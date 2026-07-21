"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AuthCard } from "./auth-card";
import { AuthError } from "./auth-error";
import { BeginLinkButton } from "./begin-link-button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { createAccountFromCheckoutAction } from "@/lib/stripe/account-actions";

/**
 * Formulário de criação de conta pós-checkout. O e-mail vem da Stripe
 * (somente leitura); o usuário escolhe nome e senha. Se o e-mail já
 * existir, troca para o fluxo de login + vínculo.
 */
export function CreateAccountForm({
  sessionId,
  email,
}: {
  sessionId: string;
  email: string;
}) {
  const t = useTranslations("createAccount");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  const schema = z
    .object({
      name: z.string().min(2, t("errors.invalidInput")),
      password: z.string().min(8, t("errors.weakPassword")),
      confirm: z.string().min(1, t("errors.invalidInput")),
    })
    .refine((d) => d.password === d.confirm, {
      path: ["confirm"],
      message: t("errors.passwordsMismatch"),
    });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await createAccountFromCheckoutAction({
      sessionId,
      name: values.name,
      password: values.password,
    });

    if (result.ok) {
      router.replace("/painel");
      router.refresh();
      return;
    }
    if (result.code === "email_exists") {
      setEmailExists(true);
      return;
    }
    setErrorCode(result.code);
  }

  if (emailExists) {
    return (
      <AuthCard
        eyebrow={t("emailExists.eyebrow")}
        title={t("emailExists.title")}
        subtitle={t("emailExists.subtitle")}
      >
        <BeginLinkButton sessionId={sessionId} label={t("emailExists.cta")} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthError code={errorCode} />

        <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-muted">
          {t("emailLine", { email })}
        </div>

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
            placeholder={t("confirmPlaceholder")}
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
