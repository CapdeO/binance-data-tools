import { BinanceService } from "./services/binanceService"

const main = async () => {
  const binanceService = new BinanceService();

  const symbol = `AVNTUSDT`;
  const interval = '15m';
  const period = 6;

  const rsi = await binanceService.getRSI(symbol, interval, period);
  console.log(`RSI for ${symbol} (${interval} interval - last ${period} candles): ${rsi}`);
}

main();