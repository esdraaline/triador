const {
  installMocks,
  resetMocks,
  makeGmailThreadMock,
  makeUrlFetchResponseMock,
} = require('./helpers/gasMocks');

describe('GAS mock harness', () => {
  afterEach(() => {
    resetMocks();
  });

  test('instala os globais esperados do Apps Script', () => {
    installMocks();

    expect(global.GmailApp).toBeDefined();
    expect(global.SpreadsheetApp).toBeDefined();
    expect(global.UrlFetchApp).toBeDefined();
    expect(global.PropertiesService).toBeDefined();
    expect(global.ScriptApp).toBeDefined();
    expect(global.Logger).toBeDefined();
    expect(global.Utilities).toBeDefined();
  });

  test('permite configurar Gmail threads e respostas UrlFetch', () => {
    const thread = makeGmailThreadMock({ id: 'thread_123' });
    const response = makeUrlFetchResponseMock({ body: { ok: true, result: 42 } });

    installMocks({
      gmail: { threads: [thread] },
      urlFetch: { responses: [response] },
    });

    expect(global.GmailApp.search('is:unread')).toEqual([thread]);
    expect(global.UrlFetchApp.fetch('https://example.com').getContentText()).toBe(
      '{"ok":true,"result":42}',
    );
  });

  test('resetMocks remove os globais instalados', () => {
    installMocks();
    resetMocks();

    expect(global.GmailApp).toBeUndefined();
    expect(global.SpreadsheetApp).toBeUndefined();
    expect(global.UrlFetchApp).toBeUndefined();
    expect(global.PropertiesService).toBeUndefined();
    expect(global.ScriptApp).toBeUndefined();
    expect(global.Logger).toBeUndefined();
    expect(global.Utilities).toBeUndefined();
  });
});
