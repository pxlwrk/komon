'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { normalizeEmail } from '@/lib/mail';
import { parseCsv, normalizeHeader } from '@/lib/csv';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import {
  membershipStatusValues,
  mailPreferenceValues,
  personStatusValues,
  salutationValues,
} from '@/lib/enums';

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const memberSchema = z.object({
  salutation: z.enum(salutationValues).nullable().optional(),
  title: optionalText,
  firstName: z.string().trim().min(1, 'Bitte geben Sie einen Vornamen an.'),
  lastName: z.string().trim().min(1, 'Bitte geben Sie einen Nachnamen an.'),
  displayName: optionalText,
  pronouns: optionalText,
  primaryEmail: z.string().trim().toLowerCase().email('Diese E-Mail-Adresse sieht nicht gültig aus.'),
  phone: optionalText,
  mobile: optionalText,
  street: optionalText,
  postalCode: optionalText,
  city: optionalText,
  region: optionalText,
  country: optionalText,
  birthDate: optionalText,
  organization: optionalText,
  jobTitle: optionalText,
  website: optionalText,
  notes: optionalText,
  memberNumber: optionalText,
  position: optionalText,
  membershipStatus: z.enum(membershipStatusValues).default('ACTIVE'),
  personStatus: z.enum(personStatusValues).default('ACTIVE'),
  mailPreference: z.enum(mailPreferenceValues).default('REGULAR'),
  allowBulkEmail: z.boolean().default(true),
});

function readForm(formData: FormData) {
  const value = (key: string) => {
    const raw = formData.get(key);
    return typeof raw === 'string' ? raw : '';
  };

  return {
    salutation: value('salutation') || null,
    title: value('title'),
    firstName: value('firstName'),
    lastName: value('lastName'),
    displayName: value('displayName'),
    pronouns: value('pronouns'),
    primaryEmail: value('primaryEmail'),
    phone: value('phone'),
    mobile: value('mobile'),
    street: value('street'),
    postalCode: value('postalCode'),
    city: value('city'),
    region: value('region'),
    country: value('country'),
    birthDate: value('birthDate'),
    organization: value('organization'),
    jobTitle: value('jobTitle'),
    website: value('website'),
    notes: value('notes'),
    memberNumber: value('memberNumber'),
    position: value('position'),
    membershipStatus: value('membershipStatus') || 'ACTIVE',
    personStatus: value('personStatus') || 'ACTIVE',
    mailPreference: value('mailPreference') || 'REGULAR',
    allowBulkEmail: formData.get('allowBulkEmail') !== null,
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Speichert die frei definierten Zusatzfelder einer Mitgliedschaft. */
async function saveCustomFields(communityId: string, membershipId: string, formData: FormData) {
  const definitions = await prisma.customFieldDefinition.findMany({ where: { communityId } });

  for (const definition of definitions) {
    const key = `cf_${definition.key}`;
    let value: string | null;

    if (definition.type === 'MULTISELECT') {
      const values = formData.getAll(key).filter((entry): entry is string => typeof entry === 'string');
      value = values.length > 0 ? JSON.stringify(values) : null;
    } else if (definition.type === 'BOOLEAN') {
      value = formData.get(key) !== null ? 'true' : 'false';
    } else {
      const raw = formData.get(key);
      value = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
    }

    if (value === null) {
      await prisma.customFieldValue.deleteMany({
        where: { definitionId: definition.id, membershipId },
      });
    } else {
      await prisma.customFieldValue.upsert({
        where: { definitionId_membershipId: { definitionId: definition.id, membershipId } },
        create: { definitionId: definition.id, membershipId, value },
        update: { value },
      });
    }
  }
}

/** Legt eine neue Teilnehmerin oder einen neuen Teilnehmer an. */
export async function createMemberAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'member.create');
  const parsed = memberSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;
  let membershipId: string;

  try {
    const existing = await prisma.person.findUnique({ where: { primaryEmail: data.primaryEmail } });

    const person = existing
      ? existing
      : await prisma.person.create({
          data: {
            salutation: data.salutation,
            title: data.title ?? null,
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName ?? null,
            pronouns: data.pronouns ?? null,
            primaryEmail: data.primaryEmail,
            phone: data.phone ?? null,
            mobile: data.mobile ?? null,
            street: data.street ?? null,
            postalCode: data.postalCode ?? null,
            city: data.city ?? null,
            region: data.region ?? null,
            country: data.country ?? null,
            birthDate: parseDate(data.birthDate),
            organization: data.organization ?? null,
            jobTitle: data.jobTitle ?? null,
            website: data.website ?? null,
            notes: data.notes ?? null,
            status: data.personStatus,
            emailAddresses: {
              create: { address: data.primaryEmail, isPrimary: true, label: 'Hauptadresse' },
            },
          },
        });

    const alreadyMember = await prisma.membership.findUnique({
      where: { communityId_personId: { communityId: context.community.id, personId: person.id } },
    });

    if (alreadyMember) {
      return fail('Diese Person ist bereits Teil der Community.');
    }

    const memberRole = await prisma.role.findFirst({
      where: { communityId: context.community.id, key: 'member' },
    });

    const membership = await prisma.membership.create({
      data: {
        communityId: context.community.id,
        personId: person.id,
        memberNumber: data.memberNumber ?? null,
        position: data.position ?? null,
        status: data.membershipStatus,
        mailPreference: data.mailPreference,
        allowBulkEmail: data.allowBulkEmail,
        roles: memberRole ? { create: { roleId: memberRole.id } } : undefined,
      },
    });
    membershipId = membership.id;

    await saveCustomFields(context.community.id, membership.id, formData);

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'member.create',
      entityType: 'Membership',
      entityId: membership.id,
      summary: `${data.firstName} ${data.lastName} aufgenommen`,
    });
  } catch (error) {
    return fromError(error, 'Die Person konnte nicht angelegt werden.');
  }

  revalidatePath(`/c/${slug}/teilnehmende`);
  redirect(`/c/${slug}/teilnehmende/${membershipId}`);
}

