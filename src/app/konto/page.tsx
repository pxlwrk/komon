import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/rbac';

import { changePasswordAction, endSessionAction, updateProfileAction } from './actions';
import { PasswordForm, ProfileForm, SessionRow } from './account-ui';

export const metadata = { title: 'Mein Konto' };

const TIMEZONES = ['Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/London', 'UTC'];

export default async function AccountPage() {
  const user = await requireUser();

  const [person, sessions] = await Promise.all([
    prisma.person.findUniqueOrThrow({
      where: { id: user.id },
      include: { emailAddresses: { orderBy: [{ isPrimary: 'desc' }] } },
    }),
    prisma.session.findMany({
      where: { personId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <AppShell
      user={user}
      activeSlug={null}
      sections={[{ items: [{ href: '/konto', label: 'Mein Konto', exact: true }] }]}
    >
      <PageHeader
        title="Mein Konto"
        description="Ihre persönlichen Angaben, Ihr Passwort und Ihre aktiven Sitzungen."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Persönliche Angaben"
              description="Diese Angaben gelten in allen Communities, in denen Sie mitwirken."
            />
            <CardBody>
              <ProfileForm
                action={updateProfileAction}
                timezones={TIMEZONES}
                values={{
                  firstName: person.firstName,
                  lastName: person.lastName,
                  displayName: person.displayName,
                  pronouns: person.pronouns,
                  phone: person.phone,
                  mobile: person.mobile,
                  timezone: person.timezone,
                  email: person.primaryEmail,
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Passwort ändern" />
            <CardBody>
              {user.mustChangePassword ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Ihr Passwort wurde von der Verwaltung gesetzt. Bitte vergeben Sie ein eigenes.
                </div>
              ) : null}
              <PasswordForm action={changePasswordAction} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Aktive Sitzungen"
              description="Hier sehen Sie, wo Sie angemeldet sind."
            />
            <CardBody>
              <ul className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <li key={session.id} className="py-2.5 first:pt-0">
                    <SessionRow
                      session={{
                        id: session.id,
                        isCurrent: session.id === user.sessionId,
                        createdAt: formatDateTime(session.createdAt),
                        expiresAt: formatDateTime(session.expiresAt),
                        userAgent: session.userAgent,
                        ipAddress: session.ipAddress,
                      }}
                      endAction={endSessionAction.bind(null, session.id)}
                    />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Meine Communities" />
            <CardBody>
              {user.communities.length === 0 ? (
                <p className="text-sm text-slate-500">Sie sind noch keiner Community zugeordnet.</p>
              ) : (
                <ul className="space-y-2">
                  {user.communities.map((entry) => (
                    <li key={entry.communityId}>
                      <Link
                        href={`/c/${entry.communitySlug}`}
                        className="block rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                      >
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {entry.communityName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {entry.roleNames.join(', ') || 'Ohne Rolle'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="E-Mail-Adressen" />
            <CardBody>
              <ul className="space-y-2">
                {person.emailAddresses.map((address) => (
                  <li key={address.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-slate-800">{address.address}</span>
                    {address.isPrimary ? <Badge tone="brand">Haupt</Badge> : null}
                  </li>
                ))}
              </ul>
              <p className="hint mt-3">
                Weitere Adressen pflegt die Verwaltung Ihrer Community in Ihrem Stammdatensatz.
              </p>
            </CardBody>
          </Card>

          {user.isSuperAdmin ? (
            <Card>
              <CardHeader title="Plattformverwaltung" />
              <CardBody className="text-sm text-slate-600">
                <p>
                  Sie haben Zugriff auf alle Communities und können unter{' '}
                  <Link href="/communities?neu=1" className="text-brand-700 hover:underline">
                    Communities
                  </Link>{' '}
                  neue anlegen.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
