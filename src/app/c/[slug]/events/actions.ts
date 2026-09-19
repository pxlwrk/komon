'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { config } from '@/lib/config';
import { isValidEmail, normalizeEmail, processMailQueue, queueEmail } from '@/lib/mail';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import {
  eventResourceKindValues,
  eventStatusValues,
  eventTaskPhaseValues,
  eventVisibilityValues,
  participationStatusValues,
  taskStatusValues,
} from '@/lib/enums';

const eventSchema = z
  .object({
    title: z.string().trim().min(2, 'Bitte geben Sie einen Titel an.'),
    summary: z.string().trim().optional(),
    description: z.string().trim().optional(),
    status: z.enum(eventStatusValues).default('PLANNING'),
    startAt: z.string().min(1, 'Bitte geben Sie einen Beginn an.'),
    endAt: z.string().min(1, 'Bitte geben Sie ein Ende an.'),
    allDay: z.boolean().default(false),
    locationName: z.string().trim().optional(),
    locationAddress: z.string().trim().optional(),
    onlineUrl: z.string().trim().optional(),
    capacity: z.string().trim().optional(),
    waitlistEnabled: z.boolean().default(true),
    allowGuests: z.boolean().default(false),
    registrationClosesAt: z.string().trim().optional(),
    visibility: z.enum(eventVisibilityValues).default('COMMUNITY'),
    organizerId: z.string().trim().optional(),
    plannedBudget: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.endAt).getTime() >= new Date(data.startAt).getTime(), {
    message: 'Das Ende darf nicht vor dem Beginn liegen.',
    path: ['endAt'],
  });

function readEventForm(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? '');
  return {
    title: value('title'),
    summary: value('summary'),
    description: value('description'),
    status: value('status') || 'PLANNING',
    startAt: value('startAt'),
    endAt: value('endAt'),
    allDay: formData.get('allDay') !== null,
    locationName: value('locationName'),
    locationAddress: value('locationAddress'),
    onlineUrl: value('onlineUrl'),
    capacity: value('capacity'),
    waitlistEnabled: formData.get('waitlistEnabled') !== null,
    allowGuests: formData.get('allowGuests') !== null,
    registrationClosesAt: value('registrationClosesAt'),
    visibility: value('visibility') || 'COMMUNITY',
    organizerId: value('organizerId'),
    plannedBudget: value('plannedBudget'),
  };
}

function toNumber(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createEventAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.manage');

  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;
  const base = slugify(data.title) || 'event';
  let eventSlug = base;
  let suffix = 2;
  while (
    await prisma.event.findUnique({
      where: { communityId_slug: { communityId: context.community.id, slug: eventSlug } },
      select: { id: true },
    })
  ) {
    eventSlug = `${base}-${suffix}`;
    suffix += 1;
  }

  let eventId: string;

  try {
    const event = await prisma.event.create({
      data: {
        communityId: context.community.id,
        title: data.title,
        slug: eventSlug,
        summary: data.summary || null,
        description: data.description || null,
        status: data.status,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        allDay: data.allDay,
        timezone: context.community.timezone,
        locationName: data.locationName || null,
        locationAddress: data.locationAddress || null,
        onlineUrl: data.onlineUrl || null,
        capacity: toNumber(data.capacity),
        waitlistEnabled: data.waitlistEnabled,
        allowGuests: data.allowGuests,
        registrationClosesAt: toDate(data.registrationClosesAt),
        visibility: data.visibility,
        organizerId: data.organizerId || context.user.id,
        createdById: context.user.id,
        plannedBudget: toNumber(data.plannedBudget),
      },
    });
    eventId = event.id;

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'event.create',
      entityType: 'Event',
      entityId: event.id,
      summary: `Event "${event.title}" angelegt`,
    });
  } catch (error) {
    return fromError(error, 'Das Event konnte nicht angelegt werden.');
  }

  revalidatePath(`/c/${slug}/events`);
  redirect(`/c/${slug}/events/${eventId}`);
}

