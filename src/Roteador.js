var roteadorPlanilhaModule = {};
var roteadorExecutorModule = {};
var roteadorTelegramModule = {};
var roteadorConfigModule = {};
if (typeof module !== 'undefined' && module.exports) {
  roteadorPlanilhaModule = require('./Planilha');
  roteadorExecutorModule = require('./Executor');
  roteadorTelegramModule = require('./Telegram');
  roteadorConfigModule = require('./Config');
}

function getRoteadorFn_(name, moduleRef) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return moduleRef[name];
}

function validarSecret(recebido, esperado) {
  return Boolean(recebido && esperado && recebido === esperado);
}

function parseCallback(data) {
  var parts = String(data || '').split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('callback_data invalido');
  }
  return {
    acao: parts[0],
    idInterno: parts[1],
  };
}

function parseTelegramUpdate_(event) {
  if (!event || !event.postData || !event.postData.contents) return {};
  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    return {};
  }
}

function obterSecretRecebido_(event) {
  var params = (event && event.parameter) || {};
  return params.SHARED_SECRET || params.shared_secret || params.secret || '';
}

function criarRespostaJson_(statusCode, body) {
  var payload = Object.assign({ statusCode: statusCode }, body || {});
  if (typeof ContentService === 'undefined') return payload;

  var output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  output.statusCode = statusCode;
  return output;
}

function despacharParaConta(conta, acao, email, deps) {
  var options = deps || {};
  var acoes = {
    arq: options.arquivarFn || getRoteadorFn_('arquivar', roteadorExecutorModule),
    lix: options.moverParaLixeiraFn || getRoteadorFn_('moverParaLixeira', roteadorExecutorModule),
    imp: options.guardarImportanteFn || getRoteadorFn_('guardarImportante', roteadorExecutorModule),
    rev: options.marcarCienteFn || getRoteadorFn_('marcarCiente', roteadorExecutorModule),
  };
  var executar = acoes[acao];
  if (executar) return executar(email);
  throw new Error('Acao nao suportada: ' + acao + ' / ' + (conta && conta.account_id));
}

function processarDoPost(event, deps) {
  var options = deps || {};
  var getSharedSecretFn =
    options.getSharedSecretFn || getRoteadorFn_('getSharedSecret', roteadorConfigModule);
  var getEmailByIdFn = options.getEmailByIdFn || getRoteadorFn_('getEmailById', roteadorPlanilhaModule);
  var responderCallbackFn =
    options.responderCallbackFn || getRoteadorFn_('responderCallback', roteadorTelegramModule);
  var despacharParaContaFn = options.despacharParaContaFn || despacharParaConta;

  if (!validarSecret(obterSecretRecebido_(event), getSharedSecretFn())) {
    return criarRespostaJson_(401, { ok: false, error: 'unauthorized' });
  }

  var update = parseTelegramUpdate_(event);
  var callback = update.callback_query;
  if (!callback) return criarRespostaJson_(200, { ok: true, ignored: true });

  var parsed = parseCallback(callback.data);
  var email = getEmailByIdFn(parsed.idInterno);
  if (!email) {
    responderCallbackFn(callback.id, 'Email nao encontrado');
    return criarRespostaJson_(404, { ok: false, error: 'email_not_found' });
  }

  if (email.status === 'executado') {
    responderCallbackFn(callback.id, 'já feito ✅');
    return criarRespostaJson_(200, { ok: true, idempotent: true });
  }

  var resultado = despacharParaContaFn({ account_id: email.account_id }, parsed.acao, email, options);
  responderCallbackFn(callback.id, 'feito ✅');
  return criarRespostaJson_(200, { ok: true, result: resultado });
}

function doPost(e) {
  return processarDoPost(e);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    doPost,
    processarDoPost,
    parseCallback,
    validarSecret,
    despacharParaConta,
  };
}
