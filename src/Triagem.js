var coletorModule = {};
var planilhaModule = {};
var classificadorModule = {};
var geminiModule = {};
var configModule = {};
if (typeof module !== 'undefined' && module.exports) {
  coletorModule = require('./Coletor');
  planilhaModule = require('./Planilha');
  classificadorModule = require('./Classificador');
  geminiModule = require('./Gemini');
  configModule = require('./Config');
}

function getFn_(name, moduleRef) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return moduleRef[name];
}

function contaHabilitadaF0_(conta) {
  return conta && conta.status === 'incluida' && conta.fase === 'F0';
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
  var sleepFn =
    opts.sleepFn || (typeof Utilities !== 'undefined' ? Utilities.sleep : function semSleep() {});
  var nowFn = opts.nowFn || function now() {
    return new Date();
  };

  var contas = listContasFn().filter(contaHabilitadaF0_);
  var regras = listRegrasFn();
  var existentes = indexarEmailsExistentes_(listEmailsFn());
  var resultado = {
    contas_processadas: 0,
    emails_triados: 0,
    por_categoria: {},
  };

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
      regras: regras,
      geminiFn: function geminiInjected(emails) {
        return classificarComGeminiFn(emails, getGeminiKeyFn(), { sleepFn: sleepFn });
      },
      sleepFn: sleepFn,
      delayEntreLotesMs: opts.delayEntreLotesMs || 1500,
    }).map(aplicarStatusTriado_);

    classificados.forEach(function appendClassificado(email) {
      appendEmailFn(email);
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

  return resultado;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    executarTriagemDiaria,
    contaHabilitadaF0_,
    indexarEmailsExistentes_,
  };
}
