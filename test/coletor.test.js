const {
  QUERY_COLETA_GMAIL,
  coletarConta,
  detectarUnsubOneClick,
  normalizarMensagemGmail,
} = require('../src/Coletor');
const {
  installMocks,
  resetMocks,
  makeGmailMessageMock,
  makeGmailThreadMock,
} = require('./helpers/gasMocks');

describe('Coletor Gmail', () => {
  afterEach(() => {
    resetMocks();
  });

  test('coletarConta busca unread sem Triado_IA e ignora thread ja rotulada', () => {
    const conta = { account_id: 'josemardp_gmail', provider: 'gmail' };
    const threads = [
      makeGmailThreadMock({
        id: 'thread_1',
        snippet: 'Trecho 1',
        messages: [{ id: 'msg_1', subject: 'Email 1' }],
      }),
      makeGmailThreadMock({
        id: 'thread_2',
        snippet: 'Trecho 2',
        messages: [{ id: 'msg_2', subject: 'Email 2' }],
      }),
      makeGmailThreadMock({
        id: 'thread_3',
        labels: ['Triado_IA'],
        messages: [{ id: 'msg_3', subject: 'Ja triado' }],
      }),
    ];
    installMocks({ gmail: { threads } });

    const emails = coletarConta(conta);

    expect(global.GmailApp.search).toHaveBeenCalledWith(QUERY_COLETA_GMAIL);
    expect(emails).toHaveLength(2);
    expect(emails.map((email) => email.message_id)).toEqual(['msg_1', 'msg_2']);
  });

  test('normalizarMensagemGmail extrai headers de unsubscribe e anexos', () => {
    const message = makeGmailMessageMock({
      id: 'msg_1',
      from: 'Loja <promo@example.com>',
      subject: 'Oferta',
      body: 'Texto do email',
      attachments: [{ name: 'boleto.pdf' }],
      headers: {
        'List-Unsubscribe': '<https://example.com/unsub>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    const thread = makeGmailThreadMock({
      id: 'thread_1',
      snippet: 'Oferta imperdivel',
      messages: [message],
    });

    expect(normalizarMensagemGmail(message, thread, { account_id: 'josemardp_gmail' })).toMatchObject({
      account_id: 'josemardp_gmail',
      provider: 'gmail',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      remetente: 'Loja <promo@example.com>',
      assunto: 'Oferta',
      snippet: 'Oferta imperdivel',
      corpo_reduzido: 'Texto do email',
      possui_anexo: true,
      list_unsubscribe: '<https://example.com/unsub>',
      unsub_oneclick: true,
      status: 'novo',
    });
  });

  test('detectarUnsubOneClick reconhece RFC 8058', () => {
    expect(
      detectarUnsubOneClick({ listUnsubscribePost: 'List-Unsubscribe=One-Click' }),
    ).toBe(true);
    expect(detectarUnsubOneClick({ listUnsubscribePost: '' })).toBe(false);
  });
});
