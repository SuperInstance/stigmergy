/**
 * TypeScript Agent Coordination Example
 *
 * Demonstrates stigmergic coordination between heterogeneous agents using
 * pheromone trails for indirect task selection. Agents don't communicate
 * directly — they read the environment and act on what they find.
 *
 * Run: npx tsx examples/ts-agent-coordination.ts
 */

import {
  Stigmergy,
  PheromoneType,
  TrailFollower,
  type Pheromone,
} from '@superinstance/stigmergy';

// --- Custom pheromone types for this domain ---

const EXPLORATION = PheromoneType.CUSTOM_START;
const HARVEST = PheromoneType.CUSTOM_START + 1;
const DANGER = PheromoneType.CUSTOM_START + 2;

// --- Agent types ---

interface ScoutReport {
  region: string;
  resourceQuality: number;
  hazardLevel: number;
  coordinates: [number, number];
}

class ScoutAgent {
  constructor(
    private id: string,
    private env: Stigmergy,
  ) {}

  scout(report: ScoutReport): void {
    const { region, resourceQuality, hazardLevel, coordinates } = report;

    console.log(`[${this.id}] Scouting ${region}: quality=${resourceQuality}, hazard=${hazardLevel}`);

    // Leave resource trail if quality is good
    if (resourceQuality > 0.5) {
      this.env.deposit(this.id, HARVEST, { coordinates, region }, resourceQuality);
    }

    // Leave danger signal if hazardous
    if (hazardLevel > 0.7) {
      this.env.deposit(this.id, DANGER, { coordinates, region }, hazardLevel);
    }

    // Always leave exploration marker
    this.env.deposit(this.id, EXPLORATION, { coordinates, region }, 0.3);
  }
}

class HarvesterAgent {
  private follower: TrailFollower;

  constructor(
    private id: string,
    private env: Stigmergy,
  ) {
    this.follower = new TrailFollower(env, id);
  }

  findBestResource(coordinates: [number, number]): Pheromone | null {
    // First check for danger — avoid hazardous areas
    const danger = this.env.detect({ coordinates }, [DANGER]);
    if (danger.strongest && danger.strongest.strength > 0.5) {
      console.log(`[${this.id}] ⚠ Avoiding ${danger.strongest.context.region} (danger: ${danger.strongest.strength.toFixed(2)})`);
      return null;
    }

    // Follow the harvest trail
    const result = this.follower.followTrail({ coordinates }, HARVEST);
    if (result.found && result.pheromone) {
      const region = result.pheromone.context.region as string;
      const strength = result.pheromone.strength;
      console.log(`[${this.id}] → Harvesting ${region} (trail strength: ${strength.toFixed(2)})`);
      return result.pheromone;
    }

    console.log(`[${this.id}] No harvest trails found near ${coordinates}`);
    return null;
  }
}

// --- Run simulation ---

console.log('=== STIGMERGIC AGENT COORDINATION (TypeScript) ===\n');

const env = new Stigmergy({
  maxPheromones: 500,
  defaultHalfLife: 10000,
  detectionRadius: 5.0,
  evaporationInterval: 3000,
});

const scout = new ScoutAgent('scout-α', env);
const harvester1 = new HarvesterAgent('harvester-1', env);
const harvester2 = new HarvesterAgent('harvester-2', env);

// Scouts explore and leave signals
scout.scout({ region: 'north-field', resourceQuality: 0.9, hazardLevel: 0.1, coordinates: [10, 20] });
scout.scout({ region: 'east-ridge', resourceQuality: 0.4, hazardLevel: 0.2, coordinates: [30, 10] });
scout.scout({ region: 'south-cavern', resourceQuality: 0.8, hazardLevel: 0.9, coordinates: [10, -20] });

console.log();

// Harvesters read the environment and navigate
harvester1.findBestResource([12, 19]); // Near north-field → should harvest
harvester2.findBestResource([11, -19]); // Near south-cavern → should avoid (danger)

console.log('\n--- After 5 seconds (partial evaporation) ---\n');

setTimeout(() => {
  // Re-check — danger may have partially evaporated
  harvester1.findBestResource([12, 19]);
  harvester2.findBestResource([11, -19]);

  console.log('\n=== SIMULATION COMPLETE ===');
  env.shutdown();
  process.exit(0);
}, 5000);
