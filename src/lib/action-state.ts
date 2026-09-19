/** Gemeinsamer Rueckgabetyp aller Server Actions. */
export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  /** Feldbezogene Fehlermeldungen, Schluessel ist der Feldname. */
  fieldErrors?: Record<string, string>;
};

export const idleState: ActionState = { status: 'idle' };

export function ok(message?: string): ActionState {
  return { status: 'success', message };
}

export function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: 'error', message, fieldErrors };
}

/** Wandelt einen Fehler in eine Rueckmeldung, die der Oberflaeche genuegt. */
export function fromError(error: unknown, fallback = 'Die Aktion ist fehlgeschlagen.'): ActionState {
  if (error instanceof Error) {
    return fail(error.message || fallback);
  }
  return fail(fallback);
}

/** Uebersetzt Zod-Fehler in feldbezogene Meldungen. */
export function fieldErrorsFromZod(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    if (key && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
