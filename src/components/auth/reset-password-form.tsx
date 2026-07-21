"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AuthCard } from "./auth-card";
import { AuthError } from "./auth-error";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const schema = z
    .object({
      password: z.string().min(8, t("errors.passwordMin")),
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await resetPasswordAction({ password: values.password });

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    router.replace("/painel");
    router.refresh();
  }

  return (
    <AuthCard eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthError code={errorCode} />

        <FormField
          label={t("passwordLabel")}
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            showLabel={tCommon("showPassword")}
            hideLabel={tCommon("hidePassword")}
            {...register("password")}
          />
        </FormField>

        <FormField
          label={t("confirmLabel")}
          htmlFor="confirm"
          error={errors.confirm?.message}
        >
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            showLabel={tCommon("showPassword")}
            hideLabel={tCommon("hidePassword")}
            {...register("confirm")}
          />
        </FormField>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
