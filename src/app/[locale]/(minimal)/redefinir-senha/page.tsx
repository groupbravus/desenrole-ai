import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("redefinirSenha") };
}

export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Chega-se aqui pelo link de recuperação, que já estabeleceu a sessão.
  await requireUser();

  return <ResetPasswordForm />;
}
