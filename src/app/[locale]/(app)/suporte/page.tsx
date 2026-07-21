import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { supportRepository } from "@/lib/data";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { ContactForm } from "@/components/support/contact-form";

export const metadata: Metadata = {
  title: "Suporte — Desenrole.ai",
};

export default async function SuportePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const faq = await supportRepository.getFaq();
  const t = await getTranslations("support");
  const tFaq = await getTranslations("support.faq");

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-muted">{t("pageSubtitle")}</p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("faqTitle")}</h2>
        <Accordion>
          {faq.map((entry) => (
            <AccordionItem key={entry.id} title={tFaq(entry.questionKey)}>
              {tFaq(entry.answerKey)}
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("contactTitle")}</h2>
        <ContactForm />
      </section>
    </div>
  );
}
