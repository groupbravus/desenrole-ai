import type { CookieOptions } from "@supabase/ssr";

/**
 * ============================================================
 * OPÇÕES DE COOKIE DA SESSÃO
 * ============================================================
 * `@supabase/ssr` usa `httpOnly: false` por padrão porque o
 * `createBrowserClient` precisa ler o cookie via `document.cookie`.
 *
 * Nesta aplicação NENHUM componente cliente fala com o Supabase — todo
 * acesso é server-side (Server Components e Server Actions). Por isso
 * forçamos `httpOnly: true`: um XSS deixa de conseguir roubar a sessão.
 *
 * Caminho oficial do SDK: `createServerClient(..., { cookieOptions })`,
 * que faz `{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions }`. O servidor
 * continua lendo os cookies pelo header da requisição — httpOnly não
 * afeta isso.
 *
 * ⚠️ CONSEQUÊNCIA: se algum dia for preciso usar `createBrowserClient`
 * (realtime, estado de auth reativo no cliente), esta decisão precisa ser
 * revista — o cliente não conseguirá ler o cookie.
 * ============================================================
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  // Em produção o cookie só trafega em HTTPS. Em dev (http://localhost)
  // `secure: true` impediria o navegador de guardá-lo.
  secure: process.env.NODE_ENV === "production",
  // "lax" preserva o retorno dos links de e-mail (navegação top-level)
  // e ainda barra envio em requisições cross-site de terceiros.
  sameSite: "lax",
  // Escopo mínimo: apenas o host atual, sem `domain` (não vaza para
  // subdomínios), e válido em toda a aplicação.
  path: "/",
};
