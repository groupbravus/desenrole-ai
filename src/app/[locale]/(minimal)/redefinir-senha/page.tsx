import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha — Desenrole.ai",
};

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
