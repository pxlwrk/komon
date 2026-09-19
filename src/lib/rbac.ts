import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { getCurrentUser, type CommunityAccess, type CurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions';

export class AccessDeniedError extends Error {
  constructor(public readonly permission: Permission | null = null) {
    super(
      permission
        ? `Für diese Aktion fehlt die Berechtigung "${permission}".`
        : 'Für diese Aktion fehlt die Berechtigung.',
    );
    this.name = 'AccessDeniedError';
  }
}

export type CommunityContext = {
  user: CurrentUser;
  community: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    timezone: string;
    locale: string;
    mailDomain: string | null;
    senderEmail: string | null;
    senderName: string | null;
    accentColor: string;
  };
  access: CommunityAccess;
  permissions: Set<Permission>;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  require: (permission: Permission) => void;
};

/** Erzwingt eine angemeldete Sitzung und leitet sonst zur Anmeldung. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/anmelden');
  }
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    throw new AccessDeniedError();
  }
  return user;
}

/**
 * Laedt den Kontext einer Community samt der Rechte der angemeldeten Person.
 * Für Administratorinnen der Plattform gelten alle Rechte.
 */
export async function requireCommunity(slug: string): Promise<CommunityContext> {
  const user = await requireUser();

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) {
    notFound();
  }

  let access = user.communities.find((entry) => entry.communityId === community.id);

  if (!access) {
    if (!user.isSuperAdmin) {
      notFound();
    }
    access = {
      communityId: community.id,
      communitySlug: community.slug,
      communityName: community.name,
      membershipId: '',
      membershipStatus: 'ACTIVE',
      roleKeys: ['superadmin'],
      roleNames: ['Plattformverwaltung'],
      permissions: [...ALL_PERMISSIONS],
    };
  }

  const permissions = new Set<Permission>(
    user.isSuperAdmin ? ALL_PERMISSIONS : access.permissions,
  );

  const can = (permission: Permission) => permissions.has(permission);

  return {
    user,
    community: {
      id: community.id,
      name: community.name,
      slug: community.slug,
      description: community.description,
      timezone: community.timezone,
      locale: community.locale,
      mailDomain: community.mailDomain,
      senderEmail: community.senderEmail,
      senderName: community.senderName,
      accentColor: community.accentColor,
    },
    access,
    permissions,
    can,
    canAny: (...list: Permission[]) => list.some(can),
    require: (permission: Permission) => {
      if (!can(permission)) {
        throw new AccessDeniedError(permission);
      }
    },
  };
}

/** Wie requireCommunity, bricht aber sofort ohne die benoetigte Berechtigung ab. */
export async function requirePermission(
  slug: string,
  permission: Permission,
): Promise<CommunityContext> {
  const context = await requireCommunity(slug);
  context.require(permission);
  return context;
}
