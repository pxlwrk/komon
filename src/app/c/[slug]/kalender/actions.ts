'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { calendarKindValues, calendarVisibilityValues } from '@/lib/enums';

const entrySchema = z
  .object({
    title: z.string().trim().min(2, 'Bitte geben Sie einen Titel an.'),
    description: z.string().trim().optional(),
    location: z.string().trim().optional(),
    startAt: z.string().min(1, 'Bitte geben Sie einen Beginn an.'),
    endAt: z.string().min(1, 'Bitte geben Sie ein Ende an.'),
    allDay: z.boolean().default(false),
    kind: z.enum(calendarKindValues).default('MEETING'),
    visibility: z.enum(calendarVisibilityValues).default('COMMUNITY'),
    recurrence: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.endAt).getTime() >= new Date(data.startAt).getTime(), {
    message: 'Das Ende darf nicht vor dem Beginn liegen.',
    path: ['endAt'],
  });

function readForm(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? '');
  return {
    title: value('title'),
    description: value('description'),
    location: value('location'),
    startAt: value('startAt'),
    endAt: value('endAt'),
    allDay: formData.get('allDay') !== null,
    kind: value('kind') || 'MEETING',
    visibility: value('visibility') || 'COMMUNITY',
    recurrence: value('recurrence'),
  };
}

export async function saveCalendarEntryAction(
  slug: string,
  entryId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'calendar.manage');

  const parsed = entrySchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;
  const payload = {
    title: data.title,
    description: data.description || null,
    location: data.location || null,
    startAt: new Date(data.startAt),
    endAt: new Date(data.endAt),
    allDay: data.allDay,
    kind: data.kind,
    visibility: data.visibility,
    recurrence: data.recurrence || null,
  };

  try {
    if (entryId) {
      const updated = await prisma.calendarEntry.updateMany({
        where: { id: entryId, communityId: context.community.id },
        data: payload,
      });
      if (updated.count === 0) return fail('Der Termin wurde nicht gefunden.');
    } else {
      await prisma.calendarEntry.create({
        data: { ...payload, communityId: context.community.id, ownerId: context.user.id },
      });
    }
  } catch (error) {
    return fromError(error, 'Der Termin konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/kalender`);
  return ok('Der Termin wurde gespeichert.');
}

export async function deleteCalendarEntryAction(slug: string, entryId: string): Promise<void> {
  const context = await requirePermission(slug, 'calendar.manage');
  await prisma.calendarEntry.deleteMany({
    where: { id: entryId, communityId: context.community.id, eventId: null },
  });
  revalidatePath(`/c/${slug}/kalender`);
}
