var regrasModule = {};
if (typeof module !== 'undefined' && module.exports) {
  regrasModule = require('./Regras');
}

var TAMANHO_LOTE_GEMINI = 30;

function getRegrasFunction_() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.classificarPorRegras === 'function') {
    return globalThis.classificarPorRegras;
  }
  return regrasModule.classificarPorRegras;
}

function contaDoEmail_(email, contexto) {
  var ctx = contexto || {};
  if (ctx.contasById && ctx.contasById[email.account_id]) return ctx.contasById[email.account_id];
  return ctx.conta || {};
}

function politicaPermiteGemini_(conta) {
  return conta && conta.allow_ai_external === true;
}

function montarAcoesDisponiveis_(resultado) {
  var acao = resultado.acao_sugerida || 'abrir';
  return [acao];
}

function aplicarResultado_(email, resultado) {
  return Object.assign({}, email, {
    categoria_sugerida: resultado.categoria,
    confianca: resultado.confianca,
    resumo: resultado.resumo || email.resumo || '',
    acao_sugerida: resultado.acao_sugerida || 'abrir',
    acoes_disponiveis: montarAcoesDisponiveis_(resultado),
  });
}

function resultadoRevisaoManual_() {
  return {
    categoria: 'importante',
    confianca: 'baixa',
    resumo: 'Revisar manualmente.',
    acao_sugerida: 'abrir',
  };
}

function dividirEmLotes_(items, tamanho) {
  var lotes = [];
  for (var index = 0; index < items.length; index += tamanho) {
    lotes.push(items.slice(index, index + tamanho));
  }
  return lotes;
}

function indexarResultadosGemini_(resultados) {
  return (resultados || []).reduce(function reduceResultados(acc, resultado) {
    if (resultado && resultado.id) acc[resultado.id] = resultado;
    return acc;
  }, {});
}

function classificarEmails(emails, contexto) {
  var ctx = contexto || {};
  var regras = ctx.regras || [];
  var historicoFn = ctx.historicoFn || function semHistorico() {
    return null;
  };
  var geminiFn = ctx.geminiFn;
  var sleepFn = ctx.sleepFn || function semDelay() {};
  var delayEntreLotesMs = ctx.delayEntreLotesMs || 0;
  var classificarPorRegrasFn = ctx.classificarPorRegrasFn || getRegrasFunction_();
  var classificados = new Array((emails || []).length);
  var ambiguosPermitidos = [];

  (emails || []).forEach(function classifyEmail(email, emailIndex) {
    var conta = contaDoEmail_(email, ctx);
    var porRegra = classificarPorRegrasFn(email, regras, conta);
    if (porRegra) {
      classificados[emailIndex] = aplicarResultado_(email, porRegra);
      return;
    }

    var porHistorico = historicoFn(email, conta);
    if (porHistorico) {
      classificados[emailIndex] = aplicarResultado_(email, porHistorico);
      return;
    }

    if (!politicaPermiteGemini_(conta)) {
      classificados[emailIndex] = aplicarResultado_(email, resultadoRevisaoManual_());
      return;
    }

    ambiguosPermitidos.push({ email: email, conta: conta, index: emailIndex });
  });

  if (ambiguosPermitidos.length && typeof geminiFn !== 'function') {
    throw new Error('geminiFn e obrigatoria para emails ambiguos permitidos');
  }

  var lotes = dividirEmLotes_(ambiguosPermitidos, TAMANHO_LOTE_GEMINI);
  lotes.forEach(function classifyBatch(lote, loteIndex) {
    var batchEmails = lote.map(function mapLote(item) {
      return item.email;
    });
    var resultados = indexarResultadosGemini_(geminiFn(batchEmails));

    lote.forEach(function appendGeminiResult(item) {
      classificados[item.index] = aplicarResultado_(
        item.email,
        resultados[item.email.id_interno] || resultadoRevisaoManual_(),
      );
    });

    if (delayEntreLotesMs > 0 && loteIndex < lotes.length - 1) {
      sleepFn(delayEntreLotesMs);
    }
  });

  return classificados;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classificarEmails,
  };
}
