'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

const groupSchema = z.object({
  name: z.string().trim().min(2, 'Bitte geben Sie einen Namen an.'),
  description: z.string().trim().optional(),
  color: z.string().trim().optional(),
});

export async function createGroupAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'group.manage');

  const parsed = groupSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    color: formData.get('color'),
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const base = slugify(parsed.data.name) || 'gruppe';
  let key = base;
  let suffix = 2;
  while (
    await prisma.group.findUnique({
      where: { communityId_key: { communityId: context.community.id, key } },
      select: { id: true },
    })
  ) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }

  try {
    const group = await prisma.group.create({
      data: {
        communityId: context.community.id,
        key,
        name: parsed.data.name,
        description: parsed.data.description || null,
        color: parsed.data.color || null,
      },
    });

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'group.create',
      entityType: 'Group',
      entityId: group.id,
      summary: `Gruppe "${group.name}" angelegt`,
    });
  } catch (error) {
    return fromError(error, 'Die Gruppe konnte nicht angelegt werden.');
  }

  revalidatePath(`/c/${slug}/gruppen`);
  return ok('Die Gruppe wurde angelegt.');
}

export async function updateGroupAction(
  slug: string,
  groupId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'group.manage');

  const parsed = groupSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    color: formData.get('color'),
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  try {
    await prisma.group.updateMany({
      where: { id: groupId, communityId: context.community.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        color: parsed.data.color || null,
      },
    });
  } catch (error) {
    return fromError(error, 'Die Gruppe konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/gruppen`);
  return ok('Die Gruppe wurde gespeichert.');
}

export async function deleteGroupAction(slug: string, groupId: string): Promise<void> {
  const context = await requirePermission(slug, 'group.manage');
  await prisma.group.deleteMany({ where: { id: groupId, communityId: context.community.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'group.delete',
    entityType: 'Group',
    entityId: groupId,
    summary: 'Gruppe gelöscht',
  });

  revalidatePath(`/c/${slug}/gruppen`);
}

/** Setzt die Mitglieder einer Gruppe neu. */
export async function setGroupMembersAction(
  slug: string,
  groupId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'group.manage');

  const group = await prisma.group.findFirst({
    where: { id: groupId, communityId: context.community.id },
  });
  if (!group) return fail('Die Gruppe wurde nicht gefunden.');

  const selected = formData
    .getAll('membershipIds')
    .filter((value): value is string => typeof value === 'string');

  const memberships = await prisma.membership.findMany({
    where: { id: { in: selected }, communityId: context.community.id },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { groupId } }),
    prisma.groupMember.createMany({
      data: memberships.map((membership) => ({ groupId, membershipId: membership.id })),
    }),
  ]);

  revalidatePath(`/c/${slug}/gruppen`);
  return ok(`${memberships.length} Personen sind nun in dieser Gruppe.`);
}
