"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "./auth-card";
import { AuthError } from "./auth-error";
import { SuccessPanel } from "@/components/ui/success-panel";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function RecoverForm() {
  const t = useTranslations("auth.recover");
  const [view, setView] = useState<"form" | "success">("form");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().email(t("errors.emailInvalid")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await requestPasswordResetAction(values);

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }
    setView("success");
  }

  return (
    <AuthCard
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        view === "form" && (
          <Link
            href="/login"
            className="font-medium text-accent hover:underline"
          >
            {t("backToLogin")}
          </Link>
        )
      }
    >
      {view === "success" ? (
        <SuccessPanel
          title={t("success.title")}
          description={t("success.description")}
          action={
            <Link href="/login" className="w-full">
              <Button className="w-full">{t("success.cta")}</Button>
            </Link>
          }
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <AuthError code={errorCode} />

          <FormField
            label={t("emailLabel")}
            htmlFor="email"
            error={errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              {...register("email")}
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
      )}
    </AuthCard>
  );
}
