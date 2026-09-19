import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ACCESS_LEVEL, FOLDER_VISIBILITY, label } from '@/lib/enums';
import { currentRoleIds, folderTrail, resolveFolderAccess } from '@/lib/files';
import { formatBytes, formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  createFolderAction,
  deleteFileAction,
  deleteFolderAction,
  renameFileAction,
  restoreVersionAction,
  updateFolderAction,
  uploadFilesAction,
} from './actions';
import { FileRow, FolderSettings, NewFolderForm, UploadForm } from './file-ui';

export const metadata = { title: 'Dateiablage' };

export default async function FilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ordner?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'file.view');
  const query = await searchParams;

  const roleIds = await currentRoleIds(context);
  const currentId = query.ordner ?? null;

  const current = currentId
    ? await prisma.folder.findFirst({
        where: { id: currentId, communityId: context.community.id },
        include: { rules: { select: { roleId: true, level: true } } },
      })
    : null;

  if (currentId && !current) notFound();

  const access = current
    ? resolveFolderAccess({
        context,
        visibility: current.visibility,
        rules: current.rules,
        roleIds,
      })
    : { canRead: true, canWrite: context.can('file.upload'), canManage: context.can('file.manage') };

  if (current && !access.canRead) {
    return (
      <>
        <PageHeader title="Dateiablage" description={current.path} />
        <Alert tone="info" title="Kein Zugriff">
          Dieser Ordner ist auf ausgewählte Rollen beschränkt.
        </Alert>
      </>
    );
  }

  const [folders, files, trail, roles] = await Promise.all([
    prisma.folder.findMany({
      where: { communityId: context.community.id, parentId: currentId },
      orderBy: { name: 'asc' },
      include: {
        rules: { select: { roleId: true, level: true } },
        _count: { select: { files: true, children: true } },
      },
    }),
    currentId
      ? prisma.storedFile.findMany({
          where: { folderId: currentId, isArchived: false },
          orderBy: { name: 'asc' },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              include: { uploadedBy: { select: { firstName: true, lastName: true } } },
            },
          },
        })
      : Promise.resolve([]),
    folderTrail(currentId),
    prisma.role.findMany({
      where: { communityId: context.community.id },
      orderBy: [{ rank: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ]);

  // Ordner ohne Leserecht werden gar nicht erst angezeigt.
  const visibleFolders = folders.filter(
    (folder) =>
      resolveFolderAccess({ context, visibility: folder.visibility, rules: folder.rules, roleIds })
        .canRead,
  );

  const totalSize = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  return (
    <>
      <PageHeader
        title="Dateiablage"
        description={
          current
            ? current.description || `Inhalt von ${current.path}`
            : 'Gemeinsame Unterlagen Ihrer Community, mit Versionsverlauf und Zugriffsrechten je Ordner.'
        }
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-1">
            <Link href={`/c/${slug}/dateien`} className="hover:text-slate-700">
              Ablage
            </Link>
            {trail.map((entry) => (
              <span key={entry.id} className="flex items-center gap-1">
                <span aria-hidden>/</span>
                <Link href={`/c/${slug}/dateien?ordner=${entry.id}`} className="hover:text-slate-700">
                  {entry.name}
                </Link>
              </span>
            ))}
          </nav>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Ordner"
              description={`${visibleFolders.length} ${visibleFolders.length === 1 ? 'Ordner' : 'Ordner'}`}
            />
            <CardBody className={visibleFolders.length === 0 ? 'p-0' : undefined}>
              {visibleFolders.length === 0 ? (
                <EmptyState title="Keine Unterordner" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visibleFolders.map((folder) => (
                    <li key={folder.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                      <Link
                        href={`/c/${slug}/dateien?ordner=${folder.id}`}
                        className="min-w-0 flex-1 hover:text-brand-700"
                      >
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {folder.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {folder._count.files} Dateien · {folder._count.children} Unterordner
                          {folder.description ? ` · ${folder.description}` : ''}
                        </span>
                      </Link>
                      {folder.visibility === 'RESTRICTED' ? (
                        <Badge tone="warning">Beschränkt</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {currentId ? (
            <Card>
              <CardHeader
                title="Dateien"
                description={`${files.length} ${files.length === 1 ? 'Datei' : 'Dateien'} · ${formatBytes(totalSize)}`}
              />
              <CardBody className={files.length === 0 ? 'p-0' : undefined}>
                {files.length === 0 ? (
                  <EmptyState
                    title="Noch keine Dateien"
                    description={access.canWrite ? 'Legen Sie rechts die erste Datei ab.' : undefined}
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {files.map((file) => (
                      <FileRow
                        key={file.id}
                        file={{
                          id: file.id,
                          name: file.name,
                          description: file.description,
                          sizeLabel: formatBytes(file.sizeBytes),
                          mimeType: file.mimeType,
                          version: file.version,
                          updatedAt: formatDateTime(file.updatedAt),
                          downloadHref: `/api/dateien/${file.id}`,
                          versions: file.versions.map((version) => ({
                            id: version.id,
                            version: version.version,
                            sizeLabel: formatBytes(version.sizeBytes),
                            uploadedAt: formatDateTime(version.uploadedAt),
                            uploadedBy: version.uploadedBy
                              ? `${version.uploadedBy.firstName} ${version.uploadedBy.lastName}`.trim()
                              : null,
                            note: version.note,
                            downloadHref: `/api/dateien/${file.id}?fassung=${version.id}`,
                            restoreAction: restoreVersionAction.bind(null, slug, file.id, version.id),
                          })),
                        }}
                        canWrite={access.canWrite}
                        canManage={access.canManage}
                        renameAction={renameFileAction.bind(null, slug, file.id)}
                        deleteAction={deleteFileAction.bind(null, slug, file.id)}
                      />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : (
            <Alert tone="info">
              Wählen Sie einen Ordner aus, um die darin abgelegten Dateien zu sehen.
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          {currentId && access.canWrite ? (
            <Card>
              <CardHeader title="Dateien ablegen" description="Gleiche Namen werden zu einer neuen Fassung." />
              <CardBody>
                <UploadForm action={uploadFilesAction.bind(null, slug, currentId)} />
              </CardBody>
            </Card>
          ) : null}

          {access.canWrite ? (
            <Card>
              <CardHeader title="Neuer Ordner" />
              <CardBody>
                <NewFolderForm action={createFolderAction.bind(null, slug, currentId)} />
              </CardBody>
            </Card>
          ) : null}

          {current && access.canManage ? (
            <FolderSettings
              folder={{
                id: current.id,
                name: current.name,
                description: current.description,
                visibility: current.visibility,
                isSystem: current.isSystem,
                rules: Object.fromEntries(current.rules.map((rule) => [rule.roleId, rule.level])),
              }}
              roles={roles}
              accessLevels={Object.entries(ACCESS_LEVEL).map(([value, title]) => ({ value, title }))}
              visibilityOptions={Object.entries(FOLDER_VISIBILITY).map(([value, title]) => ({
                value,
                title,
              }))}
              updateAction={updateFolderAction.bind(null, slug, current.id)}
              deleteAction={deleteFolderAction.bind(null, slug, current.id)}
            />
          ) : null}

          {current ? (
            <Card>
              <CardHeader title="Über diesen Ordner" />
              <CardBody className="space-y-1.5 text-sm text-slate-600">
                <p>Pfad: {current.path}</p>
                <p>Sichtbarkeit: {label(FOLDER_VISIBILITY, current.visibility)}</p>
                <p>Angelegt: {formatDateTime(current.createdAt)}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
