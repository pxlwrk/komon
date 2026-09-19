'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import type { CommunityAccess } from '@/lib/auth';

export function CommunitySwitcher({
  communities,
  activeSlug,
  canCreate,
}: {
  communities: CommunityAccess[];
  activeSlug: string | null;
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const active = communities.find((entry) => entry.communitySlug === activeSlug);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-900">
            {active?.communityName ?? 'Community wählen'}
          </span>
          {active ? (
            <span className="block truncate text-xs text-slate-500">
              {active.roleNames.join(', ') || 'Ohne Rolle'}
            </span>
          ) : null}
        </span>
        <span aria-hidden className="text-slate-400">
          ⌄
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {communities.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Noch keine Community zugeordnet.</p>
          ) : null}

          {communities.map((entry) => (
            <button
              key={entry.communityId}
              type="button"
              role="option"
              aria-selected={entry.communitySlug === activeSlug}
              onClick={() => {
                setOpen(false);
                router.push(`/c/${entry.communitySlug}`);
              }}
              className={clsx(
                'block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                entry.communitySlug === activeSlug ? 'font-medium text-brand-700' : 'text-slate-700',
              )}
            >
              <span className="block truncate">{entry.communityName}</span>
              <span className="block truncate text-xs text-slate-500">
                {entry.roleNames.join(', ') || 'Ohne Rolle'}
              </span>
            </button>
          ))}

          <div className="mt-1 border-t border-slate-100 pt-1">
            <Link
              href="/communities"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Alle Communities
            </Link>
            {canCreate ? (
              <Link
                href="/communities?neu=1"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-brand-700 hover:bg-slate-50"
              >
                Neue Community anlegen
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
