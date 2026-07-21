"use client";

import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";

/** Traduz um código de erro devolvido por uma Server Action. */
export function AuthError({ code }: { code: string | null }) {
  const t = useTranslations("auth.errors");
  if (!code) return null;

  const key = t.has(code) ? code : "unknown";

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {t(key)}
    </p>
  );
}
