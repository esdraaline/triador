const { arquivar } = require('../src/Executor');
const { appendEmail, getEmailById, setupSheet } = require('../src/Planilha');
const { installMocks, resetMocks, makeGmailThreadMock } = require('./helpers/gasMocks');

describe('Executor Gmail', () => {
  afterEach(() => {
    resetMocks();
  });

  test('arquivar remove da Inbox, aplica Triado_IA, atualiza fila e registra Log', () => {
    const thread = makeGmailThreadMock({ id: 'thread_1', labels: ['INBOX'] });
    installMocks({
      properties: {
        SHEET_ID: 'sheet_123',
        TELEGRAM_CHAT_ID: 'chat_1',
      },
      gmail: { threads: [thread] },
    });
    setupSheet();
    appendEmail({
      id_interno: 'A7F92K',
      account_id: 'josemardp_gmail',
      provider: 'gmail',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      assunto: 'Assunto',
      status: 'enviado',
      acao_sugerida: 'arquivar',
      telegram_msg_id: '55',
    });

    const editarMensagemFn = jest.fn();
    const resultado = arquivar(getEmailById('A7F92K'), {
      editarMensagemFn,
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      nowFn: () => '2026-06-29T08:00:00-03:00',
    });

    expect(thread.moveToArchive).toHaveBeenCalledTimes(1);
    expect(global.GmailApp.createLabel).toHaveBeenCalledWith('Triado_IA');
    expect(thread.addLabel).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({
      id_interno: 'A7F92K',
      status: 'executado',
      acao_executada: 'arquivar',
      executado_em: '2026-06-29T08:00:00-03:00',
    });
    expect(getEmailById('A7F92K')).toMatchObject({
      status: 'executado',
      acao_executada: 'arquivar',
    });
    expect(global.SpreadsheetApp.__spreadsheet.__getSheet('Log').__getRows()).toHaveLength(2);
    expect(editarMensagemFn).toHaveBeenCalledWith('chat_1', '55', '✅ Arquivado: Assunto', {
      inline_keyboard: [],
    });
  });
});
