import { prisma } from '@/lib/prisma';

/**
 * Entfernt abgelaufene Sitzungen. Liegt bewusst ausserhalb von auth.ts, damit
 * der Worker die Funktion ohne die Server-Umgebung von Next nutzen kann.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
