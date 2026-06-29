var QUERY_COLETA_GMAIL = 'is:unread -label:Triado_IA newer_than:1d';
var LABEL_TRIADO_IA = 'Triado_IA';

function getHeaderSeguro_(message, name) {
  if (!message || typeof message.getHeader !== 'function') return '';
  return message.getHeader(name) || message.getHeader(String(name).toLowerCase()) || '';
}

function threadTemLabel_(thread, labelName) {
  if (!thread || typeof thread.getLabels !== 'function') return false;
  return thread.getLabels().some(function someLabel(label) {
    return label && typeof label.getName === 'function' && label.getName() === labelName;
  });
}

function messagePossuiAnexo_(message) {
  if (!message || typeof message.getAttachments !== 'function') return false;
  return message.getAttachments().length > 0;
}

function reduzirCorpo_(body, maxLength) {
  var text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength || 2000);
}

function detectarUnsubOneClick(headers) {
  var post = String((headers && headers.listUnsubscribePost) || '');
  return /list-unsubscribe\s*=\s*one-click/i.test(post);
}

function normalizarMensagemGmail(message, thread, conta) {
  var headers = {
    listUnsubscribe: getHeaderSeguro_(message, 'List-Unsubscribe'),
    listUnsubscribePost: getHeaderSeguro_(message, 'List-Unsubscribe-Post'),
  };

  return {
    id_interno: '',
    account_id: conta.account_id,
    provider: conta.provider || 'gmail',
    message_id: message.getId(),
    thread_id: thread.getId(),
    remetente: message.getFrom(),
    assunto: message.getSubject(),
    data: message.getDate(),
    snippet: typeof thread.getSnippet === 'function' ? thread.getSnippet() : '',
    corpo_reduzido: reduzirCorpo_(message.getPlainBody ? message.getPlainBody() : ''),
    possui_anexo: messagePossuiAnexo_(message),
    list_unsubscribe: headers.listUnsubscribe,
    unsub_oneclick: detectarUnsubOneClick(headers),
    categoria_sugerida: '',
    confianca: '',
    resumo: '',
    acoes_disponiveis: [],
    status: 'novo',
    acao_executada: '',
    executado_em: '',
    telegram_msg_id: '',
  };
}

function coletarConta(conta) {
  var threads = GmailApp.search(QUERY_COLETA_GMAIL);
  var emails = [];

  threads.forEach(function processThread(thread) {
    if (threadTemLabel_(thread, LABEL_TRIADO_IA)) return;

    thread.getMessages().forEach(function processMessage(message) {
      if (typeof message.isUnread === 'function' && !message.isUnread()) return;
      emails.push(normalizarMensagemGmail(message, thread, conta));
    });
  });

  return emails;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    QUERY_COLETA_GMAIL,
    coletarConta,
    normalizarMensagemGmail,
    detectarUnsubOneClick,
  };
}
