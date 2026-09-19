'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/rbac';
import { slugify } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { ROLE_PRESETS, serializePermissions } from '@/lib/permissions';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Bitte geben Sie einen Namen mit mindestens zwei Zeichen an.'),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  mailDomain: z.string().trim().optional(),
  senderEmail: z.string().trim().optional(),
});

/**
 * Legt eine Community samt Systemrollen, Standardordnern und Vorlagen an und
 * macht die anlegende Person zur Leitung.
 */
export async function createCommunityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    return fail('Neue Communities legt die Plattformverwaltung an.');
  }

  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description'),
    mailDomain: formData.get('mailDomain'),
    senderEmail: formData.get('senderEmail'),
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;
  const baseSlug = slugify(data.slug || data.name);
  if (!baseSlug) {
    return fail('Aus dem Namen lässt sich keine Adresse ableiten. Bitte geben Sie eine Kurzadresse an.');
  }

  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.community.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  try {
    const community = await prisma.$transaction(async (tx) => {
      const created = await tx.community.create({
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          mailDomain: data.mailDomain || null,
          senderEmail: data.senderEmail || null,
          senderName: data.name,
        },
      });

      await tx.role.createMany({
        data: ROLE_PRESETS.map((preset) => ({
          communityId: created.id,
          key: preset.key,
          name: preset.name,
          description: preset.description,
          rank: preset.rank,
          isSystem: true,
          permissions: serializePermissions(preset.permissions),
        })),
      });

      const ownerRole = await tx.role.findFirstOrThrow({
        where: { communityId: created.id, key: 'owner' },
      });

      const membership = await tx.membership.create({
        data: { communityId: created.id, personId: user.id, status: 'ACTIVE' },
      });

      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: ownerRole.id },
      });

      await tx.folder.create({
        data: {
          communityId: created.id,
          name: 'Allgemein',
          path: '/Allgemein',
          description: 'Ablage für Unterlagen aller Mitglieder.',
          isSystem: true,
          createdById: user.id,
        },
      });

      return created;
    });

    await recordAudit({
      communityId: community.id,
      actorId: user.id,
      action: 'community.create',
      entityType: 'Community',
      entityId: community.id,
      summary: `Community "${community.name}" angelegt`,
    });

    revalidatePath('/communities');
    redirect(`/c/${community.slug}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    return fromError(error, 'Die Community konnte nicht angelegt werden.');
  }
}
