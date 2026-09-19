'use client';

import { useActionState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import {
  ARCHIVE_POLICY,
  LIST_TYPE,
  MODERATION_POLICY,
  POSTING_POLICY,
  REPLY_TO_MODE,
  SUBSCRIPTION_POLICY,
  archivePolicyValues,
  listTypeValues,
  moderationPolicyValues,
  postingPolicyValues,
  replyToModeValues,
  subscriptionPolicyValues,
} from '@/lib/enums';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type ListFormValues = {
  name: string;
  localPart: string;
  description: string | null;
  listType: string;
  postingPolicy: string;
  moderationPolicy: string;
  subscriptionPolicy: string;
  replyToMode: string;
  archivePolicy: string;
  subjectPrefix: string | null;
  footerText: string | null;
  autoSubscribeGroupId: string | null;
  isActive: boolean;
};

const defaults: ListFormValues = {
  name: '',
  localPart: '',
  description: null,
  listType: 'DISCUSSION',
  postingPolicy: 'SUBSCRIBERS',
  moderationPolicy: 'NON_SUBSCRIBERS',
  subscriptionPolicy: 'APPROVAL',
  replyToMode: 'LIST',
  archivePolicy: 'SUBSCRIBERS',
  subjectPrefix: null,
  footerText: null,
  autoSubscribeGroupId: null,
  isActive: true,
};

export function CreateListForm({
  action,
  groups,
  mailDomain,
}: {
  action: FormAction;
  groups: { id: string; name: string }[];
  mailDomain: string;
}) {
  return (
    <ListForm
      action={action}
      groups={groups}
      mailDomain={mailDomain}
      values={defaults}
      submitLabel="Liste anlegen"
      idPrefix="neu"
      compact
    />
  );
}

export function ListForm({
  action,
  groups,
  mailDomain,
  values,
  submitLabel,
  idPrefix,
  compact = false,
}: {
  action: FormAction;
  groups: { id: string; name: string }[];
  mailDomain: string;
  values: ListFormValues;
  submitLabel: string;
  idPrefix: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="Name" htmlFor={id('name')} required>
        <input id={id('name')} name="name" required defaultValue={values.name} placeholder="Vorstand" />
        <FieldError state={state} name="name" />
      </Field>

      <Field label="Adresse" htmlFor={id('localPart')} required hint={`Ergibt zusammen: name@${mailDomain}`}>
        <div className="flex items-center gap-1">
          <input
            id={id('localPart')}
            name="localPart"
            required
            defaultValue={values.localPart}
            placeholder="vorstand"
            className="min-w-0 flex-1"
          />
          <span className="shrink-0 text-sm text-slate-500">@{mailDomain}</span>
        </div>
        <FieldError state={state} name="localPart" />
      </Field>

      <Field label="Beschreibung" htmlFor={id('description')}>
        <textarea id={id('description')} name="description" rows={2} defaultValue={values.description ?? ''} />
      </Field>

      <div className={compact ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
        <Field label="Art der Liste" htmlFor={id('listType')}>
          <select id={id('listType')} name="listType" defaultValue={values.listType}>
            {listTypeValues.map((value) => (
              <option key={value} value={value}>
                {LIST_TYPE[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Wer darf schreiben" htmlFor={id('postingPolicy')}>
          <select id={id('postingPolicy')} name="postingPolicy" defaultValue={values.postingPolicy}>
            {postingPolicyValues.map((value) => (
              <option key={value} value={value}>
                {POSTING_POLICY[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Moderation" htmlFor={id('moderationPolicy')}>
          <select id={id('moderationPolicy')} name="moderationPolicy" defaultValue={values.moderationPolicy}>
            {moderationPolicyValues.map((value) => (
              <option key={value} value={value}>
                {MODERATION_POLICY[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Eintragen in die Liste" htmlFor={id('subscriptionPolicy')}>
          <select id={id('subscriptionPolicy')} name="subscriptionPolicy" defaultValue={values.subscriptionPolicy}>
            {subscriptionPolicyValues.map((value) => (
              <option key={value} value={value}>
                {SUBSCRIPTION_POLICY[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Antworten gehen an" htmlFor={id('replyToMode')}>
          <select id={id('replyToMode')} name="replyToMode" defaultValue={values.replyToMode}>
            {replyToModeValues.map((value) => (
              <option key={value} value={value}>
                {REPLY_TO_MODE[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Wer sieht das Archiv" htmlFor={id('archivePolicy')}>
          <select id={id('archivePolicy')} name="archivePolicy" defaultValue={values.archivePolicy}>
            {archivePolicyValues.map((value) => (
              <option key={value} value={value}>
                {ARCHIVE_POLICY[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Betreffzusatz" htmlFor={id('subjectPrefix')} hint="Beispiel: [Vorstand]">
          <input id={id('subjectPrefix')} name="subjectPrefix" defaultValue={values.subjectPrefix ?? ''} />
        </Field>

        <Field label="Gruppe für den Abgleich" htmlFor={id('autoSubscribeGroupId')} hint="Die Mitglieder dieser Gruppe werden automatisch eingetragen.">
          <select
            id={id('autoSubscribeGroupId')}
            name="autoSubscribeGroupId"
            defaultValue={values.autoSubscribeGroupId ?? ''}
          >
            <option value="">Ohne Abgleich</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Fußzeile" htmlFor={id('footerText')} hint="Wird unter jeden verteilten Beitrag gesetzt.">
        <textarea id={id('footerText')} name="footerText" rows={2} defaultValue={values.footerText ?? ''} />
      </Field>

      <div className="flex items-center gap-2">
        <input id={id('isActive')} name="isActive" type="checkbox" defaultChecked={values.isActive} />
        <label htmlFor={id('isActive')} className="font-normal">
          Liste nimmt Beiträge an
        </label>
      </div>

      <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
    </form>
  );
}
