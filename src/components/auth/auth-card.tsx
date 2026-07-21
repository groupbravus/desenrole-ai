import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function AuthCard({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <div className="animate-fade-up mb-8 text-center">
        <Badge variant="accent" className="mb-4">
          {eyebrow}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>

      <Card className="animate-fade-up delay-100 p-6">{children}</Card>

      {footer && (
        <p className="animate-fade-up delay-200 mt-6 text-center text-sm text-muted">
          {footer}
        </p>
      )}
    </div>
  );
}
