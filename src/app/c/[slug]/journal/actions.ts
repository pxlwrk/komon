'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import {
  journalChannelValues,
  journalStatusValues,
  journalTypeValues,
  journalVisibilityValues,
} from '@/lib/enums';

const entrySchema = z.object({
  title: z.string().trim().min(2, 'Bitte geben Sie einen Titel an.'),
  summary: z.string().trim().optional(),
  content: z.string().optional(),
  type: z.enum(journalTypeValues).default('NOTE'),
  status: z.enum(journalStatusValues).default('DRAFT'),
  channel: z.enum(journalChannelValues).default('INTERNAL'),
  visibility: z.enum(journalVisibilityValues).default('COMMUNITY'),
  plannedAt: z.string().trim().optional(),
  eventId: z.string().trim().optional(),
  tags: z.string().trim().optional(),
});

function readForm(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? '');
  return {
    title: value('title'),
    summary: value('summary'),
    content: value('content'),
    type: value('type') || 'NOTE',
    status: value('status') || 'DRAFT',
    channel: value('channel') || 'INTERNAL',
    visibility: value('visibility') || 'COMMUNITY',
    plannedAt: value('plannedAt'),
    eventId: value('eventId'),
    tags: value('tags'),
  };
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Legt die Schlagworte eines Eintrags neu fest. */
async function syncTags(communityId: string, entryId: string, raw: string | undefined) {
  const names = Array.from(
    new Set(
      (raw ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  const tagIds: string[] = [];
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { communityId_name: { communityId, name } },
      create: { communityId, name },
      update: {},
    });
    tagIds.push(tag.id);
  }

  await prisma.journalEntryTag.deleteMany({ where: { entryId } });
  if (tagIds.length > 0) {
    await prisma.journalEntryTag.createMany({
      data: tagIds.map((tagId) => ({ entryId, tagId })),
    });
  }
}

export async function createJournalEntryAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'journal.write');

  const parsed = entrySchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  if (data.status === 'PUBLISHED' && !context.can('journal.publish')) {
    return fail('Zum Veröffentlichen fehlt Ihnen die Berechtigung. Speichern Sie den Eintrag als Entwurf.');
  }

  const base = slugify(data.title) || 'eintrag';
  let entrySlug = base;
  let suffix = 2;
  while (
    await prisma.journalEntry.findUnique({
      where: { communityId_slug: { communityId: context.community.id, slug: entrySlug } },
      select: { id: true },
    })
  ) {
    entrySlug = `${base}-${suffix}`;
    suffix += 1;
  }

  let entryId: string;

  try {
    const entry = await prisma.journalEntry.create({
      data: {
        communityId: context.community.id,
        title: data.title,
        slug: entrySlug,
        summary: data.summary || null,
        content: data.content ?? '',
        type: data.type,
        status: data.status,
        channel: data.channel,
        visibility: data.visibility,
        plannedAt: toDate(data.plannedAt),
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        authorId: context.user.id,
        eventId: data.eventId || null,
      },
    });
    entryId = entry.id;

    await syncTags(context.community.id, entry.id, data.tags);

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'journal.create',
      entityType: 'JournalEntry',
      entityId: entry.id,
      summary: `Journaleintrag "${entry.title}" angelegt`,
    });
  } catch (error) {
    return fromError(error, 'Der Eintrag konnte nicht angelegt werden.');
  }

  revalidatePath(`/c/${slug}/journal`);
  redirect(`/c/${slug}/journal/${entryId}`);
}

