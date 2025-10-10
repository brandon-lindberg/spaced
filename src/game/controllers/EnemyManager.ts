import Phaser from 'phaser'
import { TextureFactory } from './TextureFactory'
import { PickupManager } from './PickupManager'
import { setCircleHitbox } from './GroupUtils'

export interface EnemyManagerConfig {
  pickupManager: PickupManager
  spawnEnemyBullet: (x: number, y: number, angleDeg: number) => void
  onBossDamaged?: (enemy: Phaser.Physics.Arcade.Sprite, hp: number, hpMax: number) => void
  onBossKilled?: (enemy: Phaser.Physics.Arcade.Sprite) => void
}

export interface SpawnContext {
  elapsedSec: number
  remainingSec: number
  levelDurationSec: number
  levelStartMs: number
}

export interface EnemyDamageResult {
  killed: boolean
  wasBoss: boolean
}

export class EnemyManager {
  private scene: Phaser.Scene
  private config: EnemyManagerConfig
  private enemies!: Phaser.Physics.Arcade.Group
  private enemyTextureKey = 'enemy-square'
  private eliteStats = { total: 0, elite: 0 }
  private player?: Phaser.Physics.Arcade.Sprite

  constructor(scene: Phaser.Scene, config: EnemyManagerConfig) {
    this.scene = scene
    this.config = config
  }

  initGroup() {
    TextureFactory.ensureEnemyTexture(this.scene, this.enemyTextureKey)
    this.enemies = this.scene.physics.add.group()
    // Remove enemy-to-enemy collision to prevent clustering
    return this.enemies
  }

  getGroup() {
    return this.enemies
  }

  setPlayer(player?: Phaser.Physics.Arcade.Sprite) {
    this.player = player
  }

  setBossHandlers(handlers: { onBossDamaged?: (enemy: Phaser.Physics.Arcade.Sprite, hp: number, hpMax: number) => void; onBossKilled?: (enemy: Phaser.Physics.Arcade.Sprite) => void }) {
    this.config.onBossDamaged = handlers.onBossDamaged
    this.config.onBossKilled = handlers.onBossKilled
  }

  spawnEnemyVariant(cx: number, cy: number, ctx: SpawnContext) {
    const roll = Math.random()
    let type: 'fodder' | 'chaser' | 'tank' = 'fodder'
    if (ctx.elapsedSec > 120 && roll < 0.15) type = 'tank'
    else if (ctx.elapsedSec > 45 && roll < 0.45) type = 'chaser'

    const viewRadius = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 0.5

    // Varied spawn distances - mix of close, medium, and far spawns
    const spawnRoll = Math.random()
    let inner: number, outer: number

    if (spawnRoll < 0.6) {
      // Close spawns (60%) - immediate threat, just off-screen
      inner = viewRadius * 0.55
      outer = viewRadius * 0.75
    } else if (spawnRoll < 0.85) {
      // Medium spawns (25%) - slightly farther off-screen
      inner = viewRadius * 0.75
      outer = viewRadius * 0.95
    } else {
      // Far spawns (15%) - time to prepare
      inner = viewRadius * 0.95
      outer = viewRadius * 1.2
    }

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    let textureKey = this.enemyTextureKey
    if (type === 'chaser') textureKey = 'enemy-chaser'
    else if (type === 'fodder') textureKey = 'enemy-fodder'
    else if (type === 'tank') textureKey = 'enemy-tank'

    const enemy = (this.enemies.get(x, y, textureKey) as Phaser.Physics.Arcade.Sprite) ||
      (this.enemies.create(x, y, textureKey) as Phaser.Physics.Arcade.Sprite)
    enemy.setTexture(textureKey)
    enemy.setActive(true).setVisible(true)
    enemy.setAlpha(1)
    enemy.setDepth(10)
    enemy.setOrigin(0.5, 0.5)
    enemy.setRotation(0)
    enemy.clearTint()

    if (type === 'chaser') enemy.setScale(0.140625)
    else if (type === 'fodder') enemy.setScale(0.10546875)
    else if (type === 'tank') enemy.setScale(0.1875)
    else enemy.setScale(6)

    enemy.enableBody(true, x, y, true, true)

    let hitboxRadius = 18
    if (type === 'chaser') hitboxRadius = 72
    else if (type === 'fodder') hitboxRadius = 54
    else if (type === 'tank') hitboxRadius = 96
    setCircleHitbox(enemy, hitboxRadius)
    enemy.setCollideWorldBounds(false)
    ;(enemy as any).elite = false
    ;(enemy as any).isElite = false

    const elapsed = (this.scene.time.now - ctx.levelStartMs) / 1000
    const touch = 1 + Math.floor(elapsed / 90)
    const playerLevel = (this.scene.registry.get('level') as number) || 1
    const hpScale = 1 + Math.min(playerLevel - 1, 8) * 0.2
    if (type === 'fodder') {
      ;(enemy as any).hp = Math.max(1, Math.round(2 * hpScale))
      ;(enemy as any).chase = 42
      ;(enemy as any).touchDamage = touch
    } else if (type === 'chaser') {
      ;(enemy as any).hp = Math.round(4 * hpScale)
      ;(enemy as any).chase = 64
      ;(enemy as any).touchDamage = touch
    } else if (type === 'tank') {
      ;(enemy as any).hp = Math.round(35 * hpScale)  // 5x tank HP (50% reduction)
      ;(enemy as any).chase = 24
      ;(enemy as any).touchDamage = touch + 1
    } else {
      ;(enemy as any).hp = Math.round(7 * hpScale)
      ;(enemy as any).chase = 24
      ;(enemy as any).touchDamage = touch + 1
      enemy.setTint(0xaaaa55)
    }
    ;(enemy as any).stunUntil = 0

    this.maybePromoteElite(enemy, ctx.remainingSec, ctx.levelDurationSec)
    return enemy
  }

