import Phaser from 'phaser'
import { getOptions } from '../systems/options'
import { audio } from '../systems/audio'
import { runState } from '../systems/runState'
import { setCircleHitbox } from './GroupUtils'

export interface BossManagerConfig {
  enemyGroup: Phaser.Physics.Arcade.Group
  spawnEnemyBullet: (x: number, y: number, angleDeg: number) => void
  getPlayer: () => Phaser.Physics.Arcade.Sprite | undefined
  onVictory: () => void
}

interface GauntletState {
  active: boolean
  stage: number
}

export class BossManager {
  private readonly scene: Phaser.Scene
  private readonly config: BossManagerConfig
  private currentBoss?: Phaser.Physics.Arcade.Sprite
  private bossTimers: Phaser.Time.TimerEvent[] = []
  private currentBossType = 0
  private currentBossPhase = -1
  private bossActive = false
  private gauntlet: GauntletState = { active: false, stage: 0 }

  constructor(scene: Phaser.Scene, config: BossManagerConfig) {
    this.scene = scene
    this.config = config
  }

  resetForLevel() {
    this.clearBossTimers()
    this.currentBoss = undefined
    this.currentBossType = 0
    this.currentBossPhase = -1
    this.bossActive = false
    this.gauntlet = { active: false, stage: 0 }
    this.scene.registry.set('boss-hp', null)
  }

  isBossActive() {
    return this.bossActive
  }

  isGauntletActive() {
    return this.gauntlet.active
  }

  update(level: number, remainingSec: number, camCenter: { x: number; y: number }) {
    if (remainingSec > 0) return
    if (level < 5) {
      if (!this.bossActive) {
        this.spawnBoss(camCenter.x, camCenter.y, level)
        audio.sfxBossSpawn()
      }
      return
    }

    if (!this.gauntlet.active) {
      this.gauntlet.active = true
      this.gauntlet.stage = 0
      this.spawnNextGauntletBoss(camCenter.x, camCenter.y)
      audio.sfxBossSpawn()
    }
  }

  handleBossDamaged(enemy: Phaser.Physics.Arcade.Sprite, hp: number, hpMax: number) {
    if (enemy !== this.currentBoss) return
    this.scene.registry.set('boss-hp', { cur: hp, max: hpMax })
    this.configureBossPhase()
  }

  handleBossDefeated(enemy: Phaser.Physics.Arcade.Sprite) {
    if (enemy !== this.currentBoss) return
    this.scene.registry.set('boss-hp', null)
    this.clearBossTimers()
    this.bossActive = false
    this.currentBoss = undefined
    if (getOptions().screenShake) this.scene.cameras.main.shake(200, 0.01)

    const level = runState.state?.level ?? 1
    if (level < 5) {
      this.config.onVictory()
      return
    }

    if (this.gauntlet.active) {
      this.gauntlet.stage += 1
      if (this.gauntlet.stage < 5) {
        const cam = this.scene.cameras.main
        const camCenter = { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2 }
        this.spawnNextGauntletBoss(camCenter.x, camCenter.y)
        audio.sfxBossSpawn()
      } else {
        this.gauntlet.active = false
        this.config.onVictory()
      }
    }
  }

  private spawnBoss(cx: number, cy: number, type?: number) {
    const radius = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 0.4
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    const bossType = type ?? (runState.state?.level ?? 1)
    const textureKey = bossType === 1 ? 'boss-1' : 'enemy-square'

    const boss = (this.config.enemyGroup.get(x, y, textureKey) as Phaser.Physics.Arcade.Sprite) ||
      (this.config.enemyGroup.create(x, y, textureKey) as Phaser.Physics.Arcade.Sprite)
    boss.setTexture(textureKey)
    boss.setActive(true).setVisible(true)
    boss.setAlpha(1)
    boss.setOrigin(0.5, 0.5)
    boss.setRotation(0)

    if (bossType === 1) boss.setScale(0.28125)
    else boss.setScale(12)

    boss.enableBody(true, x, y, true, true)
    setCircleHitbox(boss, bossType === 1 ? 120 : 36)
    ;(boss as any).hp = type === 5 ? 260 : (bossType === 1 ? 800 : 80)  // 10x HP for level 1 boss
    ;(boss as any).hpMax = (boss as any).hp
    ;(boss as any).touchDamage = 2
    ;(boss as any).chase = 25
    ;(boss as any).isBoss = true

    this.scene.registry.set('boss-hp', { cur: (boss as any).hp, max: (boss as any).hpMax })
    this.clearNonBossEnemies()
    this.clearBossTimers()
    this.currentBoss = boss
    this.currentBossType = bossType
    this.currentBossPhase = -1
    this.configureBossPhase()
    this.bossActive = true
  }

