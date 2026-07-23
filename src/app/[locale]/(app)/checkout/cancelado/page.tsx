import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Checkout cancelado — Labia.ia",
};

export default async function CheckoutCanceladoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();

  const t = await getTranslations("checkout.cancelled");

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-muted">
          <XCircle className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {t("description")}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/configuracoes">
            <Button>{t("tryAgain")}</Button>
          </Link>
          <Link href="/painel">
            <Button variant="secondary">{t("backToDashboard")}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
