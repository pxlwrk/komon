'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { normalizeEmail, processMailQueue } from '@/lib/mail';
import {
  approveListMessage,
  rejectListMessage,
  receiveListMessage,
  subscribePerson,
  syncListWithGroup,
  unsubscribePerson,
} from '@/lib/mailinglist';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import {
  archivePolicyValues,
  listTypeValues,
  moderationPolicyValues,
  postingPolicyValues,
  replyToModeValues,
  subscriptionPolicyValues,
} from '@/lib/enums';

const listSchema = z.object({
  name: z.string().trim().min(2, 'Bitte geben Sie einen Namen an.'),
  localPart: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/, 'Erlaubt sind Kleinbuchstaben, Ziffern, Punkt, Bindestrich und Unterstrich.'),
  description: z.string().trim().optional(),
  listType: z.enum(listTypeValues),
  postingPolicy: z.enum(postingPolicyValues),
  moderationPolicy: z.enum(moderationPolicyValues),
  subscriptionPolicy: z.enum(subscriptionPolicyValues),
  replyToMode: z.enum(replyToModeValues),
  archivePolicy: z.enum(archivePolicyValues),
  subjectPrefix: z.string().trim().optional(),
  footerText: z.string().trim().optional(),
  autoSubscribeGroupId: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});

function readListForm(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? '');
  return {
    name: value('name'),
    localPart: value('localPart'),
    description: value('description'),
    listType: value('listType') || 'DISCUSSION',
    postingPolicy: value('postingPolicy') || 'SUBSCRIBERS',
    moderationPolicy: value('moderationPolicy') || 'NON_SUBSCRIBERS',
    subscriptionPolicy: value('subscriptionPolicy') || 'APPROVAL',
    replyToMode: value('replyToMode') || 'LIST',
    archivePolicy: value('archivePolicy') || 'SUBSCRIBERS',
    subjectPrefix: value('subjectPrefix'),
    footerText: value('footerText'),
    autoSubscribeGroupId: value('autoSubscribeGroupId'),
    isActive: formData.get('isActive') !== null,
  };
}

/** Legt eine Gruppenmailadresse an. */
export async function createListAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'list.manage');

  const raw = readListForm(formData);
  if (!raw.localPart) raw.localPart = slugify(raw.name);

  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const community = await prisma.community.findUniqueOrThrow({
    where: { id: context.community.id },
    select: { mailDomain: true },
  });

  if (!community.mailDomain) {
    return fail(
      'Für diese Community ist noch keine Domain für Gruppenmailadressen hinterlegt. Bitte ergänzen Sie sie in den Einstellungen.',
    );
  }

  const data = parsed.data;
  const address = normalizeEmail(`${data.localPart}@${community.mailDomain}`);

  let listId: string;
  try {
    const existing = await prisma.mailingList.findUnique({ where: { address }, select: { id: true } });
    if (existing) {
      return fail('Diese Adresse ist bereits vergeben.', { localPart: 'Adresse bereits vergeben.' });
    }

    const list = await prisma.mailingList.create({
      data: {
        communityId: context.community.id,
        name: data.name,
        localPart: data.localPart,
        address,
        description: data.description || null,
        listType: data.listType,
        postingPolicy: data.postingPolicy,
        moderationPolicy: data.moderationPolicy,
        subscriptionPolicy: data.subscriptionPolicy,
        replyToMode: data.replyToMode,
        archivePolicy: data.archivePolicy,
        subjectPrefix: data.subjectPrefix || null,
        footerText: data.footerText || null,
        autoSubscribeGroupId: data.autoSubscribeGroupId || null,
        isActive: data.isActive,
      },
    });
    listId = list.id;

    // Die anlegende Person wird zur Listenleitung, damit Moderation moeglich ist.
    const membership = await prisma.membership.findUnique({
      where: { communityId_personId: { communityId: context.community.id, personId: context.user.id } },
      select: { id: true },
    });
    if (membership) {
      await subscribePerson({ listId: list.id, personId: context.user.id, role: 'OWNER', byStaff: true });
    }

    if (data.autoSubscribeGroupId) {
      await syncListWithGroup(list.id);
    }

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'list.create',
      entityType: 'MailingList',
      entityId: list.id,
      summary: `Mailingliste ${address} angelegt`,
    });
  } catch (error) {
    return fromError(error, 'Die Liste konnte nicht angelegt werden.');
  }

  revalidatePath(`/c/${slug}/listen`);
  redirect(`/c/${slug}/listen/${listId}`);
}

