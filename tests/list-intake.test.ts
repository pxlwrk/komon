import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { createTestDatabase } from './helpers/db';

/**
 * Prüft den Weg einer eingehenden Nachricht durch die Regeln einer
 * Gruppenmailadresse: annehmen, moderieren, freigeben, verteilen.
 */

let prisma: PrismaClient;
let cleanup: () => void;

const ids = {
  community: '',
  list: '',
  subscriber: '',
  moderator: '',
  stranger: '',
};

beforeAll(async () => {
  const database = createTestDatabase();
  prisma = database.prisma;
  cleanup = database.cleanup;

  // Die Module greifen auf den gemeinsamen Client zu, daher wird er ersetzt.
  vi.doMock('@/lib/prisma', () => ({ prisma }));

  const community = await prisma.community.create({
    data: {
      name: 'Testgemeinschaft',
      slug: 'test',
      mailDomain: 'listen.test.example',
      senderEmail: 'info@test.example',
    },
  });
  ids.community = community.id;

  const moderator = await prisma.person.create({
    data: {
      firstName: 'Mo',
      lastName: 'Derator',
      primaryEmail: 'mo@test.example',
      emailAddresses: { create: { address: 'mo@test.example', isPrimary: true } },
    },
  });
  ids.moderator = moderator.id;

  const subscriber = await prisma.person.create({
    data: {
      firstName: 'Su',
      lastName: 'Bscriber',
      primaryEmail: 'su@test.example',
      emailAddresses: {
        create: [
          { address: 'su@test.example', isPrimary: true },
          { address: 'su.privat@test.example', label: 'Privat' },
        ],
      },
    },
  });
  ids.subscriber = subscriber.id;

  const stranger = await prisma.person.create({
    data: {
      firstName: 'Fremd',
      lastName: 'Person',
      primaryEmail: 'fremd@anderswo.example',
      emailAddresses: { create: { address: 'fremd@anderswo.example', isPrimary: true } },
    },
  });
  ids.stranger = stranger.id;

  for (const personId of [moderator.id, subscriber.id]) {
    await prisma.membership.create({
      data: { communityId: community.id, personId, status: 'ACTIVE' },
    });
  }

  const list = await prisma.mailingList.create({
    data: {
      communityId: community.id,
      name: 'Austausch',
      localPart: 'austausch',
      address: 'austausch@listen.test.example',
      postingPolicy: 'SUBSCRIBERS',
      moderationPolicy: 'NON_SUBSCRIBERS',
      subjectPrefix: '[Austausch]',
      replyToMode: 'LIST',
    },
  });
  ids.list = list.id;

  await prisma.listSubscription.createMany({
    data: [
      { listId: list.id, personId: moderator.id, role: 'MODERATOR', status: 'ACTIVE' },
      { listId: list.id, personId: subscriber.id, role: 'SUBSCRIBER', status: 'ACTIVE' },
    ],
  });
});

afterAll(() => {
  cleanup();
});

