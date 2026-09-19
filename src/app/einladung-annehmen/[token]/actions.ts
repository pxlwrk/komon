'use server';

import { redirect } from 'next/navigation';

import { fail, fromError, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Nimmt eine Einladung an: legt bei Bedarf die Person an, setzt das Passwort
 * und stellt die Mitgliedschaft samt Rolle her.
 */
export async function acceptInvitationAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const invitation = await prisma.accountInvitation.findUnique({
    where: { token },
    include: { community: { select: { id: true, name: true, slug: true } } },
  });

  if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
    return fail('Diese Einladung ist nicht mehr gültig.');
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return fail('Diese Einladung ist abgelaufen. Bitte bitten Sie um eine neue.');
  }

  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const repeat = String(formData.get('passwordRepeat') ?? '');

  if (!firstName || !lastName) {
    return fail('Bitte geben Sie Vor- und Nachnamen an.');
  }
  if (password.length < 10) {
    return fail('Das Passwort braucht mindestens zehn Zeichen.');
  }
  if (password !== repeat) {
    return fail('Die beiden Passwörter stimmen nicht überein.');
  }

  try {
    const passwordHash = await hashPassword(password);

    const person = await prisma.person.upsert({
      where: { primaryEmail: invitation.email },
      create: {
        firstName,
        lastName,
        primaryEmail: invitation.email,
        passwordHash,
        emailAddresses: {
          create: { address: invitation.email, isPrimary: true, label: 'Hauptadresse' },
        },
      },
      update: { firstName, lastName, passwordHash, status: 'ACTIVE' },
    });

    const membership = await prisma.membership.upsert({
      where: {
        communityId_personId: { communityId: invitation.communityId, personId: person.id },
      },
      create: { communityId: invitation.communityId, personId: person.id, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    const roleId =
      invitation.roleId ??
      (
        await prisma.role.findFirst({
          where: { communityId: invitation.communityId, key: 'member' },
          select: { id: true },
        })
      )?.id;

    if (roleId) {
      await prisma.membershipRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId } },
        create: { membershipId: membership.id, roleId },
        update: {},
      });
    }

    await prisma.accountInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await recordAudit({
      communityId: invitation.communityId,
      actorId: person.id,
      action: 'account.accept',
      entityType: 'Person',
      entityId: person.id,
      summary: `${firstName} ${lastName} hat die Einladung angenommen`,
    });
  } catch (error) {
    return fromError(error, 'Der Zugang konnte nicht eingerichtet werden.');
  }

  redirect('/anmelden?eingerichtet=1');
}