/** Aendert die Einstellungen einer Liste. */
export async function updateListAction(
  slug: string,
  listId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'list.manage');

  const parsed = listSchema.safeParse(readListForm(formData));
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const list = await prisma.mailingList.findFirst({
    where: { id: listId, communityId: context.community.id },
    include: { community: { select: { mailDomain: true } } },
  });
  if (!list) return fail('Die Liste wurde nicht gefunden.');

  const data = parsed.data;
  const domain = list.community.mailDomain ?? list.address.split('@')[1];
  const address = normalizeEmail(`${data.localPart}@${domain}`);

  try {
    if (address !== list.address) {
      const conflict = await prisma.mailingList.findUnique({ where: { address }, select: { id: true } });
      if (conflict) {
        return fail('Diese Adresse ist bereits vergeben.', { localPart: 'Adresse bereits vergeben.' });
      }
    }

    await prisma.mailingList.update({
      where: { id: list.id },
      data: {
        name: data.name,
        localPart: data.localPart,
        address,
        description: data.description || null,
        listType: data.listType,
        postingPolicy: data.postingPolicy,
        moderationPolicy: data.moderationPolicy,
        subscriptionPolicy: data.subscriptionPolicy,
        replyToMode: data.replyToMode,
        archivePolicy: data.archivePolicy,
        subjectPrefix: data.subjectPrefix || null,
        footerText: data.footerText || null,
        autoSubscribeGroupId: data.autoSubscribeGroupId || null,
        isActive: data.isActive,
      },
    });

    if (data.autoSubscribeGroupId) {
      await syncListWithGroup(list.id);
    }
  } catch (error) {
    return fromError(error, 'Die Einstellungen konnten nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/listen/${listId}`);
  return ok('Die Einstellungen wurden gespeichert.');
}

export async function deleteListAction(slug: string, listId: string): Promise<void> {
  const context = await requirePermission(slug, 'list.manage');
  await prisma.mailingList.deleteMany({ where: { id: listId, communityId: context.community.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'list.delete',
    entityType: 'MailingList',
    entityId: listId,
    summary: 'Mailingliste gelöscht',
  });

  revalidatePath(`/c/${slug}/listen`);
  redirect(`/c/${slug}/listen`);
}

/** Gleicht die Eintragungen mit der hinterlegten Gruppe ab. */
export async function syncListAction(slug: string, listId: string): Promise<void> {
  const context = await requirePermission(slug, 'list.manage');

  const list = await prisma.mailingList.findFirst({
    where: { id: listId, communityId: context.community.id },
    select: { id: true },
  });
  if (!list) return;

  const result = await syncListWithGroup(list.id);

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'list.sync',
    entityType: 'MailingList',
    entityId: list.id,
    summary: `Abgleich mit der Gruppe: ${result.added} eingetragen, ${result.removed} ausgetragen`,
  });

  revalidatePath(`/c/${slug}/listen/${listId}`);
}

/** Traegt Personen in eine Liste ein. */
export async function addSubscribersAction(
  slug: string,
  listId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'list.manage');

  const list = await prisma.mailingList.findFirst({
    where: { id: listId, communityId: context.community.id },
    select: { id: true },
  });
  if (!list) return fail('Die Liste wurde nicht gefunden.');

  const personIds = formData
    .getAll('personIds')
    .filter((value): value is string => typeof value === 'string');
  const role = String(formData.get('role') ?? 'SUBSCRIBER');
  const deliveryMode = String(formData.get('deliveryMode') ?? 'REGULAR');

  if (personIds.length === 0) {
    return fail('Bitte wählen Sie mindestens eine Person aus.');
  }

  const memberships = await prisma.membership.findMany({
    where: { communityId: context.community.id, personId: { in: personIds } },
    select: { personId: true },
  });

  for (const membership of memberships) {
    await subscribePerson({
      listId: list.id,
      personId: membership.personId,
      role,
      deliveryMode,
      byStaff: true,
    });
  }

  revalidatePath(`/c/${slug}/listen/${listId}`);
  return ok(`${memberships.length} Personen wurden eingetragen.`);
}