  private spawnNextGauntletBoss(cx: number, cy: number) {
    if (this.gauntlet.stage < 4) {
      this.spawnBoss(cx, cy, this.gauntlet.stage + 1)
      this.bossActive = true
      return
    }

    const radius = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 0.35
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const boss = (this.config.enemyGroup.get(x, y, 'enemy-square') as Phaser.Physics.Arcade.Sprite) ||
      (this.config.enemyGroup.create(x, y, 'enemy-square') as Phaser.Physics.Arcade.Sprite)
    boss.setTexture('enemy-square')
    boss.setActive(true).setVisible(true)
    boss.setAlpha(1)
    boss.setOrigin(0.5, 0.5)
    boss.setRotation(0)
    boss.enableBody(true, x, y, true, true)
    boss.setScale(13.2)
    setCircleHitbox(boss, 42)
    ;(boss as any).hp = 260
    ;(boss as any).hpMax = 260
    ;(boss as any).touchDamage = 3
    ;(boss as any).chase = 30
    ;(boss as any).isBoss = true
    this.scene.registry.set('boss-hp', { cur: 260, max: 260 })
    this.clearNonBossEnemies()
    this.clearBossTimers()
    this.currentBoss = boss
    this.currentBossType = 5
    this.currentBossPhase = -1
    this.configureBossPhase()
    this.bossActive = true
    let a = 0
    this.bossTimers.push(this.scene.time.addEvent({ delay: 60, loop: true, callback: () => {
      if (!boss.active) return
      const c = { x: boss.x, y: boss.y }
      this.config.spawnEnemyBullet(c.x, c.y, a)
      a = (a + 24) % 360
    }}))
  }

