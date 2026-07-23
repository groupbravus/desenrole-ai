"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasPremiumAccess } from "@/lib/entitlements";
import { getOpenAI } from "./openai";
import { CONVERSATION_COACH_SYSTEM_PROMPT } from "./prompts/conversation-coach";
import type { ToolSlug } from "@/lib/data/types";

/**
 * ============================================================
 * ANÁLISE REAL DE CONVERSA — GPT-4.1 (visão + JSON estruturado)
 * ============================================================
 * Substitui por completo a análise mockada. Recebe o print (base64) já
 * enviado pelo navegador e devolve a análise da IA no formato consumido
 * pela tela de resultado (`bestReply` + `otherReplies`).
 *
 * Gate defensivo: autenticação + Premium são checados aqui de novo,
 * mesmo a página já estando atrás do grupo (premium) — cada chamada
 * custa uma requisição paga à OpenAI, então nunca confiamos só na UI.
 * ============================================================
 */

const MODEL = "gpt-4.1";

const REPLY_STYLE = z.enum(["funny", "playful"]);

const OTHER_REPLY_SCHEMA = z.object({
  style: REPLY_STYLE,
  text: z.string().min(1),
});

const ANALYSIS_SCHEMA = z.object({
  diagnosis: z.string().min(1),
  bestReply: z.string().min(1),
  why: z.string().min(1),
  otherReplies: z.array(OTHER_REPLY_SCHEMA).length(2),
  nextStep: z.string().min(1),
});

export type ReplyStyle = z.infer<typeof REPLY_STYLE>;
export type ConversationAnalysis = z.infer<typeof ANALYSIS_SCHEMA>;

export type AnalyzeConversationResult =
  | { ok: true; data: ConversationAnalysis }
  | { ok: false; code: "not_authenticated" | "not_premium" | "invalid_image" | "unknown" };

const TOOL_CONTEXT_HINT: Record<ToolSlug, string> = {
  "analisar-conversa":
    "A imagem é um print de uma conversa de chat (WhatsApp ou DM do Instagram) entre o usuário e a mulher.",
  "analisar-story":
    "A imagem é um print de um Story do Instagram dela, que o usuário quer usar como gancho para puxar ou continuar uma conversa.",
};

export async function analyzeConversationAction(input: {
  imageBase64: string;
  toolSlug: ToolSlug;
}): Promise<AnalyzeConversationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "not_authenticated" };

  if (!(await hasPremiumAccess())) return { ok: false, code: "not_premium" };

  if (!input.imageBase64.startsWith("data:image/")) {
    return { ok: false, code: "invalid_image" };
  }

  const locale = await getLocale();

  try {
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: CONVERSATION_COACH_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${TOOL_CONTEXT_HINT[input.toolSlug]}\nIdioma da interface do aplicativo (para os campos diagnosis/why/nextStep): ${locale}.`,
            },
            { type: "image_url", image_url: { url: input.imageBase64 } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "conversation_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              diagnosis: { type: "string" },
              bestReply: { type: "string" },
              why: { type: "string" },
              otherReplies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    style: { type: "string", enum: ["funny", "playful"] },
                    text: { type: "string" },
                  },
                  required: ["style", "text"],
                  additionalProperties: false,
                },
                minItems: 2,
                maxItems: 2,
              },
              nextStep: { type: "string" },
            },
            required: ["diagnosis", "bestReply", "why", "otherReplies", "nextStep"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = completion.choices[0]?.message.content;
    if (!raw) return { ok: false, code: "unknown" };

    const parsed = ANALYSIS_SCHEMA.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ok: false, code: "unknown" };

    // O schema garante os dois estilos certos, mas não a ORDEM (o item
    // schema é uniforme — "funny"/"playful" podem, em teoria, vir
    // trocados). Reordena de forma defensiva para a UI sempre poder
    // assumir otherReplies[0] = funny, otherReplies[1] = playful.
    const funny = parsed.data.otherReplies.find((r) => r.style === "funny");
    const playful = parsed.data.otherReplies.find((r) => r.style === "playful");
    if (!funny || !playful) return { ok: false, code: "unknown" };

    return {
      ok: true,
      data: { ...parsed.data, otherReplies: [funny, playful] },
    };
  } catch (error) {
    console.error("[analyzeConversationAction] falhou:", error);
    return { ok: false, code: "unknown" };
  }
}
