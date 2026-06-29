function makeGmailMessageMock(data = {}) {
  const headers = { ...(data.headers || {}) };

  return {
    getId: jest.fn(() => data.id || 'msg_1'),
    getFrom: jest.fn(() => data.from || 'remetente@example.com'),
    getSubject: jest.fn(() => data.subject || 'Assunto'),
    getDate: jest.fn(() => data.date || new Date('2026-06-29T10:00:00.000Z')),
    getPlainBody: jest.fn(() => data.body || ''),
    getBody: jest.fn(() => data.htmlBody || data.body || ''),
    getHeader: jest.fn((name) => headers[name] || headers[name.toLowerCase()] || ''),
    getAttachments: jest.fn(() => data.attachments || []),
    isUnread: jest.fn(() => data.unread !== false),
  };
}

function makeGmailThreadMock(data = {}) {
  const messages = (data.messages || [{}]).map((message) =>
    message.getId ? message : makeGmailMessageMock(message),
  );
  const labels = new Set(data.labels || []);

  return {
    getId: jest.fn(() => data.id || 'thread_1'),
    getMessages: jest.fn(() => messages),
    getLabels: jest.fn(() => Array.from(labels).map((name) => ({ getName: () => name }))),
    getFirstMessageSubject: jest.fn(() => data.subject || messages[0].getSubject()),
    getSnippet: jest.fn(() => data.snippet || ''),
    hasStarredMessages: jest.fn(() => Boolean(data.starred)),
    isInInbox: jest.fn(() => data.inInbox !== false),
    moveToArchive: jest.fn(() => {
      labels.delete('INBOX');
      return undefined;
    }),
    moveToTrash: jest.fn(() => {
      labels.add('TRASH');
      return undefined;
    }),
    addLabel: jest.fn((label) => {
      labels.add(label.getName ? label.getName() : String(label));
      return undefined;
    }),
  };
}

function makeGmailLabelMock(name) {
  return {
    getName: jest.fn(() => name),
  };
}

function makeGmailMock(options = {}) {
  const labels = new Map();
  (options.labels || []).forEach((name) => labels.set(name, makeGmailLabelMock(name)));
  const threads = options.threads || [];

  return {
    search: jest.fn(() => threads),
    getThreadById: jest.fn((id) => threads.find((thread) => thread.getId() === id) || null),
    getUserLabelByName: jest.fn((name) => labels.get(name) || null),
    createLabel: jest.fn((name) => {
      const label = makeGmailLabelMock(name);
      labels.set(name, label);
      return label;
    }),
    createDraft: jest.fn(),
  };
}

function makeRangeMock(sheet, row, column, numRows = 1, numColumns = 1) {
  return {
    getValues: jest.fn(() =>
      sheet.rows
        .slice(row - 1, row - 1 + numRows)
        .map((line) => line.slice(column - 1, column - 1 + numColumns)),
    ),
    setValues: jest.fn((values) => {
      values.forEach((line, rowOffset) => {
        const targetRow = row - 1 + rowOffset;
        if (!sheet.rows[targetRow]) sheet.rows[targetRow] = [];
        line.forEach((value, columnOffset) => {
          sheet.rows[targetRow][column - 1 + columnOffset] = value;
        });
      });
      return undefined;
    }),
    getValue: jest.fn(() => (sheet.rows[row - 1] || [])[column - 1]),
    setValue: jest.fn((value) => {
      if (!sheet.rows[row - 1]) sheet.rows[row - 1] = [];
      sheet.rows[row - 1][column - 1] = value;
      return undefined;
    }),
  };
}

function makeSheetTabMock(name, rows = []) {
  const sheet = {
    name,
    rows: rows.map((row) => row.slice()),
    frozenRows: 0,
  };

  return {
    getName: jest.fn(() => sheet.name),
    getDataRange: jest.fn(() =>
      makeRangeMock(sheet, 1, 1, Math.max(sheet.rows.length, 1), Math.max(sheet.rows[0]?.length || 1, 1)),
    ),
    getRange: jest.fn((row, column, numRows, numColumns) =>
      makeRangeMock(sheet, row, column, numRows, numColumns),
    ),
    appendRow: jest.fn((row) => {
      sheet.rows.push(row.slice());
      return undefined;
    }),
    clear: jest.fn(() => {
      sheet.rows = [];
      return undefined;
    }),
    setFrozenRows: jest.fn((count) => {
      sheet.frozenRows = count;
      return undefined;
    }),
    __getRows: () => sheet.rows,
    __getFrozenRows: () => sheet.frozenRows,
  };
}

function makeSpreadsheetMock(tabs = {}) {
  const sheets = new Map(
    Object.entries(tabs).map(([name, rows]) => [name, makeSheetTabMock(name, rows)]),
  );

  return {
    getSheetByName: jest.fn((name) => sheets.get(name) || null),
    insertSheet: jest.fn((name) => {
      const sheet = makeSheetTabMock(name, []);
      sheets.set(name, sheet);
      return sheet;
    }),
    getSheets: jest.fn(() => Array.from(sheets.values())),
    __getSheet: (name) => sheets.get(name),
  };
}

