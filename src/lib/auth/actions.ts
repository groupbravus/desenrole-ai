"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

/**
 * ============================================================
 * SERVER ACTIONS DE AUTENTICAÇÃO
 * ============================================================
 * Toda validação é refeita aqui — o schema do cliente é apenas UX.
 * Os erros voltam como códigos, traduzidos na interface (zero
 * texto de erro em português/inglês hardcoded no servidor).
 * ============================================================
 */

export type ActionResult =
  | { ok: true }
  | { ok: false; code: string };

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8);

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function currentLocale(): Promise<string> {
  try {
    return await getLocale();
  } catch {
    return routing.defaultLocale;
  }
}

// ------------------------------------------------------------
// Cadastro
// ------------------------------------------------------------
export async function signUpAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().min(2),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const locale = await currentLocale();
  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name, locale },
      emailRedirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(
        `/${locale}/painel`,
      )}`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.status === 422) {
      return { ok: false, code: "emailTaken" };
    }
    if (error.code === "weak_password") {
      return { ok: false, code: "weakPassword" };
    }
    return { ok: false, code: "unknown" };
  }

  return { ok: true };
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------
export async function signInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1) })
    .safeParse(input);

  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, code: "emailNotConfirmed" };
    }
    return { ok: false, code: "invalidCredentials" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------
// Logout
// ------------------------------------------------------------
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  const locale = await currentLocale();
  redirect(`/${locale}`);
}

// ------------------------------------------------------------
// Recuperação de senha
// ------------------------------------------------------------
export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const locale = await currentLocale();
  const origin = await getOrigin();
  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(
      `/${locale}/redefinir-senha`,
    )}`,
  });

  // Sempre ok: não revelamos se o e-mail existe (enumeração de contas).
  return { ok: true };
}

// ------------------------------------------------------------
// Redefinir senha — APÓS o link de recuperação
// ------------------------------------------------------------
// Aqui NÃO se pede a senha atual: o usuário a esqueceu. A prova de posse
// é o link enviado ao e-mail, que já estabeleceu a sessão.
export async function resetPasswordAction(input: {
  password: string;
}): Promise<ActionResult> {
  const parsed = z.object({ password: passwordSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "sessionExpired" };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, code: mapPasswordError(error.code) };

  // Quem pediu a recuperação pode ter tido a conta comprometida:
  // derruba todas as outras sessões.
  await supabase.auth.signOut({ scope: "others" });

  return { ok: true };
}

// ------------------------------------------------------------
// Trocar senha — usuário AUTENTICADO, dentro das configurações
// ------------------------------------------------------------
// Exige a senha atual. Sem isso, uma sessão roubada (notebook destravado,
// cookie vazado) trocaria a senha em silêncio e transformaria um acesso
// temporário em perda definitiva da conta.
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: passwordSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, code: "sessionExpired" };

  // Reautenticação: valida a senha atual num client ISOLADO, que não
  // persiste sessão nem toca nos cookies do usuário.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: reauthError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (reauthError) {
    return { ok: false, code: "wrongCurrentPassword" };
  }
  // Não deixa sessão órfã pendurada no servidor de Auth.
  await verifier.auth.signOut();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) return { ok: false, code: mapPasswordError(error.code) };

  // Troca de senha invalida as demais sessões; a atual continua válida.
  await supabase.auth.signOut({ scope: "others" });

  return { ok: true };
}

function mapPasswordError(code: string | undefined): string {
  if (code === "weak_password") return "weakPassword";
  if (code === "same_password") return "samePassword";
  if (code === "reauthentication_needed") return "reauthNeeded";
  return "unknown";
}
