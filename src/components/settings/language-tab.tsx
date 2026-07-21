"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const labels: Record<Locale, string> = {
  "pt-BR": "Português (BR)",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
};

export function LanguageTab() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("description")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => router.replace(pathname, { locale: l })}
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
              l === locale
                ? "border-accent bg-accent-muted text-accent"
                : "border-border text-foreground hover:border-border-strong",
            )}
          >
            {labels[l]}
            {l === locale && <Check className="h-4 w-4" aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  );
}
