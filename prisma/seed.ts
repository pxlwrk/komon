/**
 * Beispieldaten für eine erste Runde durch die Anwendung.
 *
 * Der Seed legt zwei Communities mit unterschiedlichem Zuschnitt an, damit die
 * Mehrmandantenfähigkeit sichtbar wird: einen Verein mit Vorstand und
 * Arbeitskreisen sowie eine offene Nachbarschaftsinitiative.
 *
 * Start mit `npm run db:seed`. Der Seed ist wiederholbar: vorhandene
 * Beispieldaten werden zuvor entfernt.
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { ROLE_PRESETS, serializePermissions } from '../src/lib/permissions';

const prisma = new PrismaClient();

const PASSWORD = 'komon-demo-2026';

type PersonSeed = {
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
  organization?: string;
  jobTitle?: string;
  phone?: string;
  withAccount?: boolean;
  superAdmin?: boolean;
};

const PEOPLE: PersonSeed[] = [
  {
    firstName: 'Mira',
    lastName: 'Lindqvist',
    email: 'mira.lindqvist@example.org',
    city: 'Leipzig',
    jobTitle: 'Vorsitz',
    withAccount: true,
    superAdmin: true,
  },
  {
    firstName: 'Jonas',
    lastName: 'Feld',
    email: 'jonas.feld@example.org',
    city: 'Leipzig',
    jobTitle: 'Kasse',
    withAccount: true,
  },
  {
    firstName: 'Anna',
    lastName: 'Berger',
    email: 'anna.berger@example.org',
    city: 'Halle',
    jobTitle: 'Öffentlichkeitsarbeit',
    withAccount: true,
  },
  {
    firstName: 'Tarek',
    lastName: 'Osman',
    email: 'tarek.osman@example.org',
    city: 'Leipzig',
    organization: 'Stadtwerkstatt',
    withAccount: true,
  },
  { firstName: 'Lena', lastName: 'Hoffmann', email: 'lena.hoffmann@example.org', city: 'Leipzig' },
  { firstName: 'Paul', lastName: 'Winter', email: 'paul.winter@example.org', city: 'Markkleeberg' },
  { firstName: 'Sofia', lastName: 'Ricci', email: 'sofia.ricci@example.org', city: 'Leipzig' },
  { firstName: 'Ben', lastName: 'Kruse', email: 'ben.kruse@example.org', city: 'Schkeuditz' },
  { firstName: 'Nora', lastName: 'Albrecht', email: 'nora.albrecht@example.org', city: 'Leipzig' },
  { firstName: 'Elias', lastName: 'Voigt', email: 'elias.voigt@example.org', city: 'Halle' },
  { firstName: 'Hanna', lastName: 'Sommer', email: 'hanna.sommer@example.org', city: 'Leipzig' },
  { firstName: 'Kai', lastName: 'Brenner', email: 'kai.brenner@example.org', city: 'Leipzig' },
];

function daysFromNow(days: number, hour = 18, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function reset(): Promise<void> {
  // Die Löschreihenfolge folgt den Fremdschlüsseln, SQLite verzeiht hier wenig.
  await prisma.auditLog.deleteMany();
  await prisma.emailDelivery.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.listMessageAttachment.deleteMany();
  await prisma.listMessage.deleteMany();
  await prisma.listSubscription.deleteMany();
  await prisma.mailingList.deleteMany();
  await prisma.eventFeedback.deleteMany();
  await prisma.eventResource.deleteMany();
  await prisma.eventTask.deleteMany();
  await prisma.eventAgendaItem.deleteMany();
  await prisma.eventParticipation.deleteMany();
  await prisma.calendarEntry.deleteMany();
  await prisma.journalComment.deleteMany();
  await prisma.journalEntryTag.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.event.deleteMany();
  await prisma.fileVersion.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.folderAccessRule.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.customFieldDefinition.deleteMany();
  await prisma.membershipTag.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.membershipRole.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.accountInvitation.deleteMany();
  await prisma.role.deleteMany();
  await prisma.community.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailAddress.deleteMany();
  await prisma.person.deleteMany();
}

async function createCommunity(params: {
  name: string;
  slug: string;
  description: string;
  purpose: string;
  mailDomain: string;
  senderEmail: string;
}) {
  const community = await prisma.community.create({
    data: {
      name: params.name,
      slug: params.slug,
      description: params.description,
      purpose: params.purpose,
      mailDomain: params.mailDomain,
      senderEmail: params.senderEmail,
      senderName: params.name,
    },
  });

  await prisma.role.createMany({
    data: ROLE_PRESETS.map((preset) => ({
      communityId: community.id,
      key: preset.key,
      name: preset.name,
      description: preset.description,
      rank: preset.rank,
      isSystem: true,
      permissions: serializePermissions(preset.permissions),
    })),
  });

  const roles = await prisma.role.findMany({ where: { communityId: community.id } });
  const roleByKey = new Map(roles.map((role) => [role.key, role]));

  return { community, roleByKey };
}

async function main(): Promise<void> {
  console.log('Beispieldaten werden angelegt.');
  await reset();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // --- Personen ------------------------------------------------------------
  const personByEmail = new Map<string, { id: string }>();

  for (const entry of PEOPLE) {
    const person = await prisma.person.create({
      data: {
        firstName: entry.firstName,
        lastName: entry.lastName,
        primaryEmail: entry.email,
        city: entry.city ?? null,
        country: 'Deutschland',
        organization: entry.organization ?? null,
        jobTitle: entry.jobTitle ?? null,
        phone: entry.phone ?? null,
        passwordHash: entry.withAccount ? passwordHash : null,
        isSuperAdmin: entry.superAdmin ?? false,
        consentAt: new Date(),
        consentText: 'Einverständnis zur Verarbeitung der Stammdaten beim Beitritt erteilt.',
        emailAddresses: {
          create: { address: entry.email, isPrimary: true, label: 'Hauptadresse' },
        },
      },
    });
    personByEmail.set(entry.email, person);
  }

  const mira = personByEmail.get('mira.lindqvist@example.org')!;
  const jonas = personByEmail.get('jonas.feld@example.org')!;
  const anna = personByEmail.get('anna.berger@example.org')!;
  const tarek = personByEmail.get('tarek.osman@example.org')!;

  // --- Community 1: Verein -------------------------------------------------
  const verein = await createCommunity({
    name: 'Kulturverein Nordklang',
    slug: 'nordklang',
    description: 'Wir machen Musik und Kultur im Leipziger Norden zugänglich.',
    purpose: 'Kulturelle Teilhabe für alle, unabhängig vom Geldbeutel.',
    mailDomain: 'listen.nordklang.example',
    senderEmail: 'info@nordklang.example',
  });

  const vereinMemberships = new Map<string, { id: string; personId: string }>();

  for (const entry of PEOPLE) {
    const person = personByEmail.get(entry.email)!;
    const roleKey =
      entry.email === 'mira.lindqvist@example.org'
        ? 'owner'
        : entry.email === 'jonas.feld@example.org'
          ? 'admin'
          : entry.email === 'anna.berger@example.org'
            ? 'editor'
            : entry.email === 'tarek.osman@example.org'
              ? 'organizer'
              : 'member';

    const membership = await prisma.membership.create({
      data: {
        communityId: verein.community.id,
        personId: person.id,
        status: 'ACTIVE',
        memberNumber: `N-${String(vereinMemberships.size + 1).padStart(3, '0')}`,
        position: entry.jobTitle ?? null,
        joinedAt: daysFromNow(-1 * (30 + vereinMemberships.size * 45)),
        roles: { create: { roleId: verein.roleByKey.get(roleKey)!.id } },
      },
    });
    vereinMemberships.set(entry.email, { id: membership.id, personId: person.id });
  }

  // Stammdatenfelder
  const beitrag = await prisma.customFieldDefinition.create({
    data: {
      communityId: verein.community.id,
      key: 'beitragssatz',
      label: 'Beitragssatz',
      type: 'SELECT',
      options: JSON.stringify(['Regulär', 'Ermäßigt', 'Fördernd', 'Beitragsfrei']),
      description: 'Grundlage für den Jahresbeitrag.',
      visibility: 'STAFF',
      required: false,
      position: 10,
    },
  });

  await prisma.customFieldDefinition.create({
    data: {
      communityId: verein.community.id,
      key: 'instrument',
      label: 'Instrument',
      type: 'TEXT',
      description: 'Womit bringt sich die Person musikalisch ein?',
      visibility: 'MEMBER',
      position: 20,
    },
  });

  let index = 0;
  for (const [, membership] of vereinMemberships) {
    await prisma.customFieldValue.create({
      data: {
        definitionId: beitrag.id,
        membershipId: membership.id,
        value: ['Regulär', 'Ermäßigt', 'Fördernd'][index % 3],
      },
    });
    index += 1;
  }

  // Schlagworte
  const tagVorstand = await prisma.tag.create({
    data: { communityId: verein.community.id, name: 'Vorstand', color: '#1c66f0' },
  });
  const tagNeu = await prisma.tag.create({
    data: { communityId: verein.community.id, name: 'Neuzugang', color: '#0ea5e9' },
  });

  await prisma.membershipTag.createMany({
    data: [
      { membershipId: vereinMemberships.get('mira.lindqvist@example.org')!.id, tagId: tagVorstand.id },
      { membershipId: vereinMemberships.get('jonas.feld@example.org')!.id, tagId: tagVorstand.id },
      { membershipId: vereinMemberships.get('anna.berger@example.org')!.id, tagId: tagVorstand.id },
      { membershipId: vereinMemberships.get('kai.brenner@example.org')!.id, tagId: tagNeu.id },
      { membershipId: vereinMemberships.get('hanna.sommer@example.org')!.id, tagId: tagNeu.id },
    ],
  });

  // Gruppen
  const gruppeVorstand = await prisma.group.create({
    data: {
      communityId: verein.community.id,
      key: 'vorstand',
      name: 'Vorstand',
      description: 'Gewählter Vorstand des Vereins.',
      members: {
        create: [
          { membershipId: vereinMemberships.get('mira.lindqvist@example.org')!.id },
          { membershipId: vereinMemberships.get('jonas.feld@example.org')!.id },
          { membershipId: vereinMemberships.get('anna.berger@example.org')!.id },
        ],
      },
    },
  });

  const gruppeTechnik = await prisma.group.create({
    data: {
      communityId: verein.community.id,
      key: 'technik',
      name: 'Arbeitskreis Technik',
      description: 'Kümmert sich um Ton, Licht und Aufbau.',
      members: {
        create: [
          { membershipId: vereinMemberships.get('tarek.osman@example.org')!.id },
          { membershipId: vereinMemberships.get('ben.kruse@example.org')!.id },
          { membershipId: vereinMemberships.get('elias.voigt@example.org')!.id },
        ],
      },
    },
  });

  // Mailinglisten
  const listeVorstand = await prisma.mailingList.create({
    data: {
      communityId: verein.community.id,
      name: 'Vorstand',
      localPart: 'vorstand',
      address: 'vorstand@listen.nordklang.example',
      description: 'Interner Austausch des Vorstands.',
      listType: 'DISCUSSION',
      postingPolicy: 'SUBSCRIBERS',
      moderationPolicy: 'NON_SUBSCRIBERS',
      subscriptionPolicy: 'CLOSED',
      replyToMode: 'LIST',
      archivePolicy: 'SUBSCRIBERS',
      subjectPrefix: '[Vorstand]',
      footerText: 'Diese Liste ist vertraulich.',
      autoSubscribeGroupId: gruppeVorstand.id,
    },
  });

  const listeAlle = await prisma.mailingList.create({
    data: {
      communityId: verein.community.id,
      name: 'Alle Mitglieder',
      localPart: 'alle',
      address: 'alle@listen.nordklang.example',
      description: 'Ankündigungen an alle Mitglieder.',
      listType: 'ANNOUNCE',
      postingPolicy: 'MODERATORS',
      moderationPolicy: 'NONE',
      subscriptionPolicy: 'APPROVAL',
      replyToMode: 'SENDER',
      archivePolicy: 'MEMBERS',
      subjectPrefix: '[Nordklang]',
    },
  });

  await prisma.listSubscription.createMany({
    data: [
      { listId: listeVorstand.id, personId: mira.id, role: 'OWNER', status: 'ACTIVE' },
      { listId: listeVorstand.id, personId: jonas.id, role: 'MODERATOR', status: 'ACTIVE' },
      { listId: listeVorstand.id, personId: anna.id, role: 'SUBSCRIBER', status: 'ACTIVE' },
    ],
  });

  await prisma.listSubscription.createMany({
    data: Array.from(vereinMemberships.values()).map((membership) => ({
      listId: listeAlle.id,
      personId: membership.personId,
      role: membership.personId === mira.id ? 'OWNER' : 'SUBSCRIBER',
      status: 'ACTIVE',
    })),
  });

  // Archivierte Listenbeiträge
  const thread = `<seed-${Date.now()}-1@nordklang.example>`;
  await prisma.listMessage.create({
    data: {
      listId: listeVorstand.id,
      messageIdHeader: thread,
      threadId: thread,
      fromName: 'Mira Lindqvist',
      fromAddress: 'mira.lindqvist@example.org',
      senderId: mira.id,
      subject: 'Termin für die Jahresplanung',
      bodyText:
        'Liebe alle,\n\nich schlage vor, die Jahresplanung am ersten Samstag im Monat zu machen.\nPasst euch das?\n\nHerzliche Grüße\nMira',
      status: 'DISTRIBUTED',
      distributedAt: daysFromNow(-12, 9),
      receivedAt: daysFromNow(-12, 9),
      recipientCount: 2,
      sizeBytes: 180,
    },
  });

  const reply = `<seed-${Date.now()}-2@nordklang.example>`;
  await prisma.listMessage.create({
    data: {
      listId: listeVorstand.id,
      messageIdHeader: reply,
      inReplyTo: thread,
      threadId: thread,
      fromName: 'Jonas Feld',
      fromAddress: 'jonas.feld@example.org',
      senderId: jonas.id,
      subject: 'Re: Termin für die Jahresplanung',
      bodyText: 'Von mir aus gern. Ich bringe die Zahlen des laufenden Jahres mit.\n\nJonas',
      status: 'DISTRIBUTED',
      distributedAt: daysFromNow(-11, 14),
      receivedAt: daysFromNow(-11, 14),
      recipientCount: 2,
      sizeBytes: 120,
    },
  });

  // Ein Beitrag wartet auf Freigabe, damit die Moderation etwas zu tun hat.
  await prisma.listMessage.create({
    data: {
      listId: listeVorstand.id,
      messageIdHeader: `<seed-${Date.now()}-3@extern.example>`,
      fromName: 'Pia Sander',
      fromAddress: 'pia.sander@extern.example',
      subject: 'Anfrage für einen Auftritt',
      bodyText:
        'Guten Tag,\n\nwir suchen für unser Stadtteilfest noch eine Band. Hätten Sie Interesse?\n\nViele Grüße\nPia Sander',
      status: 'PENDING',
      moderationReason: 'Die Absenderadresse ist für diese Liste nicht freigeschaltet.',
      receivedAt: daysFromNow(-1, 11),
      sizeBytes: 160,
    },
  });

  // Dateiablage
  const ordnerProtokolle = await prisma.folder.create({
    data: {
      communityId: verein.community.id,
      name: 'Protokolle',
      path: '/Protokolle',
      description: 'Sitzungsprotokolle des Vorstands.',
      visibility: 'RESTRICTED',
      createdById: mira.id,
      rules: {
        create: [
          { roleId: verein.roleByKey.get('owner')!.id, level: 'MANAGE' },
          { roleId: verein.roleByKey.get('admin')!.id, level: 'WRITE' },
        ],
      },
    },
  });

  await prisma.folder.create({
    data: {
      communityId: verein.community.id,
      name: 'Öffentlichkeitsarbeit',
      path: '/Öffentlichkeitsarbeit',
      description: 'Plakate, Logos und Vorlagen.',
      createdById: anna.id,
    },
  });

  await prisma.folder.create({
    data: {
      communityId: verein.community.id,
      parentId: ordnerProtokolle.id,
      name: '2026',
      path: '/Protokolle/2026',
      visibility: 'RESTRICTED',
      createdById: mira.id,
    },
  });

  // Events
  const jahresversammlung = await prisma.event.create({
    data: {
      communityId: verein.community.id,
      title: 'Jahresversammlung 2026',
      slug: 'jahresversammlung-2026',
      summary: 'Rückblick, Wahlen und Planung für das kommende Jahr.',
      description:
        'Wir schauen gemeinsam auf das vergangene Jahr, entlasten den Vorstand und stimmen über die Vorhaben für 2027 ab. Im Anschluss gibt es Suppe.',
      status: 'PUBLISHED',
      startAt: daysFromNow(21, 18, 0),
      endAt: daysFromNow(21, 21, 0),
      locationName: 'Bürgerhaus Nord',
      locationAddress: 'Nordstraße 12, 04105 Leipzig',
      capacity: 60,
      waitlistEnabled: true,
      allowGuests: true,
      registrationClosesAt: daysFromNow(18, 23, 59),
      organizerId: mira.id,
      createdById: mira.id,
      plannedBudget: 450,
      agenda: {
        create: [
          { position: 1, title: 'Begrüßung', speaker: 'Mira Lindqvist', durationMinutes: 10, startAt: daysFromNow(21, 18, 0) },
          { position: 2, title: 'Bericht der Kasse', speaker: 'Jonas Feld', durationMinutes: 25, startAt: daysFromNow(21, 18, 10) },
          { position: 3, title: 'Entlastung des Vorstands', durationMinutes: 20, startAt: daysFromNow(21, 18, 35) },
          { position: 4, title: 'Vorhaben 2027', durationMinutes: 45, startAt: daysFromNow(21, 19, 0) },
          { position: 5, title: 'Suppe und Austausch', durationMinutes: 60, startAt: daysFromNow(21, 20, 0) },
        ],
      },
      tasks: {
        create: [
          { title: 'Raum reservieren', phase: 'PLANNING', status: 'DONE', assigneeId: mira.id, completedAt: daysFromNow(-5), position: 1 },
          { title: 'Einladung versenden', phase: 'PLANNING', status: 'IN_PROGRESS', assigneeId: anna.id, dueAt: daysFromNow(7), position: 2 },
          { title: 'Technik aufbauen', phase: 'EXECUTION', status: 'OPEN', assigneeId: tarek.id, dueAt: daysFromNow(21, 16), position: 3 },
          { title: 'Protokoll schreiben', phase: 'FOLLOWUP', status: 'OPEN', assigneeId: jonas.id, dueAt: daysFromNow(24), position: 4 },
        ],
      },
    },
  });

  // Einladungen mit unterschiedlichen Rückmeldungen
  const responses = ['ACCEPTED', 'ACCEPTED', 'DECLINED', 'INVITED', 'TENTATIVE', 'ACCEPTED'];
  let responseIndex = 0;
  for (const entry of PEOPLE) {
    const person = personByEmail.get(entry.email)!;
    const status = responses[responseIndex % responses.length];
    await prisma.eventParticipation.create({
      data: {
        eventId: jahresversammlung.id,
        personId: person.id,
        email: entry.email,
        name: `${entry.firstName} ${entry.lastName}`,
        source: 'INVITED',
        status,
        remindedAt: daysFromNow(-3),
        respondedAt: status === 'INVITED' ? null : daysFromNow(-2),
        guestCount: status === 'ACCEPTED' && responseIndex % 4 === 0 ? 1 : 0,
      },
    });
    responseIndex += 1;
  }

  // Ein abgeschlossenes Event mit Nachbereitung
  const sommerfest = await prisma.event.create({
    data: {
      communityId: verein.community.id,
      title: 'Sommerfest im Hof',
      slug: 'sommerfest-im-hof',
      summary: 'Konzert, Kuchen und Kennenlernen.',
      status: 'COMPLETED',
      startAt: daysFromNow(-40, 15, 0),
      endAt: daysFromNow(-40, 22, 0),
      locationName: 'Innenhof Nordstraße 12',
      capacity: 120,
      organizerId: tarek.id,
      createdById: mira.id,
      plannedBudget: 800,
      actualCost: 735.4,
      debriefDoneAt: daysFromNow(-35),
      minutes:
        'Rund 95 Gäste kamen. Die Bands starteten pünktlich, der Kuchenstand war nach zwei Stunden leer.',
      lessonsLearned:
        'Mehr Kuchen einplanen. Den Getränkestand näher an den Eingang stellen. Die Technik früher aufbauen.',
      debriefNotes: 'Die Nachbarschaft hat sich nicht über den Lärm beschwert, das Vorgespräch hat geholfen.',
    },
  });

  for (const entry of PEOPLE.slice(0, 8)) {
    const person = personByEmail.get(entry.email)!;
    await prisma.eventParticipation.create({
      data: {
        eventId: sommerfest.id,
        personId: person.id,
        email: entry.email,
        name: `${entry.firstName} ${entry.lastName}`,
        source: 'INVITED',
        status: 'ACCEPTED',
        respondedAt: daysFromNow(-45),
        checkedInAt: daysFromNow(-40, 15, 20),
        attended: true,
      },
    });
  }

  await prisma.eventFeedback.createMany({
    data: [
      { eventId: sommerfest.id, personId: anna.id, rating: 5, comment: 'Wunderbare Stimmung, gern wieder.' },
      { eventId: sommerfest.id, personId: jonas.id, rating: 4, comment: 'Der Kuchen war zu früh aus.' },
      { eventId: sommerfest.id, rating: 5, comment: 'Als Gast sehr herzlich aufgenommen worden.' },
    ],
  });

  // Kalender
  await prisma.calendarEntry.createMany({
    data: [
      {
        communityId: verein.community.id,
        title: 'Vorstandssitzung',
        description: 'Monatliche Sitzung des Vorstands.',
        location: 'Vereinsraum',
        startAt: daysFromNow(7, 19, 0),
        endAt: daysFromNow(7, 21, 0),
        kind: 'MEETING',
        visibility: 'STAFF',
        recurrence: 'FREQ=MONTHLY;BYDAY=1MO',
        ownerId: mira.id,
      },
      {
        communityId: verein.community.id,
        title: 'Frist Fördermittelantrag',
        startAt: daysFromNow(30, 0, 0),
        endAt: daysFromNow(30, 23, 59),
        allDay: true,
        kind: 'DEADLINE',
        ownerId: jonas.id,
      },
      {
        communityId: verein.community.id,
        title: 'Probenwochenende',
        location: 'Landheim Colditz',
        startAt: daysFromNow(45, 10, 0),
        endAt: daysFromNow(47, 16, 0),
        kind: 'OTHER',
        ownerId: tarek.id,
      },
    ],
  });

  // Content-Journal
  const beschluss = await prisma.journalEntry.create({
    data: {
      communityId: verein.community.id,
      title: 'Beschluss: Beitragsordnung 2027',
      slug: 'beschluss-beitragsordnung-2027',
      summary: 'Der Vorstand schlägt eine Anpassung des ermäßigten Beitrags vor.',
      content:
        'Der Vorstand hat am gestrigen Abend beschlossen, der Jahresversammlung eine neue Beitragsordnung vorzulegen.\n\nDer ermäßigte Beitrag sinkt von 60 auf 48 Euro im Jahr. Der reguläre Beitrag bleibt unverändert. Die Differenz tragen die fördernden Mitglieder.\n\nDie Abstimmung erfolgt auf der Jahresversammlung.',
      type: 'DECISION',
      status: 'PUBLISHED',
      channel: 'INTERNAL',
      visibility: 'COMMUNITY',
      publishedAt: daysFromNow(-9),
      authorId: mira.id,
      eventId: jahresversammlung.id,
    },
  });

  await prisma.journalComment.createMany({
    data: [
      {
        entryId: beschluss.id,
        authorId: jonas.id,
        body: 'Ich ergänze bis zur Versammlung eine Hochrechnung, wie sich das auf den Haushalt auswirkt.',
      },
      {
        entryId: beschluss.id,
        authorId: anna.id,
        body: 'Gute Sache. Ich bereite einen kurzen Text für den Newsletter vor.',
      },
    ],
  });

  await prisma.journalEntry.create({
    data: {
      communityId: verein.community.id,
      title: 'Newsletter Herbstausgabe',
      slug: 'newsletter-herbstausgabe',
      summary: 'Rückblick Sommerfest, Ausblick Jahresversammlung, Aufruf für den Technikkreis.',
      content: 'Entwurf steht. Es fehlen noch Fotos vom Sommerfest und ein Zitat aus dem Vorstand.',
      type: 'NEWSLETTER',
      status: 'IN_REVIEW',
      channel: 'NEWSLETTER',
      plannedAt: daysFromNow(10, 9, 0),
      authorId: anna.id,
      tags: { create: [{ tagId: tagVorstand.id }] },
    },
  });

  await prisma.journalEntry.create({
    data: {
      communityId: verein.community.id,
      title: 'Idee: Offene Probe für Neugierige',
      slug: 'idee-offene-probe',
      summary: 'Einmal im Quartal eine Probe öffnen, damit Interessierte hineinschnuppern können.',
      type: 'NOTE',
      status: 'IDEA',
      channel: 'INTERNAL',
      plannedAt: daysFromNow(60, 19, 0),
      authorId: tarek.id,
    },
  });

  await prisma.journalEntry.create({
    data: {
      communityId: verein.community.id,
      title: 'Protokoll Vorstandssitzung September',
      slug: 'protokoll-vorstandssitzung-september',
      summary: 'Beitragsordnung, Sommerfest-Nachlese, Technikbeschaffung.',
      content:
        'Anwesend: Mira Lindqvist, Jonas Feld, Anna Berger\n\n1. Beitragsordnung\nDer Vorstand beschließt einstimmig, der Versammlung die neue Ordnung vorzulegen.\n\n2. Sommerfest\nDie Nachlese ist im Eventbereich hinterlegt.\n\n3. Technik\nTarek Osman holt Angebote für ein neues Mischpult ein.',
      type: 'MINUTES',
      status: 'PUBLISHED',
      channel: 'INTERNAL',
      visibility: 'STAFF',
      publishedAt: daysFromNow(-9),
      authorId: jonas.id,
    },
  });

  // E-Mail-Vorlagen
  await prisma.emailTemplate.createMany({
    data: [
      {
        communityId: verein.community.id,
        key: 'begruessung',
        name: 'Begrüßung neuer Mitglieder',
        description: 'Geht an Personen, die frisch aufgenommen wurden.',
        subject: 'Herzlich willkommen bei Nordklang, {{vorname}}',
        bodyText:
          'Guten Tag {{vorname}},\n\nschön, dass Sie dabei sind. In den nächsten Tagen melden wir uns mit allem Wichtigen.\n\nHerzliche Grüße\nDer Vorstand',
        variables: JSON.stringify(['vorname', 'name', 'email']),
      },
      {
        communityId: verein.community.id,
        key: 'erinnerung-beitrag',
        name: 'Erinnerung Jahresbeitrag',
        subject: 'Ihr Jahresbeitrag bei Nordklang',
        bodyText:
          'Guten Tag {{name}},\n\nder Jahresbeitrag für das laufende Jahr steht noch aus. Wir freuen uns über eine Überweisung in den kommenden zwei Wochen.\n\nVielen Dank\nJonas Feld, Kasse',
        variables: JSON.stringify(['vorname', 'name', 'email']),
      },
    ],
  });

  // --- Community 2: Nachbarschaftsinitiative -------------------------------
  const nachbarschaft = await createCommunity({
    name: 'Nachbarschaft Ostvorstadt',
    slug: 'ostvorstadt',
    description: 'Offene Nachbarschaftsinitiative für den Leipziger Osten.',
    purpose: 'Gute Nachbarschaft entsteht, wenn Menschen sich kennen.',
    mailDomain: 'listen.ostvorstadt.example',
    senderEmail: 'hallo@ostvorstadt.example',
  });

  const nachbarschaftPeople = [
    'tarek.osman@example.org',
    'lena.hoffmann@example.org',
    'sofia.ricci@example.org',
    'nora.albrecht@example.org',
    'hanna.sommer@example.org',
    'mira.lindqvist@example.org',
  ];

  const nachbarschaftMemberships: { id: string; personId: string }[] = [];

  for (const email of nachbarschaftPeople) {
    const person = personByEmail.get(email)!;
    const roleKey = email === 'tarek.osman@example.org' ? 'owner' : email === 'lena.hoffmann@example.org' ? 'moderator' : 'member';
    const membership = await prisma.membership.create({
      data: {
        communityId: nachbarschaft.community.id,
        personId: person.id,
        status: 'ACTIVE',
        joinedAt: daysFromNow(-60),
        roles: { create: { roleId: nachbarschaft.roleByKey.get(roleKey)!.id } },
      },
    });
    nachbarschaftMemberships.push({ id: membership.id, personId: person.id });
  }

  const listeNachbarschaft = await prisma.mailingList.create({
    data: {
      communityId: nachbarschaft.community.id,
      name: 'Nachbarschaft',
      localPart: 'nachbarschaft',
      address: 'nachbarschaft@listen.ostvorstadt.example',
      description: 'Offene Liste für alle im Viertel.',
      listType: 'DISCUSSION',
      postingPolicy: 'SUBSCRIBERS',
      moderationPolicy: 'NON_SUBSCRIBERS',
      subscriptionPolicy: 'OPEN',
      replyToMode: 'LIST',
      archivePolicy: 'SUBSCRIBERS',
      subjectPrefix: '[Nachbarschaft]',
      footerText: 'Antworten gehen an alle. Bitte freundlich bleiben.',
    },
  });

  await prisma.listSubscription.createMany({
    data: nachbarschaftMemberships.map((membership, position) => ({
      listId: listeNachbarschaft.id,
      personId: membership.personId,
      role: position === 0 ? 'OWNER' : position === 1 ? 'MODERATOR' : 'SUBSCRIBER',
      status: 'ACTIVE',
    })),
  });

  await prisma.folder.create({
    data: {
      communityId: nachbarschaft.community.id,
      name: 'Allgemein',
      path: '/Allgemein',
      description: 'Unterlagen für alle.',
      isSystem: true,
      createdById: tarek.id,
    },
  });

  await prisma.event.create({
    data: {
      communityId: nachbarschaft.community.id,
      title: 'Hofflohmarkt',
      slug: 'hofflohmarkt',
      summary: 'Jeder öffnet den eigenen Hof, gestöbert wird überall.',
      status: 'PLANNING',
      startAt: daysFromNow(35, 10, 0),
      endAt: daysFromNow(35, 16, 0),
      locationName: 'Ganze Ostvorstadt',
      visibility: 'PUBLIC',
      organizerId: tarek.id,
      createdById: tarek.id,
      tasks: {
        create: [
          { title: 'Höfe sammeln', phase: 'PLANNING', status: 'IN_PROGRESS', assigneeId: tarek.id, dueAt: daysFromNow(20) },
          { title: 'Lageplan drucken', phase: 'PLANNING', status: 'OPEN', dueAt: daysFromNow(28) },
        ],
      },
    },
  });

  await prisma.calendarEntry.create({
    data: {
      communityId: nachbarschaft.community.id,
      title: 'Offenes Treffen',
      description: 'Jeden Monat, alle sind willkommen.',
      location: 'Café Ecke',
      startAt: daysFromNow(14, 19, 30),
      endAt: daysFromNow(14, 21, 0),
      kind: 'MEETING',
      recurrence: 'FREQ=MONTHLY;BYDAY=2TU',
      ownerId: tarek.id,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        communityId: verein.community.id,
        actorId: mira.id,
        action: 'community.create',
        entityType: 'Community',
        entityId: verein.community.id,
        summary: 'Community "Kulturverein Nordklang" angelegt',
      },
      {
        communityId: verein.community.id,
        actorId: mira.id,
        action: 'event.create',
        entityType: 'Event',
        entityId: jahresversammlung.id,
        summary: 'Event "Jahresversammlung 2026" angelegt',
      },
      {
        communityId: verein.community.id,
        actorId: anna.id,
        action: 'journal.create',
        entityType: 'JournalEntry',
        entityId: beschluss.id,
        summary: 'Journaleintrag "Beschluss: Beitragsordnung 2027" angelegt',
      },
    ],
  });

  void gruppeTechnik;

  console.log('\nFertig. Zugänge zum Ausprobieren, alle mit dem Passwort:', PASSWORD);
  console.log('  mira.lindqvist@example.org  Leitung, zusätzlich Plattformverwaltung');
  console.log('  jonas.feld@example.org      Verwaltung');
  console.log('  anna.berger@example.org     Redaktion');
  console.log('  tarek.osman@example.org     Eventteam, Leitung der Nachbarschaft');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
