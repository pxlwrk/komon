import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import nodemailer, { type Transporter } from 'nodemailer';

import { config } from '@/lib/config';
import { prisma } from '@/lib/prisma';

export type Recipient = {
  address: string;
  name?: string | null;
  personId?: string | null;
  /** Individuelle Platzhalterwerte fuer diese Empfaengerin. */
  variables?: Record<string, string>;
};

export type QueueEmailInput = {
  communityId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  recipients: Recipient[];
  kind?: string;
  authorId?: string | null;
  templateId?: string | null;
  eventId?: string | null;
  sourceListMessageId?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  headers?: Record<string, string> | null;
  scheduledAt?: Date | null;
  /** Entwurf statt sofortigem Versand. */
  asDraft?: boolean;
};

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth:
      config.mail.user && config.mail.pass
        ? { user: config.mail.user, pass: config.mail.pass }
        : undefined,
  });
  return cachedTransport;
}

/** Ersetzt Platzhalter der Form {{name}} durch die uebergebenen Werte. */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : value;
  });
}

/** Wandelt reinen Text in einfaches, gut lesbares HTML. */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1c66f0">$1</a>',
  );

  const paragraphs = linked
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px 0">${block.replace(/\n/g, '<br />')}</p>`)
    .join('\n');

  return [
    '<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f5f7fb;',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;line-height:1.6">',
    '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;',
    'border:1px solid #e5e7eb">',
    paragraphs,
    '</div></body></html>',
  ].join('');
}

export function isValidEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address.trim());
}

export function normalizeEmail(address: string): string {
  return address.trim().toLowerCase();
}

/** Zerlegt "Vorname Nachname <adresse@example.org>" in seine Bestandteile. */
export function parseAddress(raw: string): { name: string | null; address: string } {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    return { name: name.length > 0 ? name : null, address: normalizeEmail(match[2]) };
  }
  return { name: null, address: normalizeEmail(raw) };
}

export function formatAddress(name: string | null | undefined, address: string): string {
  if (!name) return address;
  return `"${name.replace(/"/g, '')}" <${address}>`;
}

/**
 * Legt eine Nachricht mit den zugehoerigen Zustellungen an. Der eigentliche
 * Versand erfolgt durch processMailQueue, damit die Oberflaeche nicht wartet.
 */
export async function queueEmail(input: QueueEmailInput): Promise<{ messageId: string; recipientCount: number }> {
  const community = await prisma.community.findUniqueOrThrow({
    where: { id: input.communityId },
    select: { senderEmail: true, senderName: true, name: true },
  });

  const seen = new Set<string>();
  const recipients = input.recipients
    .map((recipient) => ({ ...recipient, address: normalizeEmail(recipient.address) }))
    .filter((recipient) => {
      if (!isValidEmail(recipient.address)) return false;
      if (seen.has(recipient.address)) return false;
      seen.add(recipient.address);
      return true;
    });

  const status = input.asDraft ? 'DRAFT' : input.scheduledAt ? 'SCHEDULED' : 'QUEUED';

  const message = await prisma.emailMessage.create({
    data: {
      communityId: input.communityId,
      templateId: input.templateId ?? null,
      authorId: input.authorId ?? null,
      eventId: input.eventId ?? null,
      sourceListMessageId: input.sourceListMessageId ?? null,
      kind: input.kind ?? 'CAMPAIGN',
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? textToHtml(input.bodyText),
      fromName: input.fromName ?? community.senderName ?? community.name,
      fromEmail: input.fromEmail ?? community.senderEmail ?? config.mail.defaultFromEmail,
      replyTo: input.replyTo ?? null,
      headersJson: input.headers ? JSON.stringify(input.headers) : null,
      status,
      scheduledAt: input.scheduledAt ?? null,
      recipientCount: recipients.length,
      deliveries: {
        create: recipients.map((recipient) => ({
          personId: recipient.personId ?? null,
          toAddress: recipient.address,
          toName: recipient.name ?? null,
          status: input.asDraft ? 'SKIPPED' : 'QUEUED',
          token: randomBytes(18).toString('base64url'),
        })),
      },
    },
  });

  return { messageId: message.id, recipientCount: recipients.length };
}

type SendArgs = {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  headers?: Record<string, string>;
};

