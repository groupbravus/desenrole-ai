"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { SuccessPanel } from "@/components/ui/success-panel";
import { AuthError } from "@/components/auth/auth-error";
import { changePasswordAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/data/types";

export function AccountTab({ user }: { user: CurrentUser }) {
  const t = useTranslations("settings.account");
  const tCommon = useTranslations("common");
  const [view, setView] = useState<"form" | "success">("form");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dangerConfirming, setDangerConfirming] = useState(false);

  const schema = z
    .object({
      currentPassword: z.string().min(1, t("errors.currentPasswordRequired")),
      password: z.string().min(8, t("errors.newPasswordMin")),
      confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
      path: ["confirm"],
      message: t("errors.mismatch"),
    });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await changePasswordAction({
      currentPassword: values.currentPassword,
      newPassword: values.password,
    });

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    reset();
    setView("success");
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {user.name ?? user.email}
          </p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <Link href="/perfil/editar">
          <Button variant="secondary" size="sm">
            {t("editProfile")}
          </Button>
        </Link>
      </Card>

      <Card className="p-6">
        <h3 className="mb-1.5 font-semibold text-foreground">
          {t("changePassword")}
        </h3>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          {t("securityNote")}
        </p>
        {view === "success" ? (
          <SuccessPanel
            title={t("passwordSuccess.title")}
            description={t("passwordSuccess.description")}
            action={
              <Button onClick={() => setView("form")}>
                {t("passwordSuccess.cta")}
              </Button>
            }
          />
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <AuthError code={errorCode} />

            <FormField
              label={t("currentPasswordLabel")}
              htmlFor="currentPassword"
              error={errors.currentPassword?.message}
            >
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                showLabel={tCommon("showPassword")}
                hideLabel={tCommon("hidePassword")}
                {...register("currentPassword")}
              />
            </FormField>

            <FormField
              label={t("newPasswordLabel")}
              htmlFor="newPassword"
              error={errors.password?.message}
            >
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                showLabel={tCommon("showPassword")}
                hideLabel={tCommon("hidePassword")}
                {...register("password")}
              />
            </FormField>

            <FormField
              label={t("confirmPasswordLabel")}
              htmlFor="confirmPassword"
              error={errors.confirm?.message}
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                showLabel={tCommon("showPassword")}
                hideLabel={tCommon("hidePassword")}
                {...register("confirm")}
              />
            </FormField>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("updating") : t("updatePassword")}
            </Button>
          </form>
        )}
      </Card>

      <Card className="border-danger/20 p-6">
        <h3 className="mb-1.5 font-semibold text-danger">
          {t("dangerZone.title")}
        </h3>
        <p className="mb-4 text-sm text-muted">{t("dangerZone.description")}</p>
        {!dangerConfirming ? (
          <Button variant="danger" onClick={() => setDangerConfirming(true)}>
            {t("dangerZone.cta")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
            <p className="text-sm text-foreground">
              {t("dangerZone.confirmMessage")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDangerConfirming(false)}
              >
                {t("dangerZone.cancel")}
              </Button>
              <Button variant="danger" size="sm" disabled>
                {t("dangerZone.confirmCta")}
              </Button>
            </div>
            <p className="text-xs text-subtle">{t("dangerZone.disabledNote")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
