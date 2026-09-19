'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fieldErrorsFromZod, fromError, ok, type ActionState } from '@/lib/action-state';
import { recordAudit } from '@/lib/audit';
import { currentRoleIds, rebuildFolderPaths, resolveFolderAccess } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { deleteStoredFile, storeUpload } from '@/lib/storage';
import { accessLevelValues, folderVisibilityValues } from '@/lib/enums';

const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Bitte geben Sie einen Namen an.')
    .refine((value) => !value.includes('/'), 'Der Name darf keinen Schrägstrich enthalten.'),
  description: z.string().trim().optional(),
  visibility: z.enum(folderVisibilityValues).default('COMMUNITY'),
});

/** Laedt einen Ordner samt der Rechte der angemeldeten Person. */
async function accessForFolder(slug: string, folderId: string) {
  const context = await requirePermission(slug, 'file.view');

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, communityId: context.community.id },
    include: { rules: { select: { roleId: true, level: true } } },
  });
  if (!folder) return { context, folder: null, access: null };

  const roleIds = await currentRoleIds(context);
  const access = resolveFolderAccess({
    context,
    visibility: folder.visibility,
    rules: folder.rules,
    roleIds,
  });

  return { context, folder, access };
}

export async function createFolderAction(
  slug: string,
  parentId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'file.upload');

  const parsed = folderSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    visibility: formData.get('visibility') || 'COMMUNITY',
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  try {
    let parentPath = '';
    if (parentId) {
      const parent = await accessForFolder(slug, parentId);
      if (!parent.folder || !parent.access?.canWrite) {
        return fail('In diesem Ordner dürfen Sie nichts ablegen.');
      }
      parentPath = parent.folder.path;
    }

    const path = `${parentPath}/${data.name}`;

    const existing = await prisma.folder.findUnique({
      where: { communityId_path: { communityId: context.community.id, path } },
      select: { id: true },
    });
    if (existing) {
      return fail('Ein Ordner mit diesem Namen liegt hier bereits.', { name: 'Name bereits vergeben.' });
    }

    const folder = await prisma.folder.create({
      data: {
        communityId: context.community.id,
        parentId,
        name: data.name,
        path,
        description: data.description || null,
        visibility: data.visibility,
        createdById: context.user.id,
      },
    });

    await recordAudit({
      communityId: context.community.id,
      actorId: context.user.id,
      action: 'folder.create',
      entityType: 'Folder',
      entityId: folder.id,
      summary: `Ordner "${path}" angelegt`,
    });
  } catch (error) {
    return fromError(error, 'Der Ordner konnte nicht angelegt werden.');
  }

  revalidatePath(`/c/${slug}/dateien`);
  return ok('Der Ordner wurde angelegt.');
}

export async function updateFolderAction(
  slug: string,
  folderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { context, folder, access } = await accessForFolder(slug, folderId);
  if (!folder) return fail('Der Ordner wurde nicht gefunden.');
  if (!access?.canManage) return fail('Diesen Ordner dürfen Sie nicht verwalten.');

  const parsed = folderSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    visibility: formData.get('visibility') || folder.visibility,
  });

  if (!parsed.success) {
    return fail('Bitte prüfen Sie Ihre Eingaben.', fieldErrorsFromZod(parsed.error.issues));
  }

  const data = parsed.data;

  try {
    await prisma.folder.update({
      where: { id: folder.id },
      data: {
        name: data.name,
        description: data.description || null,
        visibility: data.visibility,
      },
    });
    await rebuildFolderPaths(folder.id);

    await prisma.folderAccessRule.deleteMany({ where: { folderId: folder.id } });

    // Regeln sind nur bei eingeschraenkten Ordnern von Bedeutung.
    if (data.visibility === 'RESTRICTED') {
      const roles = await prisma.role.findMany({
        where: { communityId: context.community.id },
        select: { id: true },
      });

      const rules = roles
        .map((role) => ({ roleId: role.id, level: String(formData.get(`rule_${role.id}`) ?? '') }))
        .filter((rule) => accessLevelValues.includes(rule.level as never));

      if (rules.length > 0) {
        await prisma.folderAccessRule.createMany({
          data: rules.map((rule) => ({ folderId: folder.id, roleId: rule.roleId, level: rule.level })),
        });
      }
    }
  } catch (error) {
    return fromError(error, 'Der Ordner konnte nicht gespeichert werden.');
  }

  revalidatePath(`/c/${slug}/dateien`);
  return ok('Der Ordner wurde gespeichert.');
}

