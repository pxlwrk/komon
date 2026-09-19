import Link from 'next/link';

import { logoutAction } from '@/app/anmelden/actions';
import { CommunitySwitcher } from '@/components/community-switcher';
import { SidebarNav, type NavSection } from '@/components/sidebar-nav';
import { Avatar } from '@/components/ui';
import type { CurrentUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { initials } from '@/lib/format';

export function AppShell({
  user,
  activeSlug,
  sections,
  children,
}: {
  user: CurrentUser;
  activeSlug: string | null;
  sections: NavSection[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex flex-col border-b border-slate-200 bg-white lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            Ko
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{config.appName}</p>
            <p className="truncate text-xs text-slate-500">Community-Verwaltung</p>
          </div>
        </div>

        <div className="px-3 pb-3">
          <CommunitySwitcher communities={user.communities} activeSlug={activeSlug} canCreate={user.isSuperAdmin} />
        </div>

        <div className="scroll-area flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav sections={sections} />
        </div>

        <div className="border-t border-slate-200 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar initials={initials(user.firstName, user.lastName)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/konto"
              className="flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Mein Konto
            </Link>
            <form action={logoutAction} className="flex-1">
              <button
                type="submit"
                className="w-full rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
