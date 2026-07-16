var TRIADOR_POLITICA_SENSIBILIDADES = [
  'public',
  'personal',
  'commercial',
  'institutional',
  'institutional_sensitive',
];

function sensibilidadeConta(conta) {
  var value = conta && conta.sensitivity;
  return TRIADOR_POLITICA_SENSIBILIDADES.indexOf(value) >= 0 ? value : 'personal';
}

function politicaPermiteGemini(conta) {
  var sensitivity = sensibilidadeConta(conta);
  if (sensitivity === 'institutional' || sensitivity === 'institutional_sensitive') return false;
  return Boolean(
    conta &&
      (conta.allow_ai_external === true || conta.allow_ai_external === 'true') &&
      (conta.ai_policy || 'allowed') !== 'forbidden',
  );
}

function politicaPermiteAcao(email, acao) {
  if (acao !== 'lixeira') return true;
  return !(email && email.allow_delete === false);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sensibilidadeConta,
    politicaPermiteGemini,
    politicaPermiteAcao,
  };
}
