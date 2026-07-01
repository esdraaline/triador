var coletorModule = {};
var planilhaModule = {};
var classificadorModule = {};
var geminiModule = {};
var configModule = {};
var telegramModule = {};
if (typeof module !== 'undefined' && module.exports) {
  coletorModule = require('./Coletor');
  planilhaModule = require('./Planilha');
  classificadorModule = require('./Classificador');
  geminiModule = require('./Gemini');
  configModule = require('./Config');
  telegramModule = require('./Telegram');
}

function getFn_(name, moduleRef) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return moduleRef[name];
}

function contaHabilitadaTriagem_(conta) {
  return conta && conta.status === 'incluida' && ['F0', 'F2'].indexOf(conta.fase) >= 0;
}

function contaHabilitadaF0_(conta) {
  return conta && conta.status === 'incluida' && conta.fase === 'F0';
}

function indexarContasPorId_(contas) {
  return (contas || []).reduce(function reduceContas(acc, conta) {
    if (conta.account_id) acc[conta.account_id] = conta;
    return acc;
  }, {});
}

function filtrarContaDoProjeto_(contas, accountId) {
  if (!accountId) return contas;
  return (contas || []).filter(function filterConta(conta) {
    return conta.account_id === accountId;
  });
}

function indexarEmailsExistentes_(emails) {
  return (emails || []).reduce(
    function reduceEmails(acc, email) {
      if (email.id_interno) acc.ids[email.id_interno] = true;
      if (email.message_id) acc.messages[email.account_id + ':' + email.message_id] = true;
      return acc;
    },
    { ids: {}, messages: {} },
  );
}

function garantirIdInternoUnico_(email, idsUsados, gerarIdFn) {
  var id = email.id_interno;
  while (!id || idsUsados[id]) {
    id = gerarIdFn();
  }
  idsUsados[id] = true;
  return Object.assign({}, email, { id_interno: id });
}

function aplicarStatusTriado_(email) {
  return Object.assign({}, email, { status: 'triado' });
}

function normalizarAcao_(acao, email) {
  if (acao === 'lixo') return 'lixeira';
  if (acao) return acao;
  if (email.categoria_sugerida === 'lixo') return 'lixeira';
  if (email.categoria_sugerida === 'importante') return 'guardar';
  return 'abrir';
}

function aplicarAcoesDisponiveis_(email) {
  var acoes = (email.acoes_disponiveis || []).map(function mapAcao(acao) {
    return normalizarAcao_(acao, email);
  });
  var acaoSugerida = normalizarAcao_(email.acao_sugerida, email);

  if (acoes.indexOf(acaoSugerida) < 0) acoes.unshift(acaoSugerida);
  if (acoes.indexOf('abrir') < 0) acoes.push('abrir');

  return Object.assign({}, email, {
    acoes_disponiveis: acoes.filter(function filterAcao(acao, index) {
      return acao && acoes.indexOf(acao) === index;
    }),
  });
}

function aplicarOrigemConta_(email, conta) {
  return Object.assign({}, email, {
    account_email: conta.email || conta.account_id,
    allow_delete: conta.allow_delete,
  });
}

function marcarEnviado_(email, telegramMsgId) {
  return Object.assign({}, email, {
    status: 'enviado',
    telegram_msg_id: telegramMsgId || '',
  });
}

function contarPorCategoria_(emails) {
  return (emails || []).reduce(function reduceCategorias(acc, email) {
    var categoria = email.categoria_sugerida || 'sem_categoria';
    acc[categoria] = (acc[categoria] || 0) + 1;
    return acc;
  }, {});
}

