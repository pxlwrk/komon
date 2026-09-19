import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { config } from '@/lib/config';
import { processMailQueue } from '@/lib/mail';
import { receiveListMessage } from '@/lib/mailinglist';

/**
 * Posteingang fuer Gruppenmailadressen.
 *
 * Der eingesetzte Mailserver oder ein Zustelldienst liefert eingehende
 * Nachrichten hier ab. Erwartet wird JSON im folgenden Aufbau, wie es gaengige
 * Dienste nach dem Parsen bereitstellen.
 *
 * Absicherung erfolgt ueber den Kopf "X-Komon-Secret", der mit INBOUND_SECRET
 * uebereinstimmen muss.
 */

const inboundSchema = z.object({
  to: z.string().min(3),
  from: z.string().min(3),
  subject: z.string().default(''),
  text: z.string().default(''),
  html: z.string().nullable().optional(),
  messageId: z.string().nullable().optional(),
  inReplyTo: z.string().nullable().optional(),
  references: z.string().nullable().optional(),
  size: z.number().int().nonnegative().optional(),
  date: z.string().nullable().optional(),
});

function secretMatches(provided: string | null): boolean {
  if (!provided) return false;
  const expected = Buffer.from(config.inboundSecret, 'utf8');
  const actual = Buffer.from(provided, 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get('x-komon-secret'))) {
    return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Der Inhalt ist kein gültiges JSON.' }, { status: 400 });
  }

  const parsed = inboundSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Die Nachricht ist unvollständig.', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const receivedAt = data.date ? new Date(data.date) : new Date();

  try {
    const result = await receiveListMessage({
      to: data.to,
      from: data.from,
      subject: data.subject,
      bodyText: data.text,
      bodyHtml: data.html ?? null,
      messageId: data.messageId ?? null,
      inReplyTo: data.inReplyTo ?? null,
      references: data.references ?? null,
      sizeBytes: data.size,
      receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    });

    if (result.status === 'UNKNOWN_LIST') {
      return NextResponse.json({ status: result.status, reason: result.reason }, { status: 404 });
    }

    // Die Verteilung startet sofort, der Rest laeuft ueber den Worker weiter.
    if (result.status === 'DISTRIBUTED') {
      await processMailQueue();
    }

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error('Eingehende Nachricht konnte nicht verarbeitet werden', error);
    return NextResponse.json({ error: 'Interner Fehler bei der Verarbeitung.' }, { status: 500 });
  }
}