export async function updateJournalEntryAction(
  slug: string,
  entryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'journal.write');

  const parsed = entrySchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  const existing = await prisma.journalEntry.findFirst({
    where: { id: entryId, communityId: context.community.id },
  });
  if (!existing) return fail('Der Eintrag wurde nicht gefunden.');

  if (data.status === 'PUBLISHED' && !context.can('journal.publish')) {
    return fail('Zum Veröffentlichen fehlt Ihnen die Berechtigung.');
  }

  try {
    await prisma.journalEntry.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        summary: data.summary || null,
        content: data.content ?? '',
        type: data.type,
        status: data.status,
        channel: data.channel,
        visibility: data.visibility,
        plannedAt: toDate(data.plannedAt),
        publishedAt:
          data.status === 'PUBLISHED' ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
        eventId: data.eventId || null,
      },
    });

    await syncTags(context.community.id, existing.id, data.tags);
  } catch (error) {
    return fromError(error, 'Der Eintrag konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/journal`);
  revalidatePath(`/c/${slug}/journal/${entryId}`);
  return ok('Der Eintrag wurde gespeichert.');
}

export async function setJournalStatusAction(
  slug: string,
  entryId: string,
  status: string,
): Promise<void> {
  const context = await requirePermission(slug, 'journal.write');
  if (!journalStatusValues.includes(status as never)) return;
  if (status === 'PUBLISHED' && !context.can('journal.publish')) return;

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, communityId: context.community.id },
    select: { id: true, publishedAt: true },
  });
  if (!entry) return;

  await prisma.journalEntry.update({
    where: { id: entry.id },
    data: {
      status,
      publishedAt: status === 'PUBLISHED' ? (entry.publishedAt ?? new Date()) : entry.publishedAt,
    },
  });

  revalidatePath(`/c/${slug}/journal`);
  revalidatePath(`/c/${slug}/journal/${entryId}`);
}

export async function deleteJournalEntryAction(slug: string, entryId: string): Promise<void> {
  const context = await requirePermission(slug, 'journal.write');

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, communityId: context.community.id },
    select: { id: true, title: true, authorId: true },
  });
  if (!entry) return;

  // Fremde Eintraege darf nur die Redaktionsleitung entfernen.
  if (entry.authorId !== context.user.id && !context.can('journal.publish')) return;

  await prisma.journalEntry.delete({ where: { id: entry.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'journal.delete',
    entityType: 'JournalEntry',
    entityId: entry.id,
    summary: `Journaleintrag "${entry.title}" gelöscht`,
  });

  revalidatePath(`/c/${slug}/journal`);
  redirect(`/c/${slug}/journal`);
}

export async function addCommentAction(
  slug: string,
  entryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'journal.view');

  const body = String(formData.get('body') ?? '').trim();
  if (!body) return fail('Bitte schreiben Sie einen Kommentar.');

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, communityId: context.community.id },
    select: { id: true },
  });
  if (!entry) return fail('Der Eintrag wurde nicht gefunden.');

  await prisma.journalComment.create({
    data: { entryId: entry.id, authorId: context.user.id, body },
  });

  revalidatePath(`/c/${slug}/journal/${entryId}`);
  return ok('Ihr Kommentar wurde gespeichert.');
}

export async function deleteCommentAction(
  slug: string,
  entryId: string,
  commentId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'journal.view');

  const comment = await prisma.journalComment.findFirst({
    where: { id: commentId, entry: { id: entryId, communityId: context.community.id } },
    select: { id: true, authorId: true },
  });
  if (!comment) return;
  if (comment.authorId !== context.user.id && !context.can('journal.publish')) return;

  await prisma.journalComment.delete({ where: { id: comment.id } });
  revalidatePath(`/c/${slug}/journal/${entryId}`);
}

/** Uebernimmt einen Journaleintrag als Rundschreiben in den Entwurfsordner. */
export async function toNewsletterAction(slug: string, entryId: string): Promise<void> {
  const context = await requirePermission(slug, 'mail.compose');

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, communityId: context.community.id },
  });
  if (!entry) return;

  redirect(
    `/c/${slug}/nachrichten/neu?betreff=${encodeURIComponent(entry.title)}&text=${encodeURIComponent(
      [entry.summary, entry.content].filter(Boolean).join('\n\n'),
    )}`,
  );
}