/** Aktualisiert Stammdaten und Mitgliedsangaben. */
export async function updateMemberAction(
  slug: string,
  membershipId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'member.update');
  const parsed = memberSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  try {
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, communityId: context.community.id },
      include: { person: true },
    });

    if (!membership) {
      return fail('Dieser Eintrag wurde nicht gefunden.');
    }

    const emailChanged = membership.person.primaryEmail !== data.primaryEmail;
    if (emailChanged) {
      const conflict = await prisma.person.findUnique({ where: { primaryEmail: data.primaryEmail } });
      if (conflict && conflict.id !== membership.personId) {
        return fail(
          'Diese E-Mail-Adresse gehört bereits zu einer anderen Person.',
          { primaryEmail: 'Adresse ist bereits vergeben.' },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.person.update({
        where: { id: membership.personId },
        data: {
          salutation: data.salutation,
          title: data.title ?? null,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName ?? null,
          pronouns: data.pronouns ?? null,
          primaryEmail: data.primaryEmail,
          phone: data.phone ?? null,
          mobile: data.mobile ?? null,
          street: data.street ?? null,
          postalCode: data.postalCode ?? null,
          city: data.city ?? null,
          region: data.region ?? null,
          country: data.country ?? null,
          birthDate: parseDate(data.birthDate),
          organization: data.organization ?? null,
          jobTitle: data.jobTitle ?? null,
          website: data.website ?? null,
          notes: data.notes ?? null,
          status: data.personStatus,
        },
      });

      if (emailChanged) {
        await tx.emailAddress.updateMany({
          where: { personId: membership.personId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.emailAddress.upsert({
          where: { address: data.primaryEmail },
          create: {
            personId: membership.personId,
            address: data.primaryEmail,
            isPrimary: true,
            label: 'Hauptadresse',
          },
          update: { isPrimary: true, personId: membership.personId, status: 'ACTIVE' },
        });
      }

      await tx.membership.update({
        where: { id: membership.id },
        data: {
          memberNumber: data.memberNumber ?? null,
          position: data.position ?? null,
          status: data.membershipStatus,
          mailPreference: data.mailPreference,
          allowBulkEmail: data.allowBulkEmail,
          leftAt: data.membershipStatus === 'LEFT' ? (membership.leftAt ?? new Date()) : null,
        },
      });
    });

    await saveCustomFields(context.community.id, membership.id, formData);

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'member.update',
      entityType: 'Membership',
      entityId: membership.id,
      summary: `Stammdaten von ${data.firstName} ${data.lastName} aktualisiert`,
    });
  } catch (error) {
    return fromError(error, 'Die Änderungen konnten nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/teilnehmende`);
  revalidatePath(`/c/${slug}/teilnehmende/${membershipId}`);
  return ok('Die Stammdaten wurden gespeichert.');
}

/** Entfernt eine Person aus der Community, die Stammdaten bleiben erhalten. */
export async function removeMemberAction(slug: string, membershipId: string): Promise<void> {
  const context = await requirePermission(slug, 'member.delete');

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, communityId: context.community.id },
    include: { person: { select: { firstName: true, lastName: true } } },
  });
  if (!membership) return;

  await prisma.membership.delete({ where: { id: membership.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'member.remove',
    entityType: 'Membership',
    entityId: membership.id,
    summary: `${membership.person.firstName} ${membership.person.lastName} aus der Community entfernt`,
  });

  revalidatePath(`/c/${slug}/teilnehmende`);
  redirect(`/c/${slug}/teilnehmende`);
}

