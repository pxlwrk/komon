import 'server-only';

import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { cache } from 'react';

import { config } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { parsePermissions, type Permission } from '@/lib/permissions';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export type CommunityAccess = {
  communityId: string;
  communitySlug: string;
  communityName: string;
  membershipId: string;
  membershipStatus: string;
  roleKeys: string[];
  roleNames: string[];
  permissions: Permission[];
};

export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  locale: string;
  timezone: string;
  sessionId: string;
  activeCommunityId: string | null;
  communities: CommunityAccess[];
};

/**
 * Liest die aktuelle Sitzung. Das Ergebnis wird je Anfrage zwischengespeichert,
 * damit mehrere Aufrufe innerhalb eines Renderdurchlaufs guenstig bleiben.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(config.sessionCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      person: {
        include: {
          memberships: {
            include: {
              community: true,
              roles: { include: { role: true } },
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const person = session.person;
  if (person.status === 'ARCHIVED' || !person.passwordHash) {
    return null;
  }

  const communities: CommunityAccess[] = person.memberships
    .filter((membership) => membership.community.status === 'ACTIVE')
    .filter((membership) => membership.status === 'ACTIVE' || membership.status === 'PAUSED')
    .map((membership) => {
      const permissions = new Set<Permission>();
      for (const link of membership.roles) {
        for (const permission of parsePermissions(link.role.permissions)) {
          permissions.add(permission);
        }
      }
      return {
        communityId: membership.communityId,
        communitySlug: membership.community.slug,
        communityName: membership.community.name,
        membershipId: membership.id,
        membershipStatus: membership.status,
        roleKeys: membership.roles.map((link) => link.role.key),
        roleNames: membership.roles.map((link) => link.role.name),
        permissions: Array.from(permissions),
      };
    })
    .sort((a, b) => a.communityName.localeCompare(b.communityName, 'de'));

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: person.displayName || `${person.firstName} ${person.lastName}`.trim(),
    email: person.primaryEmail,
    isSuperAdmin: person.isSuperAdmin,
    mustChangePassword: person.mustChangePassword,
    locale: person.locale,
    timezone: person.timezone,
    sessionId: session.id,
    activeCommunityId: session.activeCommunityId,
    communities,
  };
});

export type LoginResult =
  | { ok: true; personId: string }
  | { ok: false; reason: 'INVALID' | 'LOCKED' | 'NO_ACCOUNT' };

/** Prueft die Zugangsdaten und legt bei Erfolg eine Sitzung an. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();
  const person = await prisma.person.findFirst({
    where: { primaryEmail: normalized },
  });

  if (!person || !person.passwordHash) {
    // Gleiche Laufzeit wie bei einem echten Versuch, um Rueckschluesse zu vermeiden.
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    return { ok: false, reason: 'NO_ACCOUNT' };
  }

  if (person.lockedUntil && person.lockedUntil.getTime() > Date.now()) {
    return { ok: false, reason: 'LOCKED' };
  }

  const valid = await verifyPassword(password, person.passwordHash);
  if (!valid) {
    const attempts = person.failedLoginAttempts + 1;
    await prisma.person.update({
      where: { id: person.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return { ok: false, reason: 'INVALID' };
  }

  if (person.status !== 'ACTIVE') {
    return { ok: false, reason: 'NO_ACCOUNT' };
  }

  const headerList = await headers();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000);

  const firstMembership = await prisma.membership.findFirst({
    where: { personId: person.id, status: 'ACTIVE' },
    orderBy: { joinedAt: 'asc' },
  });

  await prisma.$transaction([
    prisma.session.create({
      data: {
        token,
        personId: person.id,
        expiresAt,
        ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: headerList.get('user-agent') ?? null,
        activeCommunityId: firstMembership?.communityId ?? null,
      },
    }),
    prisma.person.update({
      where: { id: person.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return { ok: true, personId: person.id };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(config.sessionCookieName)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(config.sessionCookieName);
}

/** Merkt sich die zuletzt gewaehlte Community in der Sitzung. */
export async function setActiveCommunity(sessionId: string, communityId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeCommunityId: communityId },
  });
}
