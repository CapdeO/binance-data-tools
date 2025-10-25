import { Spot, SpotRestAPI } from '@binance/spot';
import { config } from '../config';
import { adjustToLotSize, adjustToTickSize, calculatePriceWithPercentage, calculateRSI } from '../utils';

export class BinanceService {
  private client: Spot;

  constructor() {
    const configurationRestAPI = {
      apiKey: config.binance.apiKey,
      apiSecret: config.binance.apiSecret,
      basePath: config.binance.basePath,
    };

    this.client = new Spot({ configurationRestAPI });
  }

  async getUSDTBalance() {
    try {
      const response = await this.client.restAPI.getAccount();
      const accountData = await response.data();
      const usdtBalance = accountData.balances?.find(b => b.asset === 'USDT');
      return usdtBalance ? parseFloat(usdtBalance.free || "0") : 0;
    } catch (error) {
      throw new Error(`Error getting USDT balance: ${error}`);
    }
  }

  async getTickerBalance(symbol: string) {
    try {
      const response = await this.client.restAPI.getAccount();
      const accountData = await response.data();
      const tickerBalance = accountData.balances?.find(b => b.asset === symbol);
      const result = tickerBalance ? parseFloat(tickerBalance.free || "0") : 0;
      console.log(`Balance for ${symbol}: ${result}`);
      return result;
    } catch (error) {
      throw new Error(`Error getting ticker balance: ${error}`);
    }
  }

  async getTickerPrice(symbol: string) {
    try {
      const response = await this.client.restAPI.tickerPrice({ symbol });
      const data = await response.data() as { symbol: string; price: string };
      return data.price ? parseFloat(data.price) : 0;
    } catch (error) {
      throw new Error(`Error getting ticker price: ${error}`);
    }
  }

  async getRSI(
    symbol: string,
    interval: string,
    period: number,
  ) {
    try {
      const response = await this.client.restAPI.klines({
        symbol,
        interval: interval as SpotRestAPI.KlinesIntervalEnum,
      });

      const data = await response.data();

      const closes = data.map((c : any) => parseFloat(c[4]));
      const rsis = calculateRSI(closes, period);
      
      const lastRsi = rsis[rsis.length - 1];
      return lastRsi;

    } catch (error) {
      throw new Error(`Error getting ticker RSI: ${error}`);
    }
  }

  async createMarketOrder(
    symbol: string,
    usdtQuantity: number,
  ) {
    try {
      const usdtBalance = await this.getUSDTBalance();
      if (usdtBalance < usdtQuantity) {
        throw new Error('Insufficient USDT balance to place market order');
      }

      const response = await this.client.restAPI.newOrder({
        symbol: `${symbol}USDT`,
        side: SpotRestAPI.NewOrderSideEnum.BUY,
        type: SpotRestAPI.NewOrderTypeEnum.MARKET,
        quoteOrderQty: usdtQuantity,
      });

      const data = await response.data();
      console.log('Order data:', data);

      const avgBuyPrice = data.fills && data.fills.length > 0
        ? data.fills.reduce((sum: number, fill: any) => sum + parseFloat(fill.price) * parseFloat(fill.qty), 0) /
        data.fills.reduce((sum: number, fill: any) => sum + parseFloat(fill.qty), 0)
        : 0;

    } catch (error) {
      throw new Error(`Error creating Market order: ${error}`);
    }
  }

  async sellMarketOrder(symbol: string) {
    try {
      const tickerBalance = await this.getTickerBalance(symbol);
      if (tickerBalance === 0) {
        throw new Error('Insufficient ticker balance to place market order');
      }

      const { minQty, stepSize } = await this.getExchangeInfo(symbol);

      const adjustedQuantity = adjustToLotSize(tickerBalance, minQty, stepSize);
      console.log(`Adjusted quantity for ${symbol}: ${adjustedQuantity}`);

      const response = await this.client.restAPI.newOrder({
        symbol: `${symbol}USDT`,
        side: SpotRestAPI.NewOrderSideEnum.SELL,
        type: SpotRestAPI.NewOrderTypeEnum.MARKET,
        quantity: adjustedQuantity,
      });

      const data = await response.data();
      console.log('Order executed:', data);

    } catch (error) {
      throw new Error(`Error creating Sell Market order: ${error}`);
    }
  }

