import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveGrantedUntil,
  isAccessActive,
  shouldApplyEvent,
  GRACE_PERIOD_DAYS,
} from "./entitlement-logic";

const DAY = 24 * 60 * 60 * 1000;
const cpe = new Date("2026-08-01T00:00:00Z"); // current_period_end de referência
const beforeCpe = new Date("2026-07-15T00:00:00Z");
const afterCpe = new Date("2026-08-10T00:00:00Z");

// ---------- deriveGrantedUntil por estado ----------

test("active → acesso até current_period_end", () => {
  const g = deriveGrantedUntil({ status: "active", currentPeriodEnd: cpe });
  assert.equal(g?.getTime(), cpe.getTime());
  assert.equal(isAccessActive(g, beforeCpe), true);
  assert.equal(isAccessActive(g, afterCpe), false);
});

test("trialing → tratado com segurança: acesso até o fim do período", () => {
  const g = deriveGrantedUntil({ status: "trialing", currentPeriodEnd: cpe });
  assert.equal(g?.getTime(), cpe.getTime());
});

test("past_due → aplica grace de 3 dias após current_period_end", () => {
  const g = deriveGrantedUntil({ status: "past_due", currentPeriodEnd: cpe });
  assert.equal(g?.getTime(), cpe.getTime() + GRACE_PERIOD_DAYS * DAY);
  // ainda tem acesso 2 dias após o fim do período
  assert.equal(
    isAccessActive(g, new Date(cpe.getTime() + 2 * DAY)),
    true,
  );
  // perde acesso 4 dias após (fora do grace)
  assert.equal(
    isAccessActive(g, new Date(cpe.getTime() + 4 * DAY)),
    false,
  );
});

test("unpaid → sem acesso", () => {
  assert.equal(deriveGrantedUntil({ status: "unpaid", currentPeriodEnd: cpe }), null);
});

test("incomplete / incomplete_expired / paused → sem acesso", () => {
  for (const status of ["incomplete", "incomplete_expired", "paused"] as const) {
    assert.equal(deriveGrantedUntil({ status, currentPeriodEnd: cpe }), null);
  }
});

test("canceled com período vigente → acesso até current_period_end", () => {
  const g = deriveGrantedUntil({ status: "canceled", currentPeriodEnd: cpe });
  assert.equal(g?.getTime(), cpe.getTime());
  assert.equal(isAccessActive(g, beforeCpe), true); // ainda dentro do período
  assert.equal(isAccessActive(g, afterCpe), false); // após o fim → sem acesso
});

test("canceled após o fim do período → sem acesso", () => {
  const g = deriveGrantedUntil({ status: "canceled", currentPeriodEnd: beforeCpe });
  assert.equal(isAccessActive(g, afterCpe), false);
});

// ---------- out-of-order ----------

test("shouldApplyEvent: primeiro evento sempre aplica", () => {
  assert.equal(shouldApplyEvent(new Date("2026-07-01"), null), true);
});

test("shouldApplyEvent: evento mais novo aplica", () => {
  assert.equal(
    shouldApplyEvent(new Date("2026-07-02"), new Date("2026-07-01")),
    true,
  );
});

test("shouldApplyEvent: evento mais antigo NÃO aplica (sem regressão)", () => {
  assert.equal(
    shouldApplyEvent(new Date("2026-07-01"), new Date("2026-07-02")),
    false,
  );
});

test("shouldApplyEvent: evento com mesmo timestamp aplica (idempotente)", () => {
  const t = new Date("2026-07-01");
  assert.equal(shouldApplyEvent(t, t), true);
});
