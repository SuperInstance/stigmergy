// Edge case and colony-behavior tests for Stigmergy
// Overnight watch — 2026-08-10

import { Stigmergy, PheromoneType, TrailFollower } from '../src/stigmergy';
import type { Position } from '../src/stigmergy';

// ============================================================================
// COLONY BEHAVIOR TESTS
// ============================================================================

describe('colony behavior', () => {
  test('multiple agents reinforcing the same trail converges to full strength', () => {
    const stigmergy = new Stigmergy({
      evaporationInterval: 100000,
      reinforcementRate: 0.3,
    });

    const trailhead: Position = { coordinates: [0, 0] };
    const pheromone = stigmergy.deposit('scout', PheromoneType.PATHWAY, trailhead, 0.1);

    // Multiple agents follow and reinforce
    stigmergy.follow(pheromone.id, 'agent-1');
    expect(pheromone.strength).toBeCloseTo(0.4, 5);

    stigmergy.follow(pheromone.id, 'agent-2');
    expect(pheromone.strength).toBeCloseTo(0.7, 5);

    stigmergy.follow(pheromone.id, 'agent-3');
    expect(pheromone.strength).toBeCloseTo(1.0, 5);

    // Can't exceed 1.0
    stigmergy.follow(pheromone.id, 'agent-4');
    expect(pheromone.strength).toBe(1.0);

    stigmergy.shutdown();
  });

  test('trail network emerges from multiple deposits at different positions', () => {
    const stigmergy = new Stigmergy({
      detectionRadius: 1.0,
      evaporationInterval: 100000,
    });

    // Simulate ants exploring: some paths get more traffic
    const positions = [
      { coordinates: [0, 0] },
      { coordinates: [0.1, 0] },
      { coordinates: [0.2, 0] },
      { coordinates: [0.3, 0] },
    ];

    // Scout lays initial trail
    positions.forEach((pos, i) => {
      stigmergy.deposit('scout', PheromoneType.PATHWAY, pos, 0.3);
    });

    // Foragers reinforce the middle section (the "good" path)
    const middle = stigmergy.detect({ coordinates: [0.1, 0] });
    middle.nearby.forEach((p) => stigmergy.follow(p.id, 'forager-1'));

    // The reinforced section should be stronger
    const after = stigmergy.detect({ coordinates: [0.1, 0] });
    const reinforced = after.nearby.find((p) => p.sourceId === 'scout');
    expect(reinforced!.strength).toBeGreaterThan(0.3);

    stigmergy.shutdown();
  });

  test('danger signals persist alongside pathway signals', () => {
    const stigmergy = new Stigmergy({
      detectionRadius: 1.0,
      evaporationInterval: 100000,
    });

    const pos = { coordinates: [0, 0] };

    // Pathway and danger at the same location
    stigmergy.deposit('scout', PheromoneType.PATHWAY, pos, 0.8);
    stigmergy.deposit('sentinel', PheromoneType.DANGER, pos, 1.0);

    // Agent can detect both
    const all = stigmergy.detect(pos);
    expect(all.nearby.length).toBe(2);

    // Or filter by type
    const dangers = stigmergy.detect(pos, [PheromoneType.DANGER]);
    expect(dangers.nearby.length).toBe(1);
    expect(dangers.strongest!.type).toBe(PheromoneType.DANGER);

    const paths = stigmergy.detect(pos, [PheromoneType.PATHWAY]);
    expect(paths.nearby.length).toBe(1);
    expect(paths.strongest!.type).toBe(PheromoneType.PATHWAY);

    stigmergy.shutdown();
  });
});

// ============================================================================
// STATS IMMUTABILITY
// ============================================================================

describe('stats immutability', () => {
  test('getStats returns a copy, not the internal object', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    stigmergy.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);

    const stats1 = stigmergy.getStats();
    const stats2 = stigmergy.getStats();

    // Different object references
    expect(stats1).not.toBe(stats2);
    expect(stats1.byType).not.toBe(stats2.byType);

    // But same values
    expect(stats1.totalDeposited).toBe(stats2.totalDeposited);
    expect(stats1.byType[PheromoneType.PATHWAY]).toBe(stats2.byType[PheromoneType.PATHWAY]);

    // Mutating the returned copy should not affect the internal state
    stats1.totalDeposited = 999;
    stats1.byType[PheromoneType.PATHWAY] = 999;

    const stats3 = stigmergy.getStats();
    expect(stats3.totalDeposited).toBe(1);
    expect(stats3.byType[PheromoneType.PATHWAY]).toBe(1);

    stigmergy.shutdown();
  });
});

