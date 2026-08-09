import { Stigmergy, PheromoneType, TrailFollower } from '../src/stigmergy';
import type { Pheromone, Position } from '../src/stigmergy';

// ============================================================================
// CORE STIGMERGY TESTS
// ============================================================================

describe('Stigmergy', () => {
  let stigmergy: Stigmergy;

  beforeEach(() => {
    stigmergy = new Stigmergy({
      maxPheromones: 100,
      evaporationInterval: 100000, // Don't evaporate during tests
      detectionRadius: 0.5,
    });
  });

  afterEach(() => {
    stigmergy.shutdown();
  });

  test('deposits pheromones correctly', () => {
    const position: Position = { coordinates: [0, 0] };
    const pheromone = stigmergy.deposit(
      'agent-1',
      PheromoneType.PATHWAY,
      position,
      0.8
    );

    expect(pheromone).toBeDefined();
    expect(pheromone.type).toBe(PheromoneType.PATHWAY);
    expect(pheromone.strength).toBe(0.8);
    expect(pheromone.position).toEqual(position);
    expect(pheromone.sourceId).toBe('agent-1');
  });

  test('clamps strength to [0, 1]', () => {
    const tooHigh = stigmergy.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 5.0);
    const tooLow = stigmergy.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, -1.0);

    expect(tooHigh.strength).toBe(1);
    expect(tooLow.strength).toBe(0);
  });

  test('detects nearby pheromones', () => {
    const position: Position = { coordinates: [0, 0] };
    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, position, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.DANGER, { coordinates: [0.2, 0.2] }, 0.5);

    const detected = stigmergy.detect(position);

    expect(detected.nearby.length).toBe(2);
    expect(detected.strongest).toBeDefined();
    expect(detected.strongest!.type).toBe(PheromoneType.PATHWAY);
  });

  test('detects specific types only', () => {
    stigmergy.deposit('agent-1', PheromoneType.RESOURCE, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.DANGER, { coordinates: [0.2, 0.2] }, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [0.3, 0.3] }, 1.0);

    const resourceDetections = stigmergy.detect({ coordinates: [0, 0] }, [PheromoneType.RESOURCE]);
    expect(resourceDetections.nearby.length).toBe(1);
    expect(resourceDetections.nearby[0].type).toBe(PheromoneType.RESOURCE);

    const dangerDetections = stigmergy.detect({ coordinates: [0, 0] }, [PheromoneType.DANGER]);
    expect(dangerDetections.nearby.length).toBe(1);
  });

  test('follows pheromones and reinforces them', () => {
    const position: Position = { coordinates: [0, 0] };
    const pheromone = stigmergy.deposit('agent-1', PheromoneType.PATHWAY, position, 0.5);

    const initialStrength = pheromone.strength;

    stigmergy.follow(pheromone.id, 'agent-2');

    const detected = stigmergy.detect(position);
    expect(detected.strongest!.strength).toBeGreaterThan(initialStrength);
  });

  test('follow is a no-op for unknown pheromone id', () => {
    stigmergy.follow('nonexistent', 'agent-x');
    const stats = stigmergy.getStats();
    expect(stats.totalFollowed).toBe(0);
  });

  test('evaporates pheromones over time', () => {
    const position: Position = { coordinates: [0, 0] };
    const pheromone = stigmergy.deposit('agent-1', PheromoneType.PATHWAY, position, 0.5);

    // Age the pheromone significantly so decay applies
    (pheromone as any).createdAt = Date.now() - 1000000;
    (pheromone as any).lastDecayTime = Date.now() - 1000000;

    stigmergy.evaporate();

    const detected = stigmergy.detect(position);
    // After decay the strength should be lower than the original 0.5
    if (detected.nearby.length > 0) {
      expect(detected.nearby[0].strength).toBeLessThan(0.5);
    }
  });

  test('evaporation removes very weak pheromones', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    const pheromone = stigmergy.deposit('agent', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 0.001);
    // Make it very old so it decays below 0.01
    pheromone.createdAt = Date.now() - 999999999;
    pheromone.lastDecayTime = Date.now() - 999999999;

    stigmergy.evaporate();

    const detected = stigmergy.detect({ coordinates: [0, 0] });
    expect(detected.nearby.length).toBe(0);
    stigmergy.shutdown();
  });

  test('respects max pheromone limit', () => {
    const stigmergy = new Stigmergy({ maxPheromones: 2, evaporationInterval: 100000 });

    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [1, 1] }, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [2, 2] }, 1.0);

    // Should only have 2 pheromones (oldest was evicted)
    expect(stigmergy.activePheromones).toBe(2);
    expect(stigmergy.getStats().totalDeposited).toBe(3);
    expect(stigmergy.getStats().totalEvaporated).toBe(1);

    stigmergy.shutdown();
  });

  test('tracks statistics', () => {
    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.DANGER, { coordinates: [0, 0] }, 1.0);
    stigmergy.follow('nonexistent-id', 'agent-2'); // Won't count

    const stats = stigmergy.getStats();
    expect(stats.totalDeposited).toBe(2);
    expect(stats.byType[PheromoneType.PATHWAY]).toBe(1);
    expect(stats.byType[PheromoneType.DANGER]).toBe(1);
  });

  test('reset clears all data', () => {
    stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);
    stigmergy.deposit('agent-1', PheromoneType.RESOURCE, { coordinates: [0, 0] }, 1.0);

    stigmergy.reset();

    const detected = stigmergy.detect({ coordinates: [0, 0] });
    expect(detected.nearby.length).toBe(0);

    const stats = stigmergy.getStats();
    expect(stats.totalDeposited).toBe(0);
    expect(stats.byType[PheromoneType.PATHWAY]).toBe(0);
  });
  test('evaporation applies incremental decay correctly', () => {
    const stigmergy = new Stigmergy({
      defaultHalfLife: 1000, // 1 second half-life
      evaporationInterval: 100000, // manual evaporation only
    });

    const pheromone = stigmergy.deposit('agent', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);

    // Simulate one half-life passing (1000ms)
    pheromone.lastDecayTime = Date.now() - 1000;
    stigmergy.evaporate();

    // After one half-life, strength should be approximately halved
    expect(pheromone.strength).toBeCloseTo(0.5, 1);

    // Simulate another half-life passing from now
    pheromone.lastDecayTime = Date.now() - 1000;
    stigmergy.evaporate();

    // After two half-lives total (but applied incrementally), should be ~0.25
    expect(pheromone.strength).toBeCloseTo(0.25, 1);

    stigmergy.shutdown();
  });

  test('multiple evaporation cycles match single equivalent decay', () => {
    // Two rapid evaporation cycles should produce the same result as one
    // cycle spanning the same total time (since decay is incremental)
    const stigmergy1 = new Stigmergy({ defaultHalfLife: 10000, evaporationInterval: 100000 });
    const stigmergy2 = new Stigmergy({ defaultHalfLife: 10000, evaporationInterval: 100000 });

    const p1 = stigmergy1.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);
    const p2 = stigmergy2.deposit('a', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);

    // Wait a bit
    const wait = 500;

    // p1: two cycles of `wait` each
    p1.lastDecayTime = Date.now() - wait;
    stigmergy1.evaporate();
    p1.lastDecayTime = Date.now() - wait;
    stigmergy1.evaporate();

    // p2: one cycle of 2*wait
    p2.lastDecayTime = Date.now() - (2 * wait);
    stigmergy2.evaporate();

    // Both should be approximately the same
    expect(p1.strength).toBeCloseTo(p2.strength, 3);

    stigmergy1.shutdown();
    stigmergy2.shutdown();
  });

});

