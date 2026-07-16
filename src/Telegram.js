var telegramConfigModule = {};
var telegramPoliticasModule = {};
if (typeof module !== 'undefined' && module.exports) {
  telegramConfigModule = require('./Config');
  telegramPoliticasModule = require('./Politicas');
}

var TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
var TELEGRAM_ACOES = {
  arquivar: { texto: 'Arquivar', prefixo: 'arq' },
  abrir: { texto: 'Abrir', prefixo: 'abr' },
  lixeira: { texto: 'Excluir', prefixo: 'lix' },
  guardar: { texto: 'Guardar', prefixo: 'imp' },
  ciente: { texto: 'Ciente', prefixo: 'rev' },
  rascunho: { texto: 'Responder', prefixo: 'dft' },
  descadastrar: { texto: 'Descadastrar', prefixo: 'uns' },
};

var CATEGORIAS_RESUMO = [
  { chave: 'importante', titulo: '🔴 IMPORTANTES' },
  { chave: 'descadastrar', titulo: '🟡 DESCADASTRAR' },
  { chave: 'arquivar', titulo: '⚪ ARQUIVAR' },
  { chave: 'lixo', titulo: '🗑 LIXO' },
];

function getTelegramConfigFn_(name) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return telegramConfigModule[name];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarDataResumo_(data) {
  var date = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(date.getTime())) return String(data || '');

  var day = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year = String(date.getFullYear());
  return day + '/' + month + '/' + year;
}

function nomeRemetente_(remetente) {
  var value = String(remetente || '').trim();
  var match = value.match(/^"?([^"<]+)"?\s*</);
  return (match ? match[1] : value).trim();
}

function agruparEmailsPorCategoria(emails) {
  return (emails || []).reduce(function reduceCategorias(acc, email) {
    var categoria = email.categoria_sugerida || 'arquivar';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(email);
    return acc;
  }, {});
}

function formatarLinhaEmail_(email, index) {
  var remetente = nomeRemetente_(email.remetente) || email.account_id || 'Email';
  var assunto = email.assunto || '(sem assunto)';
  var resumo = email.resumo || email.snippet || '(sem resumo)';
  var origem = email.account_email || email.conta_email || email.account_id || '';
  var linhas = [
    String(index + 1) + '. <b>' + escapeHtml(remetente) + '</b> - ' + escapeHtml(assunto),
  ];
  if (origem) linhas.push('   Conta: ' + escapeHtml(origem));
  linhas.push('   Resumo: ' + escapeHtml(resumo));
  return linhas.join('\n');
}

function formatarResumo(emailsPorCategoria, conta, data) {
  var linhas = [
    '📬 <b>TRIAGEM</b> - ' +
      escapeHtml(formatarDataResumo_(data)) +
      ' - ' +
      escapeHtml(conta.email || conta.account_id),
    '',
  ];

  CATEGORIAS_RESUMO.forEach(function appendCategoria(categoria) {
    var emails = (emailsPorCategoria && emailsPorCategoria[categoria.chave]) || [];
    if (!emails.length) return;

    linhas.push('<b>' + categoria.titulo + ' - ' + emails.length + '</b>');
    emails.forEach(function appendEmail(email, index) {
      linhas.push(formatarLinhaEmail_(email, index));
    });
    linhas.push('');
  });

  return linhas.join('\n').trim();
}

function callbackData_(acao, idInterno) {
  var definition = TELEGRAM_ACOES[acao];
  if (!definition) throw new Error('Acao Telegram desconhecida: ' + acao);

  var data = definition.prefixo + ':' + idInterno;
  if (callbackByteLength_(data) > 64) {
    throw new Error('callback_data excede 64 bytes: ' + data);
  }
  return data;
}

function callbackByteLength_(value) {
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(value, 'utf8');
  if (typeof Utilities !== 'undefined' && Utilities.newBlob) {
    return Utilities.newBlob(value).getBytes().length;
  }
  return String(value).length;
}

function politicaPermiteAcao_(email, politica, acao) {
  var fn =
    typeof globalThis !== 'undefined' && typeof globalThis.politicaPermiteAcao === 'function'
      ? globalThis.politicaPermiteAcao
      : telegramPoliticasModule.politicaPermiteAcao;
  if (!fn(email, acao)) return false;
  if (acao !== 'lixeira') return true;
  if (email && email.allow_delete === false) return false;
  if (politica && politica.allow_delete === false) return false;
  return true;
}

function politicaDoEmail_(email, politicas) {
  if (!politicas || typeof politicas === 'function') return politicas;
  if (politicas[email.account_id]) return politicas[email.account_id];
  return politicas;
}

function montarTeclado(email, politica) {
  var acoes = email.acoes_disponiveis || [];
  var buttons = acoes.filter(function filterAcao(acao) {
    return politicaPermiteAcao_(email, politica, acao);
  }).map(function mapAcao(acao) {
    var definition = TELEGRAM_ACOES[acao];
    if (!definition) throw new Error('Acao Telegram desconhecida: ' + acao);
    return {
      text: definition.texto,
      callback_data: callbackData_(acao, email.id_interno),
    };
  });

  return {
    inline_keyboard: buttons.map(function eachButton(button) {
      return [button];
    }),
  };
}

function montarTecladoResumo(emails, politicas) {
  var rows = [];
  (emails || []).forEach(function appendEmailButtons(email) {
    var resolver = politicaDoEmail_(email, politicas);
    var politica = typeof resolver === 'function' ? resolver(email) : resolver;
    var teclado = montarTeclado(email, politica);
    teclado.inline_keyboard.forEach(function appendRow(row) {
      rows.push(row);
    });
  });
  return { inline_keyboard: rows };
}

function parseTelegramResponse_(response) {
  var text = response.getContentText();
  try {
    return JSON.parse(text);
  } catch (error) {
    return { ok: false, error: 'Resposta Telegram invalida', raw: text };
  }
}

function telegramFetch_(method, payload) {
  var token = getTelegramConfigFn_('getTelegramToken')();
  var response = UrlFetchApp.fetch(TELEGRAM_API_BASE + token + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
  });
  return parseTelegramResponse_(response);
}

function enviarMensagem(chatId, texto, teclado) {
  return telegramFetch_('sendMessage', {
    chat_id: chatId,
    text: texto,
    parse_mode: 'HTML',
    reply_markup: teclado || { inline_keyboard: [] },
  });
}

function editarMensagem(chatId, msgId, texto, teclado) {
  return telegramFetch_('editMessageText', {
    chat_id: chatId,
    message_id: msgId,
    text: texto,
    parse_mode: 'HTML',
    reply_markup: teclado || { inline_keyboard: [] },
  });
}

function responderCallback(callbackQueryId, texto) {
  return telegramFetch_('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: texto || '',
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    agruparEmailsPorCategoria,
    formatarResumo,
    montarTeclado,
    montarTecladoResumo,
    enviarMensagem,
    editarMensagem,
    responderCallback,
  };
}
