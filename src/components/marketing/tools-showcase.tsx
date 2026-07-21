import { useTranslations } from "next-intl";
import { MessagesSquare, Instagram } from "lucide-react";

const showcase = [
  { key: "conversa", icon: MessagesSquare },
  { key: "story", icon: Instagram },
] as const;

export function ToolsShowcase() {
  const t = useTranslations("landing.tools");

  return (
    <section id="tools" className="border-y border-border bg-surface/30 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14 max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted">{t("subtitle")}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {showcase.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-surface p-8 transition-all hover:-translate-y-0.5 hover:border-accent/30"
            >
              <Icon className="mb-5 h-7 w-7 text-accent" aria-hidden />
              <h3 className="mb-2 text-lg font-semibold">
                {t(`${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                {t(`${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
