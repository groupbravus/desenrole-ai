import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "@/lib/stripe/sync";

/**
 * ============================================================
 * WEBHOOK DA STRIPE — recepção + dedup + sincronização (Fase S3)
 * ============================================================
 * Contrato de segurança e robustez:
 *  - Assinatura obrigatória: nada é processado sem constructEvent válido
 *    (raw body + Stripe-Signature + STRIPE_WEBHOOK_SECRET).
 *  - Ambiente: em dev só aceitamos test mode (livemode = false).
 *  - Dedup atômico via webhook_events (stripe_event_id único). Um retry da
 *    Stripe não reprocessa; apenas incrementa `attempts`.
 *  - Resposta rápida: a Stripe reenvia se não receber 2xx a tempo. O
 *    trabalho aqui é curto (o estado é relido na Stripe dentro do sync).
 *  - Idempotência real mora no syncSubscription: o evento é só um SINAL;
 *    o estado atual é relido na Stripe e convergido. Fora de ordem e
 *    duplicatas não regridem o estado (guarda latest_event_at).
 *  - Log seguro: nunca registramos segredos nem o corpo completo; só
 *    id/tipo do objeto e mensagens de erro saneadas.
 *
 * Rota FORA do matcher do middleware (`/api/...`): sua única autorização
 * é a assinatura. O App Router entrega o corpo cru via `req.text()`.
 * ============================================================
 */

// Eventos que disparam sincronização de assinatura.
const SYNC_EVENTS = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

// Eventos recebidos e registrados, mas cuja AÇÃO fica para a S5
// (reembolso/disputa removem acesso imediatamente). Aqui só deduplicamos
// e marcamos como adiado — não alteramos entitlements ainda.
const DEFERRED_EVENTS = new Set<Stripe.Event["type"]>([
  "charge.refunded",
  "charge.dispute.created",
]);

/** Extrai o subscription id do objeto do evento, quando aplicável. */
function extractSubscriptionId(event: Stripe.Event): string | null {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      return (event.data.object as Stripe.Subscription).id;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return null;
      return typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription?.id ?? null);
    }
    default:
      return null;
  }
}

/** Objeto id do evento — o mínimo para o payload de auditoria (sem PII). */
function extractObjectId(event: Stripe.Event): string | null {
  const obj = event.data.object as { id?: unknown };
  return typeof obj?.id === "string" ? obj.id : null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // 500 (não 400): é erro de configuração do servidor, não do emissor.
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch {
    // Assinatura inválida / corpo adulterado / secret errado.
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Proteção de ambiente: evento de produção não pode afetar o dev
  // (e vice-versa). Em dev só aceitamos test mode (livemode = false).
  const isProduction = process.env.NODE_ENV === "production";
  if (event.livemode !== isProduction) {
    // 200 para a Stripe não ficar re-tentando um evento que ignoramos
    // de propósito por ser de outro ambiente.
    return NextResponse.json({ received: true, skipped: "livemode_mismatch" });
  }

  const admin = createAdminClient();

  // Dedup atômico: insere o evento ou incrementa attempts se já existe.
  const { data: recorded, error: recordError } = await admin
    .rpc("record_webhook_event", {
      _event_id: event.id,
      _type: event.type,
      _livemode: event.livemode,
      _payload: { object_id: extractObjectId(event), type: event.type },
    })
    .maybeSingle<{ already_processed: boolean; attempts: number }>();

  if (recordError) {
    // Não conseguimos registrar → peça retry (não perca o evento).
    return NextResponse.json({ error: "record_failed" }, { status: 500 });
  }

  if (recorded?.already_processed) {
    // Já processado antes: idempotência — confirma sem reprocessar.
    return NextResponse.json({ received: true, deduped: true });
  }

  // Eventos fora do nosso escopo de sincronização (inclui os adiados para
  // a S5, como reembolso/disputa): registra como `skipped` e confirma.
  if (!SYNC_EVENTS.has(event.type)) {
    const note = DEFERRED_EVENTS.has(event.type) ? "deferred_to_s5" : null;
    await admin.rpc("mark_webhook_event", {
      _event_id: event.id,
      _status: "skipped",
      _error: note,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  const subscriptionId = extractSubscriptionId(event);
  if (!subscriptionId) {
    // Ex.: invoice avulsa sem assinatura. Nada a sincronizar.
    await admin.rpc("mark_webhook_event", {
      _event_id: event.id,
      _status: "skipped",
      _error: "no_subscription",
    });
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    const result = await syncSubscription({
      subscriptionId,
      source: "webhook",
      eventId: event.id,
      eventAt: new Date(event.created * 1000),
    });

    if (!result.ok) {
      // Assinatura ainda SEM conta no app (fluxo de checkout externo: a
      // conta só é criada em /criar-conta, quando o usuário volta). Isso
      // NÃO é falha — o webhook não provisiona conta. Registramos como
      // `skipped` e devolvemos 200 para a Stripe não ficar re-tentando.
      // Quando a conta for criada, /criar-conta chama syncSubscription e o
      // estado converge; eventos futuros (renovação etc.) já acham o mapa.
      const notYetLinked = result.reason === "user_not_identified";
      await admin.rpc("mark_webhook_event", {
        _event_id: event.id,
        _status: notYetLinked ? "skipped" : "error",
        _error: result.reason,
      });
      if (notYetLinked) {
        return NextResponse.json({ received: true, pending: "no_account_yet" });
      }
      // Falha real → 500, a Stripe reenvia; o dedup evita efeito duplicado.
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }

    await admin.rpc("mark_webhook_event", {
      _event_id: event.id,
      _status: "processed",
      _error: null,
    });
    return NextResponse.json({ received: true, handled: true });
  } catch (err) {
    // Mensagem saneada, sem segredos nem payload.
    const message = err instanceof Error ? err.message.slice(0, 300) : "unknown";
    await admin.rpc("mark_webhook_event", {
      _event_id: event.id,
      _status: "error",
      _error: message,
    });
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