export async function deleteFolderAction(slug: string, folderId: string): Promise<void> {
  const { context, folder, access } = await accessForFolder(slug, folderId);
  if (!folder || !access?.canManage || folder.isSystem) return;

  // Die abgelegten Dateien werden mit entfernt, damit nichts verwaist bleibt.
  const files = await prisma.storedFile.findMany({
    where: { folderId: folder.id },
    include: { versions: { select: { storageKey: true } } },
  });

  for (const file of files) {
    for (const version of file.versions) {
      await deleteStoredFile(version.storageKey).catch(() => undefined);
    }
  }

  await prisma.folder.delete({ where: { id: folder.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'folder.delete',
    entityType: 'Folder',
    entityId: folder.id,
    summary: `Ordner "${folder.path}" gelöscht`,
  });

  revalidatePath(`/c/${slug}/dateien`);
}

/** Nimmt eine oder mehrere Dateien entgegen. */
export async function uploadFilesAction(
  slug: string,
  folderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { context, folder, access } = await accessForFolder(slug, folderId);
  if (!folder) return fail('Der Ordner wurde nicht gefunden.');
  if (!access?.canWrite) return fail('In diesem Ordner dürfen Sie nichts ablegen.');

  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
  const description = String(formData.get('description') ?? '').trim() || null;

  const usable = files.filter((file) => file.size > 0);
  if (usable.length === 0) {
    return fail('Bitte wählen Sie mindestens eine Datei aus.');
  }

  let stored = 0;
  const problems: string[] = [];

  for (const file of usable) {
    try {
      const blob = await storeUpload({ communityId: context.community.id, file });

      const existing = await prisma.storedFile.findFirst({
        where: { folderId: folder.id, name: blob.fileName, isArchived: false },
      });

      if (existing) {
        // Gleicher Name bedeutet eine neue Fassung derselben Datei.
        const nextVersion = existing.version + 1;
        await prisma.$transaction([
          prisma.fileVersion.create({
            data: {
              fileId: existing.id,
              version: nextVersion,
              storageKey: blob.storageKey,
              sizeBytes: blob.sizeBytes,
              checksum: blob.checksum,
              mimeType: blob.mimeType,
              uploadedById: context.user.id,
              note: description,
            },
          }),
          prisma.storedFile.update({
            where: { id: existing.id },
            data: {
              version: nextVersion,
              storageKey: blob.storageKey,
              sizeBytes: blob.sizeBytes,
              checksum: blob.checksum,
              mimeType: blob.mimeType,
              description: description ?? existing.description,
            },
          }),
        ]);
      } else {
        const created = await prisma.storedFile.create({
          data: {
            communityId: context.community.id,
            folderId: folder.id,
            name: blob.fileName,
            description,
            mimeType: blob.mimeType,
            sizeBytes: blob.sizeBytes,
            checksum: blob.checksum,
            storageKey: blob.storageKey,
            version: 1,
          },
        });
        await prisma.fileVersion.create({
          data: {
            fileId: created.id,
            version: 1,
            storageKey: blob.storageKey,
            sizeBytes: blob.sizeBytes,
            checksum: blob.checksum,
            mimeType: blob.mimeType,
            uploadedById: context.user.id,
            note: description,
          },
        });
      }
      stored += 1;
    } catch (error) {
      problems.push(`${file.name}: ${error instanceof Error ? error.message : 'Fehler beim Speichern.'}`);
    }
  }

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'file.upload',
    entityType: 'Folder',
    entityId: folder.id,
    summary: `${stored} Dateien in "${folder.path}" abgelegt`,
  });

  revalidatePath(`/c/${slug}/dateien`);

  if (problems.length > 0) {
    return stored > 0
      ? ok(`${stored} Dateien abgelegt. Nicht übernommen: ${problems.join(' ')}`)
      : fail(problems.join(' '));
  }
  return ok(`${stored} ${stored === 1 ? 'Datei wurde' : 'Dateien wurden'} abgelegt.`);
}

export async function renameFileAction(
  slug: string,
  fileId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission(slug, 'file.upload');

  const file = await prisma.storedFile.findFirst({
    where: { id: fileId, communityId: context.community.id },
    select: { id: true, folderId: true },
  });
  if (!file) return fail('Die Datei wurde nicht gefunden.');

  const { access } = await accessForFolder(slug, file.folderId);
  if (!access?.canWrite) return fail('In diesem Ordner dürfen Sie nichts ändern.');

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;

  if (!name) return fail('Bitte geben Sie einen Namen an.');
  if (name.includes('/')) return fail('Der Name darf keinen Schrägstrich enthalten.');

  await prisma.storedFile.update({ where: { id: file.id }, data: { name, description } });

  revalidatePath(`/c/${slug}/dateien`);
  return ok('Die Datei wurde gespeichert.');
}

export async function deleteFileAction(slug: string, fileId: string): Promise<void> {
  const context = await requirePermission(slug, 'file.view');

  const file = await prisma.storedFile.findFirst({
    where: { id: fileId, communityId: context.community.id },
    include: { versions: { select: { storageKey: true } } },
  });
  if (!file) return;

  const { access } = await accessForFolder(slug, file.folderId);
  if (!access?.canManage) return;

  for (const version of file.versions) {
    await deleteStoredFile(version.storageKey).catch(() => undefined);
  }
  await prisma.storedFile.delete({ where: { id: file.id } });

  await recordAudit({
    communityId: context.community.id,
    actorId: context.user.id,
    action: 'file.delete',
    entityType: 'StoredFile',
    entityId: file.id,
    summary: `Datei "${file.name}" gelöscht`,
  });

  revalidatePath(`/c/${slug}/dateien`);
}

/** Setzt eine frühere Fassung wieder als aktuelle Fassung ein. */
export async function restoreVersionAction(
  slug: string,
  fileId: string,
  versionId: string,
): Promise<void> {
  const context = await requirePermission(slug, 'file.upload');

  const file = await prisma.storedFile.findFirst({
    where: { id: fileId, communityId: context.community.id },
  });
  if (!file) return;

  const { access } = await accessForFolder(slug, file.folderId);
  if (!access?.canWrite) return;

  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: file.id } });
  if (!version) return;

  const nextVersion = file.version + 1;

  await prisma.$transaction([
    prisma.fileVersion.create({
      data: {
        fileId: file.id,
        version: nextVersion,
        storageKey: version.storageKey,
        sizeBytes: version.sizeBytes,
        checksum: version.checksum,
        mimeType: version.mimeType,
        uploadedById: context.user.id,
        note: `Wiederhergestellt aus Fassung ${version.version}`,
      },
    }),
    prisma.storedFile.update({
      where: { id: file.id },
      data: {
        version: nextVersion,
        storageKey: version.storageKey,
        sizeBytes: version.sizeBytes,
        checksum: version.checksum,
        mimeType: version.mimeType,
      },
    }),
  ]);

  revalidatePath(`/c/${slug}/dateien`);
}
