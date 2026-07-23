import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { PenLine, History as HistoryIcon, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { analysisRepository, quizResultsRepository } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Perfil — Labia.ia",
};

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, history, quizResult] = await Promise.all([
    requireUser(),
    analysisRepository.getHistory(),
    quizResultsRepository.getLatest(),
  ]);

  const t = await getTranslations("profile");
  const tResult = await getTranslations("result.profiles");
  const currentLocale = await getLocale();
  const displayName = user.name ?? user.email;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <Avatar
          name={displayName}
          src={user.avatarUrl}
          className="h-20 w-20 text-xl"
        />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        {quizResult && (
          <Badge variant="accent">
            <Sparkles className="h-3 w-3" aria-hidden />
            {tResult(`${quizResult.profile}.title`)}
          </Badge>
        )}
        <p className="text-xs text-subtle">
          {t("memberSince", {
            date: formatDate(user.memberSince, currentLocale),
          })}
        </p>
        <Link href="/perfil/editar">
          <Button variant="secondary" size="sm">
            <PenLine className="h-4 w-4" aria-hidden />
            {t("editProfile")}
          </Button>
        </Link>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={HistoryIcon}
          label={t("stats.history")}
          value={String(history.length)}
        />
        <StatCard
          icon={Sparkles}
          label={t("stats.quiz")}
          value={quizResult ? "1" : "0"}
        />
      </div>
    </div>
  );
}
