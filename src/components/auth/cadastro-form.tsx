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
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { signUpAction } from "@/lib/auth/actions";
import { claimPendingQuizResult } from "@/lib/quiz/claim-client";

export function CadastroForm() {
  const t = useTranslations("auth.cadastro");
  const tCommon = useTranslations("common");
  const [view, setView] = useState<"form" | "success">("form");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(2, t("errors.nameMin")),
    email: z.string().email(t("errors.emailInvalid")),
    password: z.string().min(8, t("errors.passwordMin")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await signUpAction(values);

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    // Se a confirmação de e-mail estiver desligada, já há sessão aqui.
    await claimPendingQuizResult();

    setSubmittedEmail(values.email);
    setView("success");
  }

  return (
    <AuthCard
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        view === "form" && (
          <>
            {t("haveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              {t("login")}
            </Link>
          </>
        )
      }
    >
      {view === "success" ? (
        <SuccessPanel
          title={t("success.title")}
          description={t("success.description", { email: submittedEmail })}
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
            label={t("nameLabel")}
            htmlFor="name"
            error={errors.name?.message}
          >
            <Input
              id="name"
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              {...register("name")}
            />
          </FormField>

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

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>

          <p className="text-center text-xs leading-relaxed text-subtle">
            {t.rich("termsAgreement", {
              terms: (chunks) => (
                <Link href="/terms" className="text-accent hover:underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="text-accent hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </form>
      )}
    </AuthCard>
  );
}