  private maybePromoteElite(enemy: Phaser.Physics.Arcade.Sprite, remainingSec: number, totalDuration: number) {
    this.eliteStats.total++
    const stats = this.eliteStats
    const progress = 1 - Math.max(0, Math.min(1, remainingSec / Math.max(1, totalDuration)))
    const curRatio = stats.elite / Math.max(1, stats.total)
    const baseChance = 0.004 + progress * 0.015 + (remainingSec <= 120 ? 0.03 : 0)
    const targetMax = Math.min(0.2, 0.03 + progress * 0.12)
    if (Math.random() < baseChance && curRatio < targetMax) {
      stats.elite++
      ;(enemy as any).elite = true
      ;(enemy as any).hp = Math.round(((enemy as any).hp || 4) * 4.5)
      ;(enemy as any).chase = Math.max(16, Math.round(((enemy as any).chase || 40) * 0.85))
      ;(enemy as any).touchDamage = ((enemy as any).touchDamage || 1) + 1
      enemy.setTint(0xff00ff)
      enemy.setScale(enemy.scaleX * 1.15, enemy.scaleY * 1.15)
      ;(enemy as any).isElite = true
      if (Math.random() < 0.5) {
        const fireDelay = Phaser.Math.Between(1200, 1800)
        const timer = this.scene.time.addEvent({ delay: fireDelay, loop: true, callback: () => {
          if (!enemy.active) { timer.remove(false); return }
          const player = this.player
          const ang = player ? Math.atan2(player.y - enemy.y, player.x - enemy.x) : Math.random() * Math.PI * 2
          this.config.spawnEnemyBullet(enemy.x, enemy.y, Phaser.Math.RadToDeg(ang))
        }})
        ;(enemy as any).on('destroy', () => timer.remove(false))
      }
    }
  }

  applyDamage(enemy: Phaser.Physics.Arcade.Sprite, damage: number): EnemyDamageResult {
    const hp = ((enemy as any).hp ?? 2) - damage
    ;(enemy as any).hp = hp
    const isBoss = !!(enemy as any).isBoss
    if (hp > 0) {
      if (isBoss) {
        const hpMax = (enemy as any).hpMax ?? hp
        this.config.onBossDamaged?.(enemy, hp, hpMax)
      }
      return { killed: false, wasBoss: isBoss }
    }
    this.handleEnemyDeath(enemy)
    if (isBoss) this.config.onBossKilled?.(enemy)
    return { killed: true, wasBoss: isBoss }
  }