/** Versendet eine einzelne Nachricht ueber den konfigurierten Weg. */
async function deliver(args: SendArgs): Promise<string> {
  if (config.mail.transport === 'log') {
    const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
    const lines = [
      `From: ${args.from}`,
      `To: ${args.to}`,
      args.replyTo ? `Reply-To: ${args.replyTo}` : null,
      `Subject: ${args.subject}`,
      ...Object.entries(args.headers ?? {}).map(([key, value]) => `${key}: ${value}`),
      '',
      args.text,
    ].filter(Boolean);

    // Die Nachricht steht ohnehin vollstaendig in der Datenbank. Die Datei ist
    // nur eine Bequemlichkeit fuer die Entwicklung und darf auf einem
    // schreibgeschuetzten Dateisystem ausbleiben, ohne den Versand zu stoppen.
    try {
      // path.resolve beachtet auch einen absoluten Wert in STORAGE_DIR.
      const dir = path.resolve(process.cwd(), config.storageDir, 'outbox');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${id}.eml`), lines.join('\n'), 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'EROFS' && code !== 'EACCES' && code !== 'EPERM') {
        throw error;
      }
    }

    return `log-${id}`;
  }

  const info = await getTransport().sendMail({
    from: args.from,
    to: args.to,
    replyTo: args.replyTo ?? undefined,
    subject: args.subject,
    text: args.text,
    html: args.html ?? undefined,
    headers: args.headers,
  });
  return info.messageId;
}

function parseHeaders(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
      );
    }
  } catch {
    // Fehlerhafte Kopfzeilen werden stillschweigend uebergangen.
  }
  return {};
}

export type QueueResult = { processed: number; sent: number; failed: number };

/**
 * Arbeitet die Warteschlange ab. Wird vom Worker und von der Oberflaeche
 * aufgerufen, sodass der Versand auch ohne dauerhaften Prozess laeuft.
 */
export async function processMailQueue(limit = config.mail.batchSize): Promise<QueueResult> {
  const now = new Date();

  // Faellige geplante Nachrichten freigeben.
  await prisma.emailMessage.updateMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    data: { status: 'QUEUED' },
  });
  await prisma.emailDelivery.updateMany({
    where: { status: 'SKIPPED', message: { status: 'QUEUED' } },
    data: { status: 'QUEUED' },
  });

  const deliveries = await prisma.emailDelivery.findMany({
    where: {
      status: 'QUEUED',
      attempts: { lt: config.mail.maxAttempts },
      message: { status: { in: ['QUEUED', 'SENDING'] } },
    },
    include: { message: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  if (deliveries.length === 0) {
    await finalizeMessages();
    return { processed: 0, sent: 0, failed: 0 };
  }

  const messageIds = Array.from(new Set(deliveries.map((delivery) => delivery.messageId)));
  await prisma.emailMessage.updateMany({
    where: { id: { in: messageIds }, status: 'QUEUED' },
    data: { status: 'SENDING' },
  });

  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const message = delivery.message;
    const variables: Record<string, string> = {
      vorname: delivery.toName?.split(' ')[0] ?? '',
      name: delivery.toName ?? '',
      email: delivery.toAddress,
      token: delivery.token ?? '',
      antwort_link: delivery.token ? `${config.appUrl}/einladung/${delivery.token}` : '',
    };

    try {
      const providerId = await deliver({
        from: formatAddress(message.fromName, message.fromEmail ?? config.mail.defaultFromEmail),
        to: formatAddress(delivery.toName, delivery.toAddress),
        replyTo: message.replyTo,
        subject: renderTemplate(message.subject, variables),
        text: renderTemplate(message.bodyText, variables),
        html: message.bodyHtml ? renderTemplate(message.bodyHtml, variables) : null,
        headers: { ...parseHeaders(message.headersJson), 'X-Komon-Message': message.id },
      });

      await prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempts: delivery.attempts + 1,
          providerId,
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const permanent = attempts >= config.mail.maxAttempts;
      await prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: permanent ? 'FAILED' : 'QUEUED',
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      if (permanent) failed += 1;
    }
  }

  await finalizeMessages();
  return { processed: deliveries.length, sent, failed };
}

/** Setzt Nachrichten auf SENT oder FAILED, sobald alle Zustellungen erledigt sind. */
async function finalizeMessages(): Promise<void> {
  const inFlight = await prisma.emailMessage.findMany({
    where: { status: 'SENDING' },
    select: { id: true },
  });

  for (const { id } of inFlight) {
    const grouped = await prisma.emailDelivery.groupBy({
      by: ['status'],
      where: { messageId: id },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    const open = (counts.QUEUED ?? 0) + (counts.SENDING ?? 0);
    if (open > 0) continue;

    const sentCount = counts.SENT ?? 0;
    const failedCount = (counts.FAILED ?? 0) + (counts.BOUNCED ?? 0);

    await prisma.emailMessage.update({
      where: { id },
      data: {
        status: sentCount > 0 ? 'SENT' : 'FAILED',
        sentAt: new Date(),
        sentCount,
        failedCount,
      },
    });
  }
}
