var TRIADOR_ABAS = {
  CONTAS: 'Contas',
  EMAILS: 'Emails',
  REGRAS: 'Regras',
  LOG: 'Log',
};

var TRIADOR_CATEGORIAS = {
  IMPORTANTE: 'importante',
  DESCADASTRAR: 'descadastrar',
  ARQUIVAR: 'arquivar',
  LIXO: 'lixo',
};

var TRIADOR_STATUS_EMAIL = {
  NOVO: 'novo',
  TRIADO: 'triado',
  ENVIADO: 'enviado',
  EXECUTADO: 'executado',
  ERRO: 'erro',
};

var TRIADOR_LABEL_CONTROLE = 'Triado_IA';
var TRIADOR_PRIMARY_ACCOUNT_ID = 'josemardp_gmail';

function getRequiredScriptProperty_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('Script Property ausente: ' + key);
  }
  return value;
}

function getGeminiKey() {
  return getRequiredScriptProperty_('GEMINI_API_KEY');
}

function getTelegramToken() {
  return getRequiredScriptProperty_('TELEGRAM_BOT_TOKEN');
}

function getTelegramChatId() {
  return getRequiredScriptProperty_('TELEGRAM_CHAT_ID');
}

function getSharedSecret() {
  return getRequiredScriptProperty_('SHARED_SECRET');
}

function getSheetId() {
  return getRequiredScriptProperty_('SHEET_ID');
}

function getOptionalScriptProperty_(key, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value || defaultValue;
}

function getPrimaryAccountId() {
  return getOptionalScriptProperty_('PRIMARY_ACCOUNT_ID', TRIADOR_PRIMARY_ACCOUNT_ID);
}

function getAccountId() {
  return getOptionalScriptProperty_('ACCOUNT_ID', '');
}

function getNomesAbas() {
  return {
    CONTAS: TRIADOR_ABAS.CONTAS,
    EMAILS: TRIADOR_ABAS.EMAILS,
    REGRAS: TRIADOR_ABAS.REGRAS,
    LOG: TRIADOR_ABAS.LOG,
  };
}

function getCategorias() {
  return {
    IMPORTANTE: TRIADOR_CATEGORIAS.IMPORTANTE,
    DESCADASTRAR: TRIADOR_CATEGORIAS.DESCADASTRAR,
    ARQUIVAR: TRIADOR_CATEGORIAS.ARQUIVAR,
    LIXO: TRIADOR_CATEGORIAS.LIXO,
  };
}

function getStatusEmail() {
  return {
    NOVO: TRIADOR_STATUS_EMAIL.NOVO,
    TRIADO: TRIADOR_STATUS_EMAIL.TRIADO,
    ENVIADO: TRIADOR_STATUS_EMAIL.ENVIADO,
    EXECUTADO: TRIADOR_STATUS_EMAIL.EXECUTADO,
    ERRO: TRIADOR_STATUS_EMAIL.ERRO,
  };
}

function getLabelControle() {
  return TRIADOR_LABEL_CONTROLE;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGeminiKey,
    getTelegramToken,
    getTelegramChatId,
    getSharedSecret,
    getSheetId,
    getPrimaryAccountId,
    getAccountId,
    getNomesAbas,
    getCategorias,
    getStatusEmail,
    getLabelControle,
  };
}
