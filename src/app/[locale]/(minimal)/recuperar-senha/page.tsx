import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RecoverForm } from "@/components/auth/recover-form";

export const metadata: Metadata = {
  title: "Recuperar senha — Desenrole.ai",
};

export default async function RecuperarSenhaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <RecoverForm />;
}
