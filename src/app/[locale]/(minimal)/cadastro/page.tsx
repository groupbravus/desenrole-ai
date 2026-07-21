import { redirect } from "next/navigation";

/**
 * Cadastro público foi REMOVIDO. No modelo atual a conta só é criada
 * depois de um Stripe Checkout pago e validado (provisionamento pós-
 * pagamento). Qualquer acesso direto a /cadastro volta para a home, que
 * é a porta de entrada (quiz externo).
 */
export default async function CadastroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
