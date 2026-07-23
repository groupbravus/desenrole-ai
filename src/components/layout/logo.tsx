import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marca da Labia.ia — símbolo (chama + balão de conversa) + nome.
 * `variant="mark"` mostra só o símbolo, para espaços estreitos (topbar
 * mobile). O `<Link>` que envolve este componente já carrega
 * `aria-label="Labia.ia"` em todo uso — por isso a imagem é decorativa
 * (`alt=""`), sem duplicar o nome para leitores de tela.
 */
export function Logo({
  className,
  variant = "full",
}: {
  className?: string;
  variant?: "full" | "mark";
}) {
  return (
    <span
      className={cn("inline-flex select-none items-center gap-2", className)}
    >
      <Image
        src="/labia-logo.png"
        alt=""
        width={64}
        height={64}
        className="h-6 w-6 shrink-0 rounded-md"
        priority
      />
      {variant === "full" && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Labia<span className="text-accent">.ia</span>
        </span>
      )}
    </span>
  );
}