/** Setzt die Schlagworte einer Mitgliedschaft neu. */
export async function setMemberTagsAction(
  slug: string,
  membershipId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'member.update');

  const raw = String(formData.get('tags') ?? '');
  const names = Array.from(
    new Set(
      raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  try {
    const tagIds: string[] = [];
    for (const name of names) {
      const tag = await prisma.tag.upsert({
        where: { communityId_name: { communityId: context.community.id, name } },
        create: { communityId: context.community.id, name },
        update: {},
      });
      tagIds.push(tag.id);
    }

    await prisma.membershipTag.deleteMany({ where: { membershipId } });
    if (tagIds.length > 0) {
      await prisma.membershipTag.createMany({
        data: tagIds.map((tagId) => ({ membershipId, tagId })),
      });
    }
  } catch (error) {
    return fromError(error, 'Die Schlagworte konnten nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/teilnehmende/${membershipId}`);
  return ok('Die Schlagworte wurden gespeichert.');
}

/** Ergaenzt oder entfernt eine weitere E-Mail-Adresse. */
export async function addEmailAddressAction(
  slug: string,
  membershipId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'member.update');

  const address = normalizeEmail(String(formData.get('address') ?? ''));
  const label = String(formData.get('label') ?? '').trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
    return fail('Bitte geben Sie eine gültige E-Mail-Adresse an.');
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, communityId: context.community.id },
    select: { personId: true },
  });
  if (!membership) return fail('Dieser Eintrag wurde nicht gefunden.');

  const existing = await prisma.emailAddress.findUnique({ where: { address } });
  if (existing && existing.personId !== membership.personId) {
    return fail('Diese Adresse ist bereits einer anderen Person zugeordnet.');
  }

  await prisma.emailAddress.upsert({
    where: { address },
    create: { personId: membership.personId, address, label },
    update: { label, status: 'ACTIVE' },
  });

  revalidatePath(`/c/${slug}/teilnehmende/${membershipId}`);
  return ok('Die Adresse wurde hinterlegt.');
}

export async function removeEmailAddressAction(
  slug: string,
  membershipId: string,
  addressId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'member.update');

  const address = await prisma.emailAddress.findUnique({ where: { id: addressId } });
  if (!address || address.isPrimary) return;

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, communityId: context.community.id },
    select: { personId: true },
  });
  if (!membership || membership.personId !== address.personId) return;

  await prisma.emailAddress.delete({ where: { id: addressId } });
  revalidatePath(`/c/${slug}/teilnehmende/${membershipId}`);
}

// --- Import ----------------------------------------------------------------

const IMPORT_FIELDS: Record<string, string> = {
  vorname: 'firstName',
  first_name: 'firstName',
  firstname: 'firstName',
  nachname: 'lastName',
  last_name: 'lastName',
  lastname: 'lastName',
  name: 'lastName',
  email: 'primaryEmail',
  e_mail: 'primaryEmail',
  mail: 'primaryEmail',
  telefon: 'phone',
  phone: 'phone',
  mobil: 'mobile',
  mobile: 'mobile',
  strasse: 'street',
  street: 'street',
  plz: 'postalCode',
  postleitzahl: 'postalCode',
  ort: 'city',
  stadt: 'city',
  city: 'city',
  land: 'country',
  country: 'country',
  organisation: 'organization',
  firma: 'organization',
  funktion: 'jobTitle',
  mitgliedsnummer: 'memberNumber',
  notizen: 'notes',
};

/**
 * Liest eine CSV-Datei ein und legt fehlende Personen an. Bereits bekannte
 * Adressen werden der Community hinzugefuegt, ohne Stammdaten zu ueberschreiben.
 */