  private handleEnemyDeath(enemy: Phaser.Physics.Arcade.Sprite) {
    const isBoss = !!(enemy as any).isBoss
    const isElite = !!((enemy as any).elite || (enemy as any).isElite)
    const isTank = enemy.texture?.key === 'enemy-tank'
    enemy.disableBody(true, true)
    if (isBoss) return
    if (isElite) {
      const r = Math.random()
      if (r < 0.03) {
        this.config.pickupManager.spawnPowerup(enemy.x, enemy.y)
      } else if (r < 0.53) {
        const bonus = Phaser.Math.FloatBetween(0.1, 0.4)
        const count = 1 + (Math.random() < Math.min(0.9, 0.4 + bonus) ? 1 : 0)
        for (let i = 0; i < count; i++) this.config.pickupManager.spawnXP(enemy.x, enemy.y, true)
      } else {
        this.config.pickupManager.spawnGoldBurst(enemy.x, enemy.y, 5)
      }
    } else if (isTank) {
      // Tank enemies drop 20 XP orange gems
      if (Math.random() < 0.8) this.config.pickupManager.spawnXP(enemy.x, enemy.y, false, 20, 0xff9933)
      if (Math.random() < 0.3) this.config.pickupManager.spawnGold(enemy.x, enemy.y)
    } else {
      if (Math.random() < 0.8) this.config.pickupManager.spawnXP(enemy.x, enemy.y)
      if (Math.random() < 0.3) this.config.pickupManager.spawnGold(enemy.x, enemy.y)
    }
  }

  updateEnemies(cx: number, cy: number, elapsedSec: number = 0, playerLevel: number = 1) {
    const player = this.player
    const despawnRadius = Math.hypot(this.scene.scale.width, this.scene.scale.height)
    const chaseSpeedBase = 40
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]

