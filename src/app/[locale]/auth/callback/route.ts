import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca o link do e-mail por uma sessão.
 *
 * Cobre os dois formatos que o Supabase pode emitir:
 *  - PKCE:        ?code=...
 *  - Token hash:  ?token_hash=...&type=signup|recovery|email_change
 *
 * Nenhum token é repassado adiante: após a troca, redirecionamos apenas
 * para um caminho interno (`next`), sem query sensível.
 */

/** Mesmas regras do `safeInternalPath`: só caminho interno de barra única. */
function safeNext(next: string | null, locale: string): string {
  const fallback = `/${locale}/painel`;
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\") || next.includes("..")) return fallback;
  return next;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), locale);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=auth_callback`);
}
