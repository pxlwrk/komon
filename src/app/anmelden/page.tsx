import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { config } from '@/lib/config';

import { LoginForm } from './login-form';

export const metadata = { title: 'Anmelden' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/communities');
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            Ko
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">{config.appName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gemeinsame Verwaltung Ihrer Communities
          </p>
        </div>

        <div className="card p-6">
          <LoginForm redirectTo={params.weiter} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Zugang erhalten Sie über die Verwaltung Ihrer Community.
        </p>
      </div>
    </main>
  );
}
