'use client';

import Link from 'next/link';
import clsx from 'clsx';

export function EventTabs({
  basePath,
  tabs,
  active,
}: {
  basePath: string;
  tabs: { key: string; title: string }[];
  active: string;
}) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="Bereiche">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === 'uebersicht' ? basePath : `${basePath}?bereich=${tab.key}`}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm transition',
            active === tab.key
              ? 'border-brand-600 font-medium text-brand-700'
              : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
          )}
        >
          {tab.title}
        </Link>
      ))}
    </nav>
  );
}
