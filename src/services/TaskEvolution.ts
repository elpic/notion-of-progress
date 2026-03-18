/**
 * TaskEvolution.ts
 * 
 * Intelligent task generation and progression system that creates realistic
 * software development scenarios with context-aware task creation and 
 * natural workflow progression.
 * 
 * Features:
 * - Context-aware task generation based on existing project state
 * - Realistic task lifecycle progression (To Do → In Progress → Done/Blocked)
 * - Variety in task types (features, bugs, infrastructure, documentation)
 * - Sprint-like workflow simulation with dependencies and priorities
 */

import { NotionTaskRepository } from '../adapters/notion/NotionTaskRepository.js';
import { TaskSummary, TaskStatus, TaskPriority } from '../core/domain/types.js';
import { logger } from '../utils/logger.js';

/**
 * Template for generating realistic development tasks.
 */
interface TaskTemplate {
  name: string;
  priority: TaskPriority;
  category: 'Feature' | 'Bug' | 'Infrastructure' | 'Documentation' | 'Refactor';
  estimatedDays: number;
  dependencies?: string[];
  context: string;
}

interface ProjectContext {
  currentSprint: number;
  activeFeatures: string[];
  recentBugs: number;
  techDebtLevel: 'Low' | 'Medium' | 'High';
  teamSize: number;
  lastDeployment: Date;
}

export class TaskEvolution {
  private taskRepo: NotionTaskRepository;
  private projectContext: ProjectContext;
  
  // Realistic software development task templates
  private taskTemplates: TaskTemplate[] = [
    // Features
    {
      name: 'Implement user authentication with OAuth 2.0',
      priority: TaskPriority.HIGH,
      category: 'Feature',
      estimatedDays: 5,
      context: 'User management system needs secure login flow'
    },
    {
      name: 'Add dark mode toggle to user preferences',
      priority: TaskPriority.MEDIUM,
      category: 'Feature', 
      estimatedDays: 3,
      context: 'UX improvement requested by multiple users'
    },
    {
      name: 'Build real-time notification system',
      priority: TaskPriority.HIGH,
      category: 'Feature',
      estimatedDays: 7,
      dependencies: ['WebSocket infrastructure', 'User preferences'],
      context: 'Critical for user engagement and retention'
    },
    {
      name: 'Create advanced search with filters',
      priority: TaskPriority.MEDIUM,
      category: 'Feature',
      estimatedDays: 4,
      context: 'Users need better content discovery'
    },
    {
      name: 'Implement file upload with progress tracking',
      priority: TaskPriority.MEDIUM,
      category: 'Feature',
      estimatedDays: 3,
      context: 'Support for user-generated content'
    },
    
    // Bugs
    {
      name: 'Fix memory leak in WebSocket connections',
      priority: TaskPriority.HIGH,
      category: 'Bug',
      estimatedDays: 2,
      context: 'Production issue causing server instability'
    },
    {
      name: 'Resolve infinite scroll pagination bug',
      priority: TaskPriority.MEDIUM,
      category: 'Bug',
      estimatedDays: 1,
      context: 'Users report duplicate content loading'
    },
    {
      name: 'Fix race condition in async data fetching',
      priority: TaskPriority.HIGH,
      category: 'Bug',
      estimatedDays: 2,
      context: 'Intermittent data corruption in user profiles'
    },
    {
      name: 'Correct timezone handling in date picker',
      priority: TaskPriority.LOW,
      category: 'Bug',
      estimatedDays: 1,
      context: 'International users report incorrect dates'
    },
    
    // Infrastructure
    {
      name: 'Migrate database to PostgreSQL 15',
      priority: TaskPriority.MEDIUM,
      category: 'Infrastructure',
      estimatedDays: 5,
      context: 'Performance improvements and new features'
    },
    {
      name: 'Set up automated backup strategy',
      priority: TaskPriority.HIGH,
      category: 'Infrastructure',
      estimatedDays: 2,
      context: 'Data protection and disaster recovery'
    },
    {
      name: 'Implement Redis caching layer',
      priority: TaskPriority.MEDIUM,
      category: 'Infrastructure',
      estimatedDays: 3,
      context: 'Reduce database load and improve response times'
    },
    {
      name: 'Configure monitoring and alerting',
      priority: TaskPriority.HIGH,
      category: 'Infrastructure',
      estimatedDays: 4,
      context: 'Proactive issue detection and system health'
    },
    
    // Documentation
    {
      name: 'Write API documentation for v2 endpoints',
      priority: TaskPriority.MEDIUM,
      category: 'Documentation',
      estimatedDays: 2,
      context: 'Developer onboarding and external integrations'
    },
    {
      name: 'Create user onboarding guide',
      priority: TaskPriority.LOW,
      category: 'Documentation',
      estimatedDays: 1,
      context: 'Reduce support tickets and improve user experience'
    },
    {
      name: 'Update deployment runbook',
      priority: TaskPriority.MEDIUM,
      category: 'Documentation',
      estimatedDays: 1,
      context: 'Streamline release process and reduce errors'
    },
    
    // Refactoring
    {
      name: 'Refactor authentication middleware',
      priority: TaskPriority.LOW,
      category: 'Refactor',
      estimatedDays: 3,
      context: 'Improve code maintainability and add test coverage'
    },
    {
      name: 'Extract common utilities into shared library',
      priority: TaskPriority.LOW,
      category: 'Refactor',
      estimatedDays: 2,
      context: 'Reduce code duplication across services'
    },
    {
      name: 'Optimize database queries for user dashboard',
      priority: TaskPriority.MEDIUM,
      category: 'Refactor',
      estimatedDays: 2,
      context: 'Page load time exceeded 3 seconds under load'
    }
  ];

