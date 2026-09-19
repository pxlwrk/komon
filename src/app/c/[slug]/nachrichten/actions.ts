'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { processMailQueue, queueEmail, renderTemplate, type Recipient } from '@/lib/mail';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

const composeSchema = z.object({
  subject: z.string().trim().min(1, 'Bitte geben Sie einen Betreff an.'),
  bodyText: z.string().trim().min(1, 'Bitte schreiben Sie einen Text.'),
  audience: z.enum(['ALL', 'GROUP', 'TAG', 'STATUS', 'SELECTION']),
  groupId: z.string().optional(),
  tagId: z.string().optional(),
  status: z.string().optional(),
  replyTo: z.string().trim().optional(),
  scheduledAt: z.string().optional(),
  mode: z.enum(['SEND', 'DRAFT', 'SCHEDULE']),
});

/**
 * Stellt die Empfaengerliste zusammen. Personen ohne Einverstaendnis fuer
 * Rundschreiben und ohne Zustellwunsch bleiben aussen vor.
 */
async function resolveRecipients(
  communityId: string,
  audience: string,
  options: { groupId?: string; tagId?: string; status?: string; membershipIds?: string[] },
): Promise<Recipient[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      communityId,
      allowBulkEmail: true,
      mailPreference: { not: 'NONE' },
      status: audience === 'STATUS' && options.status ? options.status : { in: ['ACTIVE', 'PENDING', 'PAUSED'] },
      ...(audience === 'GROUP' && options.groupId
        ? { groupMembers: { some: { groupId: options.groupId } } }
        : {}),
      ...(audience === 'TAG' && options.tagId ? { tags: { some: { tagId: options.tagId } } } : {}),
      ...(audience === 'SELECTION' && options.membershipIds
        ? { id: { in: options.membershipIds } }
        : {}),
      person: { status: 'ACTIVE' },
    },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          primaryEmail: true,
        },
      },
    },
  });

  return memberships.map((membership) => ({
    address: membership.person.primaryEmail,
    name:
      membership.person.displayName ||
      `${membership.person.firstName} ${membership.person.lastName}`.trim(),
    personId: membership.person.id,
  }));
}

/** Verfasst eine Nachricht und legt sie als Entwurf an, plant oder sendet sie. */
export async function composeMessageAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'mail.compose');

  const parsed = composeSchema.safeParse({
    subject: formData.get('subject'),
    bodyText: formData.get('bodyText'),
    audience: formData.get('audience') ?? 'ALL',
    groupId: formData.get('groupId') ?? undefined,
    tagId: formData.get('tagId') ?? undefined,
    status: formData.get('status') ?? undefined,
    replyTo: formData.get('replyTo') ?? undefined,
    scheduledAt: formData.get('scheduledAt') ?? undefined,
    mode: formData.get('mode') ?? 'DRAFT',
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  if (data.mode === 'SEND' && !context.can('mail.send')) {
    return fail('Zum Versenden fehlt Ihnen die Berechtigung. Sie können die Nachricht als Entwurf sichern.');
  }

  const membershipIds = formData
    .getAll('membershipIds')
    .filter((value): value is string => typeof value === 'string');

  const recipients = await resolveRecipients(context.community.id, data.audience, {
    groupId: data.groupId,
    tagId: data.tagId,
    status: data.status,
    membershipIds,
  });

  if (recipients.length === 0 && data.mode !== 'DRAFT') {
    return fail('Für diese Auswahl gibt es keine Empfängerinnen und Empfänger.');
  }

  let scheduledAt: Date | null = null;
  if (data.mode === 'SCHEDULE') {
    if (!data.scheduledAt) {
      return fail('Bitte geben Sie an, wann die Nachricht versendet werden soll.');
    }
    scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return fail('Der Versandzeitpunkt ist nicht lesbar.');
    }
    if (scheduledAt.getTime() < Date.now()) {
      return fail('Der Versandzeitpunkt liegt in der Vergangenheit.');
    }
  }

  let messageId: string;

  try {
    const result = await queueEmail({
      communityId: context.community.id,
      kind: 'CAMPAIGN',
      subject: data.subject,
      bodyText: data.bodyText,
      authorId: context.user.id,
      replyTo: data.replyTo || null,
      recipients,
      asDraft: data.mode === 'DRAFT',
      scheduledAt,
    });
    messageId = result.messageId;

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'mail.compose',
      entityType: 'EmailMessage',
      entityId: messageId,
      summary: `Nachricht "${data.subject}" an ${recipients.length} Empfänger ${
        data.mode === 'SEND' ? 'versendet' : data.mode === 'SCHEDULE' ? 'geplant' : 'als Entwurf gesichert'
      }`,
    });

    if (data.mode === 'SEND') {
      // Ein erster Durchlauf startet sofort, der Rest folgt ueber den Worker.
      await processMailQueue();
    }
  } catch (error) {
    return fromError(error, 'Die Nachricht konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/nachrichten`);
  redirect(`/c/${slug}/nachrichten/${messageId}`);
}

/** Gibt einen Entwurf zum Versand frei. */
export async function sendDraftAction(slug: string, messageId: string): Promise<void> {
  const context = await requirePermission(slug, 'mail.send');

  const message = await prisma.emailMessage.findFirst({
    where: { id: messageId, communityId: context.community.id },
    include: { _count: { select: { deliveries: true } } },
  });
  if (!message || message.status === 'SENT') return;
  if (message._count.deliveries === 0) return;

  await prisma.$transaction([
    prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: 'QUEUED', scheduledAt: null },
    }),
    prisma.emailDelivery.updateMany({
      where: { messageId: message.id, status: { in: ['SKIPPED', 'FAILED'] } },
      data: { status: 'QUEUED', attempts: 0, lastError: null },
    }),
  ]);

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'mail.send',
    entityType: 'EmailMessage',
    entityId: message.id,
    summary: `Nachricht "${message.subject}" freigegeben`,
  });

  await processMailQueue();

  revalidatePath(`/c/${slug}/nachrichten`);
  revalidatePath(`/c/${slug}/nachrichten/${messageId}`);
}

