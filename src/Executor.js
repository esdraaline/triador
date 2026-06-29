var executorPlanilhaModule = {};
var executorTelegramModule = {};
var executorConfigModule = {};
if (typeof module !== 'undefined' && module.exports) {
  executorPlanilhaModule = require('./Planilha');
  executorTelegramModule = require('./Telegram');
  executorConfigModule = require('./Config');
}

function getExecutorFn_(name, moduleRef) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return moduleRef[name];
}

function obterOuCriarLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function arquivarThreadGmail_(threadId, labelName) {
  var thread = GmailApp.getThreadById(threadId);
  if (!thread) throw new Error('Thread Gmail nao encontrada: ' + threadId);

  var label = obterOuCriarLabel_(labelName);
  thread.moveToArchive();
  thread.addLabel(label);
  return thread;
}

function mensagemSucessoArquivar_(email) {
  return '✅ Arquivado: ' + (email.assunto || email.id_interno);
}

function arquivar(email, opcoes) {
  var opts = opcoes || {};
  var updateEmailStatusFn =
    opts.updateEmailStatusFn || getExecutorFn_('updateEmailStatus', executorPlanilhaModule);
  var appendLogFn = opts.appendLogFn || getExecutorFn_('appendLog', executorPlanilhaModule);
  var editarMensagemFn = opts.editarMensagemFn || getExecutorFn_('editarMensagem', executorTelegramModule);
  var getTelegramChatIdFn =
    opts.getTelegramChatIdFn || getExecutorFn_('getTelegramChatId', executorConfigModule);
  var getLabelControleFn = opts.getLabelControleFn || getExecutorFn_('getLabelControle', executorConfigModule);
  var nowFn = opts.nowFn || function now() {
    return new Date();
  };
  var labelName = getLabelControleFn();

  arquivarThreadGmail_(email.thread_id, labelName);

  var executadoEm = nowFn();
  var atualizado = updateEmailStatusFn(email.id_interno, {
    status: 'executado',
    acao_executada: 'arquivar',
    executado_em: executadoEm,
  });

  appendLogFn({
    timestamp: executadoEm,
    account_id: email.account_id,
    id_interno: email.id_interno,
    acao_sugerida: email.acao_sugerida || 'arquivar',
    acao_executada: 'arquivar',
    resultado: 'ok',
    erro: '',
  });

  if (email.telegram_msg_id) {
    editarMensagemFn(getTelegramChatIdFn(), email.telegram_msg_id, mensagemSucessoArquivar_(email), {
      inline_keyboard: [],
    });
  }

  return atualizado || Object.assign({}, email, {
    status: 'executado',
    acao_executada: 'arquivar',
    executado_em: executadoEm,
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    arquivar,
    arquivarThreadGmail_,
  };
}
