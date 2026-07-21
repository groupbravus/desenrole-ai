import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

const testimonials = ["t1", "t2", "t3"] as const;

export function SocialProof() {
  const t = useTranslations("landing.proof");

  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="mb-14 flex flex-col items-center text-center">
        <div className="mb-3 flex gap-1" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-accent text-accent" />
          ))}
        </div>
        <h2 className="max-w-lg text-3xl font-bold tracking-tight md:text-4xl">
          {t("title")}
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((key) => (
          <figure
            key={key}
            className="flex flex-col justify-between rounded-xl border border-border bg-surface p-7"
          >
            <blockquote className="text-sm leading-relaxed text-foreground">
              &ldquo;{t(`${key}.quote`)}&rdquo;
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
                {t(`${key}.initials`)}
              </span>
              <div className="text-sm">
                <p className="font-medium">{t(`${key}.name`)}</p>
                <p className="text-xs text-subtle">{t(`${key}.detail`)}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
