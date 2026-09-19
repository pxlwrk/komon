import { prisma } from '@/lib/prisma';

type AuditInput = {
  communityId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: unknown;
  ipAddress?: string | null;
};

/**
 * Schreibt einen Protokolleintrag. Fehler beim Protokollieren duerfen den
 * eigentlichen Vorgang nicht abbrechen.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        communityId: input.communityId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        meta: input.meta === undefined ? null : JSON.stringify(input.meta),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error('Protokolleintrag konnte nicht gespeichert werden', error);
  }
}