// ============================================================================
// TRAIL FOLLOWER TESTS
// ============================================================================

describe('TrailFollower', () => {
  let stigmergy: Stigmergy;
  let follower: TrailFollower;

  beforeEach(() => {
    stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    follower = new TrailFollower(stigmergy, 'agent-123');
  });

  afterEach(() => {
    stigmergy.shutdown();
  });

  test('follows trails correctly', () => {
    const targetPosition = { coordinates: [10, 20] };
    stigmergy.deposit('leader', PheromoneType.PATHWAY, targetPosition, 1.0);

    const result = follower.followTrail(targetPosition, PheromoneType.PATHWAY);

    expect(result.found).toBe(true);
    expect(result.pheromone).toBeDefined();
    expect(result.pheromone!.type).toBe(PheromoneType.PATHWAY);
    expect(result.direction).toEqual(targetPosition);
  });

  test('returns false when no trail found', () => {
    const result = follower.followTrail(
      { coordinates: [0, 0] },
      PheromoneType.PATHWAY
    );

    expect(result.found).toBe(false);
    expect(result.pheromone).toBeNull();
    expect(result.direction).toBeUndefined();
  });

  test('leaves signals', () => {
    const position = { coordinates: [5, 5] };
    const pheromone = follower.leaveSignal(
      PheromoneType.DANGER,
      position,
      0.5
    );

    expect(pheromone).toBeDefined();
    expect(pheromone.type).toBe(PheromoneType.DANGER);
    expect(pheromone.strength).toBe(0.5);
    expect(pheromone.position).toEqual(position);
  });

  test('leaves signals with metadata', () => {
    const position = { coordinates: [5, 5] };
    const metadata = new Map<string, unknown>([
      ['threat', 'malicious-ip'],
      ['confidence', 0.8],
    ]);

    const pheromone = follower.leaveSignal(
      PheromoneType.DANGER,
      position,
      0.5,
      metadata
    );

    expect(pheromone.metadata.get('threat')).toBe('malicious-ip');
    expect(pheromone.metadata.get('confidence')).toBe(0.8);
  });

  test('tracks followed trails count', () => {
    expect(follower.getFollowedCount()).toBe(0);

    stigmergy.deposit('leader', PheromoneType.PATHWAY, { coordinates: [1, 1] }, 1.0);
    follower.followTrail({ coordinates: [1, 1] }, PheromoneType.PATHWAY);
    expect(follower.getFollowedCount()).toBe(1);

    // Deposit at a different position so detect returns a different pheromone
    stigmergy.deposit('leader', PheromoneType.PATHWAY, { coordinates: [5, 5] }, 1.0);
    follower.followTrail({ coordinates: [5, 5] }, PheromoneType.PATHWAY);
    expect(follower.getFollowedCount()).toBe(2);
  });
});

