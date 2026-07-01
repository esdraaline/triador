const { arquivar, guardarImportante, marcarCiente, moverParaLixeira } = require('../src/Executor');
const { appendEmail, getEmailById, setupSheet } = require('../src/Planilha');
const { installMocks, resetMocks, makeGmailThreadMock } = require('./helpers/gasMocks');

describe('Executor Gmail', () => {
  afterEach(() => {
    delete global.Gmail;
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

  test('moverParaLixeira usa moveToTrash recuperavel, nunca exclusao permanente', () => {
    const thread = makeGmailThreadMock({ id: 'thread_1', labels: ['INBOX'] });
    installMocks({
      properties: {
        SHEET_ID: 'sheet_123',
        TELEGRAM_CHAT_ID: 'chat_1',
      },
      gmail: { threads: [thread] },
    });
    global.Gmail = {
      Users: {
        Messages: {
          remove: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    setupSheet();
    appendEmail({
      id_interno: 'A7F92K',
      account_id: 'josemardp_gmail',
      provider: 'gmail',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      assunto: 'Assunto',
      status: 'enviado',
      acao_sugerida: 'lixeira',
      telegram_msg_id: '55',
    });

    const editarMensagemFn = jest.fn();
    const resultado = moverParaLixeira(getEmailById('A7F92K'), {
      editarMensagemFn,
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      nowFn: () => '2026-07-01T08:00:00-03:00',
    });

    expect(thread.moveToTrash).toHaveBeenCalledTimes(1);
    expect(global.Gmail.Users.Messages.remove).not.toHaveBeenCalled();
    expect(global.Gmail.Users.Messages.delete).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      status: 'executado',
      acao_executada: 'lixeira',
      executado_em: '2026-07-01T08:00:00-03:00',
    });
    expect(getEmailById('A7F92K')).toMatchObject({
      status: 'executado',
      acao_executada: 'lixeira',
    });
    expect(global.SpreadsheetApp.__spreadsheet.__getSheet('Log').__getRows()[1]).toEqual(
      expect.arrayContaining(['lixeira', 'ok']),
    );
    expect(editarMensagemFn).toHaveBeenCalledWith(
      'chat_1',
      '55',
      '✅ Movido para lixeira: Assunto',
      { inline_keyboard: [] },
    );
  });

  test('guardarImportante aplica Importante, atualiza status e registra Log', () => {
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
      acao_sugerida: 'guardar',
      telegram_msg_id: '55',
    });

    const editarMensagemFn = jest.fn();
    const resultado = guardarImportante(getEmailById('A7F92K'), {
      editarMensagemFn,
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      nowFn: () => '2026-07-01T08:00:00-03:00',
    });

    expect(global.GmailApp.createLabel).toHaveBeenCalledWith('Triado_IA');
    expect(global.GmailApp.createLabel).toHaveBeenCalledWith('Importante');
    expect(thread.addLabel).toHaveBeenCalledTimes(2);
    expect(resultado).toMatchObject({
      status: 'executado',
      acao_executada: 'guardar',
    });
    expect(getEmailById('A7F92K')).toMatchObject({
      status: 'executado',
      acao_executada: 'guardar',
    });
    expect(global.SpreadsheetApp.__spreadsheet.__getSheet('Log').__getRows()[1]).toEqual(
      expect.arrayContaining(['guardar', 'ok']),
    );
    expect(editarMensagemFn).toHaveBeenCalledWith(
      'chat_1',
      '55',
      '✅ Guardado como importante: Assunto',
      { inline_keyboard: [] },
    );
  });

  test('marcarCiente aplica Triado_IA sem mover, atualiza status e registra Log', () => {
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
      acao_sugerida: 'ciente',
      telegram_msg_id: '55',
    });

    const editarMensagemFn = jest.fn();
    const resultado = marcarCiente(getEmailById('A7F92K'), {
      editarMensagemFn,
      getTelegramChatIdFn: jest.fn(() => 'chat_1'),
      nowFn: () => '2026-07-01T08:00:00-03:00',
    });

    expect(thread.moveToArchive).not.toHaveBeenCalled();
    expect(thread.moveToTrash).not.toHaveBeenCalled();
    expect(thread.addLabel).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({
      status: 'executado',
      acao_executada: 'ciente',
    });
    expect(getEmailById('A7F92K')).toMatchObject({
      status: 'executado',
      acao_executada: 'ciente',
    });
    expect(global.SpreadsheetApp.__spreadsheet.__getSheet('Log').__getRows()[1]).toEqual(
      expect.arrayContaining(['ciente', 'ok']),
    );
    expect(editarMensagemFn).toHaveBeenCalledWith('chat_1', '55', '✅ Ciente: Assunto', {
      inline_keyboard: [],
    });
  });
});
