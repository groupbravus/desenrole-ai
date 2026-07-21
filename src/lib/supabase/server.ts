import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Client Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave anônima — toda a proteção de dados vem do RLS.
 * Em Next 16 `cookies()` é assíncrono.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Chamado de um Server Component: escrever cookie não é permitido.
            // O middleware já renova a sessão, então é seguro ignorar.
          }
        },
      },
    },
  );
}
