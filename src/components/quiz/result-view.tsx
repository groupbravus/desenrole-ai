import { useTranslations } from "next-intl";
import {
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Zap,
  Hourglass,
  Flag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TOOL_ICONS, TOOL_MESSAGE_KEY } from "@/components/tools/tool-icons";
import type { QuizProfile, Tool } from "@/lib/data/types";

const PROFILE_ICONS: Record<string, LucideIcon> = { Eye, Zap, Hourglass, Flag };

export function ResultView({
  profile,
  tool,
}: {
  profile: QuizProfile;
  tool: Tool | null;
}) {
  const t = useTranslations("result");
  const tTools = useTranslations("tools.catalog");

  const ProfileIcon = PROFILE_ICONS[profile.icon] ?? Eye;
  const strengths = t.raw(`profiles.${profile.slug}.strengths`) as string[];
  const watchOuts = t.raw(`profiles.${profile.slug}.watchOuts`) as string[];
  const toolKey = tool ? TOOL_MESSAGE_KEY[tool.slug] : undefined;
  const ToolIcon = tool ? (TOOL_ICONS[tool.slug] ?? Sparkles) : Sparkles;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-12">
      <div className="animate-fade-up mb-10 text-center">
        <Badge variant="accent" className="mb-5">
          <ProfileIcon className="h-3 w-3" aria-hidden />
          {t("eyebrow")}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t(`profiles.${profile.slug}.title`)}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          {t(`profiles.${profile.slug}.tagline`)}
        </p>
      </div>

      <p className="animate-fade-up delay-100 mb-10 text-center leading-relaxed text-muted">
        {t(`profiles.${profile.slug}.description`)}
      </p>

      <div className="animate-fade-up delay-200 mb-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            {t("strengthsTitle")}
          </h2>
          <ul className="space-y-2.5">
            {strengths.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-muted">
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
            {t("watchOutTitle")}
          </h2>
          <ul className="space-y-2.5">
            {watchOuts.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-muted">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {tool && toolKey && (
        <Card className="animate-fade-up delay-300 mb-10 flex items-center gap-4 border-accent/25 bg-accent-muted/40 p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <ToolIcon className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-accent">{t("toolTitle")}</p>
            <p className="text-sm font-medium text-foreground">
              {tTools(`${toolKey}.title`)}
            </p>
          </div>
        </Card>
      )}

      <div className="animate-fade-up delay-300 flex flex-col gap-3 sm:flex-row">
        <Link href="/cadastro" className="flex-1">
          <Button size="lg" className="w-full">
            {t("ctaPrimary")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
        <Link href="/quiz" className="flex-1">
          <Button variant="secondary" size="lg" className="w-full">
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t("ctaSecondary")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