  private configureBossPhase() {
    const boss = this.currentBoss
    if (!boss || !boss.active) return
    const hp = (boss as any).hp as number
    const hpMax = (boss as any).hpMax as number
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, hpMax)))
    let nextPhase = 0
    if (this.currentBossType === 5) {
      if (pct > 0.66) nextPhase = 0
      else if (pct > 0.33) nextPhase = 1
      else if (pct > 0.15) nextPhase = 2
      else nextPhase = 3
    } else {
      if (pct > 0.66) nextPhase = 0
      else if (pct > 0.33) nextPhase = 1
      else nextPhase = 2
    }
    if (nextPhase === this.currentBossPhase) return
    this.currentBossPhase = nextPhase
    this.clearBossTimers()

    const center = () => ({ x: boss.x, y: boss.y })
    const aimToPlayer = () => {
      const player = this.config.getPlayer()
      return player ? Math.atan2(player.y - boss.y, player.x - boss.x) : 0
    }

    if (this.currentBossType === 1) {
      const bursts = [12, 16, 20]
      const delays = [1400, 1100, 900]
      const idx = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.scene.time.addEvent({ delay: delays[idx], loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        const count = bursts[idx]
        for (let k = 0; k < count; k++) this.config.spawnEnemyBullet(x, y, (k / count) * 360)
      }}))
      return
    }

    if (this.currentBossType === 2) {
      let a = 0
      const delays = [90, 70, 55]
      const step = [18, 22, 26]
      const idx = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.scene.time.addEvent({ delay: delays[idx], loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        this.config.spawnEnemyBullet(x, y, a)
        a = (a + step[idx]) % 360
      }}))
      return
    }

    if (this.currentBossType === 3) {
      const tele = [350, 300, 240]
      const spd = [160, 190, 220]
      const dur = [420, 450, 520]
      const idx = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.scene.time.addEvent({ delay: 2200 - idx * 300, loop: true, callback: () => {
        if (!boss.active) return
        const ang = aimToPlayer()
        this.showTelegraphLine(boss.x, boss.y, boss.x + Math.cos(ang) * 840, boss.y + Math.sin(ang) * 840, tele[idx])
        this.scene.time.delayedCall(tele[idx], () => {
          if (!boss.active) return
          boss.setVelocity(Math.cos(ang) * spd[idx], Math.sin(ang) * spd[idx])
          this.scene.time.delayedCall(dur[idx], () => boss.active && boss.setVelocity(0, 0))
        })
      }}))
      return
    }

    if (this.currentBossType === 4) {
      const ringR = [360, 408, 456]
      const count = [10, 14, 18]
      const tele = [400, 350, 300]
      const delay = [2500, 2200, 1900]
      const idx = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.scene.time.addEvent({ delay: delay[idx], loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        for (let k = 0; k < count[idx]; k++) {
          const ang = (k / count[idx]) * Math.PI * 2
          const rx = x + Math.cos(ang) * ringR[idx]
          const ry = y + Math.sin(ang) * ringR[idx]
          this.showTelegraphCircle(rx, ry, 48, tele[idx])
        }
        this.scene.time.delayedCall(tele[idx], () => {
          if (!boss.active) return
          for (let k = 0; k < count[idx]; k++) this.config.spawnEnemyBullet(x, y, (k / count[idx]) * 360)
        })
      }}))
      return
    }

    // Final boss combos (type 5)
    if (this.currentBossPhase === 0) {
      let a = 0
      this.bossTimers.push(this.scene.time.addEvent({ delay: 70, loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        this.config.spawnEnemyBullet(x, y, a)
        a = (a + 20) % 360
      }}))
      return
    }
    if (this.currentBossPhase === 1) {
      let a = 0
      this.bossTimers.push(this.scene.time.addEvent({ delay: 65, loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        this.config.spawnEnemyBullet(x, y, a)
        a = (a + 22) % 360
      }}))
      this.bossTimers.push(this.scene.time.addEvent({ delay: 2600, loop: true, callback: () => {
        if (!boss.active) return
        const ang = aimToPlayer()
        this.showTelegraphLine(boss.x, boss.y, boss.x + Math.cos(ang) * 900, boss.y + Math.sin(ang) * 900, 320)
        this.scene.time.delayedCall(320, () => boss.active && boss.setVelocity(Math.cos(ang) * 185, Math.sin(ang) * 185))
        this.scene.time.delayedCall(670, () => boss.active && boss.setVelocity(0, 0))
      }}))
      return
    }
    if (this.currentBossPhase === 2) {
      let a = 0
      this.bossTimers.push(this.scene.time.addEvent({ delay: 60, loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        this.config.spawnEnemyBullet(x, y, a)
        a = (a + 24) % 360
      }}))
      this.bossTimers.push(this.scene.time.addEvent({ delay: 2000, loop: true, callback: () => {
        if (!boss.active) return
        const { x, y } = center()
        const cnt = 16
        for (let k = 0; k < cnt; k++) this.config.spawnEnemyBullet(x, y, (k / cnt) * 360)
      }}))
      return
    }
    // Enrage
    let a = 0
    this.bossTimers.push(this.scene.time.addEvent({ delay: 55, loop: true, callback: () => {
      if (!boss.active) return
      const { x, y } = center()
      this.config.spawnEnemyBullet(x, y, a)
      a = (a + 26) % 360
    }}))
    this.bossTimers.push(this.scene.time.addEvent({ delay: 1600, loop: true, callback: () => {
      if (!boss.active) return
      const { x, y } = center()
      const cnt = 22
      for (let k = 0; k < cnt; k++) this.config.spawnEnemyBullet(x, y, (k / cnt) * 360)
    }}))
    this.bossTimers.push(this.scene.time.addEvent({ delay: 2200, loop: true, callback: () => {
      if (!boss.active) return
      const ang = aimToPlayer()
      this.showTelegraphLine(boss.x, boss.y, boss.x + Math.cos(ang) * 960, boss.y + Math.sin(ang) * 960, 260)
      this.scene.time.delayedCall(260, () => boss.active && boss.setVelocity(Math.cos(ang) * 200, Math.sin(ang) * 200))
      this.scene.time.delayedCall(600, () => boss.active && boss.setVelocity(0, 0))
    }}))
  }

  private clearNonBossEnemies() {
    const children = this.config.enemyGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const enemy of children) {
      if (!enemy || !enemy.active) continue
      if (!(enemy as any).isBoss) enemy.disableBody(true, true)
    }
  }

  private clearBossTimers() {
    for (const timer of this.bossTimers) timer.remove(false)
    this.bossTimers = []
  }

  private showTelegraphLine(x1: number, y1: number, x2: number, y2: number, durationMs: number) {
    const g = this.scene.add.graphics().setDepth(980)
    g.lineStyle(72, 0xff4444, 0.8)
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.strokePath()
    this.scene.tweens.add({ targets: g, alpha: 0, duration: durationMs, onComplete: () => g.destroy() })
  }

  private showTelegraphCircle(x: number, y: number, radius: number, durationMs: number) {
    const g = this.scene.add.graphics().setDepth(980)
    g.lineStyle(72, 0xffaa00, 0.85)
    g.strokeCircle(x, y, radius)
    this.scene.tweens.add({ targets: g, alpha: 0, duration: durationMs, onComplete: () => g.destroy() })
  }

}