function executarTriagemDiaria(opcoes) {
  var opts = opcoes || {};
  var listContasFn = opts.listContasFn || getFn_('listContas', planilhaModule);
  var listRegrasFn = opts.listRegrasFn || getFn_('listRegras', planilhaModule);
  var listEmailsFn = opts.listEmailsFn || getFn_('listEmails', planilhaModule);
  var appendEmailFn = opts.appendEmailFn || getFn_('appendEmail', planilhaModule);
  var appendLogFn = opts.appendLogFn || getFn_('appendLog', planilhaModule);
  var gerarIdFn = opts.gerarIdFn || getFn_('gerarIdInterno', planilhaModule);
  var coletarContaFn = opts.coletarContaFn || getFn_('coletarConta', coletorModule);
  var classificarEmailsFn = opts.classificarEmailsFn || getFn_('classificarEmails', classificadorModule);
  var classificarComGeminiFn = opts.classificarComGeminiFn || getFn_('classificarComGemini', geminiModule);
  var getGeminiKeyFn = opts.getGeminiKeyFn || getFn_('getGeminiKey', configModule);
  var getAccountIdFn = opts.getAccountIdFn || getFn_('getAccountId', configModule);
  var getTelegramChatIdFn = opts.getTelegramChatIdFn || getFn_('getTelegramChatId', configModule);
  var enviarMensagemFn = opts.enviarMensagemFn || getFn_('enviarMensagem', telegramModule);
  var formatarResumoFn = opts.formatarResumoFn || getFn_('formatarResumo', telegramModule);
  var montarTecladoResumoFn = opts.montarTecladoResumoFn || getFn_('montarTecladoResumo', telegramModule);
  var agruparEmailsPorCategoriaFn =
    opts.agruparEmailsPorCategoriaFn || getFn_('agruparEmailsPorCategoria', telegramModule);
  var sleepFn =
    opts.sleepFn || (typeof Utilities !== 'undefined' ? Utilities.sleep : function semSleep() {});
  var nowFn = opts.nowFn || function now() {
    return new Date();
  };

  var contas = filtrarContaDoProjeto_(listContasFn().filter(contaHabilitadaTriagem_), getAccountIdFn());
  var contasById = indexarContasPorId_(contas);
  var regras = listRegrasFn();
  var existentes = indexarEmailsExistentes_(listEmailsFn());
  var resultado = {
    contas_processadas: 0,
    emails_triados: 0,
    por_categoria: {},
  };
  var classificadosTodos = [];

  contas.forEach(function processConta(conta) {
    var coletados = coletarContaFn(conta).filter(function filterDuplicados(email) {
      return !existentes.messages[email.account_id + ':' + email.message_id];
    });

    if (!coletados.length) {
      appendLogFn({
        timestamp: nowFn(),
        account_id: conta.account_id,
        id_interno: '',
        acao_sugerida: 'triagem_diaria',
        acao_executada: '',
        resultado: 'ok',
        erro: '0 emails coletados',
      });
      resultado.contas_processadas += 1;
      return;
    }

    var comIds = coletados.map(function assignId(email) {
      var withId = garantirIdInternoUnico_(email, existentes.ids, gerarIdFn);
      existentes.messages[withId.account_id + ':' + withId.message_id] = true;
      return withId;
    });
    var classificados = classificarEmailsFn(comIds, {
      conta: conta,
      contasById: contasById,
      regras: regras,
      geminiFn: function geminiInjected(emails) {
        return classificarComGeminiFn(emails, getGeminiKeyFn(), { sleepFn: sleepFn });
      },
      sleepFn: sleepFn,
      delayEntreLotesMs: opts.delayEntreLotesMs || 1500,
    })
      .map(aplicarStatusTriado_)
      .map(aplicarAcoesDisponiveis_)
      .map(function applyConta(email) {
        return aplicarOrigemConta_(email, conta);
      });

    classificados.forEach(function appendClassificado(email) {
      classificadosTodos.push(email);
    });

    var porCategoria = contarPorCategoria_(classificados);
    Object.keys(porCategoria).forEach(function mergeCategoria(categoria) {
      resultado.por_categoria[categoria] =
        (resultado.por_categoria[categoria] || 0) + porCategoria[categoria];
    });

    appendLogFn({
      timestamp: nowFn(),
      account_id: conta.account_id,
      id_interno: '',
      acao_sugerida: 'triagem_diaria',
      acao_executada: '',
      resultado: 'ok',
      erro: JSON.stringify({
        emails_triados: classificados.length,
        por_categoria: porCategoria,
      }),
    });

    resultado.contas_processadas += 1;
    resultado.emails_triados += classificados.length;
  });

  if (classificadosTodos.length) {
    var textoResumo = formatarResumoFn(
      agruparEmailsPorCategoriaFn(classificadosTodos),
      { email: String(contas.length) + ' contas' },
      nowFn(),
    );
    var tecladoResumo = montarTecladoResumoFn(classificadosTodos, contasById);
    var telegramResponse = enviarMensagemFn(getTelegramChatIdFn(), textoResumo, tecladoResumo);
    var telegramMsgId =
      telegramResponse &&
      telegramResponse.result &&
      (telegramResponse.result.message_id || telegramResponse.result.messageId);
    classificadosTodos
      .map(function markSent(email) {
        return marcarEnviado_(email, telegramMsgId);
      })
      .forEach(function appendClassificado(email) {
        appendEmailFn(email);
      });
  }

  return resultado;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    executarTriagemDiaria,
    contaHabilitadaF0_,
    contaHabilitadaTriagem_,
    indexarEmailsExistentes_,
    indexarContasPorId_,
    filtrarContaDoProjeto_,
  };
}
