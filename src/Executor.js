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

function obterThreadGmail_(threadId) {
  var thread = GmailApp.getThreadById(threadId);
  if (!thread) throw new Error('Thread Gmail nao encontrada: ' + threadId);
  return thread;
}

function aplicarLabel_(thread, labelName) {
  var label = obterOuCriarLabel_(labelName);
  thread.addLabel(label);
  return label;
}

function arquivarThreadGmail_(threadId, labelName) {
  var thread = obterThreadGmail_(threadId);

  thread.moveToArchive();
  aplicarLabel_(thread, labelName);
  return thread;
}

function moverThreadParaLixeiraGmail_(threadId, labelName) {
  var thread = obterThreadGmail_(threadId);

  aplicarLabel_(thread, labelName);
  thread.moveToTrash();
  return thread;
}

function guardarThreadImportanteGmail_(threadId, labelName) {
  var thread = obterThreadGmail_(threadId);

  aplicarLabel_(thread, labelName);
  aplicarLabel_(thread, 'Importante');
  return thread;
}

function marcarThreadCienteGmail_(threadId, labelName) {
  var thread = obterThreadGmail_(threadId);

  aplicarLabel_(thread, labelName);
  return thread;
}

function mensagemSucesso_(email, texto) {
  return '✅ ' + texto + ': ' + (email.assunto || email.id_interno);
}

function executarAcao_(email, acaoExecutada, textoSucesso, executarGmailFn, opcoes) {
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

  executarGmailFn(email.thread_id, labelName);

  var executadoEm = nowFn();
  var atualizado = updateEmailStatusFn(email.id_interno, {
    status: 'executado',
    acao_executada: acaoExecutada,
    executado_em: executadoEm,
  });

  appendLogFn({
    timestamp: executadoEm,
    account_id: email.account_id,
    id_interno: email.id_interno,
    acao_sugerida: email.acao_sugerida || acaoExecutada,
    acao_executada: acaoExecutada,
    resultado: 'ok',
    erro: '',
  });

  if (email.telegram_msg_id) {
    editarMensagemFn(getTelegramChatIdFn(), email.telegram_msg_id, mensagemSucesso_(email, textoSucesso), {
      inline_keyboard: [],
    });
  }

  return atualizado || Object.assign({}, email, {
    status: 'executado',
    acao_executada: acaoExecutada,
    executado_em: executadoEm,
  });
}

function arquivar(email, opcoes) {
  return executarAcao_(email, 'arquivar', 'Arquivado', arquivarThreadGmail_, opcoes);
}

function moverParaLixeira(email, opcoes) {
  return executarAcao_(email, 'lixeira', 'Movido para lixeira', moverThreadParaLixeiraGmail_, opcoes);
}

function guardarImportante(email, opcoes) {
  return executarAcao_(email, 'guardar', 'Guardado como importante', guardarThreadImportanteGmail_, opcoes);
}

function marcarCiente(email, opcoes) {
  return executarAcao_(email, 'ciente', 'Ciente', marcarThreadCienteGmail_, opcoes);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    arquivar,
    moverParaLixeira,
    guardarImportante,
    marcarCiente,
    arquivarThreadGmail_,
    moverThreadParaLixeiraGmail_,
    guardarThreadImportanteGmail_,
    marcarThreadCienteGmail_,
  };
}
