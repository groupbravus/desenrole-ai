"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * CTA "Começar" — porta de entrada para o quiz EXTERNO.
 *
 * Regras:
 * - O destino vem só de NEXT_PUBLIC_EXTERNAL_QUIZ_URL (nunca fixado aqui,
 *   nunca localhost, nunca o quiz interno).
 * - Sem a variável, o botão fica desabilitado com mensagem segura — a
 *   página não quebra.
 * - Abre na mesma aba. Não anexamos locale: só se o quiz externo aceitar
 *   esse parâmetro (desconhecido aqui), então não arriscamos quebrar a URL.
 *
 * `NEXT_PUBLIC_*` é embutida no build; ler direto de process.env no cliente
 * é o padrão suportado.
 */
export function StartCta({
  size = "lg",
  className = "",
  withArrow = true,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  withArrow?: boolean;
}) {
  const t = useTranslations("landing.cta");
  const url = process.env.NEXT_PUBLIC_EXTERNAL_QUIZ_URL;

  if (!url) {
    return (
      <Button size={size} className={className} disabled>
        {t("unavailable")}
      </Button>
    );
  }

  return (
    <a href={url} className={className}>
      <Button size={size} className="w-full sm:w-auto">
        {t("start")}
        {withArrow && <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>
    </a>
  );
}