// ============================================================================
// EVENT TESTS
// ============================================================================

describe('events', () => {
  test('emits deposit events', (done) => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    stigmergy.on('deposit', (data) => {
      expect(data.type).toBe(PheromoneType.PATHWAY);
      expect(data.sourceId).toBe('test-agent');
      expect(data.position).toEqual({ coordinates: [1, 2] });
      stigmergy.shutdown();
      done();
    });

    stigmergy.deposit('test-agent', PheromoneType.PATHWAY, { coordinates: [1, 2] });
  });

  test('emits evaporated events', (done) => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });

    const pheromone = stigmergy.deposit('agent', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 0.001);
    pheromone.strength = 0.009;
    pheromone.createdAt = Date.now() - 1000000;
    pheromone.lastDecayTime = Date.now() - 1000000;

    stigmergy.on('evaporated', (data) => {
      expect(data.count).toBeGreaterThan(0);
      stigmergy.shutdown();
      done();
    });

    stigmergy.evaporate();
  });

  test('emits followed events', (done) => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    const pheromone = stigmergy.deposit('agent-1', PheromoneType.PATHWAY, { coordinates: [0, 0] });

    stigmergy.on('followed', (data) => {
      expect(data.pheromoneId).toBe(pheromone.id);
      expect(data.followerId).toBe('agent-2');
      stigmergy.shutdown();
      done();
    });

    stigmergy.follow(pheromone.id, 'agent-2');
  });
});

// ============================================================================
// POSITION TYPES AND EDGE CASES
// ============================================================================

