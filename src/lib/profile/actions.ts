"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * Atualiza a identidade do usuário.
 * O nome vai para `profiles`; a troca de e-mail passa pelo Supabase Auth
 * e dispara e-mail de confirmação (não muda até ser confirmada).
 */
export async function updateProfileAction(input: {
  name: string;
  email: string;
}): Promise<ActionResult & { emailPending?: boolean }> {
  const parsed = z
    .object({ name: z.string().min(2).max(80), email: z.string().email() })
    .safeParse(input);

  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "notAuthenticated" };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name })
    .eq("id", user.id);

  if (profileError) return { ok: false, code: "unknown" };

  let emailPending = false;
  if (parsed.data.email !== user.email) {
    const locale = await getLocale();
    const headerList = await headers();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;

    const { error: emailError } = await supabase.auth.updateUser(
      { email: parsed.data.email },
      {
        emailRedirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(
          `/${locale}/perfil`,
        )}`,
      },
    );

    if (emailError) return { ok: false, code: "emailTaken" };
    emailPending = true;
  }

  revalidatePath("/", "layout");
  return { ok: true, emailPending };
}
