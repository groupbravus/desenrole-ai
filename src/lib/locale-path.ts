import { routing, type Locale } from "@/i18n/routing";

/**
 * Separa o prefixo de idioma de um pathname.
 * `/pt-BR/painel` → { locale: 'pt-BR', path: '/painel' }
 *
 * Usado no middleware (para casar rotas protegidas) e nos formulários
 * (o router do next-intl reaplica o prefixo, então ele precisa sair antes).
 */
/**
 * Converte um `?next=` recebido pela URL em um caminho interno seguro.
 *
 * SEGURANÇA: sem esta validação um atacante monta
 * `/login?next=https://evil.com` (ou `//evil.com`), a vítima faz um login
 * legítimo e é redirecionada para um clone de phishing. Rejeitamos tudo
 * que não seja um caminho interno de barra única.
 *
 * Devolve `null` quando o destino não é confiável — o chamador então usa
 * o padrão da aplicação.
 */
export function safeInternalPath(next: string | null | undefined): string | null {
  if (!next) return null;
  // Precisa começar com exatamente uma barra: bloqueia "//evil.com",
  // "https://evil.com", "javascript:..." e caminhos relativos.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  // Barra invertida é normalizada para "/" por vários navegadores.
  if (next.includes("\\")) return null;
  // Impede escapar do host via segmentos relativos.
  if (next.includes("..")) return null;

  return splitLocalePath(next).path || "/";
}

export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  const [, maybeLocale, ...segments] = pathname.split("/");
  const isLocale = routing.locales.includes(maybeLocale as Locale);

  if (!isLocale) {
    return { locale: routing.defaultLocale, path: pathname };
  }

  return {
    locale: maybeLocale as Locale,
    path: `/${segments.join("/")}`,
  };
}
