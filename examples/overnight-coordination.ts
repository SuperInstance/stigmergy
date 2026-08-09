/**
 * OVERNIGHT COORDINATION EXAMPLE
 *
 * How a fleet of agents could use stigmergy to coordinate overnight work
 * without direct communication. Each agent leaves pheromone trails for
 * what it found, fixed, or flagged. The morning report is just reading
 * the strongest trails.
 */

import { Stigmergy, PheromoneType, TrailFollower } from '../src/stigmergy';

// Create the shared environment
const env = new Stigmergy({
  maxPheromones: 5000,
  defaultHalfLife: 3600000,  // 1 hour — overnight signals decay slowly
  evaporationInterval: 60000,
  detectionRadius: 0.5,
});

// --- Agent: Creative Worker ---
const creative = new TrailFollower(env, 'creative-agent');

// Creative agent finishes a piece, leaves a pathway signal
creative.leaveSignal(
  PheromoneType.PATHWAY,
  { topic: 'ai-writings' },
  0.9,
  new Map([['piece', 'pheromone-trails-on-the-factory-floor'], ['status', 'done']])
);

// Creative agent finds something interesting, flags it as a resource
creative.leaveSignal(
  PheromoneType.RESOURCE,
  { topic: 'ai-writings' },
  0.7,
  new Map([['finding', 'hermit-crab-metaphor-resonates'], ['followup', 'expand-into-series']])
);

// --- Agent: Engineering Worker ---
const engineering = new TrailFollower(env, 'engineering-agent');

// Engineering agent fixes a bug, leaves a pathway
engineering.leaveSignal(
  PheromoneType.PATHWAY,
  { topic: 'stigmergy' },
  0.95,
  new Map([['fix', 'evaporation-incremental-decay'], ['tests', '+2']])
);

// Engineering agent encounters a tricky problem, recruits help
engineering.leaveSignal(
  PheromoneType.RECRUIT,
  { topic: 'sensor-bridge' },
  0.6,
  new Map([['issue', 'alert-suppression-not-implemented'], ['priority', 'medium']])
);

// --- Agent: Negative Space Scout ---
const scout = new TrailFollower(env, 'scout-agent');

// Scout finds an unexplored repo, leaves a resource signal
scout.leaveSignal(
  PheromoneType.RESOURCE,
  { topic: 'unexplored' },
  0.5,
  new Map([['repo', 'confidence-cascade'], ['potential', 'high'], ['read', 'false']])
);

// Scout finds something concerning, marks as danger
scout.leaveSignal(
  PheromoneType.DANGER,
  { topic: 'unexplored' },
  0.8,
  new Map([['repo', 'vessel-agent-system'], ['issue', 'broken-tests'], ['count', '11']])
);

// --- Morning Report ---
console.log('=== MORNING REPORT ===\n');

// Check the pathway trails (completed work)
const pathways = env.detect({ topic: 'ai-writings' }, [PheromoneType.PATHWAY]);
console.log(`Completed creative pieces: ${pathways.nearby.length}`);
for (const p of pathways.nearby) {
  console.log(`  - ${p.metadata.get('piece')} (${(p.strength * 100).toFixed(0)}%)`);
}

const engPaths = env.detect({ topic: 'stigmergy' }, [PheromoneType.PATHWAY]);
console.log(`\nEngineering fixes: ${engPaths.nearby.length}`);
for (const p of engPaths.nearby) {
  console.log(`  - ${p.metadata.get('fix')} (${(p.strength * 100).toFixed(0)}%)`);
}

// Check recruit signals (things that need help)
const recruits = env.detect({ topic: 'sensor-bridge' }, [PheromoneType.RECRUIT]);
console.log(`\nNeeds attention: ${recruits.nearby.length}`);
for (const r of recruits.nearby) {
  console.log(`  - ${r.metadata.get('issue')} (priority: ${r.metadata.get('priority')})`);
}

// Check danger signals (problems found)
const dangers = env.detect({ topic: 'unexplored' }, [PheromoneType.DANGER]);
console.log(`\nProblems found: ${dangers.nearby.length}`);
for (const d of dangers.nearby) {
  console.log(`  - ${d.metadata.get('repo')}: ${d.metadata.get('issue')}`);
}

// Check resources (discoveries)
const resources = env.detect({ topic: 'unexplored' }, [PheromoneType.RESOURCE]);
console.log(`\nNew discoveries: ${resources.nearby.length}`);
for (const r of resources.nearby) {
  console.log(`  - ${r.metadata.get('repo')} (potential: ${r.metadata.get('potential')})`);
}

// Stats
const stats = env.getStats();
console.log(`\n=== FLEET STATS ===`);
console.log(`Total signals deposited: ${stats.totalDeposited}`);
console.log(`By type:`, stats.byType);

env.shutdown();
