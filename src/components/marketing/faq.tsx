import { useTranslations } from "next-intl";

const items = ["q1", "q2", "q3", "q4", "q5"] as const;

export function Faq() {
  const t = useTranslations("landing.faq");

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h2>

      <div className="space-y-3">
        {items.map((key) => (
          <details
            key={key}
            className="group rounded-xl border border-border bg-surface transition-colors open:border-border-strong"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-medium [&::-webkit-details-marker]:hidden">
              {t(`${key}.question`)}
              <span
                className="text-subtle transition-transform group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="px-6 pb-5 text-sm leading-relaxed text-muted">
              {t(`${key}.answer`)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