export async function importMembersAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'member.create');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Bitte wählen Sie eine CSV-Datei aus.');
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return fail('Die Datei enthält keine auswertbaren Zeilen.');
  }

  const header = rows[0].map((column) => IMPORT_FIELDS[normalizeHeader(column)] ?? null);
  if (!header.includes('primaryEmail')) {
    return fail('Es fehlt eine Spalte mit der E-Mail-Adresse. Erwartet wird eine Spalte "E-Mail".');
  }

  const memberRole = await prisma.role.findFirst({
    where: { communityId: context.community.id, key: 'member' },
  });

  let created = 0;
  let joined = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const record: Record<string, string> = {};
    header.forEach((field, column) => {
      if (field && row[column]) record[field] = row[column].trim();
    });

    const email = normalizeEmail(record.primaryEmail ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      skipped += 1;
      if (problems.length < 5) problems.push(`Zeile ${index + 1}: keine gültige E-Mail-Adresse.`);
      continue;
    }

    try {
      let person = await prisma.person.findUnique({ where: { primaryEmail: email } });

      if (!person) {
        person = await prisma.person.create({
          data: {
            firstName: record.firstName || email.split('@')[0],
            lastName: record.lastName || '',
            primaryEmail: email,
            phone: record.phone || null,
            mobile: record.mobile || null,
            street: record.street || null,
            postalCode: record.postalCode || null,
            city: record.city || null,
            country: record.country || null,
            organization: record.organization || null,
            jobTitle: record.jobTitle || null,
            notes: record.notes || null,
            emailAddresses: { create: { address: email, isPrimary: true, label: 'Hauptadresse' } },
          },
        });
        created += 1;
      }

      const existing = await prisma.membership.findUnique({
        where: { communityId_personId: { communityId: context.community.id, personId: person.id } },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.membership.create({
        data: {
          communityId: context.community.id,
          personId: person.id,
          memberNumber: record.memberNumber || null,
          roles: memberRole ? { create: { roleId: memberRole.id } } : undefined,
        },
      });
      joined += 1;
    } catch (error) {
      skipped += 1;
      if (problems.length < 5) {
        problems.push(`Zeile ${index + 1}: ${error instanceof Error ? error.message : 'Fehler beim Speichern.'}`);
      }
    }
  }

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'member.import',
    entityType: 'Community',
    entityId: context.community.id,
    summary: `CSV-Import: ${joined} aufgenommen, ${created} neu angelegt, ${skipped} übersprungen`,
  });

  revalidatePath(`/c/${slug}/teilnehmende`);

  const summary = `${joined} Personen aufgenommen, davon ${created} neu angelegt. ${skipped} Zeilen übersprungen.`;
  return problems.length > 0
    ? ok(`${summary} Hinweise: ${problems.join(' ')}`)
    : ok(summary);
}

/** Weist einer Mitgliedschaft Rollen zu. */
export async function setMemberRolesAction(
  slug: string,
  membershipId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'role.manage');

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, communityId: context.community.id },
    include: { roles: { include: { role: true } } },
  });
  if (!membership) return fail('Dieser Eintrag wurde nicht gefunden.');

  const selected = formData.getAll('roleIds').filter((value): value is string => typeof value === 'string');

  const roles = await prisma.role.findMany({
    where: { id: { in: selected }, communityId: context.community.id },
    select: { id: true, key: true },
  });

  // Die letzte Person mit Leitungsrolle darf diese nicht selbst verlieren.
  const hadOwner = membership.roles.some((link) => link.role.key === 'owner');
  const keepsOwner = roles.some((role) => role.key === 'owner');
  if (hadOwner && !keepsOwner) {
    const otherOwners = await prisma.membershipRole.count({
      where: {
        role: { communityId: context.community.id, key: 'owner' },
        membershipId: { not: membership.id },
      },
    });
    if (otherOwners === 0) {
      return fail('Die Community braucht mindestens eine Person mit der Rolle Leitung.');
    }
  }

  await prisma.$transaction([
    prisma.membershipRole.deleteMany({ where: { membershipId: membership.id } }),
    prisma.membershipRole.createMany({
      data: roles.map((role) => ({ membershipId: membership.id, roleId: role.id })),
    }),
  ]);

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'member.roles',
    entityType: 'Membership',
    entityId: membership.id,
    summary: `Rollen geändert: ${roles.map((role) => role.key).join(', ') || 'keine'}`,
  });

  revalidatePath(`/c/${slug}/teilnehmende/${membershipId}`);
  return ok('Die Rollen wurden gespeichert.');
}

/** Ordnet eine Mitgliedschaft den ausgewaehlten Gruppen zu. */
export async function setMemberGroupsAction(
  slug: string,
  membershipId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'group.manage');

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, communityId: context.community.id },
    select: { id: true },
  });
  if (!membership) return fail('Dieser Eintrag wurde nicht gefunden.');

  const selected = formData.getAll('groupIds').filter((value): value is string => typeof value === 'string');
  const groups = await prisma.group.findMany({
    where: { id: { in: selected }, communityId: context.community.id, type: 'STATIC' },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.groupMember.deleteMany({
      where: { membershipId: membership.id, group: { type: 'STATIC' } },
    }),
    prisma.groupMember.createMany({
      data: groups.map((group) => ({ membershipId: membership.id, groupId: group.id })),
    }),
  ]);

  revalidatePath(`/c/${slug}/teilnehmende/${membershipId}`);
  return ok('Die Gruppenzuordnung wurde gespeichert.');
}
