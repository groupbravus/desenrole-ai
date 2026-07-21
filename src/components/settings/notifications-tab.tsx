"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/**
 * Preferências de notificação — ainda SEM persistência (decisão aprovada:
 * fica para uma fase posterior). Os toggles são locais e a interface diz
 * isso abertamente: não fingimos que a preferência foi salva.
 */
type NotificationKey = "productUpdates" | "weeklyDigest" | "toolReminders";

export function NotificationsTab() {
  const t = useTranslations("settings.notifications");
  const [settings, setSettings] = useState<Record<NotificationKey, boolean>>({
    productUpdates: true,
    weeklyDigest: true,
    toolReminders: false,
  });

  const rows: { key: NotificationKey; label: string; description: string }[] = [
    {
      key: "productUpdates",
      label: t("productUpdates.label"),
      description: t("productUpdates.description"),
    },
    {
      key: "weeklyDigest",
      label: t("weeklyDigest.label"),
      description: t("weeklyDigest.description"),
    },
    {
      key: "toolReminders",
      label: t("toolReminders.label"),
      description: t("toolReminders.description"),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
        {t("notPersistedNotice")}
      </p>

      <Card className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 p-5"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="mt-0.5 text-xs text-muted">{row.description}</p>
            </div>
            <Switch
              checked={settings[row.key]}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, [row.key]: checked }))
              }
              label={row.label}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
