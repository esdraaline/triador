const {
  createDailyTrigger,
  doGet,
  healthCheck,
  montarWebhookUrl,
  removerWebhook,
  seedProperties,
  setTelegramWebhook,
} = require('../src/Admin');
const { installMocks, resetMocks, makeUrlFetchResponseMock } = require('./helpers/gasMocks');

describe('Admin', () => {
  afterEach(() => {
    resetMocks();
  });

  test('seedProperties exige todas as chaves obrigatorias e grava no Script Properties', () => {
    installMocks();
    const values = {
      GEMINI_API_KEY: 'gemini',
      TELEGRAM_BOT_TOKEN: '1234567890:ABCToken',
      TELEGRAM_CHAT_ID: 'chat',
      SHARED_SECRET: 'secret',
      SHEET_ID: 'sheet',
    };

    expect(seedProperties(values)).toEqual({
      ok: true,
      keys: Object.keys(values),
    });
    expect(global.PropertiesService.__store).toMatchObject(values);
  });

  test('seedProperties rejeita mapa incompleto', () => {
    installMocks();

    expect(() => seedProperties({ SHEET_ID: 'sheet' })).toThrow(
      'Script Properties ausentes para seedProperties',
    );
  });

  test('montarWebhookUrl usa SHARED_SECRET como parametro', () => {
    expect(montarWebhookUrl('https://script.google.com/macros/s/abc/exec', 'segredo 1')).toBe(
      'https://script.google.com/macros/s/abc/exec?SHARED_SECRET=segredo%201',
    );
  });

  test('setTelegramWebhook chama Telegram com URL /exec e SHARED_SECRET', () => {
    installMocks({
      properties: {
        TELEGRAM_BOT_TOKEN: '1234567890:ABCToken',
        SHARED_SECRET: 'segredo',
        WEB_APP_URL: 'https://script.google.com/macros/s/abc/exec',
      },
      urlFetch: {
        responses: [makeUrlFetchResponseMock({ body: { ok: true, result: true } })],
      },
    });

    const result = setTelegramWebhook();
    const url = global.UrlFetchApp.fetch.mock.calls[0][0];
    const payload = JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload);

    expect(result).toEqual({ ok: true, result: true });
    expect(url).toBe('https://api.telegram.org/bot1234567890:ABCToken/setWebhook');
    expect(payload).toEqual({
      url: 'https://script.google.com/macros/s/abc/exec?SHARED_SECRET=segredo',
    });
  });

  test('removerWebhook chama deleteWebhook', () => {
    installMocks({
      properties: { TELEGRAM_BOT_TOKEN: '1234567890:ABCToken' },
      urlFetch: {
        responses: [makeUrlFetchResponseMock({ body: { ok: true, result: true } })],
      },
    });

    removerWebhook();

    expect(global.UrlFetchApp.fetch.mock.calls[0][0]).toBe(
      'https://api.telegram.org/bot1234567890:ABCToken/deleteWebhook',
    );
  });

  test('createDailyTrigger cria gatilho diario uma unica vez', () => {
    installMocks();

    expect(createDailyTrigger()).toMatchObject({
      ok: true,
      created: true,
      handlerFunction: 'executarTriagemDiaria',
    });
    expect(createDailyTrigger()).toEqual({ ok: true, created: false });
    expect(global.ScriptApp.getProjectTriggers()).toHaveLength(1);
  });

  test('healthCheck e doGet retornam ok', () => {
    installMocks();

    expect(healthCheck()).toMatchObject({ ok: true, app: 'Triador' });
    const response = doGet({});

    expect(response.statusCode).toBe(200);
    expect(response.getMimeType()).toBe('application/json');
    expect(JSON.parse(response.getContent())).toMatchObject({
      statusCode: 200,
      ok: true,
      app: 'Triador',
    });
  });
});
