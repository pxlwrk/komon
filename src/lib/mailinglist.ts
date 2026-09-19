import { randomBytes } from 'node:crypto';

import { config } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, parseAddress, queueEmail } from '@/lib/mail';

/**
 * Regeln fuer Gruppenmailadressen im Stil von Mailman.
 *
 * Eine eingehende Nachricht durchlaeuft drei Stufen:
 *   1. Zustaendige Liste anhand der Empfaengeradresse finden
 *   2. Absenderin einordnen und die Einlieferungsregeln pruefen
 *   3. Nachricht archivieren und entweder verteilen oder zur Freigabe vorlegen
 */

export type InboundMessage = {
  /** Empfaengeradresse der Liste, zum Beispiel "vorstand@listen.example.org" */
  to: string;
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  sizeBytes?: number;
  receivedAt?: Date;
};

export type Disposition =
  | { decision: 'DISTRIBUTE'; reason: string }
  | { decision: 'MODERATE'; reason: string }
  | { decision: 'REJECT'; reason: string };

type ListWithContext = Awaited<ReturnType<typeof loadList>>;

async function loadList(address: string) {
  return prisma.mailingList.findUnique({
    where: { address: normalizeEmail(address) },
    include: { community: true },
  });
}

/**
 * Entscheidet, wie mit einem Beitrag zu verfahren ist.
 * Die Einlieferungsregel greift vor der Moderationsregel.
 */
export function evaluateDisposition(params: {
  postingPolicy: string;
  moderationPolicy: string;
  isSubscriber: boolean;
  isModerator: boolean;
  isCommunityMember: boolean;
  subscriptionModerated: boolean;
  subscriptionStatus: string | null;
}): Disposition {
  const {
    postingPolicy,
    moderationPolicy,
    isSubscriber,
    isModerator,
    isCommunityMember,
    subscriptionModerated,
    subscriptionStatus,
  } = params;

  if (subscriptionStatus === 'BLOCKED') {
    return { decision: 'REJECT', reason: 'Die Adresse ist für diese Liste gesperrt.' };
  }

  // Stufe 1: Darf diese Absenderin ueberhaupt einliefern?
  let allowed = false;
  switch (postingPolicy) {
    case 'OPEN':
      allowed = true;
      break;
    case 'SUBSCRIBERS':
      allowed = isSubscriber || isModerator;
      break;
    case 'MEMBERS':
      allowed = isCommunityMember || isSubscriber || isModerator;
      break;
    case 'MODERATORS':
      allowed = isModerator;
      break;
    default:
      allowed = false;
  }

  if (!allowed) {
    if (postingPolicy === 'MODERATORS') {
      return {
        decision: 'REJECT',
        reason: 'Auf dieser Liste dürfen nur Moderation und Leitung schreiben.',
      };
    }
    // Unbekannte Absenderinnen landen zur Sichtung bei der Moderation,
    // statt kommentarlos verworfen zu werden.
    return {
      decision: 'MODERATE',
      reason: 'Die Absenderadresse ist für diese Liste nicht freigeschaltet.',
    };
  }

  // Stufe 2: Moderationsregel
  if (subscriptionModerated) {
    return { decision: 'MODERATE', reason: 'Für diese Adresse ist Einzelfreigabe hinterlegt.' };
  }
  if (moderationPolicy === 'ALL') {
    return { decision: 'MODERATE', reason: 'Diese Liste moderiert alle Beiträge.' };
  }
  if (moderationPolicy === 'NON_SUBSCRIBERS' && !isSubscriber && !isModerator) {
    return { decision: 'MODERATE', reason: 'Beiträge fremder Absender werden geprüft.' };
  }

  return { decision: 'DISTRIBUTE', reason: 'Alle Regeln erfüllt.' };
}

