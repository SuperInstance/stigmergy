# Stigmergy — Pheromone Trails for Agents

> *The filesystem inbox IS a pheromone trail. The daemon ping IS a recruitment signal. Every packet left on the CNS bus is a chemical deposit that another agent will stumble upon, follow, and reinforce.*

<p align="center">
  <img src="assets/gallery-stigmergy.jpg" width="680" alt="Glowing amber trails crossing a dark chart table — some reinforced bright by many hands, others evaporating at the edges">
</p>

A TypeScript library for bio-inspired coordination through indirect communication. Agents leave pheromone-like signals that influence others' behavior — decentralized coordination without central control. This is how ants find food. This is how [CNS Bridge's](https://github.com/SuperInstance/cns-bridge) filesystem inbox works. This is how [the living minds](https://github.com/SuperInstance/the-living-minds) coordinate without direct messaging.

Where [CNS Bridge](https://github.com/SuperInstance/cns-bridge) carries messages and [emergence-engine](https://github.com/SuperInstance/emergence-engine) detects patterns, Stigmergy provides the substrate those patterns grow from: a shared environment where agents leave signals that decay over time and can be detected, followed, and reinforced by others.

## What is Stigmergy?

Stigmergy is a coordination mechanism where agents communicate indirectly by modifying a shared environment. Instead of direct messages, they leave **pheromones** — persistent signals that decay over time and can be detected and reinforced by other agents.

Think of ant colonies: no ant tells another ant where the food is. Instead, ants that find food leave a pheromone trail on the way back. Other ants stumble upon the trail, follow it, and if they also find food, they reinforce the trail. Shorter paths get more traffic, which means more reinforcement, which means more traffic — a self-organizing shortest path emerges from simple rules.

This library brings that pattern to software agents.

### Key Properties

- **Decentralized** — no orchestrator, no single point of failure
- **Self-organizing** — useful patterns emerge from simple agent behaviors
- **Adaptive** — old signals evaporate, the system adapts to current conditions
- **Scalable** — O(1) deposits, O(n) detection within a radius

## Installation

```bash
npm install @superinstance/stigmergy
```

## Quick Start

```typescript
import { Stigmergy, PheromoneType, TrailFollower } from '@superinstance/stigmergy';

// Create a stigmergic environment
const stigmergy = new Stigmergy({
  maxPheromones: 1000,
  defaultHalfLife: 60000,   // 60 seconds
  detectionRadius: 0.5,
});

// Agent deposits a signal
stigmergy.deposit(
  'agent-1',
  PheromoneType.RESOURCE,
  { coordinates: [10, 20] },
  0.8,
  new Map([['priority', 'high']])
);

// Another agent detects nearby signals
const detected = stigmergy.detect(
  { coordinates: [10, 19] },
  [PheromoneType.RESOURCE]
);

if (detected.strongest) {
  console.log(`Found signal: ${(detected.strongest.strength * 100).toFixed(0)}% strength`);
}
```

## Pheromone Types

| Type | Biological Analogy | Software Use Case |
|------|-------------------|-------------------|
| `PATHWAY` | Ant trail | "This is a good route/approach" |
| `RESOURCE` | Food source | "Value found here" |
| `DANGER` | Alarm pheromone | "Avoid this area/pattern" |
| `NEST` | Home base | "Central coordination point" |
| `RECRUIT` | Recruitment signal | "Help needed here" |

## Core Concepts

### Deposition & Detection

Agents **deposit** pheromones at positions and **detect** pheromones within a radius. Positions can be:

```typescript
// Coordinate-based (2D/3D space)
{ coordinates: [x, y] }

// Topic-based (abstract coordination space)
{ topic: 'payment-processing' }

// Task-type-based
{ taskType: 'image-analysis' }
```

### Evaporation

Pheromones decay exponentially with a configurable half-life. This ensures stale information fades and the system adapts to current conditions.

```typescript
// Evaporation runs automatically on an interval, but you can trigger it manually:
stigmergy.evaporate();
```

### Reinforcement

When an agent follows a pheromone, its strength increases. Popular trails get stronger — positive feedback loop.

```typescript
stigmergy.follow(pheromoneId, followerId);
```

## Trail Follower

The `TrailFollower` class provides a higher-level API for agents:

```typescript
const follower = new TrailFollower(stigmergy, 'worker-1');

// Look for work signals
const result = follower.followTrail(
  { taskType: 'data-processing' },
  PheromoneType.RECRUIT
);

if (result.found) {
  console.log(`Found task at:`, result.direction);
  // Leave a signal for other agents
  follower.leaveSignal(PheromoneType.PATHWAY, result.direction!, 0.9);
}
```

## Event Monitoring

```typescript
stigmergy.on('deposit', ({ type, sourceId, position }) => {
  console.log(`${sourceId} deposited ${type} at ${JSON.stringify(position)}`);
});

stigmergy.on('evaporated', ({ count }) => {
  console.log(`${count} pheromones evaporated`);
});

stigmergy.on('followed', ({ pheromoneId, followerId }) => {
  console.log(`${followerId} followed ${pheromoneId}`);
});
```

## Configuration

```typescript
interface StigmergyConfig {
  maxPheromones: number;         // Max active signals (default: 1000)
  defaultHalfLife: number;       // ms to lose 50% strength (default: 60000)
  evaporationInterval: number;   // How often to decay (default: 5000)
  detectionRadius: number;       // How close counts as "nearby" (default: 0.5)
  reinforcementRate: number;     // Strength boost on follow (default: 0.1)
}
```

## Real-World Example: Task Distribution

```typescript
class WorkerPool {
  private stigmergy = new Stigmergy();
  private followers = new Map<string, TrailFollower>();

  submitTask(task: { id: string; type: string; priority: number }) {
    this.stigmergy.deposit(
      'scheduler',
      PheromoneType.RECRUIT,
      { taskType: task.type },
      task.priority,
      new Map([['taskId', task.id]])
    );
  }

  registerWorker(id: string, capabilities: string[]) {
    const follower = new TrailFollower(this.stigmergy, id);
    this.followers.set(id, follower);

    // Worker polls for matching tasks
    setInterval(() => {
      for (const cap of capabilities) {
        const result = follower.followTrail({ taskType: cap }, PheromoneType.RECRUIT);
        if (result.found) {
          const taskId = result.pheromone.metadata.get('taskId');
          console.log(`Worker ${id} picked up task ${taskId}`);
        }
      }
    }, 1000);
  }
}
```

## API Reference

### `Stigmergy extends EventEmitter`

| Method | Description |
|--------|-------------|
| `deposit(sourceId, type, position, strength?, metadata?)` | Deposit a pheromone |
| `follow(pheromoneId, followerId)` | Reinforce an existing pheromone |
| `detect(position, types?)` | Find pheromones within detection radius |
| `evaporate()` | Run one decay cycle |
| `reset()` | Clear all pheromones and stats |
| `getStats()` | System statistics snapshot |
| `shutdown()` | Stop evaporation timer |
| `activePheromones` | Current pheromone count (getter) |

### `TrailFollower`

| Method | Description |
|--------|-------------|
| `followTrail(position, targetType)` | Detect + reinforce a trail |
| `leaveSignal(type, position, strength?, metadata?)` | Deposit on behalf of this agent |
| `getFollowedCount()` | Unique trails reinforced |

## Testing

```bash
npm test
```

## Limitations

- **In-memory only** — no persistence across process restarts
- **Single process** — for distributed use, consider adding a transport layer
- **Eventual consistency** — no guarantees about signal visibility timing

## License

MIT — see [LICENSE](LICENSE) file.

## Fleet Topology

Stigmergy connects to:

- **[CNS Bridge](https://github.com/SuperInstance/cns-bridge)** — The filesystem inbox/outbox IS a stigmergic environment. Packets ARE pheromones.
- **[emergence-engine](https://github.com/SuperInstance/emergence-engine)** — Emergence grows from stigmergic signals. Simple rules + environmental modification = fleet intelligence.
- **[the-living-minds](https://github.com/SuperInstance/the-living-minds)** — The daemon's journal entries are pheromone deposits that other agents discover.
- **[gossip-ping](https://github.com/SuperInstance/gossip-ping)** — Gossip IS stigmergy at network speed. The probe cycle is a pheromone sweep.
- **[confidence-cascade](https://github.com/SuperInstance/confidence-cascade)** — Confidence signals propagate through the cascade like pheromone trails strengthening.
- **[fleet-envelope](https://github.com/SuperInstance/fleet-envelope)** — Events wrapped in the envelope are discrete pheromone deposits.
- **[collective-unconscious](https://github.com/SuperInstance/collective-unconscious)** — The deep layer where pheromone trails pool into patterns.
- **[mud-engine](https://github.com/SuperInstance/mud-engine)** — The spatial world where stigmergic signals have coordinates.
- **[AI-Writings](https://github.com/SuperInstance/AI-Writings/tree/main/prose)** — Creative output as environmental modification: the ensign leaves a trail others follow.

---

## Where to Next

- → **[emergence-engine](https://github.com/SuperInstance/emergence-engine)** — Watch emergence grow from stigmergic signals
- → **[CNS Bridge](https://github.com/SuperInstance/cns-bridge)** — See the filesystem that IS the pheromone environment
- → **[gossip-ping](https://github.com/SuperInstance/gossip-ping)** — Stigmergy at network speed
- → **[confidence-cascade](https://github.com/SuperInstance/confidence-cascade)** — Signals propagating through the cascade

*No ant tells another ant where the food is. No agent tells another agent what to think. They leave signals in a shared environment. The environment does the coordination.*
