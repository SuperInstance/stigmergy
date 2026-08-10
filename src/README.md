# Source — The Pheromone Engine

## [stigmergy.ts](stigmergy.ts)

The core implementation. 400+ lines of TypeScript implementing:

- **`PheromoneType`** enum: PATHWAY, RESOURCE, DANGER, NEST, RECRUIT
- **`Pheromone`** interface: id, type, sourceId, strength, position, metadata, timestamps, halfLife
- **`Position`** interface: coordinate-based, topic-based, or hash-based
- **`Stigmergy`** class (extends EventEmitter): deposit, follow, detect, evaporate, reset, getStats
- **`StigmergyConfig`**: maxPheromones, defaultHalfLife, evaporationInterval, detectionRadius, reinforcementRate
- **`TrailFollower`** class: followTrail, leaveSignal, getFollowedCount

The system uses a spatial grid for O(1) deposits and O(n) detection within a radius. Pheromones decay exponentially with configurable half-life. Reinforcement adds strength when followed.

## [index.ts](index.ts)

Barrel export. Public API surface.

---

← Back to **[Stigmergy](../README.md)**
