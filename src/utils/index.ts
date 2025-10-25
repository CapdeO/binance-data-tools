export function adjustToLotSize(quantity: number, minQty: number, stepSize: number) {

  if (quantity < minQty) {
    throw new Error(`Quantity ${quantity} lower than min allowed (${minQty})`);
  }

  const adjusted = Math.floor(quantity / stepSize) * stepSize;

  return parseFloat(adjusted.toFixed(8));
}

export function adjustToTickSize(price: number, tickSize: number): string {
  const adjusted = Math.floor(price / tickSize) * tickSize;
  return adjusted.toFixed(8);
}

export function validateNotional(price: number, quantity: number, minNotional: number) {
  const notional = price * quantity;

  if (notional < minNotional) {
    throw new Error(`Notional value ${notional} lower than min (${minNotional})`);
  }

  return notional;
}

export function percentageToMultiplier(percentage: number, isLoss: boolean = false): number {
  if (isLoss) {
    return 1 - (percentage / 100);
  } else {
    return 1 + (percentage / 100);
  }
}

export function calculatePriceWithPercentage(basePrice: number, percentage: number, isLoss: boolean = false): number {
  const multiplier = percentageToMultiplier(percentage, isLoss);
  return basePrice * multiplier;
}

export function calculatePercentageChange(originalPrice: number, currentPrice: number): number {
  return ((currentPrice - originalPrice) / originalPrice) * 100;
}

export function calculateRSI(closes: number[], period = 14) {
  if (closes.length < period + 1) throw new Error('Not enough data to calculate RSI')

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const diff = closes[i]! - closes[i - 1]!
    if (diff >= 0) gains += diff
    else losses -= diff
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  const rsis = []

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi = 100 - 100 / (1 + rs)
    rsis.push(rsi)
  }

  return rsis
}