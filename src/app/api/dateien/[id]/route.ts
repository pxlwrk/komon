import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { currentRoleIds, resolveFolderAccess } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { requireCommunity } from '@/lib/rbac';
import { isInlineSafe, readStoredFile, storedFileExists } from '@/lib/storage';

/** Gibt eine Datei aus der Ablage aus, nach Prüfung der Ordnerrechte. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }

  const file = await prisma.storedFile.findUnique({
    where: { id },
    include: {
      community: { select: { slug: true } },
      folder: { include: { rules: { select: { roleId: true, level: true } } } },
    },
  });

  if (!file) {
    return NextResponse.json({ error: 'Die Datei wurde nicht gefunden.' }, { status: 404 });
  }

  const context = await requireCommunity(file.community.slug);
  const roleIds = await currentRoleIds(context);

  const access = resolveFolderAccess({
    context,
    visibility: file.folder.visibility,
    rules: file.folder.rules,
    roleIds,
  });

  if (!access.canRead) {
    return NextResponse.json({ error: 'Kein Zugriff auf diese Datei.' }, { status: 403 });
  }

  const versionId = new URL(request.url).searchParams.get('fassung');
  let storageKey = file.storageKey;
  let mimeType = file.mimeType;
  let fileName = file.name;

  if (versionId) {
    const version = await prisma.fileVersion.findFirst({
      where: { id: versionId, fileId: file.id },
    });
    if (!version) {
      return NextResponse.json({ error: 'Diese Fassung wurde nicht gefunden.' }, { status: 404 });
    }
    storageKey = version.storageKey;
    mimeType = version.mimeType;
    fileName = `v${version.version}-${file.name}`;
  }

  if (!(await storedFileExists(storageKey))) {
    return NextResponse.json({ error: 'Die Datei fehlt in der Ablage.' }, { status: 410 });
  }

  const data = await readStoredFile(storageKey);
  const disposition = isInlineSafe(mimeType) ? 'inline' : 'attachment';

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
