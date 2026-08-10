# Examples — Stigmergic Patterns

Four runnable examples showing how agents coordinate through environmental signals.

## [overnight-coordination.ts](overnight-coordination.ts)
How the overnight watch coordinates: agents deposit RECRUIT signals when work is available, PATHWAY signals when a route is discovered, and the colony converges on tasks without central scheduling.

## [shortest-path-emergence.ts](shortest-path-emergence.ts)
Classic ant colony optimization: agents discover paths through a space, reinforce short paths, and the colony converges on the optimal route. Pure stigmergy — no central planner.

## [task-distribution.js](task-distribution.js)
A worker pool where tasks find workers through pheromone signals. Workers detect RECRUIT pheromones matching their capabilities and pick up work. No task queue, no scheduler.

## [ts-agent-coordination.ts](ts-agent-coordination.ts)
TypeScript agents coordinating through stigmergic deposits. Agents leave DANGER pheromones at failed approaches, PATHWAY pheromones at successful ones, and the colony learns to avoid dead ends.

---

← Back to **[Stigmergy](../README.md)**
