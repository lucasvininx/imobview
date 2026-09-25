export function money(cents: number | bigint) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(cents) / 100);
}
export function toCents(value: string): bigint {
  const normalized = value.trim().replace(/\./g, "");
  if (!/^\d{1,12}(,\d{1,2})?$/.test(normalized))
    throw new Error("Informe um valor válido, como 950000,00.");
  const [whole, fraction = ""] = normalized.split(",");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}
