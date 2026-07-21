import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CadastroForm } from "@/components/auth/cadastro-form";

export const metadata: Metadata = {
  title: "Criar conta — Desenrole.ai",
};

export default async function CadastroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CadastroForm />;
}
