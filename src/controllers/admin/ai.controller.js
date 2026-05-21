import * as aiService from '../../services/ai.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

// Simple in-memory cache
let cachedForecast = null;
let lastCacheTime = null;
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour cache

export const getDemandForecast = async (req, res) => {
  try {
    const now = new Date().getTime();
    
    // Return cached data if valid
    if (cachedForecast && lastCacheTime && (now - lastCacheTime < CACHE_DURATION_MS)) {
      return sendSuccess(res, cachedForecast, "AI Demand Forecast retrieved (cached)");
    }

    // Generate new forecast
    const forecastData = await aiService.generateDemandForecast();
    
    // Save to cache
    cachedForecast = forecastData;
    lastCacheTime = now;

    return sendSuccess(res, forecastData, "AI Demand Forecast generated successfully");
  } catch (error) {
    console.error("Error in getDemandForecast:", error);
    return sendError(res, "Failed to generate AI forecast", 500);
  }
};