export async function updateEventAction(
  slug: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.manage');

  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  try {
    const updated = await prisma.event.updateMany({
      where: { id: eventId, communityId: context.community.id },
      data: {
        title: data.title,
        summary: data.summary || null,
        description: data.description || null,
        status: data.status,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        allDay: data.allDay,
        locationName: data.locationName || null,
        locationAddress: data.locationAddress || null,
        onlineUrl: data.onlineUrl || null,
        capacity: toNumber(data.capacity),
        waitlistEnabled: data.waitlistEnabled,
        allowGuests: data.allowGuests,
        registrationClosesAt: toDate(data.registrationClosesAt),
        visibility: data.visibility,
        organizerId: data.organizerId || null,
        plannedBudget: toNumber(data.plannedBudget),
      },
    });

    if (updated.count === 0) return fail('Das Event wurde nicht gefunden.');
  } catch (error) {
    return fromError(error, 'Das Event konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/events`);
  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok('Das Event wurde gespeichert.');
}

export async function deleteEventAction(slug: string, eventId: string): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
    select: { id: true, title: true },
  });
  if (!event) return;

  await prisma.event.delete({ where: { id: event.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'event.delete',
    entityType: 'Event',
    entityId: event.id,
    summary: `Event "${event.title}" gelöscht`,
  });

  revalidatePath(`/c/${slug}/events`);
  redirect(`/c/${slug}/events`);
}

export async function setEventStatusAction(
  slug: string,
  eventId: string,
  status: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');
  if (!eventStatusValues.includes(status as never)) return;

  await prisma.event.updateMany({
    where: { id: eventId, communityId: context.community.id },
    data: { status },
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
}

// --- Einladungen und Teilnahme --------------------------------------------

/** Fuegt Personen zur Teilnehmendenliste eines Events hinzu. */
export async function addParticipantsAction(
  slug: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.invite');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
    select: { id: true, capacity: true, waitlistEnabled: true },
  });
  if (!event) return fail('Das Event wurde nicht gefunden.');

  const source = String(formData.get('source') ?? 'SELECTION');
  const personIds = formData
    .getAll('personIds')
    .filter((value): value is string => typeof value === 'string');
  const groupId = String(formData.get('groupId') ?? '');
  const externalRaw = String(formData.get('external') ?? '');

  const targets: { personId: string | null; email: string; name: string | null }[] = [];

  if (source === 'ALL' || source === 'GROUP') {
    const memberships = await prisma.membership.findMany({
      where: {
        communityId: context.community.id,
        status: 'ACTIVE',
        ...(source === 'GROUP' && groupId ? { groupMembers: { some: { groupId } } } : {}),
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true, displayName: true, primaryEmail: true } },
      },
    });
    for (const membership of memberships) {
      targets.push({
        personId: membership.person.id,
        email: membership.person.primaryEmail,
        name:
          membership.person.displayName ||
          `${membership.person.firstName} ${membership.person.lastName}`.trim(),
      });
    }
  } else if (source === 'SELECTION' && personIds.length > 0) {
    const persons = await prisma.person.findMany({
      where: { id: { in: personIds } },
      select: { id: true, firstName: true, lastName: true, displayName: true, primaryEmail: true },
    });
    for (const person of persons) {
      targets.push({
        personId: person.id,
        email: person.primaryEmail,
        name: person.displayName || `${person.firstName} ${person.lastName}`.trim(),
      });
    }
  }

  // Zusaetzliche Gaeste ohne Mitgliedschaft, eine Adresse je Zeile.
  for (const line of externalRaw.split(/[\n,;]+/)) {
    const entry = line.trim();
    if (!entry) continue;
    const match = entry.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    const email = normalizeEmail(match ? match[2] : entry);
    if (!isValidEmail(email)) continue;
    targets.push({ personId: null, email, name: match ? match[1] || null : null });
  }

  if (targets.length === 0) {
    return fail('Es wurde niemand ausgewählt.');
  }

  const existing = await prisma.eventParticipation.findMany({
    where: { eventId: event.id },
    select: { email: true, status: true },
  });
  const known = new Set(existing.map((entry) => entry.email));
  const activeCount = existing.filter((entry) =>
    ['ACCEPTED', 'INVITED', 'TENTATIVE'].includes(entry.status),
  ).length;

  let added = 0;
  let waitlisted = 0;
  let running = activeCount;

  for (const target of targets) {
    if (known.has(target.email)) continue;

    const overCapacity = event.capacity !== null && running >= event.capacity;
    if (overCapacity && !event.waitlistEnabled) continue;

    await prisma.eventParticipation.create({
      data: {
        eventId: event.id,
        personId: target.personId,
        email: target.email,
        name: target.name,
        source: 'INVITED',
        status: overCapacity ? 'WAITLIST' : 'INVITED',
      },
    });

    known.add(target.email);
    if (overCapacity) {
      waitlisted += 1;
    } else {
      added += 1;
      running += 1;
    }
  }

  revalidatePath(`/c/${slug}/events/${eventId}`);

  const parts = [`${added} auf die Einladungsliste gesetzt`];
  if (waitlisted > 0) parts.push(`${waitlisted} auf die Warteliste`);
  return ok(`${parts.join(', ')}. Die Einladungen versenden Sie im nächsten Schritt.`);
}

