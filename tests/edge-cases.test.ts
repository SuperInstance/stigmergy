import { Stigmergy, PheromoneType, TrailFollower } from '../src/stigmergy';
import type { Position, Pheromone } from '../src/stigmergy';

// ============================================================================
// EDGE CASE AND ROBUSTNESS TESTS
// ============================================================================

describe('Stigmergy edge cases', () => {
  let stig: Stigmergy;

  beforeEach(() => {
    stig = new Stigmergy({
      maxPheromones: 100,
      evaporationInterval: 100000,
      detectionRadius: 0.5,
      reinforcementRate: 0.1,
    });
  });

  afterEach(() => stig.shutdown());

  // --- Strength boundaries ---

  test('strength exactly 0 is clamped', () => {
    const p = stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' }, 0);
    expect(p.strength).toBe(0);
  });

  test('strength exactly 1 is allowed', () => {
    const p = stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' }, 1);
    expect(p.strength).toBe(1);
  });

  test('strength above 1 is clamped to 1', () => {
    const p = stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' }, 5);
    expect(p.strength).toBe(1);
  });

  test('strength below 0 is clamped to 0', () => {
    const p = stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' }, -3);
    expect(p.strength).toBe(0);
  });

  test('negative strength pheromone evaporates immediately', () => {
    const p = stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' }, -1);
    stig.evaporate();
    expect(stig.activePheromones).toBe(0);
  });

  // --- Default strength ---

  test('default strength is 1.0', () => {
    const p = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    expect(p.strength).toBe(1);
  });

  // --- Follow reinforcement math ---

  test('follow reinforces by reinforcementRate', () => {
    const p = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.5);
    stig.follow(p.id, 'a2');
    expect(p.strength).toBeCloseTo(0.6, 5);
  });

  test('follow does not exceed 1.0', () => {
    const p = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.95);
    stig.follow(p.id, 'a2');
    expect(p.strength).toBe(1);
  });

  test('multiple follows accumulate', () => {
    const p = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.3);
    stig.follow(p.id, 'a2');
    stig.follow(p.id, 'a3');
    stig.follow(p.id, 'a4');
    expect(p.strength).toBeCloseTo(0.6, 5);
  });

  // --- Detection ---

  test('detect with no pheromones returns empty', () => {
    const result = stig.detect({ topic: 'x' });
    expect(result.nearby).toHaveLength(0);
    expect(result.strongest).toBeNull();
  });

  test('detect at exact boundary of radius', () => {
    stig = new Stigmergy({
      evaporationInterval: 100000,
      detectionRadius: 1.0,
    });
    stig.deposit('a1', PheromoneType.PATHWAY, { coordinates: [0, 1] }, 0.8);
    const result = stig.detect({ coordinates: [0, 0] });
    expect(result.nearby).toHaveLength(1);
  });

  test('detect just outside radius', () => {
    stig = new Stigmergy({
      evaporationInterval: 100000,
      detectionRadius: 0.99,
    });
    stig.deposit('a1', PheromoneType.PATHWAY, { coordinates: [0, 1] }, 0.8);
    const result = stig.detect({ coordinates: [0, 0] });
    expect(result.nearby).toHaveLength(0);
  });

  test('detect returns strongest first', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'shared' }, 0.3);
    stig.deposit('a2', PheromoneType.PATHWAY, { topic: 'shared' }, 0.9);
    stig.deposit('a3', PheromoneType.PATHWAY, { topic: 'shared' }, 0.6);
    const result = stig.detect({ topic: 'shared' });
    expect(result.strongest!.strength).toBe(0.9);
    expect(result.nearby[0].strength).toBe(0.9);
    expect(result.nearby[1].strength).toBe(0.6);
    expect(result.nearby[2].strength).toBe(0.3);
  });

  test('detect filters by single type', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.8);
    stig.deposit('a2', PheromoneType.DANGER, { topic: 'x' }, 0.8);
    const result = stig.detect({ topic: 'x' }, [PheromoneType.DANGER]);
    expect(result.nearby).toHaveLength(1);
    expect(result.nearby[0].type).toBe(PheromoneType.DANGER);
  });

  test('detect filters by multiple types', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.8);
    stig.deposit('a2', PheromoneType.DANGER, { topic: 'x' }, 0.8);
    stig.deposit('a3', PheromoneType.NEST, { topic: 'x' }, 0.8);
    const result = stig.detect(
      { topic: 'x' },
      [PheromoneType.DANGER, PheromoneType.NEST]
    );
    expect(result.nearby).toHaveLength(2);
  });

  // --- Distance / position matching ---

  test('different topics have distance 1', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.8);
    const result = stig.detect({ topic: 'y' });
    expect(result.nearby).toHaveLength(0);
  });

  test('same taskType matches', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { taskType: 'build' }, 0.8);
    const result = stig.detect({ taskType: 'build' });
    expect(result.nearby).toHaveLength(1);
  });

  test('same contextHash matches', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { contextHash: 'abc123' }, 0.8);
    const result = stig.detect({ contextHash: 'abc123' });
    expect(result.nearby).toHaveLength(1);
  });

  test('no matching position fields defaults to distance 1', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.8);
    const result = stig.detect({ taskType: 'build' });
    expect(result.nearby).toHaveLength(0);
  });

  test('3D coordinates only use first 2 dims (2D distance)', () => {
    // The distance function uses coordinates[0] and coordinates[1] only.
    // sqrt(1+1) = 1.414 < 1.5 → within radius despite 3rd dimension
    stig = new Stigmergy({
      evaporationInterval: 100000,
      detectionRadius: 1.5,
    });
    stig.deposit('a1', PheromoneType.PATHWAY, { coordinates: [1, 1, 1] }, 0.8);
    const result = stig.detect({ coordinates: [0, 0, 0] });
    // sqrt(1^2 + 1^2) = 1.414 < 1.5 (only 2D distance is computed)
    expect(result.nearby).toHaveLength(1);
  });

  test('2D coordinates calculate Euclidean distance', () => {
    stig = new Stigmergy({
      evaporationInterval: 100000,
      detectionRadius: 2.1,
    });
    stig.deposit('a1', PheromoneType.PATHWAY, { coordinates: [3, 4] }, 0.8);
    const result = stig.detect({ coordinates: [0, 0] });
    // sqrt(9+16) = 5 > 2.1
    expect(result.nearby).toHaveLength(0);

    stig.deposit('a2', PheromoneType.PATHWAY, { coordinates: [1.5, 2] }, 0.8);
    const result2 = stig.detect({ coordinates: [0, 0] });
    // sqrt(2.25+4) = 2.5 > 2.1
    expect(result2.nearby).toHaveLength(0);

    stig.deposit('a3', PheromoneType.PATHWAY, { coordinates: [1.5, 1] }, 0.8);
    const result3 = stig.detect({ coordinates: [0, 0] });
    // sqrt(2.25+1) = 1.803 < 2.1
    expect(result3.nearby).toHaveLength(1);
  });

  // --- Stats tracking ---

  test('stats track by type', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' });
    stig.deposit('a1', PheromoneType.DANGER, { topic: 'x' });
    const stats = stig.getStats();
    expect(stats.byType[PheromoneType.PATHWAY]).toBe(1);
    expect(stats.byType[PheromoneType.DANGER]).toBe(2);
  });

  test('stats decrement on evaporation', () => {
    const p = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.005);
    // Use very short halfLife
    p.halfLife = 1;
    stig.evaporate();
    const stats = stig.getStats();
    expect(stats.byType[PheromoneType.PATHWAY]).toBe(0);
    expect(stats.totalEvaporated).toBe(1);
  });

  test('stats track followed count', () => {
    const p = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    stig.follow(p.id, 'a2');
    stig.follow(p.id, 'a3');
    const stats = stig.getStats();
    expect(stats.totalFollowed).toBe(2);
  });

  test('getStats returns a copy', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    const s1 = stig.getStats();
    const s2 = stig.getStats();
    s1.totalDeposited = 999;
    expect(s2.totalDeposited).toBe(1);
  });

  // --- Events ---

  test('deposit event includes type and sourceId', () => {
    const events: any[] = [];
    stig.on('deposit', (e) => events.push(e));
    stig.deposit('agent-x', PheromoneType.RECRUIT, { topic: 'y' });
    expect(events).toHaveLength(1);
    expect(events[0].sourceId).toBe('agent-x');
    expect(events[0].type).toBe(PheromoneType.RECRUIT);
  });

  test('reset emits reset event', () => {
    let called = false;
    stig.on('reset', () => { called = true; });
    stig.reset();
    expect(called).toBe(true);
  });

  test('evaporated event includes count', () => {
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.001);
    const p = stig.detect({ topic: 'x' }).nearby[0];
    p.halfLife = 1;
    let event: any = null;
    stig.on('evaporated', (e) => { event = e; });
    stig.evaporate();
    expect(event).not.toBeNull();
    expect(event.count).toBe(1);
  });

  // --- MaxPheromones eviction ---

  test('evicts oldest when at capacity', () => {
    stig = new Stigmergy({
      maxPheromones: 3,
      evaporationInterval: 100000,
    });
    const p1 = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    const p2 = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    const p3 = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    expect(stig.activePheromones).toBe(3);

    const p4 = stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' });
    expect(stig.activePheromones).toBe(3);
    // p1 should have been evicted (it was deposited first)
    expect(stig.getStats().totalEvaporated).toBe(1);
  });

  // --- Shutdown ---

  test('shutdown prevents further evaporation', (done) => {
    stig = new Stigmergy({
      evaporationInterval: 50,
    });
    stig.deposit('a1', PheromoneType.PATHWAY, { topic: 'x' }, 0.5);
    stig.shutdown();

    setTimeout(() => {
      // No evaporation should have occurred after shutdown
      expect(stig.activePheromones).toBe(1);
      done();
    }, 150);
  });
});

