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

// Run immediately on server startup so you don't have to wait for midnight or run a second terminal on Railway!
setTimeout(() => {
  console.log('[STARTUP] Running initial AI Analysis so frontend has fresh data immediately...');
  runDailyAIAnalysis().catch(err => console.error(err));
}, 5000); // Wait 5 seconds for DB to be fully ready before starting the python process
