import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

export function SuccessPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-4 py-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