  constructor(taskRepo: NotionTaskRepository) {
    this.taskRepo = taskRepo;
    this.projectContext = {
      currentSprint: Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 14)) % 26, // 2-week sprints
      activeFeatures: [],
      recentBugs: 0,
      techDebtLevel: 'Medium',
      teamSize: 4,
      lastDeployment: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Within last week
    };
  }

  /**
   * Evolves the project by adding new tasks and progressing existing ones
   * This simulates a realistic development workflow
   */
  async evolveProject(): Promise<{ created: number; updated: number; completedTasks: number }> {
    logger.info('🔄 Starting project evolution...');
    
    const { completed: completedTasks, active } = await this.taskRepo.fetchTasks();
    const existingTasks = [...completedTasks, ...active];
    await this.updateProjectContext(existingTasks);
    
    let created = 0;
    let updated = 0; 
    let completedCount = 0;

    // Progress existing tasks (80% chance each task progresses)
    for (const task of existingTasks) {
      if (Math.random() < 0.8) {
        const progression = await this.progressTask(task);
        if (progression === 'updated') updated++;
        if (progression === 'completed') completedCount++;
      }
    }

    // Add new tasks based on project context (1-3 new tasks per day)
    const newTaskCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < newTaskCount; i++) {
      const newTask = this.generateContextualTask(existingTasks);
      if (newTask) {
        await this.createTask(newTask);
        created++;
        logger.info(`✨ Created task: ${newTask.name}`);
      }
    }

    logger.info(`📊 Evolution complete: ${created} created, ${updated} updated, ${completedCount} completed`);
    return { created, updated, completedTasks: completedCount };
  }

  /**
   * Updates project context based on current task state
   */
  private async updateProjectContext(tasks: TaskSummary[]): Promise<void> {
    this.projectContext.activeFeatures = tasks
      .filter(t => t.status === TaskStatus.IN_PROGRESS && t.title.toLowerCase().includes('feature'))
      .map(t => t.title);
    
    this.projectContext.recentBugs = tasks
      .filter(t => t.title.toLowerCase().includes('fix') || t.title.toLowerCase().includes('bug'))
      .length;
    
    // Adjust tech debt based on ratio of refactor tasks to total tasks
    const refactorTasks = tasks.filter(t => 
      t.title.toLowerCase().includes('refactor') || 
      t.title.toLowerCase().includes('optimize') ||
      t.title.toLowerCase().includes('clean')
    ).length;
    
    const ratio = refactorTasks / Math.max(tasks.length, 1);
    if (ratio > 0.3) this.projectContext.techDebtLevel = 'Low';
    else if (ratio < 0.1) this.projectContext.techDebtLevel = 'High';
    else this.projectContext.techDebtLevel = 'Medium';
  }

  /**
   * Progresses a task through its lifecycle with realistic timing
   */
  private async progressTask(task: TaskSummary): Promise<'updated' | 'completed' | 'none'> {
    const daysSinceCreation = Math.floor((Date.now() - new Date(task.dueDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
    
    // Task progression logic based on current status and time
    switch (task.status) {
      case TaskStatus.TODO:
        // 40% chance to start working on high priority tasks, 20% for others
        const startChance = task.priority === TaskPriority.HIGH ? 0.4 : 0.2;
        if (Math.random() < startChance) {
          await this.updateTaskStatus(task, TaskStatus.IN_PROGRESS);
          logger.info(`🚀 Started work on: ${task.title}`);
          return 'updated';
        }
        break;
        
      case TaskStatus.IN_PROGRESS:
        // Tasks should complete based on estimated time and some variability
        const completionChance = Math.min(0.8, daysSinceCreation * 0.1 + 0.1);
        const blockChance = 0.05; // 5% chance of getting blocked
        
        if (Math.random() < blockChance) {
          await this.updateTaskStatus(task, TaskStatus.BLOCKED);
          logger.info(`🚧 Task blocked: ${task.title}`);
          return 'updated';
        } else if (Math.random() < completionChance) {
          await this.updateTaskStatus(task, TaskStatus.DONE);
          logger.info(`✅ Completed task: ${task.title}`);
          return 'completed';
        }
        break;
        
      case TaskStatus.BLOCKED:
        // 30% chance to unblock and continue work
        if (Math.random() < 0.3) {
          await this.updateTaskStatus(task, TaskStatus.IN_PROGRESS);
          logger.info(`🔓 Unblocked task: ${task.title}`);
          return 'updated';
        }
        break;
    }
    
    return 'none';
  }

  /**
   * Generates a contextual task based on current project state
   */
  private generateContextualTask(existingTasks: TaskSummary[]): TaskTemplate | null {
    const existingNames = new Set(existingTasks.map(t => t.title.toLowerCase()));
    
    // Filter out tasks that already exist
    const availableTasks = this.taskTemplates.filter(template => 
      !existingNames.has(template.name.toLowerCase())
    );
    
    if (availableTasks.length === 0) return null;
    
    // Weighted selection based on project context
    const weights = availableTasks.map(task => {
      let weight = 1.0;
      
      // Increase weight for high priority tasks
      if (task.priority === 'High') weight *= 1.5;
      
      // Increase bug fix weight if we have many bugs
      if (task.category === 'Bug' && this.projectContext.recentBugs > 3) weight *= 2.0;
      
      // Increase infrastructure weight periodically
      if (task.category === 'Infrastructure' && this.projectContext.currentSprint % 4 === 0) weight *= 1.3;
      
      // Increase refactor weight if tech debt is high
      if (task.category === 'Refactor' && this.projectContext.techDebtLevel === 'High') weight *= 1.8;
      
      // Reduce weight if we have too many active features
      if (task.category === 'Feature' && this.projectContext.activeFeatures.length > 3) weight *= 0.5;
      
      return weight;
    });
    
    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < availableTasks.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return availableTasks[i];
      }
    }
    
    return availableTasks[0]; // Fallback
  }

  /**
   * Creates a new task in Notion from a template
   */
  private async createTask(template: TaskTemplate): Promise<void> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.estimatedDays + Math.floor(Math.random() * 3)); // Add some variability
    
    const taskName = this.personalizeTaskName(template.name, template.context);
    
    await this.taskRepo.createTask({
      title: taskName,
      priority: template.priority,
      status: TaskStatus.TODO,
      dueDate: dueDate.toISOString().split('T')[0], // Just the date part
      notes: `${template.context}\n\nCategory: ${template.category}\nEstimated effort: ${template.estimatedDays} days`
    });
    
    logger.info(`✨ Created task: ${taskName} (${template.priority} priority, due ${dueDate.toDateString()})`);
  }

  /**
   * Updates task status in Notion
   */
  private async updateTaskStatus(task: TaskSummary, newStatus: TaskStatus): Promise<void> {
    await this.taskRepo.updateTaskStatus(task.id, newStatus);
    logger.info(`🔄 Updated ${task.title} from ${task.status} to ${newStatus}`);
  }

  /**
   * Adds variety to task names based on current context
   */
  private personalizeTaskName(baseName: string, context: string): string {
    const variations = [
      `${baseName}`,
      `${baseName} - Sprint ${this.projectContext.currentSprint}`,
      `[P${this.projectContext.currentSprint}] ${baseName}`,
      `${baseName} (${context.split(' ').slice(0, 3).join(' ')})`
    ];
    
    return variations[Math.floor(Math.random() * variations.length)];
  }

  /**
   * Generates a realistic project status summary
   */
  generateProjectSummary(tasks: TaskSummary[]): string {
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = tasks.length;
    const completed = statusCounts['Done'] || 0;
    const inProgress = statusCounts['In Progress'] || 0;
    const blocked = statusCounts['Blocked'] || 0;

    const velocity = Math.round(completed / Math.max(this.projectContext.currentSprint, 1) * 10) / 10;
    
    return `📊 Sprint ${this.projectContext.currentSprint} Status: ${total} tasks total, ${completed} completed (${Math.round(completed/total*100)}%), ${inProgress} in progress, ${blocked} blocked. Team velocity: ${velocity} tasks/sprint. Tech debt level: ${this.projectContext.techDebtLevel}.`;
  }
}