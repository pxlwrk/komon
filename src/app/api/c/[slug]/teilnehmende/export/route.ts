import { NextResponse } from 'next/server';

import { toCsv } from '@/lib/csv';
import { MEMBERSHIP_STATUS, label } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

/** Liefert die Teilnehmendenliste als CSV, passend zur aktuellen Suche. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'member.export');

  const search = new URL(request.url).searchParams.get('q')?.trim();

  const memberships = await prisma.membership.findMany({
    where: {
      communityId: context.community.id,
      ...(search
        ? {
            person: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { primaryEmail: { contains: search, mode: 'insensitive' } },
                { organization: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    include: {
      person: true,
      roles: { include: { role: { select: { name: true } } } },
      tags: { include: { tag: { select: { name: true } } } },
      fieldValues: { include: { definition: { select: { label: true } } } },
    },
    orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
  });

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { communityId: context.community.id },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: { id: true, label: true },
  });

  const rows = memberships.map((membership) => {
    const person = membership.person;
    const row: Record<string, unknown> = {
      Mitgliedsnummer: membership.memberNumber ?? '',
      Anrede: person.salutation ?? '',
      Titel: person.title ?? '',
      Vorname: person.firstName,
      Nachname: person.lastName,
      'E-Mail': person.primaryEmail,
      Telefon: person.phone ?? '',
      Mobil: person.mobile ?? '',
      Strasse: person.street ?? '',
      PLZ: person.postalCode ?? '',
      Ort: person.city ?? '',
      Land: person.country ?? '',
      Geburtsdatum: person.birthDate ? person.birthDate.toISOString().slice(0, 10) : '',
      Organisation: person.organization ?? '',
      Funktion: person.jobTitle ?? '',
      'Funktion in der Community': membership.position ?? '',
      Status: label(MEMBERSHIP_STATUS, membership.status),
      Rollen: membership.roles.map((link) => link.role.name).join(', '),
      Schlagworte: membership.tags.map((link) => link.tag.name).join(', '),
      'Dabei seit': membership.joinedAt.toISOString().slice(0, 10),
      Rundschreiben: membership.allowBulkEmail ? 'ja' : 'nein',
    };

    for (const definition of definitions) {
      const value = membership.fieldValues.find((entry) => entry.definitionId === definition.id);
      row[definition.label] = formatCustomValue(value?.value ?? null);
    }

    return row;
  });

  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : ['Mitgliedsnummer', 'Vorname', 'Nachname', 'E-Mail'];

  const csv = toCsv(rows, columns);
  const fileName = `teilnehmende-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function formatCustomValue(raw: string | null): string {
  if (!raw) return '';
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).join(', ');
    } catch {
      return raw;
    }
  }
  return raw;
}
