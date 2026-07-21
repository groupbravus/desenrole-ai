"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/auth/actions";

/** Cria um chamado de suporte vinculado ao usuário autenticado. */
export async function createSupportRequestAction(input: {
  subject: string;
  message: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      subject: z.enum(["billing", "technical", "account", "other"]),
      message: z.string().min(10).max(5000),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "notAuthenticated" };

  const { error } = await supabase.from("support_requests").insert({
    user_id: user.id,
    subject: parsed.data.subject,
    message: parsed.data.message,
  });

  if (error) return { ok: false, code: "unknown" };
  return { ok: true };
}
