import 'server-only';

import { prisma } from '@/lib/prisma';
import type { CommunityContext } from '@/lib/rbac';

export type FolderAccess = {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
};

/**
 * Ermittelt die Rollen-IDs, mit denen die angemeldete Person in dieser
 * Community unterwegs ist. Die Plattformverwaltung erhaelt alle Rollen.
 */
export async function currentRoleIds(context: CommunityContext): Promise<string[]> {
  if (context.user.isSuperAdmin) {
    const roles = await prisma.role.findMany({
      where: { communityId: context.community.id },
      select: { id: true },
    });
    return roles.map((role) => role.id);
  }

  if (!context.access.membershipId) return [];

  const links = await prisma.membershipRole.findMany({
    where: { membershipId: context.access.membershipId },
    select: { roleId: true },
  });
  return links.map((link) => link.roleId);
}

/**
 * Bestimmt die Rechte an einem Ordner. Ordner ohne Einschraenkung folgen den
 * allgemeinen Berechtigungen, eingeschraenkte Ordner zusaetzlich den Regeln.
 */
export function resolveFolderAccess(params: {
  context: CommunityContext;
  visibility: string;
  rules: { roleId: string; level: string }[];
  roleIds: string[];
}): FolderAccess {
  const { context, visibility, rules, roleIds } = params;

  const globalManage = context.can('file.manage');
  const globalView = context.can('file.view');
  const globalUpload = context.can('file.upload');

  if (globalManage) {
    return { canRead: true, canWrite: true, canManage: true };
  }

  if (visibility !== 'RESTRICTED') {
    return { canRead: globalView, canWrite: globalUpload, canManage: false };
  }

  const matching = rules.filter((rule) => roleIds.includes(rule.roleId));
  if (matching.length === 0) {
    return { canRead: false, canWrite: false, canManage: false };
  }

  const levels = new Set(matching.map((rule) => rule.level));
  const canManage = levels.has('MANAGE');
  const canWrite = canManage || levels.has('WRITE');

  return {
    canRead: globalView || canWrite || canManage || levels.has('READ'),
    canWrite: globalUpload && (canWrite || canManage),
    canManage,
  };
}

/** Setzt den Pfad eines Ordners und aller Unterordner neu. */
export async function rebuildFolderPaths(folderId: string): Promise<void> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { parent: { select: { path: true } } },
  });
  if (!folder) return;

  const path = folder.parent ? `${folder.parent.path}/${folder.name}` : `/${folder.name}`;
  if (path !== folder.path) {
    await prisma.folder.update({ where: { id: folder.id }, data: { path } });
  }

  const children = await prisma.folder.findMany({
    where: { parentId: folder.id },
    select: { id: true },
  });
  for (const child of children) {
    await rebuildFolderPaths(child.id);
  }
}

/** Sammelt alle Vorfahren eines Ordners fuer die Brotkrumen-Navigation. */
export async function folderTrail(
  folderId: string | null,
): Promise<{ id: string; name: string }[]> {
  const trail: { id: string; name: string }[] = [];
  let current = folderId;

  while (current) {
    const folder: { id: string; name: string; parentId: string | null } | null =
      await prisma.folder.findUnique({
        where: { id: current },
        select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;
    trail.unshift({ id: folder.id, name: folder.name });
    current = folder.parentId;
  }

  return trail;
}
