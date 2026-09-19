import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

/**
 * Richtet für Integrationstests ein eigenes Schema in der Testdatenbank ein.
 *
 * Jeder Testlauf bekommt ein frisches Schema, sodass mehrere Dateien
 * nebeneinander laufen können, ohne sich in die Quere zu kommen. Am Ende wird
 * das Schema wieder verworfen.
 *
 * Die Verbindung kommt aus TEST_DATABASE_URL, ersatzweise aus DATABASE_URL.
 * Lokal genügt `docker compose up -d`, in CI übernimmt das der Postgres-Dienst.
 */
export function createTestDatabase(): { prisma: PrismaClient; cleanup: () => Promise<void> } {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Für die Integrationstests fehlt TEST_DATABASE_URL oder DATABASE_URL. ' +
        'Lokal hilft "docker compose up -d".',
    );
  }

  const schema = `test_${randomBytes(6).toString('hex')}`;
  const url = withSchema(base, schema);

  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  return {
    prisma,
    cleanup: async () => {
      try {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch {
        // Ein übrig gebliebenes Schema stört keinen weiteren Lauf.
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}

/** Setzt den Schema-Parameter einer Verbindungszeichenfolge. */
function withSchema(base: string, schema: string): string {
  const url = new URL(base);
  url.searchParams.set('schema', schema);
  return url.toString();
}
