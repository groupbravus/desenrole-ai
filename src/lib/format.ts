/**
 * Formatação sensível a locale. Nunca formatar moeda/data manualmente
 * nos componentes — sempre por aqui.
 */
export function formatCurrency(
  amountInCents: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
}

export function formatDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(date),
  );
}
