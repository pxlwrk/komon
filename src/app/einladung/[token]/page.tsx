import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, CardHeader, statusTone } from '@/components/ui';
import { config } from '@/lib/config';
import { PARTICIPATION_STATUS, label } from '@/lib/enums';
import { formatRange } from '@/lib/format';
import { prisma } from '@/lib/prisma';

import { respondAction, submitFeedbackAction } from './actions';
import { FeedbackForm, ResponseForm } from './response-form';

export const metadata = { title: 'Einladung' };

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const participation = await prisma.eventParticipation.findUnique({
    where: { responseToken: token },
    include: {
      event: {
        include: {
          community: { select: { name: true } },
          organizer: { select: { firstName: true, lastName: true, primaryEmail: true } },
          agenda: { orderBy: [{ position: 'asc' }, { startAt: 'asc' }] },
        },
      },
    },
  });

  if (!participation) notFound();

  const event = participation.event;
  const isPast = event.endAt.getTime() < Date.now();
  const place = event.onlineUrl
    ? 'Online'
    : [event.locationName, event.locationAddress].filter(Boolean).join(', ') ||
      'Der Ort wird noch bekannt gegeben';

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
            {event.community.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{event.title}</h1>
          <p className="mt-2 text-slate-600">{formatRange(event.startAt, event.endAt, event.allDay)}</p>
        </header>

        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(participation.status)}>
                Ihre Rückmeldung: {label(PARTICIPATION_STATUS, participation.status)}
              </Badge>
              {event.status === 'CANCELLED' ? <Badge tone="danger">Abgesagt</Badge> : null}
              {isPast ? <Badge>Bereits vorbei</Badge> : null}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Wann</dt>
                <dd className="text-sm text-slate-800">
                  {formatRange(event.startAt, event.endAt, event.allDay)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Wo</dt>
                <dd className="text-sm text-slate-800">{place}</dd>
              </div>
              {event.onlineUrl ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Zugang</dt>
                  <dd className="break-all text-sm">
                    <a href={event.onlineUrl} className="text-brand-700 hover:underline">
                      {event.onlineUrl}
                    </a>
                  </dd>
                </div>
              ) : null}
              {event.organizer ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Ansprechperson</dt>
                  <dd className="text-sm text-slate-800">
                    {event.organizer.firstName} {event.organizer.lastName} ·{' '}
                    <a href={`mailto:${event.organizer.primaryEmail}`} className="text-brand-700 hover:underline">
                      {event.organizer.primaryEmail}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            {event.description ? <p className="prose-note border-t border-slate-100 pt-4">{event.description}</p> : null}
          </CardBody>
        </Card>

        {event.agenda.length > 0 ? (
          <Card>
            <CardHeader title="Programm" />
            <CardBody>
              <ol className="space-y-2">
                {event.agenda.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="w-24 shrink-0 text-sm text-slate-500">
                      {item.startAt
                        ? new Intl.DateTimeFormat('de-DE', {
                            timeStyle: 'short',
                            timeZone: event.timezone,
                          }).format(item.startAt)
                        : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{item.title}</span>
                      {item.speaker ? (
                        <span className="block text-xs text-slate-500">{item.speaker}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ) : null}

        {!isPast && event.status !== 'CANCELLED' ? (
          <Card>
            <CardHeader title="Sind Sie dabei?" description="Ihre Rückmeldung hilft uns bei der Planung." />
            <CardBody>
              <ResponseForm
                action={respondAction.bind(null, token)}
                currentStatus={participation.status}
                guestCount={participation.guestCount}
                note={participation.note}
                dietaryNotes={participation.dietaryNotes}
                allowGuests={event.allowGuests}
              />
            </CardBody>
          </Card>
        ) : null}

        {isPast ? (
          <Card>
            <CardHeader title="Wie hat es Ihnen gefallen?" description="Ihre Rückmeldung fließt in die Nachbereitung ein." />
            <CardBody>
              <FeedbackForm action={submitFeedbackAction.bind(null, token)} />
            </CardBody>
          </Card>
        ) : null}

        <p className="text-center text-xs text-slate-500">
          Diese Seite gehört zu {config.appName}. Sie haben den Link persönlich per E-Mail erhalten.
        </p>
      </div>
    </main>
  );
}
