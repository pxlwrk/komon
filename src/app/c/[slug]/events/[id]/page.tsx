import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, StatTile, statusTone } from '@/components/ui';
import { EVENT_STATUS, EVENT_VISIBILITY, label } from '@/lib/enums';
import { formatDateTime, formatRange } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  addParticipantsAction,
  closeAttendanceAction,
  deleteAgendaItemAction,
  deleteEventAction,
  deleteTaskAction,
  linkResourceAction,
  removeParticipationAction,
  saveAgendaItemAction,
  saveDebriefAction,
  saveTaskAction,
  sendFollowUpAction,
  sendInvitationsAction,
  setEventStatusAction,
  setParticipationStatusAction,
  toggleCheckInAction,
  toggleTaskAction,
  unlinkResourceAction,
  updateEventAction,
} from '../actions';
import { EventForm } from '../event-form';
import { toLocalInput } from '../event-values';
import { AgendaPanel } from './agenda-panel';
import { DebriefPanel } from './debrief-panel';
import { EventTabs } from './event-tabs';
import { ParticipantsPanel } from './participants-panel';
import { ResourcesPanel } from './resources-panel';
import { StatusBar } from './status-bar';
import { TasksPanel } from './tasks-panel';

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ bereich?: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'event.view');
  const query = await searchParams;
  const section = query.bereich ?? 'uebersicht';

  const event = await prisma.event.findFirst({
    where: { id, communityId: context.community.id },
    include: {
      organizer: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      participations: { orderBy: [{ status: 'asc' }, { name: 'asc' }] },
      agenda: { orderBy: [{ position: 'asc' }, { startAt: 'asc' }] },
      tasks: {
        orderBy: [{ phase: 'asc' }, { position: 'asc' }, { dueAt: 'asc' }],
        include: { assignee: { select: { firstName: true, lastName: true, displayName: true } } },
      },
      resources: { include: { file: { select: { id: true, name: true, mimeType: true, sizeBytes: true } } } },
      feedback: { include: { person: { select: { firstName: true, lastName: true } } } },
    },
  });

  if (!event) notFound();

  const canManage = context.can('event.manage');
  const canInvite = context.can('event.invite');
  const canCheckIn = context.can('event.checkin');
  const canDebrief = context.can('event.debrief');

  const counts = event.participations.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.status] = (accumulator[entry.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const attendedCount = event.participations.filter((entry) => entry.attended === true).length;

  const [memberships, groups, files] = await Promise.all([
    canInvite || canManage
      ? prisma.membership.findMany({
          where: { communityId: context.community.id, status: 'ACTIVE' },
          include: {
            person: {
              select: { id: true, firstName: true, lastName: true, displayName: true, primaryEmail: true },
            },
          },
          orderBy: [{ person: { lastName: 'asc' } }],
        })
      : Promise.resolve([]),
    canInvite
      ? prisma.group.findMany({
          where: { communityId: context.community.id },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    canManage
      ? prisma.storedFile.findMany({
          where: { communityId: context.community.id, isArchived: false },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const people = memberships.map((membership) => ({
    id: membership.person.id,
    name:
      membership.person.displayName ||
      `${membership.person.lastName}, ${membership.person.firstName}`.replace(/^, /, ''),
    email: membership.person.primaryEmail,
  }));

  const tabs = [
    { key: 'uebersicht', title: 'Überblick' },
    { key: 'programm', title: `Programm (${event.agenda.length})` },
    { key: 'teilnehmende', title: `Teilnehmende (${event.participations.length})` },
    { key: 'aufgaben', title: `Aufgaben (${event.tasks.filter((task) => task.status !== 'DONE').length})` },
    { key: 'nachbereitung', title: 'Nachbereitung' },
  ];

  return (
    <>
      <PageHeader
        title={event.title}
        description={formatRange(event.startAt, event.endAt, event.allDay)}
        breadcrumb={
          <Link href={`/c/${slug}/events`} className="hover:text-slate-700">
            Events
          </Link>
        }
        actions={
          <>
            <LinkButton
              href={`/api/c/${slug}/events/${event.id}/termin.ics`}
              variant="secondary"
              prefetch={false}
            >
              Termin sichern
            </LinkButton>
            {canManage ? (
              <StatusBar
                status={event.status}
                statusOptions={Object.entries(EVENT_STATUS).map(([value, title]) => ({ value, title }))}
                setStatus={setEventStatusAction.bind(null, slug, event.id)}
                deleteAction={deleteEventAction.bind(null, slug, event.id)}
                title={event.title}
              />
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={statusTone(event.status)}>{label(EVENT_STATUS, event.status)}</Badge>
        <Badge>{label(EVENT_VISIBILITY, event.visibility)}</Badge>
        {event.locationName ? <Badge>{event.locationName}</Badge> : null}
        {event.onlineUrl ? <Badge tone="info">Online</Badge> : null}
        {event.capacity ? <Badge>Höchstzahl {event.capacity}</Badge> : null}
        {event.organizer ? (
          <Badge tone="brand">
            Verantwortung:{' '}
            {event.organizer.displayName ||
              `${event.organizer.firstName} ${event.organizer.lastName}`.trim()}
          </Badge>
        ) : null}
        {event.debriefDoneAt ? <Badge tone="success">Nachbereitung abgeschlossen</Badge> : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatTile label="Zugesagt" value={counts.ACCEPTED ?? 0} />
        <StatTile label="Offen" value={counts.INVITED ?? 0} />
        <StatTile label="Abgesagt" value={counts.DECLINED ?? 0} />
        <StatTile label="Teilgenommen" value={attendedCount} />
      </div>

      <EventTabs basePath={`/c/${slug}/events/${event.id}`} tabs={tabs} active={section} />

      <div className="mt-6">
        {section === 'uebersicht' ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {event.description ? (
                <Card>
                  <CardHeader title="Beschreibung" />
                  <CardBody>
                    <p className="prose-note">{event.description}</p>
                  </CardBody>
                </Card>
              ) : null}

              {canManage ? (
                <Card>
                  <CardHeader title="Eckdaten bearbeiten" />
                  <CardBody>
                    <EventForm
                      action={updateEventAction.bind(null, slug, event.id)}
                      values={{
                        title: event.title,
                        summary: event.summary,
                        description: event.description,
                        status: event.status,
                        startAt: toLocalInput(event.startAt),
                        endAt: toLocalInput(event.endAt),
                        allDay: event.allDay,
                        locationName: event.locationName,
                        locationAddress: event.locationAddress,
                        onlineUrl: event.onlineUrl,
                        capacity: event.capacity ? String(event.capacity) : '',
                        waitlistEnabled: event.waitlistEnabled,
                        allowGuests: event.allowGuests,
                        registrationClosesAt: event.registrationClosesAt
                          ? toLocalInput(event.registrationClosesAt)
                          : '',
                        visibility: event.visibility,
                        organizerId: event.organizerId ?? '',
                        plannedBudget: event.plannedBudget ? String(event.plannedBudget) : '',
                      }}
                      organizers={people.map((person) => ({ id: person.id, name: person.name }))}
                      cancelHref={`/c/${slug}/events`}
                      submitLabel="Änderungen speichern"
                    />
                  </CardBody>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Auf einen Blick" />
                <CardBody className="space-y-2 text-sm text-slate-600">
                  <p>Beginn: {formatDateTime(event.startAt)}</p>
                  <p>Ende: {formatDateTime(event.endAt)}</p>
                  {event.locationAddress ? <p>Anschrift: {event.locationAddress}</p> : null}
                  {event.onlineUrl ? (
                    <p className="break-all">
                      Online:{' '}
                      <a href={event.onlineUrl} className="text-brand-700 hover:underline">
                        {event.onlineUrl}
                      </a>
                    </p>
                  ) : null}
                  {event.registrationClosesAt ? (
                    <p>Anmeldeschluss: {formatDateTime(event.registrationClosesAt)}</p>
                  ) : null}
                  {event.plannedBudget !== null ? (
                    <p>Geplantes Budget: {event.plannedBudget.toFixed(2)} Euro</p>
                  ) : null}
                </CardBody>
              </Card>

              <ResourcesPanel
                resources={event.resources.map((resource) => ({
                  id: resource.id,
                  kind: resource.kind,
                  label: resource.label,
                  fileName: resource.file.name,
                  href: `/api/dateien/${resource.file.id}`,
                  unlinkAction: unlinkResourceAction.bind(null, slug, event.id, resource.id),
                }))}
                files={files}
                canManage={canManage}
                linkAction={linkResourceAction.bind(null, slug, event.id)}
              />
            </div>
          </div>
        ) : null}

        {section === 'programm' ? (
          <AgendaPanel
            items={event.agenda.map((item) => ({
              id: item.id,
              title: item.title,
              speaker: item.speaker,
              notes: item.notes,
              startAt: item.startAt ? toLocalInput(item.startAt) : '',
              startLabel: item.startAt ? formatDateTime(item.startAt) : null,
              durationMinutes: item.durationMinutes,
              position: item.position,
              saveAction: saveAgendaItemAction.bind(null, slug, event.id, item.id),
              deleteAction: deleteAgendaItemAction.bind(null, slug, event.id, item.id),
            }))}
            canManage={canManage}
            createAction={saveAgendaItemAction.bind(null, slug, event.id, null)}
          />
        ) : null}

        {section === 'teilnehmende' ? (
          <ParticipantsPanel
            participations={event.participations.map((participation) => ({
              id: participation.id,
              name: participation.name,
              email: participation.email,
              status: participation.status,
              statusTone: statusTone(participation.status),
              source: participation.source,
              guestCount: participation.guestCount,
              note: participation.note,
              respondedAt: participation.respondedAt ? formatDateTime(participation.respondedAt) : null,
              invitedAt: participation.remindedAt ? formatDateTime(participation.remindedAt) : null,
              checkedIn: participation.checkedInAt !== null,
              noShow: participation.noShow,
              personHref: participation.personId ? `/c/${slug}/teilnehmende?q=${encodeURIComponent(participation.email)}` : null,
              checkInAction: toggleCheckInAction.bind(null, slug, event.id, participation.id),
              removeAction: removeParticipationAction.bind(null, slug, event.id, participation.id),
              acceptAction: setParticipationStatusAction.bind(null, slug, event.id, participation.id, 'ACCEPTED'),
              declineAction: setParticipationStatusAction.bind(null, slug, event.id, participation.id, 'DECLINED'),
            }))}
            people={people}
            groups={groups}
            canInvite={canInvite}
            canManage={canManage}
            canCheckIn={canCheckIn}
            addAction={addParticipantsAction.bind(null, slug, event.id)}
            inviteAction={sendInvitationsAction.bind(null, slug, event.id)}
            closeAttendanceAction={closeAttendanceAction.bind(null, slug, event.id)}
          />
        ) : null}

        {section === 'aufgaben' ? (
          <TasksPanel
            tasks={event.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              description: task.description,
              phase: task.phase,
              status: task.status,
              statusTone: statusTone(task.status),
              dueAt: task.dueAt ? toLocalInput(task.dueAt) : '',
              dueLabel: task.dueAt ? formatDateTime(task.dueAt) : null,
              assigneeId: task.assigneeId ?? '',
              assigneeName: task.assignee
                ? task.assignee.displayName || `${task.assignee.firstName} ${task.assignee.lastName}`.trim()
                : null,
              saveAction: saveTaskAction.bind(null, slug, event.id, task.id),
              toggleAction: toggleTaskAction.bind(null, slug, event.id, task.id),
              deleteAction: deleteTaskAction.bind(null, slug, event.id, task.id),
            }))}
            people={people}
            canManage={canManage}
            createAction={saveTaskAction.bind(null, slug, event.id, null)}
          />
        ) : null}

        {section === 'nachbereitung' ? (
          <DebriefPanel
            event={{
              minutes: event.minutes,
              debriefNotes: event.debriefNotes,
              lessonsLearned: event.lessonsLearned,
              actualCost: event.actualCost ? String(event.actualCost) : '',
              plannedBudget: event.plannedBudget,
              done: event.debriefDoneAt !== null,
              doneLabel: event.debriefDoneAt ? formatDateTime(event.debriefDoneAt) : null,
              title: event.title,
              attendedCount,
              acceptedCount: counts.ACCEPTED ?? 0,
              noShowCount: event.participations.filter((entry) => entry.noShow).length,
            }}
            feedback={event.feedback.map((entry) => ({
              id: entry.id,
              rating: entry.rating,
              comment: entry.comment,
              author: entry.person ? `${entry.person.firstName} ${entry.person.lastName}`.trim() : 'Anonym',
              submittedAt: formatDateTime(entry.submittedAt),
            }))}
            canDebrief={canDebrief}
            saveAction={saveDebriefAction.bind(null, slug, event.id)}
            followUpAction={sendFollowUpAction.bind(null, slug, event.id)}
          />
        ) : null}
      </div>
    </>
  );
}
