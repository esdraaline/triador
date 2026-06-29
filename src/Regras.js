function normalizarTextoRegra_(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function extrairDominioRemetente_(remetente) {
  var match = String(remetente || '').match(/@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match ? match[1].toLowerCase() : '';
}

function regraEstaAtiva_(regra) {
  return regra && regra.ativo !== false && regra.ativo !== 'false' && regra.ativo !== 'FALSE';
}

function regraValeParaConta_(regra, email, conta) {
  var accountId = regra.account_id || '*';
  var emailAccountId = email.account_id || (conta && conta.account_id);
  return accountId === '*' || accountId === emailAccountId;
}

function regraCasaRemetente_(email, valor) {
  var remetente = normalizarTextoRegra_(email.remetente);
  return remetente.indexOf(normalizarTextoRegra_(valor)) >= 0;
}

function regraCasaDominio_(email, valor) {
  var dominioEmail = extrairDominioRemetente_(email.remetente);
  var dominioRegra = normalizarTextoRegra_(valor).replace(/^@/, '');
  return Boolean(dominioRegra && dominioEmail && dominioEmail === dominioRegra);
}

function regraCasaKeywordAssunto_(email, valor) {
  return normalizarTextoRegra_(email.assunto).indexOf(normalizarTextoRegra_(valor)) >= 0;
}

function regraCasa_(email, regra) {
  if (regra.tipo === 'remetente') return regraCasaRemetente_(email, regra.valor);
  if (regra.tipo === 'dominio') return regraCasaDominio_(email, regra.valor);
  if (regra.tipo === 'keyword_assunto') return regraCasaKeywordAssunto_(email, regra.valor);
  return false;
}

function montarResultadoRegra_(categoria, acaoSugerida) {
  return {
    categoria: categoria,
    acao_sugerida: acaoSugerida || 'abrir',
    confianca: 'regra',
  };
}

function classificarPorAlwaysImportant_(email, conta) {
  var keywords = (conta && conta.always_important_keywords) || [];
  var texto = normalizarTextoRegra_(
    [email.assunto, email.snippet, email.remetente].filter(Boolean).join(' '),
  );

  for (var index = 0; index < keywords.length; index += 1) {
    var keyword = normalizarTextoRegra_(keywords[index]);
    if (keyword && texto.indexOf(keyword) >= 0) {
      return montarResultadoRegra_('importante', 'abrir');
    }
  }

  return null;
}

function classificarPorRegras(email, regras, conta) {
  var forcedImportant = classificarPorAlwaysImportant_(email || {}, conta || {});
  if (forcedImportant) return forcedImportant;

  var regrasAtivas = regras || [];
  for (var index = 0; index < regrasAtivas.length; index += 1) {
    var regra = regrasAtivas[index];
    if (!regraEstaAtiva_(regra)) continue;
    if (!regraValeParaConta_(regra, email || {}, conta || {})) continue;
    if (!regraCasa_(email || {}, regra)) continue;

    return montarResultadoRegra_(regra.categoria, regra.acao_default);
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classificarPorRegras,
  };
}
