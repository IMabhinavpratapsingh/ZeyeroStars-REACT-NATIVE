/*
 * Currency symbols - EK source of truth.
 *
 * Pehle coin / Z Money ke icons (`cash-outline`, `logo-bitcoin`, `ⓩ`)
 * 15+ files mein alag-alag hardcoded the. Ab symbol badalna ho to
 * SIRF yahan badlo - shop, trade, tip, missions, rewards, chat, sab jagah
 * apne aap update ho jayega.
 *
 * Use karna ho to:
 *   - JSX mein icon ki jagah:  <CurrencyIcon type="coin" size={14} />
 *   - Plain text/template mein: `${COIN_SYMBOL} 50`  /  `${ZMONEY_SYMBOL} 50`
 */
export const COIN_SYMBOL = '🪙';
export const ZMONEY_SYMBOL = '💸';

export type CurrencyType = 'coin' | 'zmoney';

export const CURRENCY_SYMBOLS: Record<CurrencyType, string> = {
  coin: COIN_SYMBOL,
  zmoney: ZMONEY_SYMBOL,
};