/** Stoesst die Warteschlange an, etwa nach einem Fehler. */
export async function processQueueAction(slug: string): Promise<void> {
  await requirePermission(slug, 'mail.send');
  await processMailQueue();
  revalidatePath(`/c/${slug}/nachrichten`);
}

export async function cancelMessageAction(slug: string, messageId: string): Promise<void> {
  const context = await requirePermission(slug, 'mail.send');

  await prisma.$transaction([
    prisma.emailMessage.updateMany({
      where: {
        id: messageId,
        communityId: context.community.id,
        status: { in: ['DRAFT', 'SCHEDULED', 'QUEUED'] },
      },
      data: { status: 'CANCELLED' },
    }),
    prisma.emailDelivery.updateMany({
      where: { messageId, status: 'QUEUED' },
      data: { status: 'SKIPPED' },
    }),
  ]);

  revalidatePath(`/c/${slug}/nachrichten/${messageId}`);
}

/** Wiederholt fehlgeschlagene Zustellungen einer Nachricht. */
export async function retryFailedAction(slug: string, messageId: string): Promise<void> {
  const context = await requirePermission(slug, 'mail.send');

  const message = await prisma.emailMessage.findFirst({
    where: { id: messageId, communityId: context.community.id },
  });
  if (!message) return;

  await prisma.$transaction([
    prisma.emailDelivery.updateMany({
      where: { messageId, status: { in: ['FAILED', 'BOUNCED'] } },
      data: { status: 'QUEUED', attempts: 0, lastError: null },
    }),
    prisma.emailMessage.update({ where: { id: messageId }, data: { status: 'QUEUED' } }),
  ]);

  await processMailQueue();
  revalidatePath(`/c/${slug}/nachrichten/${messageId}`);
}

// --- Vorlagen --------------------------------------------------------------

const templateSchema = z.object({
  name: z.string().trim().min(2, 'Bitte geben Sie einen Namen an.'),
  subject: z.string().trim().min(1, 'Bitte geben Sie einen Betreff an.'),
  bodyText: z.string().trim().min(1, 'Bitte schreiben Sie einen Text.'),
  description: z.string().trim().optional(),
});

export async function saveTemplateAction(
  slug: string,
  templateId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'mail.template.manage');

  const parsed = templateSchema.safeParse({
    name: formData.get('name'),
    subject: formData.get('subject'),
    bodyText: formData.get('bodyText'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  try {
    if (templateId) {
      await prisma.emailTemplate.updateMany({
        where: { id: templateId, communityId: context.community.id },
        data: {
          name: data.name,
          subject: data.subject,
          bodyText: data.bodyText,
          description: data.description || null,
        },
      });
    } else {
      const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vorlage';
      let key = base;
      let suffix = 2;
      while (
        await prisma.emailTemplate.findUnique({
          where: { communityId_key: { communityId: context.community.id, key } },
          select: { id: true },
        })
      ) {
        key = `${base}-${suffix}`;
        suffix += 1;
      }

      await prisma.emailTemplate.create({
        data: {
          communityId: context.community.id,
          key,
          name: data.name,
          subject: data.subject,
          bodyText: data.bodyText,
          description: data.description || null,
        },
      });
    }
  } catch (error) {
    return fromError(error, 'Die Vorlage konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/nachrichten/vorlagen`);
  return ok('Die Vorlage wurde gespeichert.');
}

export async function deleteTemplateAction(slug: string, templateId: string): Promise<void> {
  const context = await requirePermission(slug, 'mail.template.manage');
  await prisma.emailTemplate.deleteMany({
    where: { id: templateId, communityId: context.community.id, isSystem: false },
  });
  revalidatePath(`/c/${slug}/nachrichten/vorlagen`);
}

/** Erzeugt eine Vorschau mit Beispielwerten fuer die Platzhalter. */
export async function previewTemplateAction(
  subject: string,
  body: string,
): Promise<{ subject: string; body: string }> {
  const sample = {
    vorname: 'Anna',
    name: 'Anna Berger',
    email: 'anna.berger@example.org',
    antwort_link: 'https://example.org/einladung/beispiel',
    token: 'beispiel',
  };
  return {
    subject: renderTemplate(subject, sample),
    body: renderTemplate(body, sample),
  };
}
