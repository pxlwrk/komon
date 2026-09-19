import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { createTestDatabase } from './helpers/db';

/**
 * Prüft die Warteschlange des Versands: anlegen, zustellen, Zählwerte
 * fortschreiben und geplante Nachrichten zur rechten Zeit freigeben.
 */

let prisma: PrismaClient;
let cleanup: () => Promise<void>;
let storageDir: string;
let communityId: string;

beforeAll(async () => {
  storageDir = mkdtempSync(path.join(tmpdir(), 'komon-storage-'));

  // Der Versand schreibt im Testbetrieb Dateien statt echter E-Mails.
  vi.stubEnv('MAIL_TRANSPORT', 'log');
  vi.stubEnv('STORAGE_DIR', storageDir);
  vi.stubEnv('MAIL_FROM_EMAIL', 'test@komon.local');

  const database = createTestDatabase();
  prisma = database.prisma;
  cleanup = database.cleanup;

  vi.doMock('@/lib/prisma', () => ({ prisma }));

  const community = await prisma.community.create({
    data: {
      name: 'Versandtest',
      slug: 'versand',
      senderEmail: 'absender@test.example',
      senderName: 'Versandtest',
    },
  });
  communityId = community.id;
});

afterAll(async () => {
  await cleanup();
  rmSync(storageDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('queueEmail', () => {
  it('legt je Empfängerin eine Zustellung an', async () => {
    const { queueEmail } = await import('@/lib/mail');

    const result = await queueEmail({
      communityId,
      subject: 'Hallo {{vorname}}',
      bodyText: 'Guten Tag {{vorname}}, schön dass Sie da sind.',
      recipients: [
        { address: 'eine@test.example', name: 'Eine Person' },
        { address: 'zwei@test.example', name: 'Zwei Person' },
      ],
    });

    expect(result.recipientCount).toBe(2);

    const message = await prisma.emailMessage.findUniqueOrThrow({
      where: { id: result.messageId },
      include: { deliveries: true },
    });
    expect(message.status).toBe('QUEUED');
    expect(message.deliveries).toHaveLength(2);
    expect(message.fromEmail).toBe('absender@test.example');
    expect(message.bodyHtml).toContain('<p ');
  });

  it('entfernt doppelte und ungültige Adressen', async () => {
    const { queueEmail } = await import('@/lib/mail');

    const result = await queueEmail({
      communityId,
      subject: 'Test',
      bodyText: 'Text',
      recipients: [
        { address: 'Doppelt@test.example' },
        { address: 'doppelt@test.example' },
        { address: 'keine-adresse' },
      ],
    });

    expect(result.recipientCount).toBe(1);
  });

  it('hält einen Entwurf zurück', async () => {
    const { queueEmail } = await import('@/lib/mail');

    const result = await queueEmail({
      communityId,
      subject: 'Entwurf',
      bodyText: 'Noch nicht fertig.',
      recipients: [{ address: 'entwurf@test.example' }],
      asDraft: true,
    });

    const message = await prisma.emailMessage.findUniqueOrThrow({
      where: { id: result.messageId },
      include: { deliveries: true },
    });
    expect(message.status).toBe('DRAFT');
    expect(message.deliveries[0].status).toBe('SKIPPED');
  });
});

describe('processMailQueue', () => {
  it('stellt wartende Nachrichten zu und setzt die Zählwerte', async () => {
    const { processMailQueue } = await import('@/lib/mail');

    const result = await processMailQueue();
    expect(result.sent).toBeGreaterThanOrEqual(3);
    expect(result.failed).toBe(0);

    const open = await prisma.emailDelivery.count({ where: { status: 'QUEUED' } });
    expect(open).toBe(0);

    const sentMessages = await prisma.emailMessage.findMany({ where: { status: 'SENT' } });
    expect(sentMessages.length).toBeGreaterThan(0);
    for (const message of sentMessages) {
      expect(message.sentCount).toBeGreaterThan(0);
      expect(message.sentAt).not.toBeNull();
    }
  });

  it('ersetzt die Platzhalter je Empfängerin', async () => {
    const files = readdirSync(path.join(storageDir, 'outbox'));
    expect(files.length).toBeGreaterThanOrEqual(3);

    const contents = files
      .map((file) => readFileSync(path.join(storageDir, 'outbox', file), 'utf8'))
      .join('\n');

    expect(contents).toContain('Guten Tag Eine, schön dass Sie da sind.');
    expect(contents).toContain('Guten Tag Zwei, schön dass Sie da sind.');
    expect(contents).not.toContain('{{vorname}}');
  });

  it('lässt den Entwurf unangetastet', async () => {
    const draft = await prisma.emailMessage.findFirst({ where: { subject: 'Entwurf' } });
    expect(draft?.status).toBe('DRAFT');
  });

  it('gibt eine geplante Nachricht erst zur fälligen Zeit frei', async () => {
    const { processMailQueue, queueEmail } = await import('@/lib/mail');

    const future = await queueEmail({
      communityId,
      subject: 'Später',
      bodyText: 'Kommt noch.',
      recipients: [{ address: 'spaeter@test.example' }],
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await processMailQueue();
    let message = await prisma.emailMessage.findUniqueOrThrow({ where: { id: future.messageId } });
    expect(message.status).toBe('SCHEDULED');

    // Der Zeitpunkt wird in die Vergangenheit gelegt, der nächste Durchlauf sendet.
    await prisma.emailMessage.update({
      where: { id: future.messageId },
      data: { scheduledAt: new Date(Date.now() - 1000) },
    });

    await processMailQueue();
    message = await prisma.emailMessage.findUniqueOrThrow({ where: { id: future.messageId } });
    expect(message.status).toBe('SENT');
  });

  it('meldet eine leere Warteschlange ohne Arbeit', async () => {
    const { processMailQueue } = await import('@/lib/mail');
    const result = await processMailQueue();
    expect(result.processed).toBe(0);
  });
});
