"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { beginLinkAction } from "@/lib/stripe/account-actions";

/**
 * "Entrar para vincular": guarda o session_id (cookie httpOnly, via server
 * action) e leva ao login. Depois do login o usuário volta a /criar-conta,
 * que lê o cookie e conclui o vínculo.
 */
export function BeginLinkButton({
  sessionId,
  label,
}: {
  sessionId: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      className="w-full"
      size="lg"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        // A action redireciona para o login; o loading não precisa voltar.
        void beginLinkAction({ sessionId });
      }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {label}
    </Button>
  );
}
