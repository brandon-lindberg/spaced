export type RunState = {
  level: number
  maxLevels: number
  levelStartMs: number
  levelDurationSec: number
  seed: number
}

export const levelDurationsSec: Record<number, number> = {
  1: 15 * 60,
  2: 15 * 60,
  3: 15 * 60,
  4: 15 * 60,
  5: 30 * 60,
}

export const runState = {
  state: null as RunState | null,
  checkpoints: new Map<number, unknown>(),

  newRun(seed?: number) {
    this.state = {
      level: 1,
      maxLevels: 5,
      levelStartMs: 0,
      levelDurationSec: levelDurationsSec[1],
      seed: seed ?? Math.floor(Math.random() * 1_000_000_000),
    }
    return this.state
  },

  startLevel(level: number, nowMs: number) {
    if (!this.state) this.newRun()
    const duration = levelDurationsSec[level] ?? levelDurationsSec[1]
    this.state!.level = level
    this.state!.levelStartMs = nowMs
    this.state!.levelDurationSec = duration
    return this.state
  },

  getRemainingSec(nowMs: number) {
    if (!this.state) return 0
    const elapsed = Math.max(0, (nowMs - this.state.levelStartMs) / 1000)
    return Math.max(0, Math.ceil(this.state.levelDurationSec - elapsed))
  },

  setCheckpoint(level: number, snapshot: unknown) {
    this.checkpoints.set(level, snapshot)
  },

  getCheckpoint<T = unknown>(level: number): T | null {
    return (this.checkpoints.get(level) as T) ?? null
  },
}



