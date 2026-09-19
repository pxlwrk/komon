/**
 * Einstiegspunkt für `npm run db:seed`.
 *
 * Bewusst getrennt von prisma/seed.ts: Das Modul dort soll sich importieren
 * lassen, ohne dabei etwas zu tun. Sonst legt schon ein Import Daten an.
 */

import { seed, seedPrisma } from './seed';

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await seedPrisma.$disconnect();
  });
