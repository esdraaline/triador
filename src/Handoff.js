var TRIADOR_HANDOFF_CONTRACT_VERSION = '1.0.0';
var TRIADOR_HANDOFF_SENSITIVITIES = [
  'public',
  'personal',
  'commercial',
  'institutional',
  'institutional_sensitive',
];

function novoHandoff(sourceAutomation, kind, reference, options) {
  var opts = options || {};
  var sensitivity = opts.sensitivity || 'personal';
  if (TRIADOR_HANDOFF_SENSITIVITIES.indexOf(sensitivity) < 0) {
    throw new Error('Sensibilidade inválida para handoff: ' + sensitivity);
  }
  if (!sourceAutomation || !kind || !reference) {
    throw new Error('sourceAutomation, kind e reference são obrigatórios');
  }
  return {
    contract_version: TRIADOR_HANDOFF_CONTRACT_VERSION,
    source_automation: sourceAutomation,
    kind: kind,
    reference: reference,
    sensitivity: sensitivity,
    requires_manual_confirmation: opts.requiresManualConfirmation !== false,
    created_at: opts.createdAt || new Date().toISOString(),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRIADOR_HANDOFF_CONTRACT_VERSION,
    novoHandoff,
  };
}
