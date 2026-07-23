import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { adminRepository } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { SupportStatus } from "@/lib/data/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("adminSuporte") };
}

const STATUS_VARIANT: Record<SupportStatus, "accent" | "default" | "success"> = {
  open: "accent",
  in_progress: "default",
  resolved: "success",
};

export default async function AdminSuportePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const requests = await adminRepository.getSupportRequests();
  const t = await getTranslations("admin.support");
  const tSubjects = await getTranslations("support.contact.subjects");
  const tStatus = await getTranslations("admin.support.status");
  const currentLocale = await getLocale();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-muted">{t("pageSubtitle")}</p>
      </div>

      {requests.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">
          {t("empty")}
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[request.status]}>
                  {tStatus(request.status)}
                </Badge>
                <Badge>{tSubjects(request.subject)}</Badge>
                <span className="text-xs text-subtle">
                  {formatDate(request.createdAt, currentLocale)}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {request.message}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
