import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { PremiumPoll } from "./premium-poll";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("checkoutProcessando") };
}

export default async function CheckoutProcessandoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(); // guardado também pelo (app) layout

  const { session_id } = await searchParams;
  const t = await getTranslations("checkout.processing");

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
      </div>
      <Card className="p-8">
        <PremiumPoll sessionId={session_id ?? null} />
      </Card>
    </div>
  );
}
