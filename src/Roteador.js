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

function montarUrlExecutor_(executorUrl, sharedSecret) {
  var separator = String(executorUrl).indexOf('?') >= 0 ? '&' : '?';
  return executorUrl + separator + 'SHARED_SECRET=' + encodeURIComponent(sharedSecret);
}

function parseExecutorResponse_(response) {
  var text = response && typeof response.getContentText === 'function' ? response.getContentText() : '';
  try {
    return JSON.parse(text);
  } catch (error) {
    return { ok: false, raw: text };
  }
}

function obterContaDoEmail_(email, contas) {
  var accountId = email && email.account_id;
  return (
    (contas || []).find(function findConta(conta) {
      return conta.account_id === accountId;
    }) || { account_id: accountId }
  );
}

function chamarExecutorRemoto_(conta, acao, email, sharedSecret) {
  if (!conta.executor_url) {
    throw new Error('executor_url ausente para conta: ' + conta.account_id);
  }

  var response = UrlFetchApp.fetch(montarUrlExecutor_(conta.executor_url, sharedSecret), {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      acao: acao,
      email: email,
    }),
  });
  return parseExecutorResponse_(response);
}

function despacharParaConta(conta, acao, email, deps) {
  var options = deps || {};
  var getPrimaryAccountIdFn =
    options.getPrimaryAccountIdFn || getRoteadorFn_('getPrimaryAccountId', roteadorConfigModule);
  var getSharedSecretFn =
    options.getSharedSecretFn || getRoteadorFn_('getSharedSecret', roteadorConfigModule);
  var primaryAccountId = getPrimaryAccountIdFn();

  if (conta && conta.account_id && conta.account_id !== primaryAccountId) {
    return chamarExecutorRemoto_(conta, acao, email, getSharedSecretFn());
  }

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
  var listContasFn = options.listContasFn || getRoteadorFn_('listContas', roteadorPlanilhaModule);
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

  var conta = obterContaDoEmail_(email, listContasFn());
  var resultado = despacharParaContaFn(conta, parsed.acao, email, options);
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
    montarUrlExecutor_,
    parseExecutorResponse_,
  };
}
