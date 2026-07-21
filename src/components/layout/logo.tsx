import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none text-lg font-bold tracking-tight text-foreground",
        className,
      )}
    >
      desenrole
      <span className="text-accent">.ai</span>
    </span>
  );
}