// ============================================================================
// TRAIL FOLLOWER EXTENSIVE TESTS
// ============================================================================

describe('TrailFollower extensive', () => {
  let stig: Stigmergy;
  let follower: TrailFollower;

  beforeEach(() => {
    stig = new Stigmergy({
      evaporationInterval: 100000,
      detectionRadius: 0.5,
      reinforcementRate: 0.15,
    });
    follower = new TrailFollower(stig, 'scout-1');
  });

  afterEach(() => stig.shutdown());

  test('followTrail returns direction of found pheromone', () => {
    const pos: Position = { topic: 'food-trail' };
    stig.deposit('leader', PheromoneType.RESOURCE, pos, 0.8);
    const result = follower.followTrail(pos, PheromoneType.RESOURCE);
    expect(result.found).toBe(true);
    expect(result.direction).toBeDefined();
    expect(result.direction!.topic).toBe('food-trail');
  });

  test('followTrail ignores wrong types', () => {
    const pos: Position = { topic: 'shared' };
    stig.deposit('leader', PheromoneType.DANGER, pos, 0.9);
    const result = follower.followTrail(pos, PheromoneType.RESOURCE);
    expect(result.found).toBe(false);
  });

  test('leaveSignal deposits with agentId as source', () => {
    const p = follower.leaveSignal(PheromoneType.NEST, { topic: 'home' });
    expect(p.sourceId).toBe('scout-1');
  });

  test('leaveSignal with custom strength and metadata', () => {
    const meta = new Map([['priority', 'high']]);
    const p = follower.leaveSignal(
      PheromoneType.RECRUIT,
      { topic: 'help' },
      0.5,
      meta
    );
    expect(p.strength).toBe(0.5);
    expect(p.metadata.get('priority')).toBe('high');
  });

  test('followedCount tracks unique trails', () => {
    const pos1: Position = { topic: 'trail-a' };
    const pos2: Position = { topic: 'trail-b' };
    stig.deposit('a', PheromoneType.PATHWAY, pos1);
    stig.deposit('b', PheromoneType.PATHWAY, pos2);

    follower.followTrail(pos1, PheromoneType.PATHWAY);
    follower.followTrail(pos2, PheromoneType.PATHWAY);

    expect(follower.getFollowedCount()).toBe(2);
  });

  test('same trail followed twice counts once', () => {
    const pos: Position = { topic: 'trail' };
    stig.deposit('a', PheromoneType.PATHWAY, pos);

    follower.followTrail(pos, PheromoneType.PATHWAY);
    follower.followTrail(pos, PheromoneType.PATHWAY);

    expect(follower.getFollowedCount()).toBe(1);
  });

  test('followTrail on empty environment returns not found', () => {
    const result = follower.followTrail({ topic: 'x' }, PheromoneType.PATHWAY);
    expect(result.found).toBe(false);
    expect(result.pheromone).toBeNull();
  });
});

