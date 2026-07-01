const { executarTriagemDiaria } = require('../src/Triagem');
const { appendEmail, getSheetSchemas, listEmails, setupSheet } = require('../src/Planilha');
const { installMocks, resetMocks } = require('./helpers/gasMocks');

function seedConta(spreadsheet, overrides = {}) {
  const conta = {
    account_id: 'josemardp_gmail',
    email: 'conta-pessoal@exemplo.com',
    provider: 'gmail',
    status: 'incluida',
    fase: 'F0',
    risk_level: 'low',
    delete_mode: 'trash_only',
    allow_delete: true,
    allow_unsubscribe: false,
    allow_ai_external: 'true',
    executor_url: '',
    always_important_keywords: 'boleto',
    ...overrides,
  };
  spreadsheet.__getSheet('Contas').appendRow(
    getSheetSchemas().Contas.map((header) =>
      Object.prototype.hasOwnProperty.call(conta, header) ? conta[header] : '',
    ),
  );
}

describe('Triagem diaria', () => {
  afterEach(() => {
    resetMocks();
  });

  test('executarTriagemDiaria envia resumo e grava emails com status enviado', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();
    seedConta(global.SpreadsheetApp.__spreadsheet);

    const coletados = [
      {
        account_id: 'josemardp_gmail',
        provider: 'gmail',
        message_id: 'msg_1',
        thread_id: 'thread_1',
        remetente: 'Banco <banco@example.com>',
        assunto: 'Boleto',
        snippet: 'Seu boleto chegou',
        possui_anexo: false,
        unsub_oneclick: false,
        status: 'novo',
      },
      {
        account_id: 'josemardp_gmail',
        provider: 'gmail',
        message_id: 'msg_2',
        thread_id: 'thread_2',
        remetente: 'News <news@example.com>',
        assunto: 'News',
        snippet: 'Novidades',
        possui_anexo: false,
        unsub_oneclick: false,
        status: 'novo',
      },
    ];
    const ids = ['A7F92K', 'B8G93L'];
    const enviarMensagemFn = jest.fn(() => ({ ok: true, result: { message_id: 123 } }));
    const resultado = executarTriagemDiaria({
      coletarContaFn: jest.fn(() => coletados),
      gerarIdFn: jest.fn(() => ids.shift()),
      getGeminiKeyFn: jest.fn(() => 'gemini_key'),
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      enviarMensagemFn,
      classificarEmailsFn: jest.fn((emails) =>
        emails.map((email) => ({
          ...email,
          categoria_sugerida: email.assunto === 'Boleto' ? 'importante' : 'arquivar',
          confianca: 'regra',
          resumo: 'Resumo',
          acao_sugerida: 'arquivar',
          acoes_disponiveis: ['arquivar'],
        })),
      ),
      nowFn: () => '2026-06-29T07:00:00-03:00',
    });

    const emails = listEmails();
    expect(resultado).toEqual({
      contas_processadas: 1,
      emails_triados: 2,
      por_categoria: { importante: 1, arquivar: 1 },
    });
    expect(emails).toHaveLength(2);
    expect(emails.map((email) => email.id_interno)).toEqual(['A7F92K', 'B8G93L']);
    expect(emails).toEqual([
      expect.objectContaining({
        message_id: 'msg_1',
        status: 'enviado',
        telegram_msg_id: 123,
        acoes_disponiveis: ['arquivar', 'abrir'],
      }),
      expect.objectContaining({
        message_id: 'msg_2',
        status: 'enviado',
        telegram_msg_id: 123,
        acoes_disponiveis: ['arquivar', 'abrir'],
      }),
    ]);
    expect(enviarMensagemFn).toHaveBeenCalledTimes(1);
    expect(global.SpreadsheetApp.__spreadsheet.__getSheet('Log').__getRows()).toHaveLength(2);
  });

  test('executarTriagemDiaria nao regrava mensagem ja presente na fila', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();
    seedConta(global.SpreadsheetApp.__spreadsheet);
    appendEmail({
      id_interno: 'A7F92K',
      account_id: 'josemardp_gmail',
      provider: 'gmail',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      status: 'triado',
    });

    executarTriagemDiaria({
      coletarContaFn: jest.fn(() => [
        {
          account_id: 'josemardp_gmail',
          provider: 'gmail',
          message_id: 'msg_1',
          thread_id: 'thread_1',
          status: 'novo',
        },
        {
          account_id: 'josemardp_gmail',
          provider: 'gmail',
          message_id: 'msg_2',
          thread_id: 'thread_2',
          status: 'novo',
        },
      ]),
      gerarIdFn: jest.fn(() => 'B8G93L'),
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      enviarMensagemFn: jest.fn(() => ({ ok: true, result: { message_id: 123 } })),
      classificarEmailsFn: jest.fn((emails) =>
        emails.map((email) => ({
          ...email,
          categoria_sugerida: 'arquivar',
          confianca: 'regra',
          resumo: 'Resumo',
          acao_sugerida: 'arquivar',
          acoes_disponiveis: ['arquivar'],
        })),
      ),
    });

    expect(listEmails().map((email) => email.message_id)).toEqual(['msg_1', 'msg_2']);
  });

  test('processa contas F2 e filtro ACCOUNT_ID limita executor a propria conta', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();
    const spreadsheet = global.SpreadsheetApp.__spreadsheet;
    seedConta(spreadsheet, { account_id: 'josemardp_gmail', fase: 'F0' });
    seedConta(spreadsheet, {
      account_id: 'esdraaline_gmail',
      email: 'conta-secundaria@exemplo.com',
      fase: 'F2',
    });
    const coletarContaFn = jest.fn(() => []);

    const resultado = executarTriagemDiaria({
      coletarContaFn,
      getAccountIdFn: jest.fn(() => 'esdraaline_gmail'),
    });

    expect(coletarContaFn).toHaveBeenCalledTimes(1);
    expect(coletarContaFn.mock.calls[0][0]).toMatchObject({ account_id: 'esdraaline_gmail' });
    expect(resultado.contas_processadas).toBe(1);
  });

  test('multi-conta envia um resumo unico e nao chama Gemini para conta cautela', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();
    const spreadsheet = global.SpreadsheetApp.__spreadsheet;
    seedConta(spreadsheet, { account_id: 'josemardp_gmail', email: 'conta-pessoal@exemplo.com' });
    seedConta(spreadsheet, {
      account_id: 'conta-comercial_gmail',
      email: 'conta-comercial@exemplo.com',
      fase: 'F2',
      allow_ai_external: 'cautela',
      allow_delete: false,
    });

    const classificarComGeminiFn = jest.fn((emails) =>
      emails.map((email) => ({
        id: email.id_interno,
        categoria: 'arquivar',
        confianca: 'alta',
        resumo: 'Pode arquivar.',
        acao_sugerida: 'arquivar',
      })),
    );
    const enviarMensagemFn = jest.fn(() => ({ ok: true, result: { message_id: 123 } }));
    const montarTecladoResumoFn = jest.fn(() => ({ inline_keyboard: [] }));
    const ids = ['A7F92K', 'B8G93L'];

    const resultado = executarTriagemDiaria({
      coletarContaFn: jest.fn((conta) => [
        {
          account_id: conta.account_id,
          provider: 'gmail',
          message_id: `msg_${conta.account_id}`,
          thread_id: `thread_${conta.account_id}`,
          remetente: 'Pessoa <pessoa@example.com>',
          assunto: 'Mensagem ambigua',
          snippet: 'Trecho',
          status: 'novo',
        },
      ]),
      gerarIdFn: jest.fn(() => ids.shift()),
      getGeminiKeyFn: jest.fn(() => 'gemini_key'),
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      enviarMensagemFn,
      montarTecladoResumoFn,
      classificarComGeminiFn,
      nowFn: () => '2026-07-01T07:00:00-03:00',
      delayEntreLotesMs: 0,
    });

    const emails = listEmails();
    expect(resultado).toMatchObject({ contas_processadas: 2, emails_triados: 2 });
    expect(enviarMensagemFn).toHaveBeenCalledTimes(1);
    expect(classificarComGeminiFn).toHaveBeenCalledTimes(1);
    expect(classificarComGeminiFn.mock.calls[0][0]).toHaveLength(1);
    expect(classificarComGeminiFn.mock.calls[0][0][0].account_id).toBe('josemardp_gmail');
    expect(emails).toEqual([
      expect.objectContaining({ account_id: 'josemardp_gmail', status: 'enviado' }),
      expect.objectContaining({
        account_id: 'conta-comercial_gmail',
        status: 'enviado',
        confianca: 'baixa',
        acoes_disponiveis: ['abrir'],
      }),
    ]);
    expect(montarTecladoResumoFn.mock.calls[0][1]).toMatchObject({
      josemardp_gmail: expect.objectContaining({ allow_delete: true }),
      conta-comercial_gmail: expect.objectContaining({ allow_delete: false }),
    });
  });
});
