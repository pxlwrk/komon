'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { slugify } from '@/lib/format';
import { customFieldTypeValues, customFieldVisibilityValues } from '@/lib/enums';

const communitySchema = z.object({
  name: z.string().trim().min(2, 'Bitte geben Sie einen Namen an.'),
  description: z.string().trim().optional(),
  purpose: z.string().trim().optional(),
  timezone: z.string().trim().min(1),
  mailDomain: z.string().trim().optional(),
  senderEmail: z.string().trim().optional(),
  senderName: z.string().trim().optional(),
  accentColor: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export async function updateCommunityAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'community.manage');

  const parsed = communitySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    purpose: formData.get('purpose'),
    timezone: formData.get('timezone') || 'Europe/Berlin',
    mailDomain: formData.get('mailDomain'),
    senderEmail: formData.get('senderEmail'),
    senderName: formData.get('senderName'),
    accentColor: formData.get('accentColor'),
    status: formData.get('status') || 'ACTIVE',
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  if (data.senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.senderEmail)) {
    return fail('Die Absenderadresse sieht nicht gültig aus.', { senderEmail: 'Ungültige Adresse.' });
  }
  if (data.mailDomain && !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(data.mailDomain)) {
    return fail('Die Domain sieht nicht gültig aus.', { mailDomain: 'Ungültige Domain.' });
  }

  try {
    await prisma.community.update({
      where: { id: context.community.id },
      data: {
        name: data.name,
        description: data.description || null,
        purpose: data.purpose || null,
        timezone: data.timezone,
        mailDomain: data.mailDomain ? data.mailDomain.toLowerCase() : null,
        senderEmail: data.senderEmail ? data.senderEmail.toLowerCase() : null,
        senderName: data.senderName || null,
        accentColor: data.accentColor || '#1c66f0',
        status: data.status,
      },
    });

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'community.update',
      entityType: 'Community',
      entityId: context.community.id,
      summary: 'Einstellungen der Community geändert',
    });
  } catch (error) {
    return fromError(error, 'Die Einstellungen konnten nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/einstellungen`);
  return ok('Die Einstellungen wurden gespeichert.');
}

const fieldSchema = z.object({
  label: z.string().trim().min(1, 'Bitte geben Sie eine Beschriftung an.'),
  type: z.enum(customFieldTypeValues).default('TEXT'),
  description: z.string().trim().optional(),
  options: z.string().trim().optional(),
  required: z.boolean().default(false),
  visibility: z.enum(customFieldVisibilityValues).default('STAFF'),
  position: z.string().trim().optional(),
});

/** Legt ein Stammdatenfeld an oder aendert es. */
export async function saveCustomFieldAction(
  slug: string,
  fieldId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'community.manage');

  const parsed = fieldSchema.safeParse({
    label: formData.get('label'),
    type: formData.get('type') || 'TEXT',
    description: formData.get('description'),
    options: formData.get('options'),
    required: formData.get('required') !== null,
    visibility: formData.get('visibility') || 'STAFF',
    position: formData.get('position'),
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;
  const needsOptions = data.type === 'SELECT' || data.type === 'MULTISELECT';

  const options = (data.options ?? '')
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (needsOptions && options.length === 0) {
    return fail('Für eine Auswahl brauchen wir mindestens eine Möglichkeit.', {
      options: 'Bitte je Zeile eine Möglichkeit angeben.',
    });
  }

  const position = Number.parseInt(data.position ?? '', 10);

  try {
    if (fieldId) {
      const existing = await prisma.customFieldDefinition.findFirst({
        where: { id: fieldId, communityId: context.community.id },
      });
      if (!existing) return fail('Das Feld wurde nicht gefunden.');

      await prisma.customFieldDefinition.update({
        where: { id: existing.id },
        data: {
          label: data.label,
          type: data.type,
          description: data.description || null,
          options: needsOptions ? JSON.stringify(options) : null,
          required: data.required,
          visibility: data.visibility,
          position: Number.isFinite(position) ? position : existing.position,
        },
      });
    } else {
      const base = slugify(data.label).replace(/-/g, '_') || 'feld';
      let key = base;
      let suffix = 2;
      while (
        await prisma.customFieldDefinition.findUnique({
          where: { communityId_key: { communityId: context.community.id, key } },
          select: { id: true },
        })
      ) {
        key = `${base}_${suffix}`;
        suffix += 1;
      }

      await prisma.customFieldDefinition.create({
        data: {
          communityId: context.community.id,
          key,
          label: data.label,
          type: data.type,
          description: data.description || null,
          options: needsOptions ? JSON.stringify(options) : null,
          required: data.required,
          visibility: data.visibility,
          position: Number.isFinite(position) ? position : 0,
        },
      });
    }
  } catch (error) {
    return fromError(error, 'Das Feld konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/einstellungen`);
  return ok('Das Feld wurde gespeichert.');
}

export async function deleteCustomFieldAction(slug: string, fieldId: string): Promise<void> {
  const context = await requirePermission(slug, 'community.manage');
  await prisma.customFieldDefinition.deleteMany({
    where: { id: fieldId, communityId: context.community.id },
  });
  revalidatePath(`/c/${slug}/einstellungen`);
}

/** Legt ein Schlagwort an, damit es zur Auswahl steht. */
export async function createTagAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'community.manage');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return fail('Bitte geben Sie einen Namen an.');

  try {
    await prisma.tag.create({
      data: {
        communityId: context.community.id,
        name,
        description: String(formData.get('description') ?? '').trim() || null,
      },
    });
  } catch {
    return fail('Dieses Schlagwort gibt es bereits.');
  }

  revalidatePath(`/c/${slug}/einstellungen`);
  return ok('Das Schlagwort wurde angelegt.');
}

export async function deleteTagAction(slug: string, tagId: string): Promise<void> {
  const context = await requirePermission(slug, 'community.manage');
  await prisma.tag.deleteMany({ where: { id: tagId, communityId: context.community.id } });
  revalidatePath(`/c/${slug}/einstellungen`);
}
