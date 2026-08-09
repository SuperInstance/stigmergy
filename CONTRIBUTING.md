# Contributing to Stigmergy

## What This Is

`stigmergy` is a TypeScript library for bio-inspired coordination through indirect communication. Agents leave pheromone-like signals that influence others' behavior — decentralized coordination without central control. Think ant colonies: no ant tells another ant where the food is; instead, ants that find food leave a pheromone trail that gets reinforced by others.

## Development Setup

```bash
git clone git@github.com:SuperInstance/stigmergy.git
cd stigmergy
npm install
```

### Prerequisites

- Node.js 16+
- TypeScript 5.0+ (installed via `npm install`)

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Organization

| File | What It Tests |
|------|--------------|
| `tests/stigmergy.test.ts` | Core pheromone deposit/decay, trail following, environment config |
| `src/stigmergy.ts` (inline tests) | Unit tests for individual classes and functions |

Tests use Jest with `ts-jest`. Configuration is in `package.json`.

## Building

```bash
# Compile TypeScript to dist/
npm run build
```

Output goes to `dist/` with `.js`, `.d.ts`, `.js.map`, and `.d.ts.map` files.

## Project Structure

```
stigmergy/
├── src/
│   ├── index.ts           # Public API re-exports
│   └── stigmergy.ts       # Core: Stigmergy environment, Pheromone, TrailFollower
├── tests/
│   └── stigmergy.test.ts
├── examples/
│   └── task-distribution.js  # Example: multi-agent task allocation
├── dist/                   # Compiled output
├── tsconfig.json
├── package.json
└── README.md
```

## Code Style

- **TypeScript:** strict mode, explicit type annotations on all public APIs
- **JSDoc:** document all public classes and methods with descriptions and examples
- **Zero runtime dependencies:** the library must remain dependency-free at runtime
- **Tests:** every new behavior needs test coverage — both unit and integration tests
- **Commits:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`)

## Key Design Decisions

1. **Pheromones, not messages.** Agents never communicate directly. They deposit signals into a shared environment. This is the core abstraction.
2. **Time-based decay.** Pheromones have a configurable half-life and decay exponentially. Old signals evaporate; the system adapts to current conditions.
3. **Spatial detection.** Agents detect pheromones within a radius, not globally. This enables spatial locality in coordination patterns.
4. **No orchestrator.** There is no central controller. Patterns emerge from simple agent behaviors interacting through the environment.

## Pull Request Checklist

- [ ] `npm test` passes
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] New code has test coverage
- [ ] No new runtime dependencies added
- [ ] Public APIs documented with JSDoc
- [ ] No secrets or credentials committed
- [ ] Commit messages follow conventional commits

## Fleet Context

This library is part of the SuperInstance fleet. It provides the coordination layer for multi-agent systems that need to self-organize without central control.

Related fleet components:
- `voxel-logic` — spatial reasoning in discrete 3D grids (complementary spatial primitive)
- `gossip-ping` — SWIM-style failure detection for fleet membership
- `lucineer` — the build agent that uses stigmergic coordination for multi-agent builds
