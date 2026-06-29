const { arquivar } = require('../src/Executor');
const { processarDoPost, parseCallback, validarSecret } = require('../src/Roteador');
const { appendEmail, getEmailById, setupSheet } = require('../src/Planilha');
const { installMocks, resetMocks, makeGmailThreadMock } = require('./helpers/gasMocks');

function makeEvent(secret, callbackData = 'arq:A7F92K') {
  return {
    parameter: { secret },
    postData: {
      contents: JSON.stringify({
        callback_query: {
          id: 'callback_1',
          data: callbackData,
          message: { message_id: 55 },
        },
      }),
    },
  };
}

function responsePayload(response) {
  if (response.getContent) return JSON.parse(response.getContent());
  return response;
}

describe('Roteador doPost', () => {
  afterEach(() => {
    resetMocks();
  });

  test('validarSecret rejeita segredo incorreto', () => {
    expect(validarSecret('errado', 'certo')).toBe(false);
    expect(validarSecret('certo', 'certo')).toBe(true);
  });

  test('parseCallback parseia arq:A7F92K', () => {
    expect(parseCallback('arq:A7F92K')).toEqual({
      acao: 'arq',
      idInterno: 'A7F92K',
    });
  });

  test('segredo invalido responde 401 e nao age', () => {
    installMocks();
    const responderCallbackFn = jest.fn();
    const despacharParaContaFn = jest.fn();

    const response = processarDoPost(makeEvent('errado'), {
      getSharedSecretFn: jest.fn(() => 'certo'),
      responderCallbackFn,
      despacharParaContaFn,
    });

    expect(response.statusCode).toBe(401);
    expect(responsePayload(response)).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(responderCallbackFn).not.toHaveBeenCalled();
    expect(despacharParaContaFn).not.toHaveBeenCalled();
  });

  test('status executado evita repeticao da acao e responde ja feito', () => {
    installMocks();
    const responderCallbackFn = jest.fn();
    const despacharParaContaFn = jest.fn();

    const response = processarDoPost(makeEvent('certo'), {
      getSharedSecretFn: jest.fn(() => 'certo'),
      getEmailByIdFn: jest.fn(() => ({ id_interno: 'A7F92K', status: 'executado' })),
      responderCallbackFn,
      despacharParaContaFn,
    });

    expect(response.statusCode).toBe(200);
    expect(responsePayload(response)).toMatchObject({ ok: true, idempotent: true });
    expect(responderCallbackFn).toHaveBeenCalledWith('callback_1', 'já feito ✅');
    expect(despacharParaContaFn).not.toHaveBeenCalled();
  });

  test('chamar callback duas vezes arquiva so uma vez', () => {
    const thread = makeGmailThreadMock({ id: 'thread_1', labels: ['INBOX'] });
    installMocks({
      properties: {
        SHEET_ID: 'sheet_123',
        SHARED_SECRET: 'certo',
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

    const responderCallbackFn = jest.fn();
    const editarMensagemFn = jest.fn();
    const deps = {
      responderCallbackFn,
      despacharParaContaFn: (conta, acao, email) => {
        if (acao !== 'arq') throw new Error('acao inesperada');
        return arquivar(email, {
          editarMensagemFn,
          getTelegramChatIdFn: jest.fn(() => 'chat_1'),
          nowFn: () => '2026-06-29T08:00:00-03:00',
        });
      },
    };

    processarDoPost(makeEvent('certo'), deps);
    processarDoPost(makeEvent('certo'), deps);

    expect(thread.moveToArchive).toHaveBeenCalledTimes(1);
    expect(getEmailById('A7F92K').status).toBe('executado');
    expect(responderCallbackFn).toHaveBeenNthCalledWith(1, 'callback_1', 'feito ✅');
    expect(responderCallbackFn).toHaveBeenNthCalledWith(2, 'callback_1', 'já feito ✅');
    expect(editarMensagemFn).toHaveBeenCalledTimes(1);
  });
});
