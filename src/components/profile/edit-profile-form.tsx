"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessPanel } from "@/components/ui/success-panel";
import { AuthError } from "@/components/auth/auth-error";
import { updateProfileAction } from "@/lib/profile/actions";
import type { CurrentUser } from "@/lib/data/types";

export function EditProfileForm({ user }: { user: CurrentUser }) {
  const t = useTranslations("profile.edit");
  const router = useRouter();
  const [view, setView] = useState<"form" | "success">("form");
  const [emailPending, setEmailPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(2, t("errors.nameMin")),
    email: z.string().email(t("errors.emailInvalid")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name ?? "", email: user.email },
  });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await updateProfileAction(values);

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    setEmailPending(Boolean(result.emailPending));
    setView("success");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </div>

      <Card className="p-6">
        {view === "success" ? (
          <SuccessPanel
            title={t("success.title")}
            description={
              emailPending ? t("success.emailPending") : t("success.description")
            }
            action={
              <Link href="/perfil" className="w-full">
                <Button className="w-full">{t("success.cta")}</Button>
              </Link>
            }
          />
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <AuthError code={errorCode} />

            <div className="flex items-center gap-4">
              <Avatar
                name={user.name ?? user.email}
                src={user.avatarUrl}
                className="h-14 w-14 text-base"
              />
              <p className="text-xs text-subtle">{t("avatarNote")}</p>
            </div>

            <FormField
              label={t("nameLabel")}
              htmlFor="name"
              error={errors.name?.message}
            >
              <Input id="name" autoComplete="name" {...register("name")} />
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
                {...register("email")}
              />
            </FormField>

            <div className="flex gap-3">
              <Link href="/perfil" className="flex-1">
                <Button type="button" variant="secondary" className="w-full">
                  {t("cancel")}
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