export async function updateSubscriptionAction(
  slug: string,
  listId: string,
  subscriptionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'list.manage');

  const subscription = await prisma.listSubscription.findFirst({
    where: { id: subscriptionId, list: { id: listId, communityId: context.community.id } },
  });
  if (!subscription) return fail('Der Eintrag wurde nicht gefunden.');

  await prisma.listSubscription.update({
    where: { id: subscription.id },
    data: {
      role: String(formData.get('role') ?? subscription.role),
      deliveryMode: String(formData.get('deliveryMode') ?? subscription.deliveryMode),
      status: String(formData.get('status') ?? subscription.status),
      moderated: formData.get('moderated') !== null,
    },
  });

  revalidatePath(`/c/${slug}/listen/${listId}`);
  return ok('Der Eintrag wurde gespeichert.');
}

export async function removeSubscriberAction(
  slug: string,
  listId: string,
  personId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'list.manage');

  const list = await prisma.mailingList.findFirst({
    where: { id: listId, communityId: context.community.id },
    select: { id: true },
  });
  if (!list) return;

  await unsubscribePerson(list.id, personId);
  revalidatePath(`/c/${slug}/listen/${listId}`);
}

// --- Moderation ------------------------------------------------------------

export async function approveMessageAction(
  slug: string,
  listId: string,
  messageId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'list.moderate');

  const message = await prisma.listMessage.findFirst({
    where: { id: messageId, list: { id: listId, communityId: context.community.id } },
    select: { id: true, subject: true },
  });
  if (!message) return;

  const count = await approveListMessage(message.id, context.user.id);
  await processMailQueue();

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'list.approve',
    entityType: 'ListMessage',
    entityId: message.id,
    summary: `Beitrag "${message.subject}" an ${count} Adressen verteilt`,
  });

  revalidatePath(`/c/${slug}/listen/${listId}/moderation`);
  revalidatePath(`/c/${slug}/listen/${listId}`);
}

export async function rejectMessageAction(
  slug: string,
  listId: string,
  messageId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'list.moderate');

  const message = await prisma.listMessage.findFirst({
    where: { id: messageId, list: { id: listId, communityId: context.community.id } },
    select: { id: true, subject: true },
  });
  if (!message) return fail('Der Beitrag wurde nicht gefunden.');

  const reason = String(formData.get('reason') ?? '').trim() || 'Der Beitrag passt nicht zu dieser Liste.';
  const notify = formData.get('notify') !== null;

  try {
    await rejectListMessage(message.id, context.user.id, reason, notify);
    await processMailQueue();

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'list.reject',
      entityType: 'ListMessage',
      entityId: message.id,
      summary: `Beitrag "${message.subject}" abgelehnt`,
    });
  } catch (error) {
    return fromError(error, 'Der Beitrag konnte nicht abgelehnt werden.');
  }

  revalidatePath(`/c/${slug}/listen/${listId}/moderation`);
  return ok('Der Beitrag wurde abgelehnt.');
}

/** Verfasst einen Beitrag direkt aus der Anwendung heraus. */
export async function postToListAction(
  slug: string,
  listId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'list.view');

  const list = await prisma.mailingList.findFirst({
    where: { id: listId, communityId: context.community.id },
    select: { address: true, isActive: true },
  });
  if (!list) return fail('Die Liste wurde nicht gefunden.');
  if (!list.isActive) return fail('Diese Liste nimmt derzeit keine Beiträge an.');

  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('bodyText') ?? '').trim();

  if (!subject) return fail('Bitte geben Sie einen Betreff an.');
  if (!body) return fail('Bitte schreiben Sie einen Text.');

  try {
    const result = await receiveListMessage({
      to: list.address,
      from: `${context.user.fullName} <${context.user.email}>`,
      subject,
      bodyText: body,
    });

    await processMailQueue();
    revalidatePath(`/c/${slug}/listen/${listId}`);

    if (result.status === 'DISTRIBUTED') {
      return ok(`Der Beitrag wurde an ${result.recipientCount} Adressen verteilt.`);
    }
    if (result.status === 'PENDING') {
      return ok(`Der Beitrag liegt der Moderation vor. ${result.reason}`);
    }
    return fail(result.reason);
  } catch (error) {
    return fromError(error, 'Der Beitrag konnte nicht eingestellt werden.');
  }
}
