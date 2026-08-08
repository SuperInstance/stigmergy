/**
 * Task Distribution Example
 *
 * Run: node examples/task-distribution.js
 */

const { Stigmergy, PheromoneType, TrailFollower } = require('@superinstance/stigmergy');

// --- Simulated distributed task pool ---

class DistributedTaskPool {
  constructor() {
    this.stigmergy = new Stigmergy({
      maxPheromones: 500,
      defaultHalfLife: 30000,
      evaporationInterval: 5000,
    });
    this.workers = new Map();
    this.tasks = new Map();
    this.completedTasks = 0;
  }

  submitTask(task) {
    console.log(`Submitting task: ${task.id} (${task.type})`);
    this.tasks.set(task.id, task);
    this.stigmergy.deposit(
      'system',
      PheromoneType.RECRUIT,
      { taskType: task.type },
      task.priority || 0.5,
      new Map([['taskId', task.id]])
    );
  }

  registerWorker(workerId, capabilities = ['data-processing']) {
    console.log(`Registering worker: ${workerId}`);
    const follower = new TrailFollower(this.stigmergy, workerId);
    this.workers.set(workerId, {
      follower,
      capabilities,
      currentTask: null,
      completed: 0,
      interval: null,
    });
    this.startWorkerLoop(workerId);
  }

  startWorkerLoop(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.interval = setInterval(() => {
      if (worker.currentTask) {
        if (Date.now() > worker.currentTask.startTime + worker.currentTask.duration) {
          this.completeTask(workerId);
        }
        return;
      }
      for (const cap of worker.capabilities) {
        const result = worker.follower.followTrail({ taskType: cap }, PheromoneType.RECRUIT);
        if (result.found) {
          const taskId = result.pheromone.metadata.get('taskId');
          const task = this.tasks.get(taskId);
          if (task && !task.assigned) {
            this.assignTask(workerId, task);
            break;
          }
        }
      }
    }, 500);
  }

  assignTask(workerId, task) {
    const worker = this.workers.get(workerId);
    task.assigned = true;
    task.startTime = Date.now();
    task.duration = task.estimatedTime || (Math.random() * 3000 + 1000);
    worker.currentTask = task;
    console.log(`  → ${workerId} picked up ${task.id}`);
  }

  completeTask(workerId) {
    const worker = this.workers.get(workerId);
    const task = worker.currentTask;
    this.completedTasks++;
    worker.completed++;
    this.tasks.delete(task.id);
    worker.currentTask = null;
    console.log(`  ✓ ${workerId} completed ${task.id} (${worker.completed} total)`);

    this.stigmergy.deposit(
      workerId,
      PheromoneType.RESOURCE,
      { taskType: task.type },
      0.9,
      new Map([['taskId', task.id]])
    );
  }

  shutdown() {
    for (const worker of this.workers.values()) {
      if (worker.interval) clearInterval(worker.interval);
    }
    this.stigmergy.shutdown();
  }
}

// --- Run ---

console.log('=== TASK DISTRIBUTION VIA STIGMERGY ===\n');

const pool = new DistributedTaskPool();

pool.registerWorker('worker-1', ['data-processing']);
pool.registerWorker('worker-2', ['data-processing', 'image-analysis']);
pool.registerWorker('worker-3', ['image-analysis']);

pool.submitTask({ id: 'task-1', type: 'data-processing', priority: 0.8, estimatedTime: 1500 });
pool.submitTask({ id: 'task-2', type: 'image-analysis', priority: 0.9, estimatedTime: 2000 });
pool.submitTask({ id: 'task-3', type: 'data-processing', priority: 0.7, estimatedTime: 1000 });
pool.submitTask({ id: 'task-4', type: 'image-analysis', priority: 0.6, estimatedTime: 1500 });

// Monitor
const monitor = setInterval(() => {
  if (pool.tasks.size === 0 && pool.completedTasks === 4) {
    console.log(`\nAll ${pool.completedTasks} tasks completed!`);
    clearInterval(monitor);
    pool.shutdown();
    process.exit(0);
  }
}, 500);

// Safety timeout
setTimeout(() => {
  console.log('\nTimeout — shutting down');
  clearInterval(monitor);
  pool.shutdown();
  process.exit(0);
}, 15000);