  async createOCOOrder(symbol: string, fixedPrice: number) {
    try {

      const tickerBalance = await this.getTickerBalance(symbol);

      const { minQty, stepSize, tickSize } = await this.getExchangeInfo(symbol);

      if (tickerBalance === 0 || tickerBalance < minQty) {
        throw new Error('Insufficient ticker balance to place OCO order');
      }

      const adjustedQuantity = adjustToLotSize(tickerBalance, minQty, stepSize);
      console.log(`Adjusted quantity for ${symbol}: ${adjustedQuantity}`);

      const { takeProfitPercentage, stopLossPercentage } = config.trading.thresholds;
      const takeProfitPriceRaw = calculatePriceWithPercentage(fixedPrice, takeProfitPercentage);
      const stopLossPriceRaw = calculatePriceWithPercentage(fixedPrice, stopLossPercentage, true);

      const takeProfitPrice = adjustToTickSize(takeProfitPriceRaw, tickSize);
      const stopLossPrice = adjustToTickSize(stopLossPriceRaw, tickSize);

      console.log(`Creating OCO order for ${symbol} with Take Profit: ${takeProfitPrice} and Stop Loss: ${stopLossPrice}`);

      const response = await this.client.restAPI.orderListOco({
        symbol: `${symbol}USDT`,
        side: SpotRestAPI.OrderListOcoSideEnum.SELL,
        quantity: adjustedQuantity,

        aboveType: SpotRestAPI.OrderListOcoAboveTypeEnum.TAKE_PROFIT,
        aboveStopPrice: Number(takeProfitPrice),

        belowType: SpotRestAPI.OrderListOcoBelowTypeEnum.STOP_LOSS,
        belowStopPrice: Number(stopLossPrice),
      });

      const data = await response.data();
      console.log('OCO order sent:', data);

      return {
        takeProfit: takeProfitPrice,
        stopLoss: stopLossPrice,
      };

    } catch (error) {
      throw new Error(`Error creating OCO order: ${error}`);
    }
  }

  async cancelOCOOrder(symbol: string, orderListId: number) {
    try {

      const response = await this.client.restAPI.deleteOrderList({
        symbol: `${symbol}USDT`,
        orderListId,
      });

      const data = await response.data();
      console.log('OCO order cancelled:', data);

    } catch (error) {
      throw new Error(`Error cancelling OCO order: ${error}`);
    }
  }

  async getOCOOrderStatus(orderListId: number) {
    try {

      const response = await this.client.restAPI.getOrderList({ orderListId });
      const data = await response.data();

      if (!data.listOrderStatus) {
        throw new Error('No order list status found');
      }

      console.log("ORDER OCO DATA");
      console.log(data);

      return data.listOrderStatus;

    } catch (error) {
      throw new Error(`Error getting OCO order status: ${error}`);
    }
  }

  async getExchangeInfo(symbol: string) {
    const info = await this.client.restAPI.exchangeInfo({ symbol: `${symbol}USDT` })
    const data = await info.data();

    if (!data.symbols || data.symbols.length === 0 || !data.symbols[0]) {
      throw new Error(`No exchange info found for symbol ${symbol}USDT`);
    }

    const filters = data.symbols[0].filters;

    if (!filters || filters.length === 0) {
      throw new Error(`No filters found for symbol ${symbol}USDT`);
    }

    const notionalFilter = filters.find(
      f => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL'
    );
    const priceFilter = filters.find(f => f.filterType === 'PRICE_FILTER');

    if (!priceFilter || !priceFilter.tickSize) throw new Error('No PRICE_FILTER filter found for symbol');
    if (!notionalFilter || !notionalFilter.minNotional) throw new Error('No NOTIONAL filter found for symbol');

    const tickSize = parseFloat(priceFilter.tickSize);
    const minNotional = parseFloat(notionalFilter.minNotional);

    const lotFilter = filters.find(f => f.filterType === 'LOT_SIZE');
    if (!lotFilter || !lotFilter.stepSize || !lotFilter.minQty) {
      throw new Error(`No LOT_SIZE filter found for symbol ${symbol}USDT`);
    }

    const stepSize = parseFloat(lotFilter.stepSize);
    const minQty = parseFloat(lotFilter.minQty);

    return { tickSize, minNotional, stepSize, minQty };
  }
}