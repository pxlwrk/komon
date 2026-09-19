/**
 * Dauerhafter Versand-Worker.
 *
 * Start mit `npm run mail:worker`. Der Worker arbeitet die Warteschlange in
 * festen Abstaenden ab, gibt faellige geplante Nachrichten frei und raeumt
 * abgelaufene Sitzungen auf. Fuer kleine Installationen genuegt der Versand
 * direkt aus der Oberflaeche, der Worker sorgt fuer grosse Verteiler.
 */

import { pruneExpiredSessions } from '../src/lib/maintenance';
import { processMailQueue } from '../src/lib/mail';
import { prisma } from '../src/lib/prisma';

const INTERVAL_MS = Number.parseInt(process.env.MAIL_WORKER_INTERVAL_MS ?? '15000', 10);

let running = true;

async function tick(): Promise<void> {
  try {
    const result = await processMailQueue();
    if (result.processed > 0) {
      console.log(
        `[${new Date().toISOString()}] ${result.processed} Zustellungen bearbeitet, ` +
          `${result.sent} zugestellt, ${result.failed} endgültig fehlgeschlagen.`,
      );
    }
  } catch (error) {
    console.error('Fehler beim Versand', error);
  }
}

async function hourlyCleanup(): Promise<void> {
  try {
    const removed = await pruneExpiredSessions();
    if (removed > 0) {
      console.log(`${removed} abgelaufene Sitzungen entfernt.`);
    }
  } catch (error) {
    console.error('Fehler beim Aufräumen', error);
  }
}

async function main(): Promise<void> {
  console.log(`Versand-Worker gestartet, Intervall ${INTERVAL_MS} ms.`);

  const cleanup = setInterval(hourlyCleanup, 60 * 60 * 1000);

  const stop = async (signal: string) => {
    console.log(`\n${signal} empfangen, Worker wird beendet.`);
    running = false;
    clearInterval(cleanup);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));

  await hourlyCleanup();

  while (running) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

void main();
