const {
  TRIADOR_CONTRACT_VERSION,
  criarChaveIdempotencia,
  normalizarEventoAuditoria,
  normalizarResultadoExecucao,
} = require('../src/Contratos');

describe('Contratos compartilhados', () => {
  test('normaliza resultado preservando dados legados', () => {
    const result = normalizarResultadoExecucao(
      { salvos: 2, falhas: 1 },
      {
        automationId: 'baixar_documento',
        sensitivity: 'institutional',
        requiresConfirmation: true,
        reversible: true,
        executionId: 'exec-1',
      },
    );

    expect(result).toMatchObject({
      salvos: 2,
      contract_version: TRIADOR_CONTRACT_VERSION,
      execution_id: 'exec-1',
      automation_id: 'baixar_documento',
      status: 'partial',
      sensitivity: 'institutional',
      requires_confirmation: true,
    });
  });

  test('normaliza evento e cria chave de idempotência', () => {
    expect(criarChaveIdempotencia(['gmail', 'conta', 'msg-1'])).toBe('gmail:conta:msg-1');
    expect(normalizarEventoAuditoria({ status: 'success', action: 'archive' })).toMatchObject({
      contract_version: TRIADOR_CONTRACT_VERSION,
      automation_id: 'triador',
      status: 'success',
      action: 'archive',
    });
  });
});