describe('receiveListMessage', () => {
  it('verteilt den Beitrag einer eingetragenen Adresse', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    const result = await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'Su Bscriber <su@test.example>',
      subject: 'Wann treffen wir uns?',
      bodyText: 'Hat jemand am Donnerstag Zeit?',
      messageId: '<erste@test.example>',
    });

    expect(result.status).toBe('DISTRIBUTED');

    const stored = await prisma.listMessage.findUnique({
      where: { messageIdHeader: '<erste@test.example>' },
    });
    expect(stored?.status).toBe('DISTRIBUTED');
    expect(stored?.senderId).toBe(ids.subscriber);

    // Die verteilte Nachricht trägt Präfix, Fuß und Listenkopfzeilen.
    const distribution = await prisma.emailMessage.findFirst({
      where: { sourceListMessageId: stored?.id },
      include: { deliveries: true },
    });
    expect(distribution?.subject).toBe('[Austausch] Wann treffen wir uns?');
    expect(distribution?.bodyText).toContain('austausch@listen.test.example');
    expect(distribution?.replyTo).toBe('austausch@listen.test.example');
    expect(distribution?.headersJson).toContain('List-Id');

    // Die absendende Person bekommt keine Kopie zurück.
    const addresses = distribution?.deliveries.map((delivery) => delivery.toAddress) ?? [];
    expect(addresses).toContain('mo@test.example');
    expect(addresses).not.toContain('su@test.example');
  });

  it('erkennt eine Person auch an ihrer Zweitadresse', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    const result = await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'su.privat@test.example',
      subject: 'Von privat geschrieben',
      bodyText: 'Kurze Rückmeldung.',
      messageId: '<zweitadresse@test.example>',
    });

    expect(result.status).toBe('DISTRIBUTED');
  });

  it('legt fremde Absender der Moderation vor', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    const result = await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'fremd@anderswo.example',
      subject: 'Werbung',
      bodyText: 'Ein Angebot für Sie.',
      messageId: '<fremd@test.example>',
    });

    expect(result.status).toBe('PENDING');

    const stored = await prisma.listMessage.findUnique({
      where: { messageIdHeader: '<fremd@test.example>' },
    });
    expect(stored?.status).toBe('PENDING');
    expect(stored?.moderationReason).toBeTruthy();
  });

  it('ordnet Antworten demselben Gespräch zu', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'mo@test.example',
      subject: 'Re: [Austausch] Wann treffen wir uns?',
      bodyText: 'Donnerstag passt mir.',
      messageId: '<antwort@test.example>',
      inReplyTo: '<erste@test.example>',
    });

    const antwort = await prisma.listMessage.findUnique({
      where: { messageIdHeader: '<antwort@test.example>' },
    });
    expect(antwort?.threadId).toBe('<erste@test.example>');
  });

  it('setzt das Präfix bei einer Antwort kein zweites Mal', async () => {
    const antwort = await prisma.listMessage.findUnique({
      where: { messageIdHeader: '<antwort@test.example>' },
    });
    const distribution = await prisma.emailMessage.findFirst({
      where: { sourceListMessageId: antwort?.id },
    });
    expect(distribution?.subject).toBe('Re: [Austausch] Wann treffen wir uns?');
  });

  it('nimmt dieselbe Nachricht kein zweites Mal an', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    const result = await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'su@test.example',
      subject: 'Wann treffen wir uns?',
      bodyText: 'Hat jemand am Donnerstag Zeit?',
      messageId: '<erste@test.example>',
    });

    expect(result.status).toBe('DISTRIBUTED');
    const count = await prisma.listMessage.count({
      where: { messageIdHeader: '<erste@test.example>' },
    });
    expect(count).toBe(1);
  });

  it('meldet eine unbekannte Empfängeradresse', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    const result = await receiveListMessage({
      to: 'gibtesnicht@listen.test.example',
      from: 'su@test.example',
      subject: 'Hallo',
      bodyText: 'Text',
    });

    expect(result.status).toBe('UNKNOWN_LIST');
  });

  it('weist zu große Nachrichten ab', async () => {
    const { receiveListMessage } = await import('@/lib/mailinglist');

    await prisma.mailingList.update({
      where: { id: ids.list },
      data: { maxMessageSize: 50 },
    });

    const result = await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'su@test.example',
      subject: 'Lang',
      bodyText: 'x'.repeat(200),
      messageId: '<zugross@test.example>',
    });

    expect(result.status).toBe('REJECTED');

    await prisma.mailingList.update({
      where: { id: ids.list },
      data: { maxMessageSize: 10485760 },
    });
  });
});

describe('Moderation', () => {
  it('verteilt einen Beitrag nach der Freigabe', async () => {
    const { approveListMessage } = await import('@/lib/mailinglist');

    const pending = await prisma.listMessage.findUniqueOrThrow({
      where: { messageIdHeader: '<fremd@test.example>' },
    });

    const recipients = await approveListMessage(pending.id, ids.moderator);
    expect(recipients).toBeGreaterThan(0);

    const updated = await prisma.listMessage.findUniqueOrThrow({ where: { id: pending.id } });
    expect(updated.status).toBe('DISTRIBUTED');
    expect(updated.moderatorId).toBe(ids.moderator);
  });

  it('benachrichtigt die absendende Person bei einer Ablehnung', async () => {
    const { receiveListMessage, rejectListMessage } = await import('@/lib/mailinglist');

    await receiveListMessage({
      to: 'austausch@listen.test.example',
      from: 'fremd@anderswo.example',
      subject: 'Noch ein Angebot',
      bodyText: 'Bitte kaufen Sie etwas.',
      messageId: '<abgelehnt@test.example>',
    });

    const pending = await prisma.listMessage.findUniqueOrThrow({
      where: { messageIdHeader: '<abgelehnt@test.example>' },
    });

    await rejectListMessage(pending.id, ids.moderator, 'Passt nicht zur Liste.');

    const updated = await prisma.listMessage.findUniqueOrThrow({ where: { id: pending.id } });
    expect(updated.status).toBe('REJECTED');
    expect(updated.moderationReason).toBe('Passt nicht zur Liste.');

    const notice = await prisma.emailMessage.findFirst({
      where: { kind: 'TRANSACTIONAL', subject: { contains: 'nicht veröffentlicht' } },
      include: { deliveries: true },
    });
    expect(notice?.deliveries[0]?.toAddress).toBe('fremd@anderswo.example');
  });
});

describe('Eintragungen', () => {
  it('trägt eine Person durch die Verwaltung sofort ein', async () => {
    const { subscribePerson } = await import('@/lib/mailinglist');

    const result = await subscribePerson({
      listId: ids.list,
      personId: ids.stranger,
      byStaff: true,
    });

    expect(result.status).toBe('ACTIVE');
  });

  it('trägt eine Person wieder aus, ohne den Eintrag zu verlieren', async () => {
    const { unsubscribePerson } = await import('@/lib/mailinglist');

    await unsubscribePerson(ids.list, ids.stranger);

    const subscription = await prisma.listSubscription.findUnique({
      where: { listId_personId: { listId: ids.list, personId: ids.stranger } },
    });
    expect(subscription?.status).toBe('UNSUBSCRIBED');
    expect(subscription?.unsubscribedAt).not.toBeNull();
  });
});
