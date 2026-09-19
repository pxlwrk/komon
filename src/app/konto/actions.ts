'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/rbac';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte geben Sie einen Vornamen an.'),
  lastName: z.string().trim().min(1, 'Bitte geben Sie einen Nachnamen an.'),
  displayName: z.string().trim().optional(),
  pronouns: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  timezone: z.string().trim().min(1),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    displayName: formData.get('displayName'),
    pronouns: formData.get('pronouns'),
    phone: formData.get('phone'),
    mobile: formData.get('mobile'),
    timezone: formData.get('timezone') || 'Europe/Berlin',
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  try {
    await prisma.person.update({
      where: { id: user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName || null,
        pronouns: data.pronouns || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        timezone: data.timezone,
      },
    });
  } catch (error) {
    return fromError(error, 'Die Angaben konnten nicht gespeichert werden.');
  }

  revalidatePath('/konto');
  return ok('Ihre Angaben wurden gespeichert.');
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const repeat = String(formData.get('repeat') ?? '');

  if (next.length < 10) {
    return fail('Das neue Passwort braucht mindestens zehn Zeichen.');
  }
  if (next !== repeat) {
    return fail('Die beiden neuen Passwörter stimmen nicht überein.');
  }

  const person = await prisma.person.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!person.passwordHash || !(await verifyPassword(current, person.passwordHash))) {
    return fail('Das bisherige Passwort stimmt nicht.');
  }

  try {
    await prisma.person.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(next), mustChangePassword: false },
    });

    // Andere Sitzungen werden beendet, die aktuelle bleibt bestehen.
    await prisma.session.deleteMany({
      where: { personId: user.id, id: { not: user.sessionId } },
    });

    await recordAudit({
      actorId: user.id,
      action: 'account.password',
      entityType: 'Person',
      entityId: user.id,
      summary: 'Passwort geändert',
    });
  } catch (error) {
    return fromError(error, 'Das Passwort konnte nicht geändert werden.');
  }

  revalidatePath('/konto');
  return ok('Ihr Passwort wurde geändert. Andere Sitzungen wurden beendet.');
}

export async function endSessionAction(sessionId: string): Promise<void> {
  const user = await requireUser();
  if (sessionId === user.sessionId) return;

  await prisma.session.deleteMany({ where: { id: sessionId, personId: user.id } });
  revalidatePath('/konto');
}
