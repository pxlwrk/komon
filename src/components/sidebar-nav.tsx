'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export type NavItem = {
  href: string;
  label: string;
  /** Zusatzangabe rechts, etwa die Zahl offener Vorgaenge. */
  badge?: number;
  /** Der Eintrag gilt nur bei exakter Uebereinstimmung als aktiv. */
  exact?: boolean;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav className="space-y-5">
      {sections.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title ? (
            <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition',
                    isActive(item)
                      ? 'bg-brand-50 font-medium text-brand-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
