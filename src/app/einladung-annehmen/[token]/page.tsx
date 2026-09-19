import { notFound } from 'next/navigation';

import { Alert, Card, CardBody } from '@/components/ui';
import { config } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';

import { acceptInvitationAction } from './actions';
import { AcceptForm } from './accept-form';

export const metadata = { title: 'Zugang einrichten' };

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.accountInvitation.findUnique({
    where: { token },
    include: {
      community: { select: { name: true } },
      role: { select: { name: true } },
      invitedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!invitation) notFound();

  const invalid =
    invitation.revokedAt !== null ||
    invitation.acceptedAt !== null ||
    invitation.expiresAt.getTime() < Date.now();

  const person = await prisma.person.findUnique({
    where: { primaryEmail: invitation.email },
    select: { firstName: true, lastName: true },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            Ko
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Willkommen</h1>
          <p className="mt-1 text-sm text-slate-600">
            {invitation.invitedBy
              ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName} lädt Sie zu ${invitation.community.name} ein.`
              : `Sie wurden zu ${invitation.community.name} eingeladen.`}
          </p>
        </header>

        <Card>
          <CardBody>
            {invalid ? (
              <Alert tone="warning" title="Einladung nicht mehr gültig">
                {invitation.acceptedAt
                  ? 'Dieser Zugang wurde bereits eingerichtet. Sie können sich anmelden.'
                  : invitation.revokedAt
                    ? 'Die Einladung wurde zurückgezogen.'
                    : `Die Einladung galt bis zum ${formatDate(invitation.expiresAt)}.`}
              </Alert>
            ) : (
              <>
                {invitation.message ? (
                  <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {invitation.message}
                  </p>
                ) : null}

                <AcceptForm
                  action={acceptInvitationAction.bind(null, token)}
                  email={invitation.email}
                  firstName={person?.firstName ?? invitation.firstName ?? ''}
                  lastName={person?.lastName ?? invitation.lastName ?? ''}
                  roleName={invitation.role?.name ?? null}
                />
              </>
            )}
          </CardBody>
        </Card>

        <p className="text-center text-xs text-slate-500">
          {config.appName} · Ihr Zugang gilt für {invitation.community.name}.
        </p>
      </div>
    </main>
  );
}
