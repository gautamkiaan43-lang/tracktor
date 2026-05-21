import cron from 'node-cron';
import { runDailyAIAnalysis } from '../services/ai-analysis.service.js';

// Schedule the AI historical booking analysis once daily at midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON-DAILY] Starting daily AI Business Intelligence historical data analysis...');
  try {
    await runDailyAIAnalysis();
    console.log('[CRON-DAILY] Daily AI analysis successfully completed.');
  } catch (error) {
    console.error('[CRON-DAILY] Error occurred during daily AI analysis:', error);
  }
});

console.log('[CRON] AI Daily Scheduler successfully initialized and bound (runs daily at 00:00).');
