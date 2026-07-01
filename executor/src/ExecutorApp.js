var executorAppConfigModule = {};
var executorAppPlanilhaModule = {};
var executorAppExecutorModule = {};
if (typeof module !== 'undefined' && module.exports) {
  executorAppConfigModule = require('../../src/Config');
  executorAppPlanilhaModule = require('../../src/Planilha');
  executorAppExecutorModule = require('../../src/Executor');
}

function getExecutorAppFn_(name, moduleRef) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return moduleRef[name];
}

function criarRespostaExecutorJson_(statusCode, body) {
  var payload = Object.assign({ statusCode: statusCode }, body || {});
  if (typeof ContentService === 'undefined') return payload;

  var output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  output.statusCode = statusCode;
  return output;
}

function obterSecretExecutorRecebido_(event) {
  var params = (event && event.parameter) || {};
  return params.SHARED_SECRET || params.shared_secret || params.secret || '';
}

function parseExecutorPayload_(event) {
  if (!event || !event.postData || !event.postData.contents) return {};
  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    return {};
  }
}

function executarAcaoExecutor_(acao, email, options) {
  var opts = options || {};
  var acoes = {
    arq: opts.arquivarFn || getExecutorAppFn_('arquivar', executorAppExecutorModule),
    lix: opts.moverParaLixeiraFn || getExecutorAppFn_('moverParaLixeira', executorAppExecutorModule),
    imp: opts.guardarImportanteFn || getExecutorAppFn_('guardarImportante', executorAppExecutorModule),
    rev: opts.marcarCienteFn || getExecutorAppFn_('marcarCiente', executorAppExecutorModule),
  };
  var executar = acoes[acao];
  if (!executar) throw new Error('Acao nao suportada no executor: ' + acao);
  return executar(email);
}

function processarExecutorDoPost(event, deps) {
  var options = deps || {};
  var getSharedSecretFn =
    options.getSharedSecretFn || getExecutorAppFn_('getSharedSecret', executorAppConfigModule);
  var getEmailByIdFn =
    options.getEmailByIdFn || getExecutorAppFn_('getEmailById', executorAppPlanilhaModule);

  if (obterSecretExecutorRecebido_(event) !== getSharedSecretFn()) {
    return criarRespostaExecutorJson_(401, { ok: false, error: 'unauthorized' });
  }

  var payload = parseExecutorPayload_(event);
  if (!payload.acao || !payload.email || !payload.email.id_interno) {
    return criarRespostaExecutorJson_(400, { ok: false, error: 'payload_invalido' });
  }

  var emailAtual = getEmailByIdFn(payload.email.id_interno) || payload.email;
  if (emailAtual.status === 'executado') {
    return criarRespostaExecutorJson_(200, { ok: true, idempotent: true });
  }

  var resultado = executarAcaoExecutor_(payload.acao, emailAtual, options);
  return criarRespostaExecutorJson_(200, { ok: true, result: resultado });
}

function doPost(e) {
  return processarExecutorDoPost(e);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    doPost,
    processarExecutorDoPost,
    parseExecutorPayload_,
  };
}