/** Versendet die Einladungen an alle noch nicht angeschriebenen Personen. */
export async function sendInvitationsAction(
  slug: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.invite');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
    include: { organizer: { select: { primaryEmail: true } } },
  });
  if (!event) return fail('Das Event wurde nicht gefunden.');

  const onlyNew = formData.get('onlyNew') !== null;
  const customText = String(formData.get('message') ?? '').trim();

  const participations = await prisma.eventParticipation.findMany({
    where: {
      eventId: event.id,
      status: { in: ['INVITED', 'WAITLIST', 'TENTATIVE'] },
      ...(onlyNew ? { remindedAt: null } : {}),
    },
  });

  if (participations.length === 0) {
    return fail('Es gibt niemanden, der angeschrieben werden könnte.');
  }

  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'full',
    timeStyle: event.allDay ? undefined : 'short',
    timeZone: event.timezone,
  }).format(event.startAt);

  const place = event.onlineUrl
    ? `Online: ${event.onlineUrl}`
    : [event.locationName, event.locationAddress].filter(Boolean).join(', ') || 'Ort wird noch bekannt gegeben';

  try {
    for (const participation of participations) {
      const link = `${config.appUrl}/einladung/${participation.responseToken}`;
      const body = [
        `Liebe Teilnehmerin, lieber Teilnehmer,`,
        '',
        `wir laden Sie herzlich ein zu: ${event.title}`,
        '',
        `Wann: ${dateLabel}`,
        `Wo: ${place}`,
        event.summary ? `\n${event.summary}` : '',
        customText ? `\n${customText}` : '',
        '',
        'Bitte geben Sie uns über diesen Link Bescheid, ob Sie dabei sind:',
        link,
        '',
        'Herzliche Grüße',
        context.community.name,
      ]
        .filter((line) => line !== '')
        .join('\n');

      await queueEmail({
        communityId: context.community.id,
        kind: 'EVENT_INVITATION',
        eventId: event.id,
        subject: `Einladung: ${event.title}`,
        bodyText: body,
        authorId: context.user.id,
        replyTo: event.organizer?.primaryEmail ?? null,
        recipients: [
          { address: participation.email, name: participation.name, personId: participation.personId },
        ],
      });

      await prisma.eventParticipation.update({
        where: { id: participation.id },
        data: { remindedAt: new Date() },
      });
    }

    await processMailQueue();

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'event.invite',
      entityType: 'Event',
      entityId: event.id,
      summary: `${participations.length} Einladungen zu "${event.title}" versendet`,
    });
  } catch (error) {
    return fromError(error, 'Die Einladungen konnten nicht versendet werden.');
  }

  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok(`${participations.length} Einladungen wurden auf den Weg gebracht.`);
}