// ============================================================================
// CONCURRENT / BULK OPERATIONS
// ============================================================================

describe('bulk operations', () => {
  let stig: Stigmergy;

  beforeEach(() => {
    stig = new Stigmergy({
      maxPheromones: 500,
      evaporationInterval: 100000,
    });
  });

  afterEach(() => {
    stig.shutdown();
  });

  test('deposit 100 pheromones', () => {
    for (let i = 0; i < 100; i++) {
      stig.deposit(
        `agent-${i}`,
        PheromoneType.PATHWAY,
        { coordinates: [i * 0.01, 0] },
        0.5
      );
    }
    expect(stig.activePheromones).toBe(100);
    expect(stig.getStats().totalDeposited).toBe(100);
  });

  test('detect among many pheromones', () => {
    for (let i = 0; i < 50; i++) {
      stig.deposit('a', PheromoneType.PATHWAY, { topic: 'cluster' }, 0.5);
    }
    const result = stig.detect({ topic: 'cluster' });
    expect(result.nearby).toHaveLength(50);
    expect(result.strongest).not.toBeNull();
  });

  test('evaporation removes bulk weak pheromones', () => {
    for (let i = 0; i < 20; i++) {
      const p = stig.deposit('a', PheromoneType.PATHWAY, { topic: 'x' }, 0.005);
      p.halfLife = 1;
    }
    stig.evaporate();
    expect(stig.activePheromones).toBe(0);
  });

  test('reset clears everything', () => {
    stig.deposit('a', PheromoneType.PATHWAY, { topic: 'x' });
    stig.deposit('a', PheromoneType.DANGER, { topic: 'x' });
    stig.follow(stig.detect({ topic: 'x' }).nearby[0].id, 'b');

    stig.reset();

    expect(stig.activePheromones).toBe(0);
    const stats = stig.getStats();
    expect(stats.totalDeposited).toBe(0);
    expect(stats.totalFollowed).toBe(0);
  });
});
