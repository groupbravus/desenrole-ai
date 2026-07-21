"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SuccessPanel } from "@/components/ui/success-panel";
import { AuthError } from "@/components/auth/auth-error";
import { createSupportRequestAction } from "@/lib/support/actions";

const SUBJECTS = ["billing", "technical", "account", "other"] as const;

export function ContactForm() {
  const t = useTranslations("support.contact");
  const tSubjects = useTranslations("support.contact.subjects");
  const [view, setView] = useState<"form" | "success">("form");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const schema = z.object({
    subject: z.enum(SUBJECTS),
    message: z.string().min(10, t("errors.messageMin")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "technical" },
  });

  async function onSubmit(values: FormValues) {
    setErrorCode(null);
    const result = await createSupportRequestAction(values);

    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    reset();
    setView("success");
  }

  return (
    <Card className="p-6">
      {view === "success" ? (
        <SuccessPanel
          title={t("success.title")}
          description={t("success.description")}
          action={
            <Button onClick={() => setView("form")}>{t("success.cta")}</Button>
          }
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <AuthError code={errorCode} />

          <FormField
            label={t("subjectLabel")}
            htmlFor="subject"
            error={errors.subject?.message}
          >
            <Select
              id="subject"
              options={SUBJECTS.map((value) => ({
                value,
                label: tSubjects(value),
              }))}
              {...register("subject")}
            />
          </FormField>

          <FormField
            label={t("messageLabel")}
            htmlFor="message"
            error={errors.message?.message}
          >
            <Textarea
              id="message"
              rows={5}
              placeholder={t("messagePlaceholder")}
              {...register("message")}
            />
          </FormField>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? t("sending") : t("send")}
          </Button>
        </form>
      )}
    </Card>
  );
}
