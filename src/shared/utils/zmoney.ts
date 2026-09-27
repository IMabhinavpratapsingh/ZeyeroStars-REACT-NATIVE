// PEHLE yahan fixed presets (1,5,10,15,20,25,30) the aur UI sirf inhi
// buttons se amount choose karwata tha - isliye 30 se zyada Z Money
// kabhi bheji hi nahi ja sakti thi (jaise 50k wale item ke liye kaafi
// nahi tha). Ab TipModal/TradeModal mein ek free-type input box hai -
// koi bhi positive integer amount type kar sakte ho.

// Sirf DISPLAY ke liye - "itna bhejoge to itna katega" dikhane ke liye.
// Actual deduction/validation hamesha backend hi karta hai.
export function calculateZMoneyCost(amount: number): number {
  if (!amount || amount <= 0) return 0;
  const fee = Math.ceil(amount * 0.1);
  return amount + fee;
}

// Input box mein type ki hui value valid hai kya (positive integer) -
// isse UI turant "Send" button disable/enable kar sakta hai bina
// backend ka wait kiye. Final validation phir bhi backend hi karta hai.
export function isValidZMoneyAmount(amount: unknown): boolean {
  const n = Number(amount);
  return Number.isInteger(n) && n >= 1;
}