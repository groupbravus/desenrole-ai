"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ImagePlus,
  Sparkles,
  Copy,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyzeConversationAction,
  type ConversationAnalysis,
} from "@/lib/ai/analyze-conversation";
import type { ToolSlug } from "@/lib/data/types";

type Status = "idle" | "loading" | "done";

const REPLY_STYLE_EMOJI = { funny: "😂", playful: "😏" } as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ToolWorkspace({ slug }: { slug: ToolSlug }) {
  const t = useTranslations("tools.workspace");
  const tAuthErrors = useTranslations("auth.errors");

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ConversationAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const bestReply = result?.bestReply ?? "";
  const otherReplies = result?.otherReplies ?? [];

  function handleFile(nextFile: File | undefined) {
    if (!nextFile || !nextFile.type.startsWith("image/")) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setStatus("idle");
    setResult(null);
    setError(null);
  }

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze() {
    if (!file || status === "loading") return;
    setStatus("loading");
    setError(null);

    try {
      const imageBase64 = await fileToBase64(file);
      const response = await analyzeConversationAction({
        imageBase64,
        toolSlug: slug,
      });

      if (!response.ok) {
        setError(
          response.code === "not_authenticated"
            ? tAuthErrors("notAuthenticated")
            : tAuthErrors("unknown"),
        );
        setStatus("idle");
        return;
      }

      setResult(response.data);
      setStatus("done");
    } catch {
      setError(tAuthErrors("unknown"));
      setStatus("idle");
    }
  }

  async function handleCopy(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    window.setTimeout(() => {
      setCopiedIndex((current) => (current === index ? null : current));
    }, 1500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="space-y-5 p-6">
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={t("previewAlt")}
              className="max-h-80 w-full object-contain bg-surface-raised"
            />
            <button
              type="button"
              onClick={clearImage}
              aria-label={t("removeImage")}
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-14 text-center transition-colors hover:border-accent/50 hover:bg-surface-raised"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-accent">
              <ImagePlus className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm font-medium text-foreground">
              {t("uploadLabel")}
            </span>
            <span className="text-xs text-subtle">{t("uploadHint")}</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t("uploadLabel")}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!file || status === "loading"}
          onClick={analyze}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {status === "loading" ? t("analyzing") : t("analyze")}
        </Button>

        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {status === "idle" && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted">
            <Sparkles className="h-6 w-6 text-subtle" aria-hidden />
            {t("emptyState")}
          </Card>
        )}

        {status === "loading" && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2.5 text-sm text-accent">
              <Sparkles className="h-4 w-4 animate-pulse" aria-hidden />
              {t("loadingLabel")}
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </Card>
        )}

        {status === "done" && (
          <>
            <Card className="animate-fade-up space-y-3 border-accent/40 bg-surface p-6 shadow-[0_0_40px_rgba(230,162,60,0.08)]">
              <Badge variant="accent">
                <span aria-hidden>🔥</span> {t("bestReplyBadge")}
              </Badge>
              <div className="flex items-start justify-between gap-4">
                <p className="text-base leading-relaxed text-foreground">
                  {bestReply}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(bestReply, 0)}
                  aria-label={t("copy")}
                  className="shrink-0 text-muted transition-colors hover:text-accent"
                >
                  {copiedIndex === 0 ? (
                    <Check className="h-4 w-4 text-success" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </Card>

            {otherReplies.length > 0 && (
              <div className="space-y-2">
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-subtle">
                  {t("otherReplies")}
                </p>
                {otherReplies.map((reply, i) => {
                  const index = i + 1;
                  return (
                    <Card
                      key={index}
                      className="animate-fade-up space-y-1.5 p-3.5"
                    >
                      <span className="text-[11px] font-medium text-subtle">
                        {REPLY_STYLE_EMOJI[reply.style]}{" "}
                        {t(`replyStyles.${reply.style}`)}
                      </span>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-relaxed text-muted">
                          {reply.text}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopy(reply.text, index)}
                          aria-label={t("copy")}
                          className="shrink-0 text-muted transition-colors hover:text-accent"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-4 w-4 text-success" aria-hidden />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={analyze}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t("regenerate")}
            </Button>

            <Card className="flex items-start gap-3 border-dashed border-border-strong bg-surface-raised/40 p-4">
              <span className="text-lg leading-none" aria-hidden>
                📩
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {t("followUp.title")}
                </p>
                <p className="text-xs leading-relaxed text-subtle">
                  {t("followUp.instruction")} {t("followUp.detail")}
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
