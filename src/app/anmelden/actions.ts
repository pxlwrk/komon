'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { login, logout } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { fail, type ActionState } from '@/lib/action-state';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Bitte geben Sie Ihre E-Mail-Adresse an.').email('Diese Adresse sieht nicht gültig aus.'),
  password: z.string().min(1, 'Bitte geben Sie Ihr Passwort ein.'),
  redirectTo: z.string().optional(),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo'),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? 'Bitte prüfen Sie Ihre Eingaben.');
  }

  const result = await login(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    if (result.reason === 'LOCKED') {
      return fail('Das Konto ist vorübergehend gesperrt. Bitte versuchen Sie es in einigen Minuten erneut.');
    }
    // Ob die Adresse existiert, bleibt bewusst offen.
    return fail('E-Mail-Adresse und Passwort passen nicht zusammen.');
  }

  await recordAudit({
    actorId: result.personId,
    action: 'auth.login',
    entityType: 'Person',
    entityId: result.personId,
    summary: 'Anmeldung erfolgreich',
  });

  const target = parsed.data.redirectTo;
  redirect(target && target.startsWith('/') ? target : '/communities');
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/anmelden');
}
