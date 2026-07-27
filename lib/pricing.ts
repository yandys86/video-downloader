/**
 * Packs de créditos que se venden en la web (Fase 1 = solo Stripe).
 * PayPal + cripto vienen en Fase 3.
 */

export type CreditPack = {
  id: string;              // slug interno
  label: string;
  credits: number;
  priceCents: number;      // en céntimos EUR
  featured?: boolean;
  hint?: string;
};

export const PACKS: CreditPack[] = [
  { id: "starter",  label: "Prueba",   credits:   25, priceCents:  300, hint: "0,12 €/crédito" },
  { id: "standard", label: "Standard", credits:  100, priceCents:  900, hint: "0,09 €/crédito", featured: true },
  { id: "pro",      label: "Pro",      credits:  400, priceCents: 2500, hint: "0,062 €/crédito · ahorra 30%" },
  { id: "studio",   label: "Studio",   credits: 1500, priceCents: 8000, hint: "0,053 €/crédito · máximo descuento" },
];

export function getPack(id: string): CreditPack | undefined {
  return PACKS.find((p) => p.id === id);
}

export function fmtPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
