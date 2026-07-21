"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { AuthCard } from "./auth-card";
import { AuthError } from "./auth-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/auth/actions";
import { claimPendingQuizResult } from "@/lib/quiz/claim-client";
import { safeInternalPath } from "@/lib/locale-path";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorCode, setErrorCode] = useState<string | null>(
    searchParams.get("error") ? "unknown" : null,
  );

  const schema = z.object({
    email: z.string().email(t("errors.emailInvalid")),
    password: z.string().min(1, t("errors.passwordRequired")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await signInAction(values);

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    // Se o quiz foi respondido antes do cadastro, persiste agora.
    await claimPendingQuizResult();

    // Nunca confiar no `next` da URL: pode vir de um link enviado por
    // terceiros. Destino não-interno cai no padrão.
    const target = safeInternalPath(searchParams.get("next")) ?? "/painel";
    router.replace(target);
    router.refresh();
  }

  return (
    <AuthCard
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link
            href="/cadastro"
            className="font-medium text-accent hover:underline"
          >
            {t("signup")}
          </Link>
        </>
      }
    >
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

        <FormField
          label={t("passwordLabel")}
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            showLabel={tCommon("showPassword")}
            hideLabel={tCommon("hidePassword")}
            {...register("password")}
          />
        </FormField>

        <div className="flex justify-end">
          <Link
            href="/recuperar-senha"
            className="text-xs text-muted hover:text-foreground"
          >
            {t("forgot")}
          </Link>
        </div>

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
