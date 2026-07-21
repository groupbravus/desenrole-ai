import { useTranslations } from "next-intl";
import { ClipboardList, Wand2, MessageCircleHeart } from "lucide-react";

const steps = [
  { key: "step1", icon: ClipboardList },
  { key: "step2", icon: Wand2 },
  { key: "step3", icon: MessageCircleHeart },
] as const;

export function HowItWorks() {
  const t = useTranslations("landing.how");

  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24">
      <div className="mb-14 max-w-xl">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-3 text-muted">{t("subtitle")}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {steps.map(({ key, icon: Icon }, i) => (
          <div
            key={key}
            className="group relative rounded-xl border border-border bg-surface p-7 transition-colors hover:border-border-strong"
          >
            <span className="absolute right-6 top-6 text-5xl font-bold text-surface-overlay transition-colors group-hover:text-accent/10">
              {i + 1}
            </span>
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-muted">
              <Icon className="h-5 w-5 text-accent" aria-hidden />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{t(`${key}.title`)}</h3>
            <p className="text-sm leading-relaxed text-muted">
              {t(`${key}.description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