    for (const enemy of children) {
      if (!enemy || !enemy.active || !player) continue
      if (!enemy.body) enemy.enableBody(true, enemy.x, enemy.y, true, true)
      const stunUntil = ((enemy as any).stunUntil as number) || 0
      if (this.scene.time.now < stunUntil) continue

      const chaseSpeed = ((enemy as any).chase as number) || chaseSpeedBase
      const dx = player.x - enemy.x
      const dy = player.y - enemy.y
      const dist = Math.hypot(dx, dy) || 1
      const enemyType = enemy.texture?.key

      // Anti-kiting: Reduce spacing when enemies cluster (makes kiting harder)
      let spacingX = 0
      let spacingY = 0
      let nearbyCount = 0
      const spacingRadius = 180
      for (const other of children) {
        if (other === enemy || !other.active) continue
        const odx = enemy.x - other.x
        const ody = enemy.y - other.y
        const oDist = Math.hypot(odx, ody)
        if (oDist < spacingRadius && oDist > 0) {
          nearbyCount++
          // Weaker spacing when in groups to maintain threat
          const pushStrength = (spacingRadius - oDist) / spacingRadius * 0.5
          spacingX += (odx / oDist) * pushStrength
          spacingY += (ody / oDist) * pushStrength
        }
      }

      // Unique movement patterns per enemy type
      let vx = 0, vy = 0

      if (enemyType === 'enemy-chaser') {
        // Chaser: Fast aggressive pursuit with strong weaving - scales with player level
        // Level 1: 6x speed, Level 10+: 9x speed
        // Also gets slight boost from time (max +0.5x)
        const levelScale = Math.min(9, 6 + (playerLevel - 1) * 0.33)  // +0.33x per level
        const timeBonus = Math.min(0.5, elapsedSec / 360)  // +0.5x max over 6 minutes
        const chaserSpeedScale = levelScale + timeBonus

        // Weave intensity: Level 1: 0.3, Level 10+: 0.6
        const weaveIntensity = Math.min(0.6, 0.3 + (playerLevel - 1) * 0.033)
        const weaveTime = this.scene.time.now / 500
        const weaveOffset = Math.sin(weaveTime + enemy.x * 0.01) * weaveIntensity
        const perpX = -dy / dist
        const perpY = dx / dist
        vx = (dx / dist + perpX * weaveOffset) * chaseSpeed * chaserSpeedScale
        vy = (dy / dist + perpY * weaveOffset) * chaseSpeed * chaserSpeedScale
      } else if (enemyType === 'enemy-fodder') {
        // Fodder: Aggressive swarm behavior - rushes in groups
        const rushDistance = 500
        const aggressionBonus = Math.min(nearbyCount * 0.3, 2) // Faster when in groups

        if (dist > rushDistance) {
          // Fast approach when far
          vx = (dx / dist) * chaseSpeed * (7 + aggressionBonus)
          vy = (dy / dist) * chaseSpeed * (7 + aggressionBonus)
        } else {
          // Erratic close-range attacks
          const erraticAngle = Math.sin(this.scene.time.now * 0.003 + enemy.x * 0.02) * 1.2
          const targetAngle = Math.atan2(dy, dx) + erraticAngle
          vx = Math.cos(targetAngle) * chaseSpeed * (6 + aggressionBonus)
          vy = Math.sin(targetAngle) * chaseSpeed * (6 + aggressionBonus)
        }
      } else if (enemyType === 'enemy-tank') {
        // Tank: Longer, more frequent charges with prediction
        const chargeData = (enemy as any).chargeData || { nextCharge: this.scene.time.now + 1500, charging: false }
        ;(enemy as any).chargeData = chargeData

        if (this.scene.time.now >= chargeData.nextCharge && !chargeData.charging && dist < 800) {
          chargeData.charging = true
          chargeData.chargeEndTime = this.scene.time.now + 800  // Increased from 400 to 800
          chargeData.nextCharge = this.scene.time.now + Phaser.Math.Between(2000, 3500)  // More frequent
          // Predict player position for smarter charging
          const playerVelX = (player.body?.velocity.x || 0)
          const playerVelY = (player.body?.velocity.y || 0)
          chargeData.targetX = player.x + playerVelX * 0.3
          chargeData.targetY = player.y + playerVelY * 0.3
        }

        if (chargeData.charging && this.scene.time.now < chargeData.chargeEndTime) {
          // Charging at predicted position
          const cdx = (chargeData.targetX || player.x) - enemy.x
          const cdy = (chargeData.targetY || player.y) - enemy.y
          const cDist = Math.hypot(cdx, cdy) || 1
          vx = (cdx / cDist) * chaseSpeed * 15  // Increased from 12 to 15
          vy = (cdy / cDist) * chaseSpeed * 15
        } else {
          chargeData.charging = false
          // Faster base speed
          vx = (dx / dist) * chaseSpeed * 4.5  // Increased from 3 to 4.5
          vy = (dy / dist) * chaseSpeed * 4.5
        }
      } else {
        // Default: direct chase
        vx = (dx / dist) * chaseSpeed * 6
        vy = (dy / dist) * chaseSpeed * 6
      }

      // Apply reduced spacing force (makes clustering more dangerous)
      enemy.setVelocity(vx + spacingX * 40, vy + spacingY * 40)

      // Rotation
      if (enemy.texture && (enemy.texture.key === 'enemy-chaser' || enemy.texture.key === 'enemy-fodder' || enemy.texture.key === 'enemy-tank')) {
        if (Math.hypot(vx, vy) > 0.1) {
          const angle = Math.atan2(vy, vx) + Math.PI / 2
          enemy.setRotation(angle)
        }
      }

      // Despawn if too far
      const dcx = enemy.x - cx
      const dcy = enemy.y - cy
      const distCam = Math.hypot(dcx, dcy)
      if (distCam > despawnRadius * 1.5) enemy.disableBody(true, true)
    }
  }
}
