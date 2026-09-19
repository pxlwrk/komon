'use server';

import { randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { config } from '@/lib/config';
import { processMailQueue, queueEmail, normalizeEmail } from '@/lib/mail';
import {
  ALL_PERMISSIONS,
  isPermission,
  serializePermissions,
  type Permission,
} from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Bitte geben Sie einen Namen an.'),
  description: z.string().trim().optional(),
  rank: z.string().trim().optional(),
});

/** Legt eine Rolle an oder aendert sie samt Rechten. */
export async function saveRoleAction(
  slug: string,
  roleId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'role.manage');

  const parsed = roleSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    rank: formData.get('rank'),
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;
  const selected = formData
    .getAll('permissions')
    .filter((value): value is string => typeof value === 'string')
    .filter(isPermission) as Permission[];

  // Niemand darf sich mehr Rechte geben, als er selbst besitzt.
  const ownPermissions = context.user.isSuperAdmin ? ALL_PERMISSIONS : Array.from(context.permissions);
  const tooMuch = selected.filter((permission) => !ownPermissions.includes(permission));
  if (tooMuch.length > 0) {
    return fail('Sie können nur Rechte vergeben, die Sie selbst besitzen.');
  }

  const rank = Number.parseInt(data.rank ?? '', 10);

  try {
    if (roleId) {
      const role = await prisma.role.findFirst({
        where: { id: roleId, communityId: context.community.id },
      });
      if (!role) return fail('Die Rolle wurde nicht gefunden.');

      // Die Leitungsrolle behält immer alle Rechte, damit niemand ausgesperrt wird.
      const permissions = role.key === 'owner' ? ALL_PERMISSIONS : selected;

      await prisma.role.update({
        where: { id: role.id },
        data: {
          name: data.name,
          description: data.description || null,
          rank: Number.isFinite(rank) ? rank : role.rank,
          permissions: serializePermissions(permissions),
        },
      });
    } else {
      const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rolle';
      let key = base;
      let suffix = 2;
      while (
        await prisma.role.findUnique({
          where: { communityId_key: { communityId: context.community.id, key } },
          select: { id: true },
        })
      ) {
        key = `${base}-${suffix}`;
        suffix += 1;
      }

      await prisma.role.create({
        data: {
          communityId: context.community.id,
          key,
          name: data.name,
          description: data.description || null,
          rank: Number.isFinite(rank) ? rank : 80,
          permissions: serializePermissions(selected),
        },
      });
    }

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: roleId ? 'role.update' : 'role.create',
      entityType: 'Role',
      entityId: roleId,
      summary: `Rolle "${data.name}" gespeichert`,
    });
  } catch (error) {
    return fromError(error, 'Die Rolle konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/benutzer`);
  return ok('Die Rolle wurde gespeichert.');
}

export async function deleteRoleAction(slug: string, roleId: string): Promise<void> {
  const context = await requirePermission(slug, 'role.manage');

  const role = await prisma.role.findFirst({
    where: { id: roleId, communityId: context.community.id },
    select: { id: true, key: true, isSystem: true, name: true },
  });
  if (!role || role.key === 'owner') return;

  await prisma.role.delete({ where: { id: role.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'role.delete',
    entityType: 'Role',
    entityId: role.id,
    summary: `Rolle "${role.name}" gelöscht`,
  });

  revalidatePath(`/c/${slug}/benutzer`);
}

/** Lädt eine Person zum Anlegen eines Zugangs ein. */
export async function inviteAccountAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'account.manage');

  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const roleId = String(formData.get('roleId') ?? '') || null;
  const message = String(formData.get('message') ?? '').trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return fail('Bitte geben Sie eine gültige E-Mail-Adresse an.');
  }

  try {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const person = await prisma.person.findUnique({
      where: { primaryEmail: email },
      select: { id: true, firstName: true, lastName: true },
    });

    const invitation = await prisma.accountInvitation.create({
      data: {
        communityId: context.community.id,
        email,
        firstName: person?.firstName ?? null,
        lastName: person?.lastName ?? null,
        roleId,
        token,
        invitedById: context.user.id,
        message,
        expiresAt,
      },
    });

    await queueEmail({
      communityId: context.community.id,
      kind: 'TRANSACTIONAL',
      subject: `Ihr Zugang zu ${context.community.name}`,
      bodyText: [
        'Guten Tag,',
        '',
        `Sie wurden eingeladen, bei ${context.community.name} mitzuwirken.`,
        message ? `\n${message}\n` : '',
        'Über diesen Link richten Sie Ihr Passwort ein:',
        `${config.appUrl}/einladung-annehmen/${token}`,
        '',
        `Der Link gilt bis zum ${expiresAt.toLocaleDateString('de-DE')}.`,
        '',
        'Herzliche Grüße',
        context.community.name,
      ]
        .filter((line) => line !== '')
        .join('\n'),
      authorId: context.user.id,
      recipients: [{ address: email, name: person ? `${person.firstName} ${person.lastName}`.trim() : null }],
    });

    await processMailQueue();

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'account.invite',
      entityType: 'AccountInvitation',
      entityId: invitation.id,
      summary: `Einladung an ${email} versendet`,
    });
  } catch (error) {
    return fromError(error, 'Die Einladung konnte nicht versendet werden.');
  }

  revalidatePath(`/c/${slug}/benutzer`);
  return ok(`Die Einladung an ${email} ist unterwegs.`);
}

