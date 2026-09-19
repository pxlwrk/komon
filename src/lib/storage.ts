import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from '@/lib/config';

/**
 * Dateiablage mit zwei Wegen.
 *
 * Ohne weitere Einrichtung landen Dateien im lokalen Dateisystem. Liegt ein
 * Token für Vercel Blob vor, wandern sie dorthin. Das ist auf serverlosen
 * Plattformen nötig, deren Dateisystem schreibgeschützt ist.
 *
 * Der Speicherschlüssel bleibt in beiden Fällen derselbe, sodass bestehende
 * Datensätze unverändert weiterverwendet werden können.
 */

const ROOT = path.resolve(process.cwd(), config.storageDir, 'files');

/** Liegt ein Blob-Token vor, wird dieser Weg genutzt. */
function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

export function usesBlobStorage(): boolean {
  return blobToken() !== undefined;
}

/** Entfernt alles, was einen Dateinamen unsicher machen koennte. */
export function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f]/g, '');
  const cleaned = base.replace(/[^a-zA-Z0-9._ äöüÄÖÜß-]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : 'datei';
}

/** Loest einen Speicherschluessel auf und verhindert Ausbrueche aus dem Ablageordner. */
function resolveKey(storageKey: string): string {
  const target = path.resolve(ROOT, storageKey);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (target !== ROOT && !target.startsWith(rootWithSep)) {
    throw new Error('Ungültiger Speicherort.');
  }
  return target;
}

/** Wehrt Schlüssel ab, die aus der Ablage ausbrechen wollen. */
function assertSafeKey(storageKey: string): void {
  if (storageKey.startsWith('/') || storageKey.split('/').includes('..')) {
    throw new Error('Ungültiger Speicherort.');
  }
}

export type StoredBlob = {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
  mimeType: string;
  fileName: string;
};

/** Legt einen Datenstrom in der Ablage ab und liefert die Metadaten zurueck. */
export async function storeBuffer(params: {
  communityId: string;
  fileName: string;
  mimeType?: string | null;
  data: Buffer;
  /** Unterordner innerhalb der Community, etwa "listen" fuer Anhaenge. */
  scope?: string;
}): Promise<StoredBlob> {
  const now = new Date();
  const fileName = safeFileName(params.fileName);
  const segments = [
    params.communityId,
    params.scope ?? 'ablage',
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
  ];
  const unique = `${randomBytes(8).toString('hex')}-${fileName}`;
  const storageKey = path.posix.join(...segments, unique);

  const token = blobToken();
  if (token) {
    const { put } = await import('@vercel/blob');
    await put(storageKey, params.data, {
      access: 'public',
      token,
      // Der Schlüssel ist bereits eindeutig, ein Zusatz würde ihn unauffindbar machen.
      addRandomSuffix: false,
      contentType: params.mimeType?.trim() || guessMimeType(fileName),
    });
  } else {
    const target = resolveKey(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, params.data);
  }

  return {
    storageKey,
    sizeBytes: params.data.byteLength,
    checksum: createHash('sha256').update(params.data).digest('hex'),
    mimeType: params.mimeType?.trim() || guessMimeType(fileName),
    fileName,
  };
}

export async function storeUpload(params: {
  communityId: string;
  file: File;
  scope?: string;
}): Promise<StoredBlob> {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  if (buffer.byteLength > config.maxUploadBytes) {
    throw new Error(
      `Die Datei ist größer als erlaubt. Zulässig sind ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`,
    );
  }
  return storeBuffer({
    communityId: params.communityId,
    fileName: params.file.name,
    mimeType: params.file.type,
    data: buffer,
    scope: params.scope,
  });
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  const token = blobToken();
  if (token) {
    assertSafeKey(storageKey);
    const { head } = await import('@vercel/blob');
    const info = await head(storageKey, { token });
    const response = await fetch(info.url);
    if (!response.ok) {
      throw new Error('Die Datei konnte nicht gelesen werden.');
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(resolveKey(storageKey));
}

export async function storedFileExists(storageKey: string): Promise<boolean> {
  const token = blobToken();
  if (token) {
    try {
      assertSafeKey(storageKey);
      const { head } = await import('@vercel/blob');
      await head(storageKey, { token });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await stat(resolveKey(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const token = blobToken();
  if (token) {
    assertSafeKey(storageKey);
    const { del } = await import('@vercel/blob');
    await del(storageKey, { token });
    return;
  }
  await rm(resolveKey(storageKey), { force: true });
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.ics': 'text/calendar; charset=utf-8',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
};

export function guessMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

/**
 * Bestimmt, ob eine Datei im Browser angezeigt werden darf. Alles andere wird
 * zum Herunterladen angeboten, damit kein fremdes HTML im Kontext der
 * Anwendung ausgefuehrt wird.
 */
export function isInlineSafe(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') && mimeType !== 'image/svg+xml'
      ? true
      : mimeType === 'application/pdf' || mimeType.startsWith('text/plain')
  );
}
