import { SPOT_REST_API_PROD_URL } from '@binance/spot';

export const config = {
  // Configuración de Binance API
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    basePath: process.env.BASE_PATH ?? SPOT_REST_API_PROD_URL,
  },

  trading: {
    defaultSymbol: 'BNBUSDT',
    maxRetries: 3,
    requestTimeout: 5000,
    intervalTime: 60 * 1000, // 1 minuto

    thresholds: {
      priceUpdateTrigger: 0.5,    // 1% - Cuando actualizar OCO por subida de precio
      takeProfitPercentage: 50.0, // 50% - Ganancia objetivo
      stopLossPercentage: 0.5,    // 0.5% - Pérdida máxima
    }
  },
};