// ============================================================================
// SHUTDOWN SAFETY
// ============================================================================

describe('shutdown safety', () => {
  test('shutdown is idempotent (can be called multiple times)', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    stigmergy.shutdown();
    stigmergy.shutdown();
    stigmergy.shutdown();

    // Should not throw
    expect(true).toBe(true);
  });

  test('operations after shutdown still work (just no evaporation)', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    stigmergy.shutdown();

    // These should all still work
    const pheromone = stigmergy.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);
    expect(pheromone).toBeDefined();

    const detected = stigmergy.detect({ coordinates: [0, 0] });
    expect(detected.nearby.length).toBe(1);

    stigmergy.follow(pheromone.id, 'b');
    stigmergy.evaporate(); // Manual evaporation still works
    stigmergy.reset();
    expect(stigmergy.activePheromones).toBe(0);
  });
});

// ============================================================================
// RESET BEHAVIOR
// ============================================================================

describe('reset behavior', () => {
  test('reset emits an event', (done) => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    stigmergy.on('reset', () => {
      expect(true).toBe(true);
      stigmergy.shutdown();
      done();
    });

    stigmergy.reset();
  });

  test('reset clears stats including byType breakdown', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    stigmergy.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('a', PheromoneType.DANGER, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('a', PheromoneType.NEST, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('a', PheromoneType.RESOURCE, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('a', PheromoneType.RECRUIT, { coordinates: [0, 0] }, 1.0);

    stigmergy.reset();

    const stats = stigmergy.getStats();
    expect(stats.totalDeposited).toBe(0);
    expect(stats.totalEvaporated).toBe(0);
    expect(stats.totalFollowed).toBe(0);
    expect(stats.byType[PheromoneType.PATHWAY]).toBe(0);
    expect(stats.byType[PheromoneType.DANGER]).toBe(0);
    expect(stats.byType[PheromoneType.NEST]).toBe(0);
    expect(stats.byType[PheromoneType.RESOURCE]).toBe(0);
    expect(stats.byType[PheromoneType.RECRUIT]).toBe(0);

    stigmergy.shutdown();
  });
});

// ============================================================================
// TRAIL FOLLOWER EXTENDED
// ============================================================================

describe('TrailFollower extended behavior', () => {
  test('follower accumulates unique trails only', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    const follower = new TrailFollower(stigmergy, 'ant-1');

    const pos: Position = { coordinates: [1, 1] };
    const pheromone = stigmergy.deposit('queen', PheromoneType.PATHWAY, pos, 1.0);

    // Follow the same trail multiple times
    follower.followTrail(pos, PheromoneType.PATHWAY);
    follower.followTrail(pos, PheromoneType.PATHWAY);
    follower.followTrail(pos, PheromoneType.PATHWAY);

    // Should count as 1 unique trail
    expect(follower.getFollowedCount()).toBe(1);

    stigmergy.shutdown();
  });

  test('follower can leave multiple signal types', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    const follower = new TrailFollower(stigmergy, 'scout-1');

    const pos: Position = { coordinates: [5, 5] };

    follower.leaveSignal(PheromoneType.PATHWAY, pos, 1.0);
    follower.leaveSignal(PheromoneType.RESOURCE, pos, 0.8);
    follower.leaveSignal(PheromoneType.DANGER, { coordinates: [3, 3] }, 1.0);

    const stats = stigmergy.getStats();
    expect(stats.totalDeposited).toBe(3);
    expect(stats.byType[PheromoneType.PATHWAY]).toBe(1);
    expect(stats.byType[PheromoneType.RESOURCE]).toBe(1);
    expect(stats.byType[PheromoneType.DANGER]).toBe(1);

    stigmergy.shutdown();
  });

  test('follower leaves signals with its own agentId', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    const follower = new TrailFollower(stigmergy, 'unique-scout');

    const pheromone = follower.leaveSignal(
      PheromoneType.NEST,
      { coordinates: [0, 0] },
      1.0
    );

    expect(pheromone.sourceId).toBe('unique-scout');

    stigmergy.shutdown();
  });
});

