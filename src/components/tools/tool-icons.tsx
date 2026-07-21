import { MessagesSquare, Instagram, type LucideIcon } from "lucide-react";
import type { ToolSlug } from "@/lib/data/types";

export const TOOL_ICONS: Record<ToolSlug, LucideIcon> = {
  "analisar-conversa": MessagesSquare,
  "analisar-story": Instagram,
};

export const TOOL_MESSAGE_KEY: Record<ToolSlug, string> = {
  "analisar-conversa": "conversa",
  "analisar-story": "story",
};
