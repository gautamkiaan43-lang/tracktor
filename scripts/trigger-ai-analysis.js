import { runDailyAIAnalysis } from '../src/services/ai-analysis.service.js';

const trigger = async () => {
  console.log('--- Manually Triggering AI Data Aggregation ---');
  try {
    await runDailyAIAnalysis();
    console.log('--- Trigger Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Trigger failed:', err);
    process.exit(1);
  }
};

trigger();
