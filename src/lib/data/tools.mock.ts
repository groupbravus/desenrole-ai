import type { Tool } from "./types";

const tools: Tool[] = [
  { slug: "analisar-conversa", icon: "MessagesSquare", premium: false },
  { slug: "analisar-story", icon: "Instagram", premium: false },
];

export const toolsRepository = {
  async getTools(): Promise<Tool[]> {
    return tools;
  },
  async getBySlug(slug: string): Promise<Tool | null> {
    return tools.find((t) => t.slug === slug) ?? null;
  },
};
