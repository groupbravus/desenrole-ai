import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { splitLocalePath } from "./lib/locale-path";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

/** Rotas que exigem sessão. Comparadas SEM o prefixo de idioma. */
const PROTECTED_PREFIXES = [
  "/painel",
  "/ferramentas",
  "/jogos",
  "/historico",
  "/perfil",
  "/configuracoes",
  "/suporte",
  "/admin",
  // Chega-se aqui pelo link de recuperação, que já cria sessão.
  // Fica FORA de AUTH_PREFIXES de propósito: redirecionar daqui
  // para o painel quebraria o fluxo de redefinição.
  "/redefinir-senha",
];

/** Rotas de autenticação — quem já tem sessão não deve ficar nelas. */
const AUTH_PREFIXES = ["/login", "/cadastro", "/recuperar-senha"];

function matches(path: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Preserva os cookies de sessão renovados ao trocar de resposta. */
function withCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export default async function middleware(request: NextRequest) {
  // 1. next-intl resolve o idioma (pode redirecionar/reescrever).
  const response = intlMiddleware(request);

  // 2. Supabase renova a sessão sobre a resposta do next-intl.
  const user = await updateSession(request, response);

  const { pathname } = request.nextUrl;
  const { locale, path: rest } = splitLocalePath(pathname);

  // 3. Visitante em rota protegida → login, guardando o destino original.
  if (!user && matches(rest, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", pathname);
    return withCookies(response, NextResponse.redirect(url));
  }

  // 4. Autenticado em tela de auth → painel.
  if (user && matches(rest, AUTH_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/painel`;
    url.search = "";
    return withCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
