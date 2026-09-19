import { describe, expect, it } from 'vitest';

import {
  applyFooter,
  applySubjectPrefix,
  canViewArchive,
  evaluateDisposition,
} from '@/lib/mailinglist';

describe('evaluateDisposition', () => {
  const base = {
    postingPolicy: 'SUBSCRIBERS',
    moderationPolicy: 'NON_SUBSCRIBERS',
    isSubscriber: false,
    isModerator: false,
    isCommunityMember: false,
    subscriptionModerated: false,
    subscriptionStatus: null as string | null,
  };

  it('verteilt Beiträge eingetragener Adressen sofort', () => {
    const result = evaluateDisposition({ ...base, isSubscriber: true });
    expect(result.decision).toBe('DISTRIBUTE');
  });

  it('legt fremde Absender der Moderation vor', () => {
    const result = evaluateDisposition(base);
    expect(result.decision).toBe('MODERATE');
  });

  it('weist gesperrte Adressen ab', () => {
    const result = evaluateDisposition({ ...base, isSubscriber: true, subscriptionStatus: 'BLOCKED' });
    expect(result.decision).toBe('REJECT');
  });

  it('lässt auf einer offenen Liste alle schreiben', () => {
    const result = evaluateDisposition({
      ...base,
      postingPolicy: 'OPEN',
      moderationPolicy: 'NONE',
    });
    expect(result.decision).toBe('DISTRIBUTE');
  });

  it('weist auf einer Ankündigungsliste alle außer der Moderation ab', () => {
    const result = evaluateDisposition({
      ...base,
      postingPolicy: 'MODERATORS',
      isSubscriber: true,
    });
    expect(result.decision).toBe('REJECT');
  });

  it('lässt die Moderation auf einer Ankündigungsliste durch', () => {
    const result = evaluateDisposition({
      ...base,
      postingPolicy: 'MODERATORS',
      moderationPolicy: 'NONE',
      isModerator: true,
      isSubscriber: true,
    });
    expect(result.decision).toBe('DISTRIBUTE');
  });

  it('moderiert alle Beiträge, wenn die Liste das verlangt', () => {
    const result = evaluateDisposition({
      ...base,
      moderationPolicy: 'ALL',
      isSubscriber: true,
    });
    expect(result.decision).toBe('MODERATE');
  });

  it('moderiert einzelne Adressen mit gesetztem Merkmal', () => {
    const result = evaluateDisposition({
      ...base,
      moderationPolicy: 'NONE',
      isSubscriber: true,
      subscriptionModerated: true,
    });
    expect(result.decision).toBe('MODERATE');
  });

  it('lässt Mitglieder der Community auf einer Mitgliederliste zu', () => {
    const result = evaluateDisposition({
      ...base,
      postingPolicy: 'MEMBERS',
      moderationPolicy: 'NONE',
      isCommunityMember: true,
    });
    expect(result.decision).toBe('DISTRIBUTE');
  });
});

describe('applySubjectPrefix', () => {
  it('setzt das Präfix vor den Betreff', () => {
    expect(applySubjectPrefix('Termin', '[Vorstand]')).toBe('[Vorstand] Termin');
  });

  it('setzt das Präfix kein zweites Mal', () => {
    expect(applySubjectPrefix('[Vorstand] Termin', '[Vorstand]')).toBe('[Vorstand] Termin');
  });

  it('behält das Antwortkürzel vorn', () => {
    expect(applySubjectPrefix('Re: Termin', '[Vorstand]')).toBe('Re: [Vorstand] Termin');
  });

  it('erkennt ein Präfix hinter dem Antwortkürzel', () => {
    expect(applySubjectPrefix('Re: [Vorstand] Termin', '[Vorstand]')).toBe('Re: [Vorstand] Termin');
  });

  it('kommt ohne Präfix zurecht', () => {
    expect(applySubjectPrefix('  Termin  ', null)).toBe('Termin');
  });
});

describe('applyFooter', () => {
  it('trennt den Fuß nach RFC 3676 ab', () => {
    const result = applyFooter('Text', 'Hinweis', 'liste@example.org');
    expect(result).toContain('\n\n-- \n');
    expect(result).toContain('Hinweis');
    expect(result).toContain('liste@example.org');
  });

  it('ergänzt auch ohne eigenen Text einen Hinweis', () => {
    const result = applyFooter('Text', null, 'liste@example.org');
    expect(result).toContain('liste@example.org');
  });
});

describe('canViewArchive', () => {
  it('öffnet das Archiv für die Moderation immer', () => {
    expect(
      canViewArchive({
        archivePolicy: 'PRIVATE',
        isCommunityMember: false,
        isSubscriber: false,
        canModerate: true,
      }),
    ).toBe(true);
  });

  it('verschließt ein privates Archiv für alle anderen', () => {
    expect(
      canViewArchive({
        archivePolicy: 'PRIVATE',
        isCommunityMember: true,
        isSubscriber: true,
        canModerate: false,
      }),
    ).toBe(false);
  });

  it('öffnet ein Abonnentenarchiv nur für eingetragene Adressen', () => {
    expect(
      canViewArchive({
        archivePolicy: 'SUBSCRIBERS',
        isCommunityMember: true,
        isSubscriber: false,
        canModerate: false,
      }),
    ).toBe(false);

    expect(
      canViewArchive({
        archivePolicy: 'SUBSCRIBERS',
        isCommunityMember: true,
        isSubscriber: true,
        canModerate: false,
      }),
    ).toBe(true);
  });
});
