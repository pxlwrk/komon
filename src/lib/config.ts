/** Laufzeitkonfiguration aus Umgebungsvariablen mit sinnvollen Vorgaben. */

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function int(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'ja'].includes(value.toLowerCase());
}

export const config = {
  appName: str('APP_NAME', 'Komon'),
  appUrl: str('APP_URL', 'http://localhost:3000'),
  sessionCookieName: 'komon_session',
  sessionMaxAgeDays: int('SESSION_MAX_AGE_DAYS', 30),
  storageDir: str('STORAGE_DIR', 'storage'),
  maxUploadBytes: int('MAX_UPLOAD_BYTES', 25 * 1024 * 1024),
  mail: {
    /** smtp | log — "log" schreibt Nachrichten in die Datenbank statt sie zu senden. */
    transport: str('MAIL_TRANSPORT', 'log'),
    host: str('SMTP_HOST', 'localhost'),
    port: int('SMTP_PORT', 1025),
    secure: bool('SMTP_SECURE', false),
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS?.trim() || undefined,
    defaultFromName: str('MAIL_FROM_NAME', 'Komon'),
    defaultFromEmail: str('MAIL_FROM_EMAIL', 'komon@localhost'),
    batchSize: int('MAIL_BATCH_SIZE', 25),
    maxAttempts: int('MAIL_MAX_ATTEMPTS', 3),
  },
  /** Gemeinsames Geheimnis fuer den Posteingang der Mailinglisten. */
  inboundSecret: str('INBOUND_SECRET', 'komon-inbound-dev-secret'),
} as const;
