const {
  TRIADOR_HANDOFF_CONTRACT_VERSION,
  novoHandoff,
} = require('../src/Handoff');

describe('Handoff entre projetos', () => {
  test('cria referência que exige confirmação manual', () => {
    expect(novoHandoff('triador', 'document_link', 'doc-123', {
      createdAt: '2026-07-16T12:00:00.000Z',
    })).toEqual({
      contract_version: TRIADOR_HANDOFF_CONTRACT_VERSION,
      source_automation: 'triador',
      kind: 'document_link',
      reference: 'doc-123',
      sensitivity: 'personal',
      requires_manual_confirmation: true,
      created_at: '2026-07-16T12:00:00.000Z',
    });
  });
});
