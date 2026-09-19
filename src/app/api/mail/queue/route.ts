import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { pruneExpiredSessions } from '@/lib/maintenance';
import { config } from '@/lib/config';
import { processMailQueue } from '@/lib/mail';

/**
 * Arbeitet die Warteschlange ab. Gedacht fuer einen Cron-Aufruf, wenn kein
 * dauerhafter Worker laufen soll.
 */
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

  const result = await processMailQueue();
  const prunedSessions = await pruneExpiredSessions();

  return NextResponse.json({ ...result, prunedSessions });
}
