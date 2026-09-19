import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

/**
 * Richtet eine eigene SQLite-Datei für Integrationstests ein, damit die
 * Entwicklungsdaten unberührt bleiben.
 */
export function createTestDatabase(): { prisma: PrismaClient; cleanup: () => void } {
  const directory = mkdtempSync(path.join(tmpdir(), 'komon-test-'));
  const file = path.join(directory, 'test.db');
  const url = `file:${file}`;

  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  return {
    prisma,
    cleanup: () => {
      void prisma.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