export async function revokeInvitationAction(slug: string, invitationId: string): Promise<void> {
  const context = await requirePermission(slug, 'account.manage');
  await prisma.accountInvitation.updateMany({
    where: { id: invitationId, communityId: context.community.id, acceptedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/c/${slug}/benutzer`);
}

/** Setzt ein neues Passwort und verlangt eine Änderung beim nächsten Anmelden. */
export async function resetPasswordAction(
  slug: string,
  personId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'account.manage');

  const membership = await prisma.membership.findUnique({
    where: { communityId_personId: { communityId: context.community.id, personId } },
    select: { id: true },
  });
  if (!membership) return fail('Diese Person gehört nicht zu dieser Community.');

  const password = String(formData.get('password') ?? '');
  if (password.length < 10) {
    return fail('Das Passwort braucht mindestens zehn Zeichen.');
  }

  try {
    await prisma.person.update({
      where: { id: personId },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Bestehende Sitzungen werden beendet, damit der alte Zugang nicht weiterläuft.
    await prisma.session.deleteMany({ where: { personId } });

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'account.reset',
      entityType: 'Person',
      entityId: personId,
      summary: 'Passwort durch die Verwaltung neu gesetzt',
    });
  } catch (error) {
    return fromError(error, 'Das Passwort konnte nicht gesetzt werden.');
  }

  revalidatePath(`/c/${slug}/benutzer`);
  return ok('Das Passwort wurde gesetzt. Beim nächsten Anmelden wird eine Änderung verlangt.');
}

/** Entzieht einer Person den Zugang, ohne die Stammdaten zu berühren. */
export async function revokeAccessAction(slug: string, personId: string): Promise<void> {
  const context = await requirePermission(slug, 'account.manage');

  if (personId === context.user.id) return;

  const membership = await prisma.membership.findUnique({
    where: { communityId_personId: { communityId: context.community.id, personId } },
    select: { id: true },
  });
  if (!membership) return;

  // Der Zugang wird nur entzogen, wenn die Person in keiner weiteren Community mitwirkt.
  const otherMemberships = await prisma.membership.count({
    where: { personId, communityId: { not: context.community.id } },
  });
  if (otherMemberships > 0) return;

  await prisma.$transaction([
    prisma.person.update({ where: { id: personId }, data: { passwordHash: null } }),
    prisma.session.deleteMany({ where: { personId } }),
  ]);

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'account.revoke',
    entityType: 'Person',
    entityId: personId,
    summary: 'Zugang entzogen',
  });

  revalidatePath(`/c/${slug}/benutzer`);
}
