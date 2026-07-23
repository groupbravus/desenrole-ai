import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RecoverForm } from "@/components/auth/recover-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("recuperarSenha") };
}

export default async function RecuperarSenhaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <RecoverForm />;
}
