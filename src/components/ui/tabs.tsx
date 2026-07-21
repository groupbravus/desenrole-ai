"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  items,
  defaultValue,
}: {
  items: TabItem[];
  defaultValue?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value);

  return (
    <div>
      <div
        role="tablist"
        className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
      >
        {items.map((item) => (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active === item.value}
            onClick={() => setActive(item.value)}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
              active === item.value
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <div key={item.value} role="tabpanel" hidden={active !== item.value}>
          {item.content}
        </div>
      ))}
    </div>
  );
}
