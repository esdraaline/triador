const {
  appendEmail,
  appendLog,
  contaRowToObj,
  emailToRow,
  gerarIdInterno,
  getEmailById,
  getSheetSchemas,
  listContas,
  listEmailsByStatus,
  listRegras,
  regraRowToObj,
  rowToEmail,
  setupSheet,
  updateEmailStatus,
} = require('../src/Planilha');
const { installMocks, resetMocks } = require('./helpers/gasMocks');

describe('Planilha - mapeamento puro', () => {
  test('emailToRow e rowToEmail preservam campos do EmailItem', () => {
    const email = {
      id_interno: 'A7F92K',
      account_id: 'josemardp_gmail',
      provider: 'gmail',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      remetente: 'Jose <jose@example.com>',
      assunto: 'Boleto',
      data: new Date('2026-06-29T10:00:00.000Z'),
      snippet: 'Trecho',
      corpo_reduzido: 'Corpo reduzido',
      possui_anexo: true,
      list_unsubscribe: '<https://example.com/unsub>',
      unsub_oneclick: false,
      categoria_sugerida: 'importante',
      confianca: 'regra',
      resumo: 'Boleto recebido.',
      acoes_disponiveis: ['abrir', 'arquivar'],
      status: 'triado',
      acao_executada: '',
      executado_em: '',
      telegram_msg_id: '99',
    };

    const row = emailToRow(email);
    const parsed = rowToEmail(row);

    expect(parsed).toEqual(email);
  });

  test('gerarIdInterno usa 6 caracteres seguros sem ambiguos', () => {
    const ids = Array.from({ length: 30 }, () => gerarIdInterno());

    ids.forEach((id) => {
      expect(id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(id).not.toMatch(/[O0I1]/);
    });
  });

  test('contaRowToObj parseia booleanos e listas', () => {
    const headers = getSheetSchemas().Contas;
    const row = [
      'josemardp_gmail',
      'conta-pessoal@exemplo.com',
      'gmail',
      'incluida',
      'F0',
      'low',
      'trash_only',
      'TRUE',
      'false',
      'true',
      '',
      'banco, boleto; governo',
    ];

    expect(contaRowToObj(row, headers)).toMatchObject({
      account_id: 'josemardp_gmail',
      allow_delete: true,
      allow_unsubscribe: false,
      always_important_keywords: ['banco', 'boleto', 'governo'],
    });
  });

  test('regraRowToObj parseia ativo como booleano', () => {
    const headers = getSheetSchemas().Regras;
    const row = ['dominio', '@example.com', '*', 'arquivar', 'arquivar', 'sim'];

    expect(regraRowToObj(row, headers)).toEqual({
      tipo: 'dominio',
      valor: '@example.com',
      account_id: '*',
      categoria: 'arquivar',
      acao_default: 'arquivar',
      ativo: true,
    });
  });
});

describe('Planilha - SpreadsheetApp mockado', () => {
  afterEach(() => {
    resetMocks();
  });

  test('setupSheet cria abas com cabecalhos e congela a primeira linha', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });

    setupSheet();

    const spreadsheet = global.SpreadsheetApp.__spreadsheet;
    const schemas = getSheetSchemas();

    Object.entries(schemas).forEach(([name, headers]) => {
      const sheet = spreadsheet.__getSheet(name);
      expect(sheet).toBeDefined();
      expect(sheet.__getRows()[0]).toEqual(headers);
      expect(sheet.__getFrozenRows()).toBe(1);
    });
  });

  test('appendEmail, getEmailById e updateEmailStatus operam sobre a aba Emails', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();

    appendEmail({
      id_interno: 'A7F92K',
      account_id: 'josemardp_gmail',
      provider: 'gmail',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      remetente: 'Jose <jose@example.com>',
      assunto: 'Assunto',
      data: '2026-06-29T07:00:00-03:00',
      snippet: 'Trecho',
      possui_anexo: false,
      unsub_oneclick: false,
      categoria_sugerida: 'arquivar',
      confianca: 'regra',
      resumo: 'Resumo',
      acoes_disponiveis: ['arquivar'],
      status: 'triado',
    });

    expect(getEmailById('A7F92K')).toMatchObject({
      id_interno: 'A7F92K',
      status: 'triado',
      acoes_disponiveis: ['arquivar'],
    });

    const updated = updateEmailStatus('A7F92K', {
      status: 'executado',
      acao_executada: 'arquivar',
    });

    expect(updated.status).toBe('executado');
    expect(getEmailById('A7F92K')).toMatchObject({
      status: 'executado',
      acao_executada: 'arquivar',
    });
    expect(listEmailsByStatus('executado')).toHaveLength(1);
  });

  test('listContas, listRegras e appendLog usam as abas corretas', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();

    const spreadsheet = global.SpreadsheetApp.__spreadsheet;
    spreadsheet.__getSheet('Contas').appendRow([
      'josemardp_gmail',
      'conta-pessoal@exemplo.com',
      'gmail',
      'incluida',
      'F0',
      'low',
      'trash_only',
      true,
      false,
      true,
      '',
      'banco,boleto',
    ]);
    spreadsheet
      .__getSheet('Regras')
      .appendRow(['keyword_assunto', 'boleto', '*', 'importante', 'abrir', true]);

    appendLog({
      timestamp: '2026-06-29T07:00:00-03:00',
      account_id: 'josemardp_gmail',
      id_interno: 'A7F92K',
      acao_sugerida: 'arquivar',
      acao_executada: 'arquivar',
      resultado: 'ok',
      erro: '',
    });

    expect(listContas()).toEqual([
      expect.objectContaining({
        account_id: 'josemardp_gmail',
        always_important_keywords: ['banco', 'boleto'],
      }),
    ]);
    expect(listRegras()).toEqual([
      expect.objectContaining({
        tipo: 'keyword_assunto',
        ativo: true,
      }),
    ]);
    expect(spreadsheet.__getSheet('Log').__getRows()).toHaveLength(2);
  });
});