/** Setzt den Status einer Teilnahme, etwa beim Erfassen vor Ort. */
export async function setParticipationStatusAction(
  slug: string,
  eventId: string,
  participationId: string,
  status: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');
  if (!participationStatusValues.includes(status as never)) return;

  await prisma.eventParticipation.updateMany({
    where: { id: participationId, event: { id: eventId, communityId: context.community.id } },
    data: { status, respondedAt: new Date() },
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
}

/** Erfasst die Anwesenheit vor Ort. */
export async function toggleCheckInAction(
  slug: string,
  eventId: string,
  participationId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.checkin');

  const participation = await prisma.eventParticipation.findFirst({
    where: { id: participationId, event: { id: eventId, communityId: context.community.id } },
  });
  if (!participation) return;

  const isCheckedIn = participation.checkedInAt !== null;

  await prisma.eventParticipation.update({
    where: { id: participation.id },
    data: {
      checkedInAt: isCheckedIn ? null : new Date(),
      attended: isCheckedIn ? null : true,
      noShow: false,
    },
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
}

export async function removeParticipationAction(
  slug: string,
  eventId: string,
  participationId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');

  await prisma.eventParticipation.deleteMany({
    where: { id: participationId, event: { id: eventId, communityId: context.community.id } },
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
}

/** Schliesst die Anwesenheitserfassung ab und markiert Ausbleibende. */
export async function closeAttendanceAction(slug: string, eventId: string): Promise<void> {
  const context = await requirePermission(slug, 'event.checkin');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
    select: { id: true },
  });
  if (!event) return;

  await prisma.eventParticipation.updateMany({
    where: { eventId: event.id, status: 'ACCEPTED', checkedInAt: null },
    data: { attended: false, noShow: true },
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
}

// --- Aufgaben und Programm -------------------------------------------------

export async function saveTaskAction(
  slug: string,
  eventId: string,
  taskId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.manage');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
    select: { id: true },
  });
  if (!event) return fail('Das Event wurde nicht gefunden.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return fail('Bitte geben Sie einen Titel an.');

  const phase = String(formData.get('phase') ?? 'PLANNING');
  const status = String(formData.get('status') ?? 'OPEN');
  const assigneeId = String(formData.get('assigneeId') ?? '') || null;
  const dueAt = toDate(String(formData.get('dueAt') ?? ''));
  const description = String(formData.get('description') ?? '').trim() || null;

  const data = {
    title,
    description,
    phase: eventTaskPhaseValues.includes(phase as never) ? phase : 'PLANNING',
    status: taskStatusValues.includes(status as never) ? status : 'OPEN',
    assigneeId,
    dueAt,
    completedAt: status === 'DONE' ? new Date() : null,
  };

  try {
    if (taskId) {
      await prisma.eventTask.updateMany({ where: { id: taskId, eventId: event.id }, data });
    } else {
      await prisma.eventTask.create({ data: { ...data, eventId: event.id } });
    }
  } catch (error) {
    return fromError(error, 'Die Aufgabe konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok('Die Aufgabe wurde gespeichert.');
}

export async function toggleTaskAction(
  slug: string,
  eventId: string,
  taskId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');

  const task = await prisma.eventTask.findFirst({
    where: { id: taskId, event: { id: eventId, communityId: context.community.id } },
  });
  if (!task) return;

  const done = task.status === 'DONE';

  await prisma.eventTask.update({
    where: { id: task.id },
    data: { status: done ? 'OPEN' : 'DONE', completedAt: done ? null : new Date() },
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
}

export async function deleteTaskAction(slug: string, eventId: string, taskId: string): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');
  await prisma.eventTask.deleteMany({
    where: { id: taskId, event: { id: eventId, communityId: context.community.id } },
  });
  revalidatePath(`/c/${slug}/events/${eventId}`);
}

export async function saveAgendaItemAction(
  slug: string,
  eventId: string,
  itemId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.manage');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
    select: { id: true },
  });
  if (!event) return fail('Das Event wurde nicht gefunden.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return fail('Bitte geben Sie einen Titel an.');

  const data = {
    title,
    speaker: String(formData.get('speaker') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    startAt: toDate(String(formData.get('startAt') ?? '')),
    durationMinutes: toNumber(String(formData.get('durationMinutes') ?? '')),
    position: Math.trunc(toNumber(String(formData.get('position') ?? '')) ?? 0),
  };

  if (itemId) {
    await prisma.eventAgendaItem.updateMany({ where: { id: itemId, eventId: event.id }, data });
  } else {
    await prisma.eventAgendaItem.create({ data: { ...data, eventId: event.id } });
  }

  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok('Der Programmpunkt wurde gespeichert.');
}

export async function deleteAgendaItemAction(
  slug: string,
  eventId: string,
  itemId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');
  await prisma.eventAgendaItem.deleteMany({
    where: { id: itemId, event: { id: eventId, communityId: context.community.id } },
  });
  revalidatePath(`/c/${slug}/events/${eventId}`);
}

// --- Nachbereitung ---------------------------------------------------------

export async function saveDebriefAction(
  slug: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.debrief');

  const minutes = String(formData.get('minutes') ?? '').trim() || null;
  const debriefNotes = String(formData.get('debriefNotes') ?? '').trim() || null;
  const lessonsLearned = String(formData.get('lessonsLearned') ?? '').trim() || null;
  const actualCost = toNumber(String(formData.get('actualCost') ?? ''));
  const markDone = formData.get('markDone') !== null;

  const updated = await prisma.event.updateMany({
    where: { id: eventId, communityId: context.community.id },
    data: {
      minutes,
      debriefNotes,
      lessonsLearned,
      actualCost,
      debriefDoneAt: markDone ? new Date() : null,
      ...(markDone ? { status: 'COMPLETED' } : {}),
    },
  });

  if (updated.count === 0) return fail('Das Event wurde nicht gefunden.');

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'event.debrief',
    entityType: 'Event',
    entityId: eventId,
    summary: markDone ? 'Nachbereitung abgeschlossen' : 'Nachbereitung aktualisiert',
  });

  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok('Die Nachbereitung wurde gespeichert.');
}

/** Verschickt eine Nachlese an alle, die teilgenommen haben. */
export async function sendFollowUpAction(
  slug: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.debrief');

  const event = await prisma.event.findFirst({
    where: { id: eventId, communityId: context.community.id },
  });
  if (!event) return fail('Das Event wurde nicht gefunden.');

  const subject = String(formData.get('subject') ?? '').trim() || `Nachlese: ${event.title}`;
  const body = String(formData.get('bodyText') ?? '').trim();
  if (!body) return fail('Bitte schreiben Sie einen Text.');

  const audience = String(formData.get('audience') ?? 'ATTENDED');

  const participations = await prisma.eventParticipation.findMany({
    where: {
      eventId: event.id,
      ...(audience === 'ATTENDED'
        ? { attended: true }
        : audience === 'ACCEPTED'
          ? { status: 'ACCEPTED' }
          : {}),
    },
  });

  if (participations.length === 0) {
    return fail('Für diese Auswahl gibt es keine Empfängerinnen und Empfänger.');
  }

  try {
    await queueEmail({
      communityId: context.community.id,
      kind: 'EVENT_FOLLOWUP',
      eventId: event.id,
      subject,
      bodyText: body,
      authorId: context.user.id,
      recipients: participations.map((participation) => ({
        address: participation.email,
        name: participation.name,
        personId: participation.personId,
      })),
    });

    await processMailQueue();
  } catch (error) {
    return fromError(error, 'Die Nachlese konnte nicht versendet werden.');
  }

  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok(`Die Nachlese geht an ${participations.length} Personen.`);
}

/** Verknuepft eine Datei aus der Ablage mit dem Event. */
export async function linkResourceAction(
  slug: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'event.manage');

  const fileId = String(formData.get('fileId') ?? '');
  const kind = String(formData.get('kind') ?? 'OTHER');
  const label = String(formData.get('label') ?? '').trim() || null;

  if (!fileId) return fail('Bitte wählen Sie eine Datei aus.');

  const file = await prisma.storedFile.findFirst({
    where: { id: fileId, communityId: context.community.id },
    select: { id: true },
  });
  if (!file) return fail('Die Datei wurde nicht gefunden.');

  try {
    await prisma.eventResource.create({
      data: {
        eventId,
        fileId: file.id,
        kind: eventResourceKindValues.includes(kind as never) ? kind : 'OTHER',
        label,
      },
    });
  } catch {
    return fail('Diese Datei ist bereits verknüpft.');
  }

  revalidatePath(`/c/${slug}/events/${eventId}`);
  return ok('Die Datei wurde verknüpft.');
}

export async function unlinkResourceAction(
  slug: string,
  eventId: string,
  resourceId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'event.manage');
  await prisma.eventResource.deleteMany({
    where: { id: resourceId, event: { id: eventId, communityId: context.community.id } },
  });
  revalidatePath(`/c/${slug}/events/${eventId}`);
}
