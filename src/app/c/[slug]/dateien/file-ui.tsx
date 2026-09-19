'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function UploadForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Dateien" htmlFor="files" required>
        <input id="files" name="files" type="file" multiple required className="text-sm" />
      </Field>

      <Field label="Anmerkung" htmlFor="upload-description" hint="Erscheint im Versionsverlauf.">
        <input id="upload-description" name="description" placeholder="Fassung nach der Sitzung" />
      </Field>

      <SubmitButton pendingLabel="Wird hochgeladen">Ablegen</SubmitButton>
    </form>
  );
}

export function NewFolderForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Name" htmlFor="folder-name" required>
        <input id="folder-name" name="name" required placeholder="Protokolle" />
      </Field>

      <Field label="Beschreibung" htmlFor="folder-description">
        <input id="folder-description" name="description" />
      </Field>

      <Field label="Sichtbarkeit" htmlFor="folder-visibility">
        <select id="folder-visibility" name="visibility" defaultValue="COMMUNITY">
          <option value="COMMUNITY">Alle Mitglieder</option>
          <option value="RESTRICTED">Nur ausgewählte Rollen</option>
        </select>
      </Field>

      <SubmitButton pendingLabel="Wird angelegt">Ordner anlegen</SubmitButton>
    </form>
  );
}

export function FolderSettings({
  folder,
  roles,
  accessLevels,
  visibilityOptions,
  updateAction,
  deleteAction,
}: {
  folder: {
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    isSystem: boolean;
    rules: Record<string, string>;
  };
  roles: { id: string; name: string }[];
  accessLevels: { value: string; title: string }[];
  visibilityOptions: { value: string; title: string }[];
  updateAction: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [state, formAction] = useActionState(updateAction, idleState);
  const [visibility, setVisibility] = useState(folder.visibility);
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader title="Ordner verwalten" />
      <CardBody className="space-y-4">
        <form action={formAction} className="space-y-3">
          <FormMessage state={state} />

          <Field label="Name" htmlFor={`edit-name-${folder.id}`} required>
            <input id={`edit-name-${folder.id}`} name="name" defaultValue={folder.name} required />
          </Field>

          <Field label="Beschreibung" htmlFor={`edit-description-${folder.id}`}>
            <input
              id={`edit-description-${folder.id}`}
              name="description"
              defaultValue={folder.description ?? ''}
            />
          </Field>

          <Field label="Sichtbarkeit" htmlFor={`edit-visibility-${folder.id}`}>
            <select
              id={`edit-visibility-${folder.id}`}
              name="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              {visibilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.title}
                </option>
              ))}
            </select>
          </Field>

          {visibility === 'RESTRICTED' ? (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">Rechte je Rolle</p>
              {roles.map((role) => (
                <div key={role.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-slate-700">{role.name}</span>
                  <select
                    name={`rule_${role.id}`}
                    defaultValue={folder.rules[role.id] ?? ''}
                    className="w-44 shrink-0"
                    aria-label={`Zugriff für ${role.name}`}
                  >
                    <option value="">Kein Zugriff</option>
                    {accessLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.title}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="hint">
                Wer das Recht „Ordner und Dateien verwalten“ besitzt, sieht diesen Ordner in jedem Fall.
              </p>
            </div>
          ) : null}

          <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
            Speichern
          </SubmitButton>
        </form>

        {!folder.isSystem ? (
          <div className="border-t border-slate-100 pt-3">
            {confirming ? (
              <form action={deleteAction} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Ordner samt Inhalt löschen?</span>
                <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
                  Ja, löschen
                </SubmitButton>
                <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
                  Abbrechen
                </Button>
              </form>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                Ordner löschen
              </Button>
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function FileRow({
  file,
  canWrite,
  canManage,
  renameAction,
  deleteAction,
}: {
  file: {
    id: string;
    name: string;
    description: string | null;
    sizeLabel: string;
    mimeType: string;
    version: number;
    updatedAt: string;
    downloadHref: string;
    versions: {
      id: string;
      version: number;
      sizeLabel: string;
      uploadedAt: string;
      uploadedBy: string | null;
      note: string | null;
      downloadHref: string;
      restoreAction: () => Promise<void>;
    }[];
  };
  canWrite: boolean;
  canManage: boolean;
  renameAction: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [view, setView] = useState<'none' | 'edit' | 'versions'>('none');
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(renameAction, idleState);

  return (
    <li className="py-2.5 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <a href={file.downloadHref} className="min-w-0 flex-1 hover:text-brand-700">
          <span className="block truncate text-sm font-medium text-slate-800">{file.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {file.sizeLabel} · Fassung {file.version} · {file.updatedAt}
            {file.description ? ` · ${file.description}` : ''}
          </span>
        </a>

        <div className="flex shrink-0 items-center gap-1">
          {file.versions.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView(view === 'versions' ? 'none' : 'versions')}
            >
              Verlauf
            </Button>
          ) : null}
          {canWrite ? (
            <Button variant="ghost" size="sm" onClick={() => setView(view === 'edit' ? 'none' : 'edit')}>
              Ändern
            </Button>
          ) : null}
        </div>
      </div>

      {view === 'versions' ? (
        <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5">
          {file.versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-2">
              <a href={version.downloadHref} className="min-w-0 text-xs text-slate-600 hover:text-brand-700">
                <span className="block truncate">
                  Fassung {version.version} · {version.sizeLabel} · {version.uploadedAt}
                </span>
                <span className="block truncate text-slate-500">
                  {version.uploadedBy ?? 'Unbekannt'}
                  {version.note ? ` · ${version.note}` : ''}
                </span>
              </a>
              {canWrite && version.version !== file.version ? (
                <form action={version.restoreAction}>
                  <SubmitButton variant="ghost" size="sm" pendingLabel="Wird gesetzt">
                    Wiederherstellen
                  </SubmitButton>
                </form>
              ) : version.version === file.version ? (
                <Badge tone="success">Aktuell</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {view === 'edit' && canWrite ? (
        <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-2.5">
          <form action={formAction} className="space-y-2">
            <FormMessage state={state} />
            <Field label="Name" htmlFor={`file-name-${file.id}`} required>
              <input id={`file-name-${file.id}`} name="name" defaultValue={file.name} required />
            </Field>
            <Field label="Beschreibung" htmlFor={`file-description-${file.id}`}>
              <input
                id={`file-description-${file.id}`}
                name="description"
                defaultValue={file.description ?? ''}
              />
            </Field>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
              Speichern
            </SubmitButton>
          </form>

          {canManage ? (
            <div className="border-t border-slate-200 pt-2">
              {confirming ? (
                <form action={deleteAction} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Datei mit allen Fassungen löschen?</span>
                  <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
                    Ja, löschen
                  </SubmitButton>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
                    Abbrechen
                  </Button>
                </form>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                  Datei löschen
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
