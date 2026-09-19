'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { MEMBERSHIP_STATUS, membershipStatusValues } from '@/lib/enums';

export function MemberFilters({
  basePath,
  groups,
  tags,
  current,
}: {
  basePath: string;
  groups: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  current: { q: string; status: string; gruppe: string; tag: string };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value.trim().length > 0) {
        params.set(key, value.trim());
      }
    }
    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="lg:col-span-2">
        <label htmlFor="q" className="sr-only">
          Suche
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={current.q}
          placeholder="Name, E-Mail, Ort oder Organisation"
        />
      </div>

      <div>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={current.status} onChange={submit}>
          <option value="">Alle Status</option>
          {membershipStatusValues.map((value) => (
            <option key={value} value={value}>
              {MEMBERSHIP_STATUS[value]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="gruppe" className="sr-only">
          Gruppe
        </label>
        <select id="gruppe" name="gruppe" defaultValue={current.gruppe} onChange={submit}>
          <option value="">Alle Gruppen</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <select
          name="tag"
          defaultValue={current.tag}
          onChange={submit}
          aria-label="Schlagwort"
          className="min-w-0 flex-1"
        >
          <option value="">Alle Schlagworte</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Suchen
        </button>
      </div>
    </form>
  );
}
