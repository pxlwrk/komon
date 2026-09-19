/**
 * Spielt die Beispieldaten ein, wenn die Datenbank noch leer ist.
 *
 * Gedacht für eine Testinstallation auf einer Plattform wie Vercel, deren
 * Datenbank von außen nicht erreichbar ist. Der Aufruf hängt im Build und
 * greift nur unter zwei Bedingungen:
 *
 *   1. SEED_DEMO_DATA ist auf "true" gesetzt
 *   2. Es gibt noch keine einzige Community
 *
 * Die zweite Bedingung sorgt dafür, dass ein erneutes Deployment vorhandene
 * Daten unangetastet lässt. Wer neu aufsetzen möchte, leert die Datenbank.
 */

import { seed, seedPrisma } from '../prisma/seed';

async function main(): Promise<void> {
  if (process.env.SEED_DEMO_DATA?.trim().toLowerCase() !== 'true') {
    console.log('SEED_DEMO_DATA ist nicht gesetzt, es werden keine Beispieldaten angelegt.');
    return;
  }

  const vorhandene = await seedPrisma.community.count();
  if (vorhandene > 0) {
    console.log(
      `Die Datenbank enthält bereits ${vorhandene} Communities. Die Beispieldaten bleiben aus.`,
    );
    return;
  }

  console.log('Die Datenbank ist leer, die Beispieldaten werden eingespielt.');
  await seed();
}

main()
  .catch((error) => {
    console.error('Die Beispieldaten konnten nicht eingespielt werden:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await seedPrisma.$disconnect();
  });
