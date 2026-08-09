/**
 * STIGMERGIC COORDINATION
 *
 * Indirect coordination through environmental modifications.
 * Like ants leaving pheromone trails, agents leave signals in shared space
 * that influence others' behavior. Decentralized coordination without central control.
 *
 * Based on stigmergy in biological systems — agents communicate by modifying
 * a shared environment rather than through direct messaging.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Pheromone types — modeled after biological ant colonies.
 */
export enum PheromoneType {
  PATHWAY = 'PATHWAY',
  RESOURCE = 'RESOURCE',
  DANGER = 'DANGER',
  NEST = 'NEST',
  RECRUIT = 'RECRUIT',
}

/**
 * A pheromone signal deposited by an agent.
 */
export interface Pheromone {
  id: string;
  type: PheromoneType;
  sourceId: string;
  strength: number;
  position: Position;
  metadata: Map<string, unknown>;
  createdAt: number;
  lastDecayTime: number;
  halfLife: number;
}

/**
 * Position can be coordinate-based, topic-based, or hash-based.
 */
export interface Position {
  topic?: string;
  taskType?: string;
  contextHash?: string;
  coordinates?: number[];
}

/**
 * Configuration for the stigmergy system.
 */
export interface StigmergyConfig {
  maxPheromones: number;
  defaultHalfLife: number;
  evaporationInterval: number;
  detectionRadius: number;
  reinforcementRate: number;
}

export interface StigmergyStats {
  totalDeposited: number;
  totalEvaporated: number;
  totalFollowed: number;
  byType: Record<PheromoneType, number>;
}

// ============================================================================
// STIGMERGY SYSTEM
// ============================================================================

/**
 * Core stigmergic environment where agents deposit, detect, and follow
 * pheromone signals. Extends EventEmitter for monitoring.
 */
export class Stigmergy extends EventEmitter {
  private config: StigmergyConfig;
  private pheromones: Map<string, Pheromone> = new Map();
  private grid: Map<string, string[]> = new Map();
  private evaporationTimer: ReturnType<typeof setInterval> | null = null;
  private stats: StigmergyStats;

  constructor(config: Partial<StigmergyConfig> = {}) {
    super();
    this.config = {
      maxPheromones: 1000,
      defaultHalfLife: 60000,
      evaporationInterval: 5000,
      detectionRadius: 0.5,
      reinforcementRate: 0.1,
      ...config,
    };
    this.stats = this.createEmptyStats();
    this.startEvaporation();
  }

  /**
   * Deposit a pheromone signal into the environment.
   */
  deposit(
    sourceId: string,
    type: PheromoneType,
    position: Position,
    strength: number = 1.0,
    metadata: Map<string, unknown> = new Map()
  ): Pheromone {
    const now = Date.now();
    const pheromone: Pheromone = {
      id: randomUUID(),
      type,
      sourceId,
      strength: Math.min(1, Math.max(0, strength)),
      position,
      metadata,
      createdAt: now,
      lastDecayTime: now,
      halfLife: this.config.defaultHalfLife,
    };

    if (this.pheromones.size >= this.config.maxPheromones) {
      this.evaporateOldest();
    }

    this.pheromones.set(pheromone.id, pheromone);
    this.addToGrid(pheromone);

    this.stats.totalDeposited++;
    this.stats.byType[type]++;

    this.emit('deposit', {
      id: pheromone.id,
      type,
      sourceId,
      position,
    });

    return pheromone;
  }

  /**
   * Follow (and reinforce) an existing pheromone.
   */
  follow(pheromoneId: string, followerId: string): void {
    const pheromone = this.pheromones.get(pheromoneId);
    if (!pheromone) return;

    pheromone.strength = Math.min(
      1,
      pheromone.strength + this.config.reinforcementRate
    );
    this.stats.totalFollowed++;
    this.emit('followed', { pheromoneId, followerId });
  }

  /**
   * Detect pheromones near a given position.
   */
  detect(
    position: Position,
    types?: PheromoneType[]
  ): {
    nearby: Pheromone[];
    strongest: Pheromone | null;
  } {
    const nearby: Pheromone[] = [];

    for (const pheromone of this.pheromones.values()) {
      const distance = this.distance(position, pheromone.position);
      if (distance <= this.config.detectionRadius) {
        if (!types || types.includes(pheromone.type)) {
          nearby.push(pheromone);
        }
      }
    }

    nearby.sort((a, b) => b.strength - a.strength);
    return {
      nearby,
      strongest: nearby[0] || null,
    };
  }

  /**
   * Run one evaporation cycle — decay all pheromones by their half-life.
   */
  evaporate(): void {
    const now = Date.now();
    const toEvaporate: string[] = [];

    for (const [id, pheromone] of this.pheromones) {
      const elapsed = now - pheromone.lastDecayTime;
      const decayFactor = Math.pow(0.5, elapsed / pheromone.halfLife);
      pheromone.strength *= decayFactor;
      pheromone.lastDecayTime = now;

      if (pheromone.strength < 0.01) {
        toEvaporate.push(id);
      }
    }

    for (const id of toEvaporate) {
      const pheromone = this.pheromones.get(id);
      if (pheromone) {
        this.stats.byType[pheromone.type]--;
        this.removeFromGrid(pheromone);
      }
      this.pheromones.delete(id);
      this.stats.totalEvaporated++;
    }

    this.emit('evaporated', { count: toEvaporate.length });
  }

