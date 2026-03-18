/**
 * scripts/evolve-tasks.ts
 * 
 * Runs the intelligent task evolution system to create dynamic,
 * realistic software development scenarios.
 * 
 * This script:
 * - Generates new contextual tasks based on current project state
 * - Progresses existing tasks through realistic lifecycle states
 * - Simulates authentic software development workflow patterns
 * 
 * Usage:
 *   npx tsx scripts/evolve-tasks.ts
 *   npx tsx scripts/evolve-tasks.ts --dry-run    # Preview changes
 *   npx tsx scripts/evolve-tasks.ts --verbose    # Detailed logging
 */

import 'dotenv/config';
import { TaskEvolution } from '../src/services/TaskEvolution.js';
import { NotionTaskRepository } from '../src/adapters/notion/NotionTaskRepository.js';
import { logger } from '../src/utils/logger.js';
import { updateSystemStatus } from '../src/utils/systemStatus.js';

const isDryRun = process.argv.includes('--dry-run');
const isVerbose = process.argv.includes('--verbose');

async function main(): Promise<void> {
  try {
    if (isVerbose) {
      logger.info('🚀 Starting intelligent task evolution system...');
      logger.info(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    }

    const taskRepo = new NotionTaskRepository();
    const taskEvolution = new TaskEvolution(taskRepo);

    if (isDryRun) {
      logger.info('🔍 DRY RUN MODE - No actual changes will be made');
      
      // In dry run, we'll just analyze the current state
      const { completed, active } = await taskRepo.fetchTasks();
      const allTasks = [...completed, ...active];
      
      logger.info(`📊 Current State: ${allTasks.length} tasks total`);
      logger.info(`   • ${completed.length} completed tasks`);
      logger.info(`   • ${active.length} active tasks`);
      
      const summary = taskEvolution.generateProjectSummary(allTasks);
      logger.info(summary);
      
      logger.info('🎭 Would simulate task evolution (new tasks, status changes)');
      return;
    }

    // Execute the evolution
    const results = await taskEvolution.evolveProject();
    
    logger.info('🎉 Task evolution completed successfully!');
    logger.info(`   📝 ${results.created} new tasks created`);
    logger.info(`   🔄 ${results.updated} tasks updated`);
    logger.info(`   ✅ ${results.completedTasks} tasks completed`);

    // Update system status to reflect the evolution
    try {
      await updateSystemStatus({
        lastRun: new Date().toISOString(),
        status: 'Operational',
        totalStandups: 0, // This will be updated by the actual count
        environment: process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local'
      });
      
      if (isVerbose) {
        logger.info('📊 System status updated with evolution metrics');
      }
    } catch (statusError) {
      logger.warn('⚠️  Failed to update system status:', statusError);
    }

  } catch (error) {
    logger.error('❌ Task evolution failed:', error);
    
    // Update system status to reflect the error
    try {
      await updateSystemStatus({
        lastRun: new Date().toISOString(),
        status: 'Degraded',
        totalStandups: 0,
        environment: process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local'
      }, error instanceof Error ? error.message : String(error));
    } catch (statusError) {
      logger.warn('⚠️  Failed to update system status with error:', statusError);
    }
    
    process.exit(1);
  }
}

if (isVerbose) {
  logger.info('🎯 Task Evolution System - Creating Dynamic Development Scenarios');
  logger.info('   • Contextual task generation based on project state');
  logger.info('   • Realistic task lifecycle progression');
  logger.info('   • Sprint-like workflow simulation');
  logger.info('   • Variety in task types and priorities');
  logger.info('');
}

main().catch(error => {
  logger.error('💥 Fatal error in task evolution:', error);
  process.exit(1);
});