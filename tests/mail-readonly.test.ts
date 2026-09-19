import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { createTestDatabase } from './helpers/db';

/**
 * Auf serverlosen Plattformen ist das Dateisystem schreibgeschützt. Der
 * Versandweg "log" legt dort keine Datei mehr an, muss die Nachricht aber
 * trotzdem als zugestellt verbuchen: Der belastbare Nachweis steht in der
 * Datenbank, die Datei ist nur eine Bequemlichkeit für die Entwicklung.
 */

let prisma: PrismaClient;
let cleanup: () => Promise<void>;
let communityId: string;

beforeAll(async () => {
  vi.stubEnv('MAIL_TRANSPORT', 'log');

  // Das Dateisystem verhält sich wie auf einer schreibgeschützten Plattform.
  vi.doMock('node:fs/promises', async () => {
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const readOnly = () => {
      const error = new Error('EROFS: read-only file system') as NodeJS.ErrnoException;
      error.code = 'EROFS';
      return Promise.reject(error);
    };
    return { ...actual, mkdir: vi.fn(readOnly), writeFile: vi.fn(readOnly) };
  });

  const database = createTestDatabase();
  prisma = database.prisma;
  cleanup = database.cleanup;

  vi.doMock('@/lib/prisma', () => ({ prisma }));

  const community = await prisma.community.create({
    data: { name: 'Schreibgeschützt', slug: 'readonly', senderEmail: 'absender@test.example' },
  });
  communityId = community.id;
});

afterAll(async () => {
  await cleanup();
  vi.unstubAllEnvs();
  vi.doUnmock('node:fs/promises');
});

describe('Versand ohne beschreibbares Dateisystem', () => {
  it('stellt die Nachricht trotzdem zu', async () => {
    const { processMailQueue, queueEmail } = await import('@/lib/mail');

    const { messageId } = await queueEmail({
      communityId,
      subject: 'Geht auch ohne Datei',
      bodyText: 'Der Nachweis steht in der Datenbank.',
      recipients: [{ address: 'empfang@test.example', name: 'Empfang' }],
    });

    const result = await processMailQueue();
    expect(result.failed).toBe(0);
    expect(result.sent).toBe(1);

    const message = await prisma.emailMessage.findUniqueOrThrow({
      where: { id: messageId },
      include: { deliveries: true },
    });

    expect(message.status).toBe('SENT');
    expect(message.deliveries[0].status).toBe('SENT');
    expect(message.deliveries[0].lastError).toBeNull();
    expect(message.deliveries[0].providerId).toMatch(/^log-/);
  });
});
