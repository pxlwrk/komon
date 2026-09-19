'use server';

import { revalidatePath } from 'next/cache';

import { fail, fromError, ok, type ActionState } from '@/lib/action-state';
import { prisma } from '@/lib/prisma';

/**
 * Nimmt die Rueckmeldung zu einer Einladung entgegen. Der persoenliche Token
 * aus der E-Mail genuegt, eine Anmeldung ist nicht noetig.
 */
export async function respondAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const participation = await prisma.eventParticipation.findUnique({
    where: { responseToken: token },
    include: { event: { select: { id: true, capacity: true, waitlistEnabled: true, status: true } } },
  });

  if (!participation) {
    return fail('Diese Einladung ist uns nicht bekannt.');
  }

  if (participation.event.status === 'CANCELLED') {
    return fail('Dieses Event wurde abgesagt.');
  }

  const answer = String(formData.get('answer') ?? '');
  if (!['ACCEPTED', 'DECLINED', 'TENTATIVE'].includes(answer)) {
    return fail('Bitte wählen Sie eine der Antwortmöglichkeiten.');
  }

  const guestCount = Math.max(0, Number.parseInt(String(formData.get('guestCount') ?? '0'), 10) || 0);
  const note = String(formData.get('note') ?? '').trim() || null;
  const dietaryNotes = String(formData.get('dietaryNotes') ?? '').trim() || null;

  try {
    let status = answer;

    // Bei begrenzter Zahl entscheidet die Reihenfolge der Zusagen.
    if (answer === 'ACCEPTED' && participation.event.capacity !== null) {
      const accepted = await prisma.eventParticipation.count({
        where: {
          eventId: participation.eventId,
          status: 'ACCEPTED',
          id: { not: participation.id },
        },
      });
      if (accepted + 1 + guestCount > participation.event.capacity) {
        if (!participation.event.waitlistEnabled) {
          return fail('Dieses Event ist bereits ausgebucht.');
        }
        status = 'WAITLIST';
      }
    }

    await prisma.eventParticipation.update({
      where: { id: participation.id },
      data: {
        status,
        guestCount,
        note,
        dietaryNotes,
        respondedAt: new Date(),
      },
    });

    revalidatePath(`/einladung/${token}`);

    if (status === 'WAITLIST') {
      return ok('Vielen Dank. Die Plätze sind belegt, Sie stehen nun auf der Warteliste.');
    }
    if (status === 'ACCEPTED') {
      return ok('Vielen Dank für Ihre Zusage. Wir freuen uns auf Sie.');
    }
    if (status === 'TENTATIVE') {
      return ok('Vielen Dank. Wir haben Ihre Rückmeldung unter Vorbehalt vermerkt.');
    }
    return ok('Vielen Dank für Ihre Rückmeldung. Schade, dass es nicht passt.');
  } catch (error) {
    return fromError(error, 'Ihre Rückmeldung konnte nicht gespeichert werden.');
  }
}

/** Nimmt eine Rueckmeldung zur Zufriedenheit nach dem Event entgegen. */
export async function submitFeedbackAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const participation = await prisma.eventParticipation.findUnique({
    where: { responseToken: token },
    select: { eventId: true, personId: true },
  });

  if (!participation) return fail('Diese Einladung ist uns nicht bekannt.');

  const rating = Number.parseInt(String(formData.get('rating') ?? ''), 10);
  const comment = String(formData.get('comment') ?? '').trim() || null;

  if (!Number.isFinite(rating) && !comment) {
    return fail('Bitte geben Sie eine Bewertung oder einen Kommentar ab.');
  }

  await prisma.eventFeedback.create({
    data: {
      eventId: participation.eventId,
      personId: participation.personId,
      rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, rating)) : null,
      comment,
    },
  });

  revalidatePath(`/einladung/${token}`);
  return ok('Vielen Dank für Ihre Rückmeldung.');
}