/** Setzt das Praefix genau einmal vor den Betreff. */
export function applySubjectPrefix(subject: string, prefix: string | null | undefined): string {
  const clean = subject.trim();
  if (!prefix) return clean;
  const marker = prefix.trim();
  if (!marker) return clean;
  const pattern = new RegExp(`^(re:\\s*|aw:\\s*|fwd:\\s*)*${escapeRegExp(marker)}\\s*`, 'i');
  if (pattern.test(clean)) return clean;

  const replyMatch = clean.match(/^((?:re:|aw:|fwd:)\s*)+/i);
  if (replyMatch) {
    const head = replyMatch[0];
    return `${head}${marker} ${clean.slice(head.length)}`.replace(/\s+/g, ' ').trim();
  }
  return `${marker} ${clean}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Haengt den Listenfuss an den Nachrichtentext an. */
export function applyFooter(body: string, footer: string | null | undefined, listAddress: string): string {
  const separator = '\n\n-- \n';
  const standard = `Diese Nachricht kam über die Liste ${listAddress}.`;
  const text = footer?.trim() ? `${footer.trim()}\n${standard}` : standard;
  return `${body.replace(/\s+$/, '')}${separator}${text}`;
}

export type IntakeResult =
  | { status: 'DISTRIBUTED'; listMessageId: string; recipientCount: number }
  | { status: 'PENDING'; listMessageId: string; reason: string }
  | { status: 'REJECTED'; listMessageId: string | null; reason: string }
  | { status: 'UNKNOWN_LIST'; reason: string };

/** Nimmt eine eingehende Nachricht an und verarbeitet sie nach den Listenregeln. */
export async function receiveListMessage(input: InboundMessage): Promise<IntakeResult> {
  const list = await loadList(input.to);
  if (!list || !list.isActive) {
    return { status: 'UNKNOWN_LIST', reason: `Keine aktive Liste für ${input.to}.` };
  }

  const sender = parseAddress(input.from);
  const sizeBytes = input.sizeBytes ?? Buffer.byteLength(input.bodyText, 'utf8');

  if (sizeBytes > list.maxMessageSize) {
    return {
      status: 'REJECTED',
      listMessageId: null,
      reason: `Die Nachricht überschreitet die zulässige Größe von ${list.maxMessageSize} Byte.`,
    };
  }

  const emailRecord = await prisma.emailAddress.findUnique({
    where: { address: sender.address },
    select: { personId: true },
  });
  const personByPrimary = emailRecord
    ? null
    : await prisma.person.findUnique({
        where: { primaryEmail: sender.address },
        select: { id: true },
      });
  const personId = emailRecord?.personId ?? personByPrimary?.id ?? null;

  const subscription = personId
    ? await prisma.listSubscription.findUnique({
        where: { listId_personId: { listId: list.id, personId } },
      })
    : null;

  const membership = personId
    ? await prisma.membership.findUnique({
        where: { communityId_personId: { communityId: list.communityId, personId } },
        select: { status: true },
      })
    : null;

  const disposition = evaluateDisposition({
    postingPolicy: list.postingPolicy,
    moderationPolicy: list.moderationPolicy,
    isSubscriber: subscription?.status === 'ACTIVE',
    isModerator:
      subscription?.status === 'ACTIVE' &&
      (subscription.role === 'MODERATOR' || subscription.role === 'OWNER'),
    isCommunityMember: membership?.status === 'ACTIVE',
    subscriptionModerated: subscription?.moderated ?? false,
    subscriptionStatus: subscription?.status ?? null,
  });

  const messageIdHeader =
    input.messageId?.trim() || `<${randomBytes(12).toString('hex')}@komon.local>`;

  const threadId = await resolveThreadId(list.id, input.inReplyTo, input.references, messageIdHeader);

  const existing = await prisma.listMessage.findUnique({
    where: { messageIdHeader },
    select: { id: true, status: true },
  });
  if (existing) {
    // Doppelte Einlieferung derselben Nachricht wird nicht erneut verteilt.
    return existing.status === 'DISTRIBUTED'
      ? { status: 'DISTRIBUTED', listMessageId: existing.id, recipientCount: 0 }
      : { status: 'PENDING', listMessageId: existing.id, reason: 'Die Nachricht liegt bereits vor.' };
  }

  const listMessage = await prisma.listMessage.create({
    data: {
      listId: list.id,
      messageIdHeader,
      inReplyTo: input.inReplyTo ?? null,
      referencesRaw: input.references ?? null,
      threadId,
      fromName: sender.name,
      fromAddress: sender.address,
      senderId: personId,
      subject: input.subject.trim() || '(ohne Betreff)',
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? null,
      sizeBytes,
      status: disposition.decision === 'DISTRIBUTE' ? 'APPROVED' : disposition.decision === 'MODERATE' ? 'PENDING' : 'REJECTED',
      moderationReason: disposition.decision === 'DISTRIBUTE' ? null : disposition.reason,
      receivedAt: input.receivedAt ?? new Date(),
    },
  });

  if (disposition.decision === 'REJECT') {
    return { status: 'REJECTED', listMessageId: listMessage.id, reason: disposition.reason };
  }

  if (disposition.decision === 'MODERATE') {
    await notifyModerators(list, listMessage.id, sender.address, input.subject);
    return { status: 'PENDING', listMessageId: listMessage.id, reason: disposition.reason };
  }

  const recipientCount = await distributeListMessage(listMessage.id);
  return { status: 'DISTRIBUTED', listMessageId: listMessage.id, recipientCount };
}

/** Ordnet eine Antwort dem bestehenden Gespraech zu. */
async function resolveThreadId(
  listId: string,
  inReplyTo: string | null | undefined,
  references: string | null | undefined,
  ownMessageId: string,
): Promise<string> {
  const candidates = [
    ...(inReplyTo ? [inReplyTo.trim()] : []),
    ...(references ? references.split(/\s+/).map((entry) => entry.trim()).filter(Boolean).reverse() : []),
  ];

  for (const candidate of candidates) {
    const parent = await prisma.listMessage.findFirst({
      where: { listId, messageIdHeader: candidate },
      select: { threadId: true, messageIdHeader: true },
    });
    if (parent) {
      return parent.threadId ?? parent.messageIdHeader;
    }
  }
  return ownMessageId;
}

/**
 * Verteilt eine freigegebene Nachricht an alle aktiven Adressen der Liste.
 * Der Fuss und die Listenkopfzeilen entsprechen dem Verhalten von Mailman.
 */
export async function distributeListMessage(listMessageId: string): Promise<number> {
  const message = await prisma.listMessage.findUniqueOrThrow({
    where: { id: listMessageId },
    include: { list: { include: { community: true } } },
  });

  if (message.status === 'DISTRIBUTED') {
    return message.recipientCount;
  }

  const list = message.list;

  const subscriptions = await prisma.listSubscription.findMany({
    where: { listId: list.id, status: 'ACTIVE', deliveryMode: { in: ['REGULAR'] } },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, primaryEmail: true, displayName: true } },
      emailAddress: { select: { address: true, status: true } },
    },
  });

  const recipients = subscriptions
    .map((subscription) => {
      const address = subscription.emailAddress?.address ?? subscription.person.primaryEmail;
      const status = subscription.emailAddress?.status ?? 'ACTIVE';
      return { subscription, address, status };
    })
    .filter((entry) => entry.status === 'ACTIVE')
    // Die absendende Person erhaelt keine Kopie der eigenen Nachricht zurueck.
    .filter((entry) => entry.address !== message.fromAddress)
    .map((entry) => ({
      address: entry.address,
      name:
        entry.subscription.person.displayName ||
        `${entry.subscription.person.firstName} ${entry.subscription.person.lastName}`.trim(),
      personId: entry.subscription.person.id,
    }));

  const subject = applySubjectPrefix(message.subject, list.subjectPrefix);
  const body = applyFooter(message.bodyText, list.footerText, list.address);
  const senderLabel = message.fromName ? `${message.fromName} <${message.fromAddress}>` : message.fromAddress;
  const intro = `Von: ${senderLabel}\n\n`;

  const archiveUrl = `${config.appUrl}/c/${list.community.slug}/listen/${list.id}/archiv/${message.id}`;

  const { messageId } = await queueEmail({
    communityId: list.communityId,
    kind: 'LIST_DISTRIBUTION',
    subject,
    bodyText: `${intro}${body}`,
    sourceListMessageId: message.id,
    fromName: message.fromName ?? list.name,
    fromEmail: list.address,
    replyTo: list.replyToMode === 'LIST' ? list.address : message.fromAddress,
    headers: {
      'List-Id': `${list.name} <${list.localPart}.${list.address.split('@')[1] ?? 'localhost'}>`,
      'List-Post': `<mailto:${list.address}>`,
      'List-Archive': `<${archiveUrl}>`,
      'List-Unsubscribe': `<${config.appUrl}/c/${list.community.slug}/listen/${list.id}>`,
      'X-Komon-List': list.address,
      Precedence: 'list',
    },
    recipients,
  });

  await prisma.listMessage.update({
    where: { id: message.id },
    data: {
      status: 'DISTRIBUTED',
      distributedAt: new Date(),
      recipientCount: recipients.length,
    },
  });

  void messageId;
  return recipients.length;
}

/** Informiert die Moderation ueber einen wartenden Beitrag. */
async function notifyModerators(
  list: NonNullable<ListWithContext>,
  listMessageId: string,
  fromAddress: string,
  subject: string,
): Promise<void> {
  const moderators = await prisma.listSubscription.findMany({
    where: { listId: list.id, status: 'ACTIVE', role: { in: ['MODERATOR', 'OWNER'] } },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, primaryEmail: true } },
    },
  });

  if (moderators.length === 0) return;

  const link = `${config.appUrl}/c/${list.community.slug}/listen/${list.id}/moderation`;

  await queueEmail({
    communityId: list.communityId,
    kind: 'TRANSACTIONAL',
    subject: `Freigabe nötig: ${subject}`,
    bodyText: [
      'Für die Liste ' + list.address + ' wartet ein Beitrag auf Freigabe.',
      '',
      `Absenderin oder Absender: ${fromAddress}`,
      `Betreff: ${subject}`,
      '',
      `Zur Moderation: ${link}`,
    ].join('\n'),
    recipients: moderators.map((moderator) => ({
      address: moderator.person.primaryEmail,
      name: `${moderator.person.firstName} ${moderator.person.lastName}`.trim(),
      personId: moderator.person.id,
    })),
  });

  void listMessageId;
}

/** Gibt einen wartenden Beitrag frei und verteilt ihn. */
export async function approveListMessage(listMessageId: string, moderatorId: string): Promise<number> {
  await prisma.listMessage.update({
    where: { id: listMessageId },
    data: { status: 'APPROVED', moderatorId, moderatedAt: new Date(), moderationReason: null },
  });
  return distributeListMessage(listMessageId);
}

/** Lehnt einen Beitrag ab und benachrichtigt die absendende Person. */
export async function rejectListMessage(
  listMessageId: string,
  moderatorId: string,
  reason: string,
  notifySender = true,
): Promise<void> {
  const message = await prisma.listMessage.update({
    where: { id: listMessageId },
    data: {
      status: 'REJECTED',
      moderatorId,
      moderatedAt: new Date(),
      moderationReason: reason,
    },
    include: { list: true },
  });

  if (!notifySender) return;

  await queueEmail({
    communityId: message.list.communityId,
    kind: 'TRANSACTIONAL',
    subject: `Ihr Beitrag an ${message.list.address} wurde nicht veröffentlicht`,
    bodyText: [
      'Vielen Dank für Ihren Beitrag.',
      '',
      `Betreff: ${message.subject}`,
      '',
      'Der Beitrag wurde nicht an die Liste weitergegeben.',
      `Begründung: ${reason}`,
      '',
      'Bei Rückfragen antworten Sie gern auf diese Nachricht.',
    ].join('\n'),
    recipients: [{ address: message.fromAddress, name: message.fromName }],
  });
}

/** Traegt eine Person in eine Liste ein und beachtet dabei die Eintragungsregel. */
export async function subscribePerson(params: {
  listId: string;
  personId: string;
  emailAddressId?: string | null;
  role?: string;
  deliveryMode?: string;
  /** Eintragung durch die Verwaltung umgeht die Freigabe. */
  byStaff?: boolean;
}): Promise<{ status: string }> {
  const list = await prisma.mailingList.findUniqueOrThrow({ where: { id: params.listId } });

  const status =
    params.byStaff || list.subscriptionPolicy === 'OPEN'
      ? 'ACTIVE'
      : list.subscriptionPolicy === 'CLOSED'
        ? 'PENDING'
        : 'PENDING';

  const subscription = await prisma.listSubscription.upsert({
    where: { listId_personId: { listId: params.listId, personId: params.personId } },
    create: {
      listId: params.listId,
      personId: params.personId,
      emailAddressId: params.emailAddressId ?? null,
      role: params.role ?? 'SUBSCRIBER',
      deliveryMode: params.deliveryMode ?? 'REGULAR',
      status,
    },
    update: {
      status,
      role: params.role ?? undefined,
      deliveryMode: params.deliveryMode ?? undefined,
      emailAddressId: params.emailAddressId ?? undefined,
      unsubscribedAt: null,
    },
  });

  return { status: subscription.status };
}

/** Traegt eine Person aus einer Liste aus, ohne die Historie zu verlieren. */
export async function unsubscribePerson(listId: string, personId: string): Promise<void> {
  await prisma.listSubscription.updateMany({
    where: { listId, personId },
    data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
  });
}

/**
 * Gleicht die Eintragungen mit der hinterlegten Gruppe ab. Damit bleibt eine
 * Liste automatisch aktuell, wenn sich die Gruppe aendert.
 */
export async function syncListWithGroup(listId: string): Promise<{ added: number; removed: number }> {
  const list = await prisma.mailingList.findUniqueOrThrow({ where: { id: listId } });
  if (!list.autoSubscribeGroupId) return { added: 0, removed: 0 };

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: list.autoSubscribeGroupId, membership: { status: 'ACTIVE' } },
    include: { membership: { select: { personId: true } } },
  });
  const wanted = new Set(groupMembers.map((entry) => entry.membership.personId));

  const current = await prisma.listSubscription.findMany({
    where: { listId, status: 'ACTIVE' },
    select: { personId: true, role: true },
  });
  const currentIds = new Set(current.map((entry) => entry.personId));

  let added = 0;
  for (const personId of wanted) {
    if (currentIds.has(personId)) continue;
    await subscribePerson({ listId, personId, byStaff: true });
    added += 1;
  }

  let removed = 0;
  for (const entry of current) {
    // Moderation und Leitung bleiben eingetragen, auch wenn sie nicht in der Gruppe sind.
    if (entry.role !== 'SUBSCRIBER') continue;
    if (wanted.has(entry.personId)) continue;
    await unsubscribePerson(listId, entry.personId);
    removed += 1;
  }

  return { added, removed };
}

/**
 * Prueft, ob das Archiv einer Liste eingesehen werden darf.
 * Moderation und Listenleitung sehen das Archiv immer.
 */
export function canViewArchive(params: {
  archivePolicy: string;
  isCommunityMember: boolean;
  isSubscriber: boolean;
  canModerate: boolean;
}): boolean {
  if (params.canModerate) return true;
  switch (params.archivePolicy) {
    case 'PUBLIC':
      return true;
    case 'MEMBERS':
      return params.isCommunityMember;
    case 'SUBSCRIBERS':
      return params.isSubscriber;
    case 'PRIVATE':
      return false;
    default:
      return false;
  }
}