describe('position types and edge cases', () => {
  test('handles coordinate-based positions', () => {
    const stigmergy = new Stigmergy({ detectionRadius: 5.0, evaporationInterval: 100000 });

    stigmergy.deposit('agent', PheromoneType.PATHWAY, { coordinates: [0, 0] }, 1.0);

    const inside = stigmergy.detect({ coordinates: [3, 4] }); // Distance = 5
    expect(inside.nearby.length).toBe(1);

    const outside = stigmergy.detect({ coordinates: [4, 4] }); // Distance ≈ 5.66 > 5
    expect(outside.nearby.length).toBe(0);

    stigmergy.shutdown();
  });

  test('handles topic-based positions', () => {
    const stigmergy = new Stigmergy({ detectionRadius: 0.5, evaporationInterval: 100000 });

    stigmergy.deposit('agent', PheromoneType.PATHWAY, { topic: 'task-processing' });

    const sameTopic = stigmergy.detect({ topic: 'task-processing' });
    expect(sameTopic.nearby.length).toBe(1);

    const differentTopic = stigmergy.detect({ topic: 'user-interface' });
    expect(differentTopic.nearby.length).toBe(0);

    stigmergy.shutdown();
  });

  test('handles taskType-based positions', () => {
    const stigmergy = new Stigmergy({ detectionRadius: 0.5, evaporationInterval: 100000 });

    stigmergy.deposit('agent', PheromoneType.RESOURCE, { taskType: 'image-analysis' });

    const match = stigmergy.detect({ taskType: 'image-analysis' });
    expect(match.nearby.length).toBe(1);

    const noMatch = stigmergy.detect({ taskType: 'data-processing' });
    expect(noMatch.nearby.length).toBe(0);

    stigmergy.shutdown();
  });

  test('handles contextHash-based positions', () => {
    const stigmergy = new Stigmergy({ detectionRadius: 0.5, evaporationInterval: 100000 });

    stigmergy.deposit('agent', PheromoneType.PATHWAY, { contextHash: 'abc123' });

    const match = stigmergy.detect({ contextHash: 'abc123' });
    expect(match.nearby.length).toBe(1);

    const noMatch = stigmergy.detect({ contextHash: 'different' });
    expect(noMatch.nearby.length).toBe(0);

    stigmergy.shutdown();
  });

  test('grid is cleaned up after evaporation', () => {
    const stigmergy = new Stigmergy({ evaporationInterval: 100000 });
    const pheromone = stigmergy.deposit('agent', PheromoneType.PATHWAY, { topic: 'test' }, 0.001);

    // Force the pheromone to be very old so it decays below threshold
    pheromone.createdAt = Date.now() - 999999999;
    pheromone.lastDecayTime = Date.now() - 999999999;

    stigmergy.evaporate();

    // After evaporation, the pheromone should be gone
    expect(stigmergy.activePheromones).toBe(0);

    // Depositing a new pheromone at the same position should work correctly
    const newPheromone = stigmergy.deposit('agent', PheromoneType.PATHWAY, { topic: 'test' }, 1.0);
    expect(newPheromone).toBeDefined();

    stigmergy.shutdown();
  });

  test('grid is cleaned up after maxPheromones eviction', () => {
    const stigmergy = new Stigmergy({ maxPheromones: 1, evaporationInterval: 100000 });

    const first = stigmergy.deposit('agent1', PheromoneType.PATHWAY, { topic: 'topic-a' }, 1.0);
    // This should evict the first pheromone
    stigmergy.deposit('agent2', PheromoneType.PATHWAY, { topic: 'topic-b' }, 1.0);

    expect(stigmergy.activePheromones).toBe(1);

    // The first pheromone should not be detectable
    const detectA = stigmergy.detect({ topic: 'topic-a' });
    expect(detectA.nearby.length).toBe(0);

    // The second pheromone should be detectable
    const detectB = stigmergy.detect({ topic: 'topic-b' });
    expect(detectB.nearby.length).toBe(1);

    stigmergy.shutdown();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('performance', () => {
  test('handles many signals efficiently', () => {
    const stigmergy = new Stigmergy({
      maxPheromones: 10000,
      evaporationInterval: 3600000,
      detectionRadius: 100, // Wide radius so detection finds pheromones
    });

    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      stigmergy.deposit(`agent-${i % 10}`, PheromoneType.PATHWAY, {
        coordinates: [Math.random() * 100, Math.random() * 100],
      }, Math.random());
    }

    const depositTime = Date.now() - start;

    const detectStart = Date.now();
    const result = stigmergy.detect({ coordinates: [50, 50] });
    const detectTime = Date.now() - detectStart;

    expect(depositTime).toBeLessThan(2000);
    expect(detectTime).toBeLessThan(100);
    expect(result.nearby.length).toBeGreaterThan(0);

    stigmergy.shutdown();
  });
});