  /**
   * Clear all pheromones and reset stats.
   */
  reset(): void {
    this.pheromones.clear();
    this.grid.clear();
    this.stats = this.createEmptyStats();
    this.emit('reset');
  }

  /**
   * Get the current active pheromone count.
   */
  get activePheromones(): number {
    return this.pheromones.size;
  }

  /**
   * Get a snapshot of system statistics.
   */
  getStats(): StigmergyStats {
    return {
      ...this.stats,
      byType: { ...this.stats.byType },
    };
  }

  /**
   * Stop the evaporation timer. Call this when done to prevent leaks.
   */
  shutdown(): void {
    if (this.evaporationTimer) {
      clearInterval(this.evaporationTimer);
      this.evaporationTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Private methods
  // --------------------------------------------------------------------------

  private createEmptyStats(): StigmergyStats {
    return {
      totalDeposited: 0,
      totalEvaporated: 0,
      totalFollowed: 0,
      byType: {
        [PheromoneType.PATHWAY]: 0,
        [PheromoneType.RESOURCE]: 0,
        [PheromoneType.DANGER]: 0,
        [PheromoneType.NEST]: 0,
        [PheromoneType.RECRUIT]: 0,
      },
    };
  }

  private startEvaporation(): void {
    this.evaporationTimer = setInterval(() => {
      this.evaporate();
    }, this.config.evaporationInterval);
  }

  private evaporateOldest(): void {
    let oldest: Pheromone | null = null;
    for (const pheromone of this.pheromones.values()) {
      if (!oldest || pheromone.createdAt < oldest.createdAt) {
        oldest = pheromone;
      }
    }
    if (oldest) {
      this.removeFromGrid(oldest);
      this.pheromones.delete(oldest.id);
      this.stats.totalEvaporated++;
    }
  }

  private addToGrid(pheromone: Pheromone): void {
    const key = this.positionToKey(pheromone.position);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(pheromone.id);
  }

  private removeFromGrid(pheromone: Pheromone): void {
    const key = this.positionToKey(pheromone.position);
    const ids = this.grid.get(key);
    if (ids) {
      const idx = ids.indexOf(pheromone.id);
      if (idx !== -1) {
        ids.splice(idx, 1);
      }
      if (ids.length === 0) {
        this.grid.delete(key);
      }
    }
  }

  private positionToKey(position: Position): string {
    if (position.coordinates) {
      return `${Math.floor(position.coordinates[0] * 10)},${Math.floor(position.coordinates[1] * 10)}`;
    }
    return position.topic || position.taskType || 'default';
  }

  private distance(a: Position, b: Position): number {
    if (a.coordinates && b.coordinates) {
      const dx = (a.coordinates[0] || 0) - (b.coordinates[0] || 0);
      const dy = (a.coordinates[1] || 0) - (b.coordinates[1] || 0);
      return Math.sqrt(dx * dx + dy * dy);
    }
    if (a.topic && b.topic && a.topic === b.topic) {
      return 0;
    }
    if (a.taskType && b.taskType && a.taskType === b.taskType) {
      return 0;
    }
    if (a.contextHash && b.contextHash && a.contextHash === b.contextHash) {
      return 0;
    }
    return 1;
  }
}

// ============================================================================
// TRAIL FOLLOWER
// ============================================================================

/**
 * Higher-level agent that follows trails and leaves signals.
 * Wraps the raw Stigmergy API for agent-oriented usage.
 */
export class TrailFollower {
  private stigmergy: Stigmergy;
  private agentId: string;
  private followedTrails: Set<string> = new Set();

  constructor(stigmergy: Stigmergy, agentId: string) {
    this.stigmergy = stigmergy;
    this.agentId = agentId;
  }

  /**
   * Follow a trail of a specific pheromone type from the current position.
   * If found, reinforces the trail and returns direction info.
   */
  followTrail(
    currentPosition: Position,
    targetType: PheromoneType
  ): { found: boolean; pheromone: Pheromone | null; direction?: Position } {
    const detected = this.stigmergy.detect(currentPosition, [targetType]);

    if (!detected.strongest) {
      return { found: false, pheromone: null };
    }

    this.stigmergy.follow(detected.strongest.id, this.agentId);
    this.followedTrails.add(detected.strongest.id);

    return {
      found: true,
      pheromone: detected.strongest,
      direction: detected.strongest.position,
    };
  }

  /**
   * Leave a pheromone signal at a position.
   */
  leaveSignal(
    type: PheromoneType,
    position: Position,
    strength: number = 1.0,
    metadata: Map<string, unknown> = new Map()
  ): Pheromone {
    return this.stigmergy.deposit(this.agentId, type, position, strength, metadata);
  }

  /**
   * How many unique trails this follower has reinforced.
   */
  getFollowedCount(): number {
    return this.followedTrails.size;
  }
}
