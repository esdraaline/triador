var TRIADOR_CONTRACT_VERSION = '1.0.0';
var TRIADOR_STATUSES = [
  'pending',
  'running',
  'waiting_confirmation',
  'success',
  'partial',
  'failed',
  'skipped',
];
var TRIADOR_SENSITIVITIES = [
  'public',
  'personal',
  'commercial',
  'institutional',
  'institutional_sensitive',
];

function criarChaveIdempotencia(parts) {
  return (parts || [])
    .filter(function filterPart(part) {
      return part !== null && typeof part !== 'undefined' && String(part) !== '';
    })
    .map(String)
    .join(':');
}

function novoIdExecucao(automationId, nowFn, randomFn) {
  var now = (nowFn || function now() { return new Date(); })();
  var random = (randomFn || Math.random)().toString(36).slice(2, 10);
  return String(automationId || 'unknown') + ':' + now.getTime() + ':' + random;
}

function normalizarStatusExecucao_(result) {
  var status = result && result.status;
  if (TRIADOR_STATUSES.indexOf(status) >= 0) return status;
  if (result && (result.error || result.falhas)) return result.salvos || result.validados ? 'partial' : 'failed';
  return 'success';
}

function normalizarSensibilidade_(value) {
  return TRIADOR_SENSITIVITIES.indexOf(value) >= 0 ? value : 'personal';
}

function normalizarResultadoExecucao(result, options) {
  var source = Object.assign({}, result || {});
  var opts = options || {};
  var automationId = opts.automationId || 'triador';
  return Object.assign(source, {
    contract_version: TRIADOR_CONTRACT_VERSION,
    execution_id: opts.executionId || novoIdExecucao(automationId, opts.nowFn, opts.randomFn),
    automation_id: automationId,
    status: normalizarStatusExecucao_(source),
    reversible: opts.reversible !== false,
    requires_confirmation: opts.requiresConfirmation === true,
    ai_used: source.ai_used === true,
    sensitivity: normalizarSensibilidade_(opts.sensitivity),
    idempotency_key: source.idempotency_key || null,
    error: source.error || null,
  });
}

function normalizarEventoAuditoria(event, options) {
  var source = event || {};
  var opts = options || {};
  var status = TRIADOR_STATUSES.indexOf(source.status) >= 0 ? source.status : 'failed';
  return {
    contract_version: TRIADOR_CONTRACT_VERSION,
    timestamp: source.timestamp || new Date().toISOString(),
    execution_id: source.execution_id || null,
    automation_id: opts.automationId || source.automation_id || 'triador',
    event_type: source.event_type || 'action',
    status: status,
    sensitivity: normalizarSensibilidade_(source.sensitivity || opts.sensitivity),
    action: source.action || source.acao_executada || null,
    idempotency_key: source.idempotency_key || null,
    error: source.error || null,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRIADOR_CONTRACT_VERSION,
    criarChaveIdempotencia,
    novoIdExecucao,
    normalizarResultadoExecucao,
    normalizarEventoAuditoria,
  };
}
