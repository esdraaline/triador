const { executarTriagemDiaria } = require('../src/Triagem');
const { appendEmail, getSheetSchemas, listEmails, setupSheet } = require('../src/Planilha');
const { installMocks, resetMocks } = require('./helpers/gasMocks');

function seedConta(spreadsheet) {
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
    'true',
    '',
    'boleto',
  ]);
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

  test('ignora contas fora do F0', () => {
    installMocks({ properties: { SHEET_ID: 'sheet_123' } });
    setupSheet();
    const spreadsheet = global.SpreadsheetApp.__spreadsheet;
    spreadsheet.__getSheet('Contas').appendRow(
      getSheetSchemas().Contas.map((header) => {
        if (header === 'account_id') return 'futura';
        if (header === 'status') return 'incluida';
        if (header === 'fase') return 'F2';
        if (header === 'provider') return 'gmail';
        return '';
      }),
    );
    const coletarContaFn = jest.fn(() => []);

    const resultado = executarTriagemDiaria({ coletarContaFn });

    expect(coletarContaFn).not.toHaveBeenCalled();
    expect(resultado.contas_processadas).toBe(0);
  });
});
