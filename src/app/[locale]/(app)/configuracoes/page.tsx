import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { billingRepository } from "@/lib/data";
import { getSubscriptionSummary } from "@/lib/entitlements";
import { Tabs } from "@/components/ui/tabs";
import { AccountTab } from "@/components/settings/account-tab";
import { SubscriptionTab } from "@/components/settings/subscription-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { LanguageTab } from "@/components/settings/language-tab";

export const metadata: Metadata = {
  title: "Configurações — Labia.ia",
};

export default async function ConfiguracoesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, price, summary] = await Promise.all([
    requireUser(),
    billingRepository.getPremiumPrice(),
    getSubscriptionSummary(),
  ]);

  const t = await getTranslations("settings");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-muted">{t("pageSubtitle")}</p>
      </div>

      <Tabs
        items={[
          {
            value: "account",
            label: t("tabs.account"),
            content: <AccountTab user={user} />,
          },
          {
            value: "subscription",
            label: t("tabs.subscription"),
            content: <SubscriptionTab price={price} summary={summary} />,
          },
          {
            value: "notifications",
            label: t("tabs.notifications"),
            content: <NotificationsTab />,
          },
          {
            value: "language",
            label: t("tabs.language"),
            content: <LanguageTab />,
          },
        ]}
      />
    </div>
  );
}
