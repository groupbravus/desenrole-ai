import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Accordion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-3", className)}>{children}</div>;
}

export function AccordionItem({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border bg-surface transition-colors open:border-border-strong">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <span
          className="text-subtle transition-transform group-open:rotate-45"
          aria-hidden
        >
          +
        </span>
      </summary>
      <p className="px-6 pb-5 text-sm leading-relaxed text-muted">{children}</p>
    </details>
  );
}