function makeSheetMock(options = {}) {
  const activeSpreadsheet = options.spreadsheet || makeSpreadsheetMock(options.tabs || {});

  return {
    openById: jest.fn(() => activeSpreadsheet),
    getActiveSpreadsheet: jest.fn(() => activeSpreadsheet),
    __spreadsheet: activeSpreadsheet,
  };
}

function makeUrlFetchResponseMock(options = {}) {
  const statusCode = options.statusCode || 200;
  const body =
    typeof options.body === 'string' ? options.body : JSON.stringify(options.body || { ok: true });

  return {
    getResponseCode: jest.fn(() => statusCode),
    getContentText: jest.fn(() => body),
    getHeaders: jest.fn(() => options.headers || {}),
  };
}

function makeUrlFetchMock(options = {}) {
  const responses = (options.responses || [makeUrlFetchResponseMock()]).slice();

  return {
    fetch: jest.fn(() => responses.shift() || makeUrlFetchResponseMock()),
  };
}

function makePropsMock(initial = {}) {
  const store = { ...initial };
  const scriptProperties = {
    getProperty: jest.fn((key) => store[key] || null),
    setProperty: jest.fn((key, value) => {
      store[key] = String(value);
      return scriptProperties;
    }),
    setProperties: jest.fn((values) => {
      Object.entries(values).forEach(([key, value]) => {
        store[key] = String(value);
      });
      return scriptProperties;
    }),
    deleteProperty: jest.fn((key) => {
      delete store[key];
      return scriptProperties;
    }),
    getProperties: jest.fn(() => ({ ...store })),
  };

  return {
    getScriptProperties: jest.fn(() => scriptProperties),
    __store: store,
  };
}

function makeScriptAppMock(options = {}) {
  const triggers = options.triggers || [];

  return {
    getProjectTriggers: jest.fn(() => triggers),
    newTrigger: jest.fn((handlerFunction) => ({
      timeBased: jest.fn(function timeBased() {
        return this;
      }),
      atHour: jest.fn(function atHour() {
        return this;
      }),
      everyDays: jest.fn(function everyDays() {
        return this;
      }),
      nearMinute: jest.fn(function nearMinute() {
        return this;
      }),
      create: jest.fn(() => {
        const trigger = {
          getHandlerFunction: () => handlerFunction,
          getUniqueId: () => `trigger_${triggers.length + 1}`,
        };
        triggers.push(trigger);
        return trigger;
      }),
    })),
    deleteTrigger: jest.fn((trigger) => {
      const index = triggers.indexOf(trigger);
      if (index >= 0) triggers.splice(index, 1);
      return undefined;
    }),
  };
}

function makeLoggerMock() {
  return {
    log: jest.fn(),
  };
}

function makeUtilitiesMock() {
  return {
    sleep: jest.fn(),
    base64Encode: jest.fn((value) => Buffer.from(String(value)).toString('base64')),
    base64Decode: jest.fn((value) => Buffer.from(String(value), 'base64')),
    getUuid: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
  };
}

function makeContentServiceMock() {
  return {
    MimeType: {
      JSON: 'application/json',
      TEXT: 'text/plain',
    },
    createTextOutput: jest.fn((content = '') => ({
      content,
      mimeType: 'text/plain',
      setMimeType: jest.fn(function setMimeType(mimeType) {
        this.mimeType = mimeType;
        return this;
      }),
      getContent: jest.fn(function getContent() {
        return this.content;
      }),
      getMimeType: jest.fn(function getMimeType() {
        return this.mimeType;
      }),
    })),
  };
}

function installMocks(overrides = {}) {
  global.GmailApp = overrides.GmailApp || makeGmailMock(overrides.gmail || {});
  global.SpreadsheetApp = overrides.SpreadsheetApp || makeSheetMock(overrides.sheets || {});
  global.UrlFetchApp = overrides.UrlFetchApp || makeUrlFetchMock(overrides.urlFetch || {});
  global.PropertiesService =
    overrides.PropertiesService || makePropsMock(overrides.properties || {});
  global.ScriptApp = overrides.ScriptApp || makeScriptAppMock(overrides.scriptApp || {});
  global.Logger = overrides.Logger || makeLoggerMock();
  global.Utilities = overrides.Utilities || makeUtilitiesMock();
  global.ContentService = overrides.ContentService || makeContentServiceMock();

  return {
    GmailApp: global.GmailApp,
    SpreadsheetApp: global.SpreadsheetApp,
    UrlFetchApp: global.UrlFetchApp,
    PropertiesService: global.PropertiesService,
    ScriptApp: global.ScriptApp,
    Logger: global.Logger,
    Utilities: global.Utilities,
    ContentService: global.ContentService,
  };
}

function resetMocks() {
  [
    'GmailApp',
    'SpreadsheetApp',
    'UrlFetchApp',
    'PropertiesService',
    'ScriptApp',
    'Logger',
    'Utilities',
    'ContentService',
  ].forEach((key) => {
    delete global[key];
  });
}

module.exports = {
  installMocks,
  resetMocks,
  makeGmailMock,
  makeGmailThreadMock,
  makeGmailMessageMock,
  makeGmailLabelMock,
  makeSheetMock,
  makeSpreadsheetMock,
  makeSheetTabMock,
  makeUrlFetchMock,
  makeUrlFetchResponseMock,
  makePropsMock,
  makeScriptAppMock,
  makeLoggerMock,
  makeUtilitiesMock,
  makeContentServiceMock,
};
