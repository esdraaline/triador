var configModule = {};
if (typeof module !== 'undefined' && module.exports) {
  configModule = require('./Config');
}

var ID_INTERNO_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

var SHEET_SCHEMAS = {
  Contas: [
    'account_id',
    'email',
    'provider',
    'status',
    'fase',
    'risk_level',
    'delete_mode',
    'allow_delete',
    'allow_unsubscribe',
    'allow_ai_external',
    'executor_url',
    'always_important_keywords',
  ],
  Emails: [
    'id_interno',
    'account_id',
    'provider',
    'message_id',
    'thread_id',
    'remetente',
    'assunto',
    'data',
    'snippet',
    'corpo_reduzido',
    'possui_anexo',
    'list_unsubscribe',
    'unsub_oneclick',
    'categoria_sugerida',
    'confianca',
    'resumo',
    'acoes_disponiveis',
    'status',
    'acao_executada',
    'executado_em',
    'telegram_msg_id',
  ],
  Regras: ['tipo', 'valor', 'account_id', 'categoria', 'acao_default', 'ativo'],
  Log: [
    'timestamp',
    'account_id',
    'id_interno',
    'acao_sugerida',
    'acao_executada',
    'resultado',
    'erro',
  ],
};

function getConfigFunction_(name) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return configModule[name];
}

function getAbas_() {
  return getConfigFunction_('getNomesAbas')();
}

function getSheetId_() {
  return getConfigFunction_('getSheetId')();
}

function getSheetSchemas() {
  return {
    Contas: SHEET_SCHEMAS.Contas.slice(),
    Emails: SHEET_SCHEMAS.Emails.slice(),
    Regras: SHEET_SCHEMAS.Regras.slice(),
    Log: SHEET_SCHEMAS.Log.slice(),
  };
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value === null || typeof value === 'undefined') return false;

  var normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return ['true', 'sim', 's', 'yes', 'y', '1'].indexOf(normalized) >= 0;
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(String).map(trimString_).filter(Boolean);
  if (value === null || typeof value === 'undefined') return [];

  var text = String(value).trim();
  if (!text) return [];

  if (text.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).map(trimString_).filter(Boolean);
    } catch (error) {
      // Cai para o parser simples abaixo.
    }
  }

  return text.split(/[,;\n]/).map(trimString_).filter(Boolean);
}

function trimString_(value) {
  return String(value).trim();
}

function listToCell_(value) {
  if (Array.isArray(value)) return value.join(',');
  if (value === null || typeof value === 'undefined') return '';
  return value;
}

function objectToRow_(obj, headers, listFields) {
  return headers.map(function mapHeader(header) {
    if (listFields.indexOf(header) >= 0) return listToCell_(obj[header]);
    if (Object.prototype.hasOwnProperty.call(obj, header)) return obj[header];
    return '';
  });
}

function rowToObject_(row, headers) {
  return headers.reduce(function reduceRow(acc, header, index) {
    acc[header] = row[index];
    return acc;
  }, {});
}

function emailToRow(obj, headers) {
  return objectToRow_(obj || {}, headers || SHEET_SCHEMAS.Emails, ['acoes_disponiveis']);
}

function rowToEmail(row, headers) {
  var email = rowToObject_(row || [], headers || SHEET_SCHEMAS.Emails);
  email.possui_anexo = parseBoolean(email.possui_anexo);
  email.unsub_oneclick = parseBoolean(email.unsub_oneclick);
  email.acoes_disponiveis = parseList(email.acoes_disponiveis);
  return email;
}

function contaRowToObj(row, headers) {
  var conta = rowToObject_(row || [], headers || SHEET_SCHEMAS.Contas);
  conta.allow_delete = parseBoolean(conta.allow_delete);
  conta.allow_unsubscribe = parseBoolean(conta.allow_unsubscribe);
  conta.always_important_keywords = parseList(conta.always_important_keywords);
  return conta;
}

function regraRowToObj(row, headers) {
  var regra = rowToObject_(row || [], headers || SHEET_SCHEMAS.Regras);
  regra.ativo = parseBoolean(regra.ativo);
  return regra;
}

