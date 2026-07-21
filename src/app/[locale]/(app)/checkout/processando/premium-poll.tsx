"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  reconcileCheckoutReturnAction,
  checkPremiumStatusAction,
} from "@/lib/stripe/actions";

const POLL_INTERVAL_MS = 2500;
const TIMEOUT_MS = 60_000;

/**
 * Tela de sucesso do checkout.
 *
 * NÃO libera Premium: apenas (1) dispara uma tentativa de reconciliação
 * (syncSubscription relê a Stripe) e (2) faz polling do ESTADO LOCAL de
 * entitlements. Quando o entitlement fica ativo, redireciona ao painel.
 * Se estourar 60s (webhook demorando), mostra mensagem honesta.
 */
export function PremiumPoll({ sessionId }: { sessionId: string | null }) {
  const t = useTranslations("checkout.processing");
  const router = useRouter();
  const [phase, setPhase] = useState<"working" | "active" | "timeout">(
    "working",
  );
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled) return;

      const { premium } = await checkPremiumStatusAction();
      if (cancelled) return;

      if (premium) {
        setPhase("active");
        router.replace("/painel");
        router.refresh();
        return;
      }

      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        setPhase("timeout");
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    async function start() {
      // Tentativa de reconciliação (best-effort); o polling decide o acesso.
      if (sessionId) {
        try {
          await reconcileCheckoutReturnAction({ sessionId });
        } catch {
          // ignora: o cron/webhook ainda vão convergir
        }
      }
      void tick();
    }

    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, router]);

  if (phase === "timeout") {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-4 py-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-muted">
          <Clock className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-foreground">{t("timeoutTitle")}</p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
            {t("timeoutDescription")}
          </p>
        </div>
        <Link href="/painel">
          <Button variant="secondary">{t("goToDashboard")}</Button>
        </Link>
      </div>
    );
  }

  if (phase === "active") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </span>
        <p className="font-semibold text-foreground">{t("activeTitle")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden />
      <div>
        <p className="font-semibold text-foreground">{t("workingTitle")}</p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          {t("workingDescription")}
        </p>
      </div>
    </div>
  );
}
