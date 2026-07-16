var adminConfigModule = {};
var adminPlanilhaModule = {};
if (typeof module !== 'undefined' && module.exports) {
  adminConfigModule = require('./Config');
  adminPlanilhaModule = require('./Planilha');
}

var REQUIRED_SCRIPT_PROPERTIES = [
  'GEMINI_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'SHARED_SECRET',
  'SHEET_ID',
];
var WEB_APP_URL_PROPERTY = 'WEB_APP_URL';
var DAILY_TRIGGER_FUNCTION = 'executarTriagemDiaria';

function getAdminFn_(name, moduleRef) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
    return globalThis[name];
  }
  return moduleRef[name];
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function logAdmin_(message) {
  if (typeof Logger !== 'undefined' && Logger && typeof Logger.log === 'function') {
    Logger.log(message);
  }
}

function validarMapaPropriedades_(values) {
  var missing = REQUIRED_SCRIPT_PROPERTIES.filter(function filterMissing(key) {
    return !values || !values[key];
  });
  if (missing.length) {
    throw new Error('Script Properties ausentes para seedProperties: ' + missing.join(', '));
  }
}

function seedProperties(values) {
  validarMapaPropriedades_(values);
  props_().setProperties(values);
  logAdmin_('Script Properties gravadas: ' + REQUIRED_SCRIPT_PROPERTIES.join(', '));
  return { ok: true, keys: REQUIRED_SCRIPT_PROPERTIES.slice() };
}

function getWebAppUrl_(overrideUrl) {
  var url = overrideUrl || props_().getProperty(WEB_APP_URL_PROPERTY);
  if (!url) {
    throw new Error('Informe a URL /exec do Web App ou defina WEB_APP_URL em Script Properties');
  }
  return String(url).replace(/\?+$/, '');
}

function montarWebhookUrl(webAppUrl, sharedSecret) {
  var separator = String(webAppUrl).indexOf('?') >= 0 ? '&' : '?';
  return webAppUrl + separator + 'SHARED_SECRET=' + encodeURIComponent(sharedSecret);
}

function telegramApiUrl_(method) {
  var token = getAdminFn_('getTelegramToken', adminConfigModule)();
  return 'https://api.telegram.org/bot' + token + '/' + method;
}

function fetchTelegram_(method, payload) {
  var response = UrlFetchApp.fetch(telegramApiUrl_(method), {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
  });
  try {
    return JSON.parse(response.getContentText());
  } catch (error) {
    return { ok: false, raw: response.getContentText() };
  }
}

function setTelegramWebhook(webAppUrl) {
  var url = montarWebhookUrl(getWebAppUrl_(webAppUrl), getAdminFn_('getSharedSecret', adminConfigModule)());
  var result = fetchTelegram_('setWebhook', { url: url });
  logAdmin_('setTelegramWebhook: ' + JSON.stringify(result));
  return result;
}

function removerWebhook() {
  var result = fetchTelegram_('deleteWebhook', {});
  logAdmin_('removerWebhook: ' + JSON.stringify(result));
  return result;
}

function listarTriggers() {
  return ScriptApp.getProjectTriggers().map(function mapTrigger(trigger) {
    return {
      handlerFunction: trigger.getHandlerFunction(),
      uniqueId: typeof trigger.getUniqueId === 'function' ? trigger.getUniqueId() : '',
    };
  });
}

function createDailyTrigger() {
  var existing = ScriptApp.getProjectTriggers().some(function hasDailyTrigger(trigger) {
    return trigger.getHandlerFunction() === DAILY_TRIGGER_FUNCTION;
  });
  if (existing) {
    logAdmin_('Gatilho diario ja existe para ' + DAILY_TRIGGER_FUNCTION);
    return { ok: true, created: false };
  }

  var trigger = ScriptApp.newTrigger(DAILY_TRIGGER_FUNCTION)
    .timeBased()
    .atHour(7)
    .nearMinute(0)
    .everyDays(1)
    .create();
  logAdmin_('Gatilho diario criado para ' + DAILY_TRIGGER_FUNCTION);
  return {
    ok: true,
    created: true,
    handlerFunction: trigger.getHandlerFunction(),
  };
}

function healthCheck() {
  return {
    ok: true,
    app: 'Triador',
    contract_version: '1.0.0',
    automation_id: 'triador',
    timestamp: new Date().toISOString(),
  };
}

function jsonOutput_(statusCode, payload) {
  var body = Object.assign({ statusCode: statusCode }, payload || {});
  var output = ContentService.createTextOutput(JSON.stringify(body));
  output.setMimeType(ContentService.MimeType.JSON);
  output.statusCode = statusCode;
  return output;
}

function doGet(e) {
  var payload = healthCheck(e);
  return jsonOutput_(200, payload);
}

function setupTriadorSheet() {
  var setupSheetFn = getAdminFn_('setupSheet', adminPlanilhaModule);
  setupSheetFn();
  logAdmin_('Planilha configurada');
  return { ok: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REQUIRED_SCRIPT_PROPERTIES,
    WEB_APP_URL_PROPERTY,
    seedProperties,
    montarWebhookUrl,
    setTelegramWebhook,
    removerWebhook,
    listarTriggers,
    createDailyTrigger,
    healthCheck,
    doGet,
    setupTriadorSheet,
  };
}