function gerarIdInterno(randomFn) {
  var random = randomFn || Math.random;
  var id = '';
  for (var index = 0; index < 6; index += 1) {
    id += ID_INTERNO_ALFABETO.charAt(Math.floor(random() * ID_INTERNO_ALFABETO.length));
  }
  return id;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSheetId_());
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function getSheetValues_(sheet) {
  return sheet.getDataRange().getValues();
}

function getHeaders_(sheet) {
  var values = getSheetValues_(sheet);
  return (values[0] || []).map(trimString_);
}

function isEmptyRow_(row) {
  return row.every(function everyCell(cell) {
    return cell === '' || cell === null || typeof cell === 'undefined';
  });
}

function ensureHeaders_(sheet, headers) {
  var currentHeaders = getHeaders_(sheet).filter(Boolean);
  var finalHeaders = currentHeaders.length ? currentHeaders.slice() : headers.slice();

  headers.forEach(function addMissingHeader(header) {
    if (finalHeaders.indexOf(header) < 0) finalHeaders.push(header);
  });

  sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  sheet.setFrozenRows(1);
}

function setupSheet() {
  var spreadsheet = getSpreadsheet_();
  var abas = getAbas_();

  ensureHeaders_(getOrCreateSheet_(spreadsheet, abas.CONTAS), SHEET_SCHEMAS.Contas);
  ensureHeaders_(getOrCreateSheet_(spreadsheet, abas.EMAILS), SHEET_SCHEMAS.Emails);
  ensureHeaders_(getOrCreateSheet_(spreadsheet, abas.REGRAS), SHEET_SCHEMAS.Regras);
  ensureHeaders_(getOrCreateSheet_(spreadsheet, abas.LOG), SHEET_SCHEMAS.Log);
}

function getSheetBySchema_(schemaName) {
  var spreadsheet = getSpreadsheet_();
  var abas = getAbas_();
  return spreadsheet.getSheetByName(abas[schemaName.toUpperCase()]);
}

function appendEmail(obj) {
  var sheet = getSheetBySchema_('Emails');
  sheet.appendRow(emailToRow(obj, getHeaders_(sheet)));
}

function appendLog(obj) {
  var sheet = getSheetBySchema_('Log');
  sheet.appendRow(objectToRow_(obj || {}, getHeaders_(sheet), []));
}

function listRows_(sheet, mapper) {
  var values = getSheetValues_(sheet);
  var headers = (values[0] || []).map(trimString_);
  return values
    .slice(1)
    .filter(function filterRows(row) {
      return !isEmptyRow_(row);
    })
    .map(function mapRows(row) {
      return mapper(row, headers);
    });
}

function listContas() {
  return listRows_(getSheetBySchema_('Contas'), contaRowToObj);
}

function listRegras() {
  return listRows_(getSheetBySchema_('Regras'), regraRowToObj);
}

function listEmailsByStatus(status) {
  return listRows_(getSheetBySchema_('Emails'), rowToEmail).filter(function filterStatus(email) {
    return email.status === status;
  });
}

function findEmailRow_(sheet, idInterno) {
  var values = getSheetValues_(sheet);
  var headers = (values[0] || []).map(trimString_);
  var idIndex = headers.indexOf('id_interno');

  if (idIndex < 0) return null;

  for (var index = 1; index < values.length; index += 1) {
    if (values[index][idIndex] === idInterno) {
      return {
        rowNumber: index + 1,
        row: values[index],
        headers: headers,
      };
    }
  }

  return null;
}

function getEmailById(idInterno) {
  var sheet = getSheetBySchema_('Emails');
  var found = findEmailRow_(sheet, idInterno);
  return found ? rowToEmail(found.row, found.headers) : null;
}

function updateEmailStatus(idInterno, patch) {
  var sheet = getSheetBySchema_('Emails');
  var found = findEmailRow_(sheet, idInterno);
  if (!found) return null;

  var updated = Object.assign({}, rowToEmail(found.row, found.headers), patch || {});
  sheet.getRange(found.rowNumber, 1, 1, found.headers.length).setValues([
    emailToRow(updated, found.headers),
  ]);
  return updated;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSheetSchemas,
    parseBoolean,
    parseList,
    emailToRow,
    rowToEmail,
    contaRowToObj,
    regraRowToObj,
    gerarIdInterno,
    setupSheet,
    appendEmail,
    updateEmailStatus,
    getEmailById,
    listEmailsByStatus,
    appendLog,
    listContas,
    listRegras,
  };
}
