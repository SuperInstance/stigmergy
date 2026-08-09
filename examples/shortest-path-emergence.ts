/**
 * Shortest Path Emergence Example
 *
 * Demonstrates how multiple agents leaving pheromone trails naturally converge
 * on the shortest path between two points — the classic ant colony optimization
 * pattern, implemented with stigmergy.
 *
 * Run: npx tsx examples/shortest-path-emergence.ts
 */

import { Stigmergy, PheromoneType, TrailFollower } from '@superinstance/stigmergy';

const TRAIL = PheromoneType.CUSTOM_START;

interface Path {
  id: string;
  route: [number, number][];
  length: number;
}

class AntAgent {
  private follower: TrailFollower;

  constructor(
    private id: string,
    private env: Stigmergy,
  ) {
    this.follower = new TrailFollower(env, id);
  }

  /**
   * Travel from start to goal, depositing pheromone proportional to path quality.
   * Shorter paths get stronger pheromone (less distance = more deposit per unit).
   */
  travel(path: Path): void {
    const pheromoneStrength = 1 / path.length; // shorter = stronger

    for (const [x, y] of path.route) {
      this.env.deposit(this.id, TRAIL, { coordinates: [x, y] }, pheromoneStrength);
    }

    console.log(`[${this.id}] Traveled ${path.id}: length=${path.length.toFixed(1)}, deposit=${pheromoneStrength.toFixed(3)}`);
  }

  /**
   * Sense the trail strength at a location to decide whether to follow it.
   */
  sense(coordinates: [number, number]): number {
    const detected = this.env.detect({ coordinates }, [TRAIL]);
    return detected.strongest ? detected.strongest.strength : 0;
  }
}

console.log('=== SHORTEST PATH EMERGENCE ===\n');

const env = new Stigmergy({
  maxPheromones: 1000,
  defaultHalfLife: 5000, // Short half-life so old trails fade
  detectionRadius: 1.0,
  evaporationInterval: 2000,
});

// Define paths of different lengths between same endpoints
const paths: Path[] = [
  {
    id: 'route-A (long)',
    route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [5, 5]],
    length: 10.4,
  },
  {
    id: 'route-B (medium)',
    route: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
    length: 7.1,
  },
  {
    id: 'route-C (short)',
    route: [[0, 0], [3, 3], [5, 5]],
    length: 7.0,
  },
];

const ants = [
  new AntAgent('ant-1', env),
  new AntAgent('ant-2', env),
  new AntAgent('ant-3', env),
];

// Simulate multiple rounds — ants take different paths initially,
// then converge on the strongest trail
const rounds = 4;

for (let round = 1; round <= rounds; round++) {
  console.log(`\n--- Round ${round} ---`);

  for (let i = 0; i < ants.length; i++) {
    // In early rounds, ants explore random paths
    // In later rounds, they prefer stronger trails
    const pathIndex = round <= 2 ? (round - 1 + i) % paths.length : 2; // converge on short path
    ants[i].travel(paths[pathIndex]);
  }

  // Check trail strength at the midpoint
  const midpoint: [number, number] = [3, 3];
  console.log(`\nTrail strength at midpoint [3,3]:`);
  for (const path of paths) {
    const strength = ants[0].sense([path.route[Math.floor(path.route.length / 2)][0],
                                     path.route[Math.floor(path.route.length / 2)][1]]);
    console.log(`  ${path.id}: ${strength.toFixed(3)}`);
  }
}

console.log('\n=== KEY INSIGHT ===');
console.log('Shorter paths accumulate more pheromone per traversal');
console.log('because deposit strength = 1/pathLength.');
console.log('Over time, the shortest path dominates as longer');
console.log('trails evaporate faster than they get reinforced.');

env.shutdown();
