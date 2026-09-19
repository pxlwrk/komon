import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, statusTone } from '@/components/ui';
import {
  JOURNAL_CHANNEL,
  JOURNAL_STATUS,
  JOURNAL_TYPE,
  JOURNAL_VISIBILITY,
  journalStatusValues,
  label,
} from '@/lib/enums';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  addCommentAction,
  deleteCommentAction,
  deleteJournalEntryAction,
  setJournalStatusAction,
  updateJournalEntryAction,
} from '../actions';
import { JournalForm } from '../journal-form';
import { CommentSection, EntryToolbar } from './entry-ui';

export default async function JournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ bearbeiten?: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'journal.view');
  const query = await searchParams;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, communityId: context.community.id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      event: { select: { id: true, title: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, firstName: true, lastName: true, displayName: true } } },
      },
    },
  });

  if (!entry) notFound();

  // Interne Einträge sehen nur die Redaktion und die verfassende Person.
  if (entry.visibility === 'STAFF' && !context.can('journal.publish') && entry.authorId !== context.user.id) {
    notFound();
  }

  const canEdit = context.can('journal.write');
  const editing = canEdit && query.bearbeiten === '1';

  const events = canEdit
    ? await prisma.event.findMany({
        where: { communityId: context.community.id },
        orderBy: { startAt: 'desc' },
        select: { id: true, title: true },
        take: 100,
      })
    : [];

  return (
    <>
      <PageHeader
        title={entry.title}
        description={
          entry.author
            ? `${entry.author.displayName || `${entry.author.firstName} ${entry.author.lastName}`.trim()} · zuletzt bearbeitet ${formatDateTime(entry.updatedAt)}`
            : `Zuletzt bearbeitet ${formatDateTime(entry.updatedAt)}`
        }
        breadcrumb={
          <Link href={`/c/${slug}/journal`} className="hover:text-slate-700">
            Content-Journal
          </Link>
        }
        actions={
          canEdit ? (
            <>
              {editing ? (
                <LinkButton href={`/c/${slug}/journal/${entry.id}`} variant="secondary">
                  Ansicht
                </LinkButton>
              ) : (
                <LinkButton href={`/c/${slug}/journal/${entry.id}?bearbeiten=1`} variant="secondary">
                  Bearbeiten
                </LinkButton>
              )}
              <EntryToolbar
                status={entry.status}
                statusOptions={journalStatusValues
                  .filter((value) => context.can('journal.publish') || value !== 'PUBLISHED')
                  .map((value) => ({ value, title: JOURNAL_STATUS[value] }))}
                setStatus={setJournalStatusAction.bind(null, slug, entry.id)}
                deleteAction={deleteJournalEntryAction.bind(null, slug, entry.id)}
                newsletterHref={
                  context.can('mail.compose')
                    ? `/c/${slug}/nachrichten/neu?betreff=${encodeURIComponent(entry.title)}&text=${encodeURIComponent(
                        [entry.summary, entry.content].filter(Boolean).join('\n\n'),
                      )}`
                    : null
                }
                title={entry.title}
              />
            </>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={statusTone(entry.status)}>{label(JOURNAL_STATUS, entry.status)}</Badge>
        <Badge>{label(JOURNAL_TYPE, entry.type)}</Badge>
        <Badge tone="info">{label(JOURNAL_CHANNEL, entry.channel)}</Badge>
        <Badge>{label(JOURNAL_VISIBILITY, entry.visibility)}</Badge>
        {entry.plannedAt ? <Badge tone="warning">Geplant für {formatDateTime(entry.plannedAt)}</Badge> : null}
        {entry.publishedAt ? <Badge tone="success">Veröffentlicht {formatDateTime(entry.publishedAt)}</Badge> : null}
        {entry.event ? (
          <Link href={`/c/${slug}/events/${entry.event.id}`}>
            <Badge tone="brand">Zum Event: {entry.event.title}</Badge>
          </Link>
        ) : null}
        {entry.tags.map((link) => (
          <Badge key={link.tag.id}>{link.tag.name}</Badge>
        ))}
      </div>

      {editing ? (
        <JournalForm
          action={updateJournalEntryAction.bind(null, slug, entry.id)}
          values={{
            title: entry.title,
            summary: entry.summary,
            content: entry.content,
            type: entry.type,
            status: entry.status,
            channel: entry.channel,
            visibility: entry.visibility,
            plannedAt: entry.plannedAt ? toLocalInput(entry.plannedAt) : '',
            eventId: entry.eventId ?? '',
            tags: entry.tags.map((link) => link.tag.name).join(', '),
          }}
          events={events}
          canPublish={context.can('journal.publish')}
          cancelHref={`/c/${slug}/journal/${entry.id}`}
          submitLabel="Änderungen speichern"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardBody>
                {entry.summary ? (
                  <p className="mb-4 border-l-2 border-brand-300 pl-4 text-base text-slate-700">
                    {entry.summary}
                  </p>
                ) : null}
                {entry.content ? (
                  <p className="prose-note text-base">{entry.content}</p>
                ) : (
                  <p className="text-sm text-slate-500">Für diesen Eintrag gibt es noch keinen Text.</p>
                )}
              </CardBody>
            </Card>

            <CommentSection
              comments={entry.comments.map((comment) => ({
                id: comment.id,
                body: comment.body,
                author: comment.author
                  ? comment.author.displayName ||
                    `${comment.author.firstName} ${comment.author.lastName}`.trim()
                  : 'Unbekannt',
                createdAt: formatDateTime(comment.createdAt),
                canDelete: comment.authorId === context.user.id || context.can('journal.publish'),
                deleteAction: deleteCommentAction.bind(null, slug, entry.id, comment.id),
              }))}
              addAction={addCommentAction.bind(null, slug, entry.id)}
            />
          </div>

          <Card className="h-fit">
            <CardHeader title="Angaben" />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>Angelegt: {formatDateTime(entry.createdAt)}</p>
              <p>Zuletzt bearbeitet: {formatDateTime(entry.updatedAt)}</p>
              {entry.plannedAt ? <p>Geplant für: {formatDateTime(entry.plannedAt)}</p> : null}
              {entry.publishedAt ? <p>Veröffentlicht: {formatDateTime(entry.publishedAt)}</p> : null}
              <p>Kanal: {label(JOURNAL_CHANNEL, entry.channel)}</p>
              <p>Sichtbarkeit: {label(JOURNAL_VISIBILITY, entry.visibility)}</p>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
