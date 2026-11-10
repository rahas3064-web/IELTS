export function priceAfterPercent(amountToman, percent) {
  const amount = BigInt(amountToman);
  const rate = BigInt(percent);
  if (amount < 0n || rate < 1n || rate > 100n) throw new Error("invalid_price");
  const discount = (amount * rate) / 100n;
  const final = amount - discount;
  return { original: amount, discount, final };
}
