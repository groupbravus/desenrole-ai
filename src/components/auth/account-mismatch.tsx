import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/lib/auth/actions";
import { AuthCard } from "./auth-card";
import { Button } from "@/components/ui/button";

/**
 * Usuário autenticado com um e-mail DIFERENTE do que pagou. Bloqueia (não
 * tenta adivinhar intenção) e oferece sair para tentar de novo com a
 * conta certa.
 */
export async function AccountMismatch() {
  const t = await getTranslations("createAccount.mismatch");
  return (
    <AuthCard eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")}>
      <form action={signOutAction}>
        <SignOutButton />
      </form>
    </AuthCard>
  );
}

function SignOutButton() {
  const t = useTranslations("createAccount.mismatch");
  return (
    <Button type="submit" className="w-full" size="lg" variant="secondary">
      {t("signOut")}
    </Button>
  );
}