// ============================================================================
// EDGE CASES: EMPTY SYSTEM
// ============================================================================

describe('empty system edge cases', () => {
  test('detect on empty system returns empty results', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    const result = stigmergy.detect({ coordinates: [0, 0] });
    expect(result.nearby).toEqual([]);
    expect(result.strongest).toBeNull();

    stigmergy.shutdown();
  });

  test('detect on empty system with type filter returns empty results', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    const result = stigmergy.detect(
      { topic: 'nothing' },
      [PheromoneType.PATHWAY, PheromoneType.DANGER]
    );
    expect(result.nearby).toEqual([]);
    expect(result.strongest).toBeNull();

    stigmergy.shutdown();
  });

  test('getStats on fresh system returns zeros', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    const stats = stigmergy.getStats();
    expect(stats.totalDeposited).toBe(0);
    expect(stats.totalEvaporated).toBe(0);
    expect(stats.totalFollowed).toBe(0);

    Object.values(stats.byType).forEach((count) => {
      expect(count).toBe(0);
    });

    stigmergy.shutdown();
  });

  test('evaporate on empty system is a no-op', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    expect(() => stigmergy.evaporate()).not.toThrow();
    expect(stigmergy.activePheromones).toBe(0);

    stigmergy.shutdown();
  });
});

// ============================================================================
// COORDINATE EDGE CASES
// ============================================================================

describe('coordinate edge cases', () => {
  test('3D coordinates use only first two dimensions for distance', () => {
    const stigmergy = new Stigmergy({
      detectionRadius: 1.0,
      evaporationInterval: 100000,
    });

    // Deposit at [0, 0, 100] — z is ignored in distance calc
    stigmergy.deposit('agent', PheromoneType.PATHWAY, { coordinates: [0, 0, 100] }, 1.0);

    // Detect from [0, 0, 0] — should find it because x,y distance is 0
    const result = stigmergy.detect({ coordinates: [0, 0, 0] });
    expect(result.nearby.length).toBe(1);

    stigmergy.shutdown();
  });

  test('negative coordinates work correctly', () => {
    const stigmergy = new Stigmergy({
      detectionRadius: 1.0,
      evaporationInterval: 100000,
    });

    stigmergy.deposit('agent', PheromoneType.PATHWAY, { coordinates: [-5, -5] }, 1.0);

    const detected = stigmergy.detect({ coordinates: [-5, -5] });
    expect(detected.nearby.length).toBe(1);

    // Distance from [-5,-5] to [-6,-5] = 1.0, which is exactly the radius (inclusive)
    const onBoundary = stigmergy.detect({ coordinates: [-6, -5] });
    expect(onBoundary.nearby.length).toBe(1);

    // Slightly beyond boundary
    const beyond = stigmergy.detect({ coordinates: [-6.1, -5] });
    expect(beyond.nearby.length).toBe(0);

    stigmergy.shutdown();
  });

  test('default position key when no identifying fields', () => {
    const stigmergy = new Stigmergy({
      detectionRadius: 0.5,
      evaporationInterval: 100000,
    });

    // Empty position — should use 'default' key
    stigmergy.deposit('agent', PheromoneType.PATHWAY, {}, 1.0);

    // Distance between two empty positions is 1 (no matching fields)
    const result = stigmergy.detect({});
    expect(result.nearby.length).toBe(0); // distance is 1, > 0.5

    stigmergy.shutdown();
  });
});

// ============================================================================
// PHEROMONE TYPE COVERAGE
// ============================================================================

describe('all pheromone types', () => {
  test('all five types can be deposited and detected', () => {
    const stigmergy = new Stigmergy({
      detectionRadius: 0.5,
      evaporationInterval: 100000,
    });

    const pos: Position = { topic: 'shared-topic' };

    Object.values(PheromoneType).forEach((type) => {
      stigmergy.deposit('agent', type, pos, 1.0);
    });

    const all = stigmergy.detect(pos);
    expect(all.nearby.length).toBe(5);

    const stats = stigmergy.getStats();
    Object.values(PheromoneType).forEach((type) => {
      expect(stats.byType[type]).toBe(1);
    });

    stigmergy.shutdown();
  });
});
