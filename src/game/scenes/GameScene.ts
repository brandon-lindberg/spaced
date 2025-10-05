import Phaser from 'phaser'
import { getOptions } from '../systems/options'
import { runState } from '../systems/runState'
import { attachGamepad, ensureGamepadProbe } from '../systems/gamepad'
import { audio } from '../systems/audio'
import { createSceneContext } from '../controllers/SceneServices'
import { BackgroundController } from '../controllers/BackgroundController'
import { PlayerController } from '../controllers/PlayerController'
import { PickupManager } from '../controllers/PickupManager'
import { RunProgressManager, type LevelUpChoice, type StatsSnapshot } from '../controllers/RunProgressManager'
import { EnemyManager, type SpawnContext } from '../controllers/EnemyManager'
import { BossManager } from '../controllers/BossManager'
import { ObstacleManager } from '../controllers/ObstacleManager'

export default class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite
  private playerController?: PlayerController
  private background?: BackgroundController
  private progressManager?: RunProgressManager
  private pickupManager?: PickupManager
  private enemyManager?: EnemyManager
  private bossManager?: BossManager
  private obstacleManager?: ObstacleManager

  private enemies!: Phaser.Physics.Arcade.Group
  private spawnAccumulator = 0
  private levelStartMs = 0

  private remainingSec = 0
  private stats: StatsSnapshot = {
    fireRate: 0.8,
    bulletDamage: 1,
    multishot: 1,
    speedMultiplier: 1,
    magnetRadius: 16,
    spreadDeg: 10,
    inlineExtraProjectiles: 0,
    bonusLevelsUsed: 0,
    hpCur: 10,
    hpMax: 10,
    hurtCooldown: 0,
  }

  private initializeWeaponCooldowns() {
    // Don't reset the entire object - preserve existing cooldowns
    if (!this.weaponCooldowns) {
      this.weaponCooldowns = {}
    }
    this.laserBeamAccum = 0
    const inv = this.progressManager?.getInventory()
    if (!inv) return
    // Only initialize cooldowns for weapons that don't have one yet
    for (const weapon of inv.weapons) {
      if (weapon.key.includes('blaster') && this.weaponCooldowns['blaster'] === undefined) {
        this.weaponCooldowns['blaster'] = 0
      }
      if (weapon.key.includes('missile') && this.weaponCooldowns['missiles'] === undefined) {
        this.weaponCooldowns['missiles'] = 0
      }
      if (weapon.key.includes('orb') && this.weaponCooldowns['orbs'] === undefined) {
        this.weaponCooldowns['orbs'] = 0
      }
    }
  }

  private handleLevelUpChoices(choices: LevelUpChoice[]) {
    this.scene.pause()
    this.time.timeScale = 0
    audio.sfxLevelUp()
    this.scene.launch('LevelUp', { choices })
    const applyOnce = (key: string) => {
      this.progressManager?.applyLevelUpChoice(key)
      this.game.events.off('levelup-apply', applyOnce)
      this.time.timeScale = 1
      this.scene.resume()
    }
    this.game.events.on('levelup-apply', applyOnce)
  }

  private handleLevelUpApplied(choiceKey: string) {
    if (choiceKey.startsWith('w-')) {
      this.initializeWeaponCooldowns()
    }
  }

  private handleStatsChanged(stats: StatsSnapshot) {
    this.stats = { ...stats }
    this.hurtCooldown = stats.hurtCooldown
  }

  // Basic weapon: Blaster
  private bullets!: Phaser.Physics.Arcade.Group
  private missileGroup!: Phaser.Physics.Arcade.Group
  private orbGroup!: Phaser.Physics.Arcade.Group
  private enemyBullets!: Phaser.Physics.Arcade.Group
  private bulletTextureKey = 'bullet'
  // Per-weapon cooldowns so weapons fire independently
  private weaponCooldowns: Record<string, number> = {}
  private laserAngle = 0
  private laserBeamAccum = 0
  // private laserTickCooldown = 0

  // Player health
  private hurtCooldown = 0

  // Dynamic quality scaling
  private qualityLevel = 0 // 0 = high, 1 = medium, 2 = low
  private fpsAcc = 0
  private lowFpsTime = 0
  private highFpsTime = 0
  private readonly qualityZoom: number[] = [1.0, 1.15, 1.3]
  private readonly spawnCapScale: number[] = [1.0, 0.85, 0.7]
  private readonly spawnRateScale: number[] = [1.0, 0.9, 0.8]

  constructor() {
    super('Game')
  }

  create() {
    const level = runState.state?.level ?? 1

    this.background = new BackgroundController(this, { qualityZoom: this.qualityZoom })
    this.background.init(level)

    audio.init(this)
    audio.startMusic(this)

    const sceneCtx = createSceneContext(this, { audio, runState, getOptions })

    const progressHandlers = {
      onLevelUpChoices: (choices: LevelUpChoice[]) => this.handleLevelUpChoices(choices),
      onLevelUpApplied: (choiceKey: string) => this.handleLevelUpApplied(choiceKey),
      onStatsChanged: (stats: StatsSnapshot) => this.handleStatsChanged(stats),
      onCheckpoint: () => {},
    }
    this.progressManager = new RunProgressManager(this, progressHandlers)
    this.progressManager.initializeFromRegistry()
    this.stats = this.progressManager.getStats()
    this.hurtCooldown = this.stats.hurtCooldown

    this.playerController = new PlayerController(sceneCtx)
    this.player = this.playerController.initSprite()

    this.enemyBullets = this.physics.add.group({ maxSize: 300 })
    this.physics.add.overlap(this.player, this.enemyBullets, (_p, b) => {
      const bullet = b as Phaser.Physics.Arcade.Sprite
      bullet.disableBody(true, true)
      const dmg = (bullet as any).damage ?? 1
      this.onPlayerHitProjectile(bullet.x, bullet.y, dmg)
    })

    this.pickupManager = new PickupManager(this, { progress: this.progressManager })
    this.pickupManager.initGroups()
    this.pickupManager.setupPlayerColliders(this.player)

    this.enemyManager = new EnemyManager(this, {
      pickupManager: this.pickupManager,
      spawnEnemyBullet: (x, y, angle) => this.spawnEnemyBullet(x, y, angle),
    })
    this.enemies = this.enemyManager.initGroup()
    this.enemyManager.setPlayer(this.player)
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Phaser.Physics.Arcade.Sprite
      if (!enemy.active) return
      this.onPlayerTouched(enemy)
    })

    this.bossManager = new BossManager(this, {
      enemyGroup: this.enemies,
      spawnEnemyBullet: (x, y, angle) => this.spawnEnemyBullet(x, y, angle),
      getPlayer: () => this.player,
      onVictory: () => {
        this.scene.stop('HUD')
        this.scene.start('Victory')
      },
    })
    this.enemyManager.setBossHandlers({
      onBossDamaged: (enemy, hp, hpMax) => this.bossManager?.handleBossDamaged(enemy, hp, hpMax),
      onBossKilled: (enemy) => this.bossManager?.handleBossDefeated(enemy),
    })

    this.obstacleManager = new ObstacleManager(this, {
      enemyGroup: this.enemies,
      onCollision: (objA, objB) => this.onAsteroidHit(objA, objB),
    })
    this.obstacleManager.setPlayer(this.player)

    const rs = runState.startLevel(level, this.time.now)
    this.levelStartMs = rs?.levelStartMs ?? this.time.now
    this.remainingSec = rs?.levelDurationSec ?? 900
    this.spawnAccumulator = 0
    this.registry.set('boss-hp', null)
    this.bossManager?.resetForLevel()
    this.obstacleManager?.reset()

    if (!this.weaponCooldowns || Object.keys(this.weaponCooldowns).length === 0) {
      this.initializeWeaponCooldowns()
    }

    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.scale.off('resize', this.handleResize, this)
    })

    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true

    // Player <-> enemy collision damage
    // already wired via enemyManager overlap above

    // Inventory (persist across level restarts within run)
    // Touch joystick handled by PlayerController

    // Gamepad setup
    this.input.gamepad?.once('connected', () => {})
    ensureGamepadProbe(this)

    // Pause wiring: ESC or P opens Pause
    const openPause = () => {
      if (this.scene.isPaused()) return
      // Globally pause time and physics for this scene
      this.time.timeScale = 0
      this.physics.world.isPaused = true
      this.scene.launch('Pause')
      this.scene.pause()
    }
    this.input.keyboard?.on('keydown-ESC', openPause)
    this.input.keyboard?.on('keydown-P', openPause)
    attachGamepad(this, { pause: openPause })

    // Mobile pause button overlay (top-right)
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
    if (isMobile) {
      const place = (t: Phaser.GameObjects.Text) => t.setPosition(this.scale.width - 10, this.scale.height - 26)
      const btn = this.add.text(0, 0, 'II', { fontFamily:'monospace', fontSize:'12px', color:'#ffffff', backgroundColor:'#111144', padding:{ x:4, y:2 } }).setOrigin(1,0).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor:true })
      place(btn)
      btn.on('pointerdown', openPause)
      this.scale.on('resize', () => place(btn))
    }

    this.game.events.on('pause-closed', () => {
      // Resume time and physics
      this.time.timeScale = 1
      this.physics.world.isPaused = false
    })
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.playerController || !this.progressManager) return
    const dt = delta / 1000
    const speed = 80 * this.stats.speedMultiplier
    this.playerController.update(speed)

    const cam = this.cameras.main
    this.background?.update(cam)

    this.updateDynamicQuality(dt)
    this.progressManager?.tickHurtCooldown(dt)

    this.remainingSec = Math.max(0, this.remainingSec - dt)
    const total = (runState.state?.levelDurationSec ?? 900)
    const elapsedSec = Math.max(0, total - this.remainingSec)
    const wave = 0.6 + 0.4 * Math.sin(elapsedSec * 0.25)
    const spawnPerSecBase = Math.min(5, (0.3 + elapsedSec * 0.015) * wave)
    const spawnPerSec = spawnPerSecBase * this.spawnRateScale[this.qualityLevel]
    this.spawnAccumulator += spawnPerSec * dt
    const capBase = Math.min(70, 10 + Math.floor(elapsedSec * 0.5))
    const targetCap = Math.floor(capBase * this.spawnCapScale[this.qualityLevel])
    const camCenter = this.getCameraCenter()
    const level = runState.state?.level ?? 1

    while (this.remainingSec > 0 && this.spawnAccumulator >= 1) {
      if (this.enemies.countActive(true) + 1 > targetCap) break
      this.spawnAccumulator -= 1
      const ctx: SpawnContext = {
        elapsedSec,
        remainingSec: this.remainingSec,
        levelDurationSec: total,
        levelStartMs: this.levelStartMs,
      }
      this.enemyManager?.spawnEnemyVariant(camCenter.x, camCenter.y, ctx)
    }

    this.enemyManager?.updateEnemies(camCenter.x, camCenter.y)

    if (level === 2) {
      this.obstacleManager?.update(dt, camCenter)
    }

    this.pickupManager?.update(dt, this.stats.magnetRadius, camCenter, this.bossManager?.isBossActive() ?? false)

    // Level timer and victory
    this.registry.set('time-left', Math.ceil(this.remainingSec))
    this.bossManager?.update(level, this.remainingSec, camCenter)

    // Autofire weapon
    this.updateWeapon(dt)
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const width = gameSize?.width ?? this.scale.width
    const height = gameSize?.height ?? this.scale.height
    this.background?.handleResize(width, height, this.qualityLevel)
    this.playerController?.handleResize(width, height)
  }

  private ensureBulletAssets() {
    if (!this.bullets) {
      this.bullets = this.physics.add.group({ maxSize: 300 })
      this.physics.add.overlap(
        this.bullets,
        this.enemies,
        (_obj1, _obj2) => {
          const b = _obj1 as Phaser.GameObjects.GameObject
          const e = _obj2 as Phaser.GameObjects.GameObject
          this.onBulletHit(b, e)
        }
      )
    }
    // Ensure enemy bullet group exists and colliders are set (player overlap added in create)
    if (!this.enemyBullets) {
      this.enemyBullets = this.physics.add.group({ maxSize: 300 })
    }
    if (!this.missileGroup) {
      this.missileGroup = this.physics.add.group({ maxSize: 120 })
      this.physics.add.overlap(this.missileGroup, this.enemies, (_b, _e) => this.onBulletHit(_b as any, _e as any))
    }
    if (!this.orbGroup) {
      this.orbGroup = this.physics.add.group({ maxSize: 90 })
      this.physics.add.overlap(this.orbGroup, this.enemies, (_b, _e) => this.onBulletHit(_b as any, _e as any))
    }
    if (!this.textures.exists(this.bulletTextureKey)) {
      const size = 2
      const gfx = this.add.graphics()
      gfx.fillStyle(0x88ff88, 1)
      gfx.fillRect(0, 0, size, size)
      gfx.generateTexture(this.bulletTextureKey, size, size)
      gfx.destroy()
    }
    if (!this.textures.exists('missile-tex')) {
      const g = this.add.graphics()
      g.fillStyle(0xffaa33, 1)
      g.fillRect(0, 0, 3, 5)
      g.generateTexture('missile-tex', 3, 5)
      g.destroy()
    }
    if (!this.textures.exists('orb-tex')) {
      const g = this.add.graphics()
      g.fillStyle(0x66ccff, 1)
      g.fillCircle(4, 4, 4)
      g.generateTexture('orb-tex', 8, 8)
      g.destroy()
    }
    if (!this.textures.exists('beam-tex')) {
      const g = this.add.graphics()
      g.fillStyle(0xff66ff, 1)
      g.fillRect(0, 0, 8, 2)
      g.generateTexture('beam-tex', 8, 2)
      g.destroy()
    }
    if (!this.textures.exists('blaster-tex')) {
      const g = this.add.graphics(); g.fillStyle(0xffffff, 1); g.fillRect(0,0,3,3); g.generateTexture('blaster-tex',3,3); g.destroy()
    }
    if (!this.textures.exists('laser-shot-tex')) {
      const g = this.add.graphics(); g.fillStyle(0xff66ff, 1); g.fillRect(0,0,2,2); g.generateTexture('laser-shot-tex',2,2); g.destroy()
    }
    if (!this.textures.exists('explosion-tex')) {
      const s = 32
      const can = this.textures.createCanvas('explosion-tex', s, s)
      const ctx = can?.getContext()
      if (ctx && can) {
        const cx = s / 2, cy = s / 2, r = s / 2
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, 'rgba(255,220,120,1)')
        grad.addColorStop(0.5, 'rgba(255,120,60,0.6)')
        grad.addColorStop(1, 'rgba(255,120,60,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, s, s)
        can.refresh()
      }
    }
  }

  private updateWeapon(dt: number) {
    this.ensureBulletAssets()
    const inv = this.progressManager?.getInventory()
    if (!inv) return
    const has = (k: string) => inv.weapons.some((w) => w.key === k)
    const hasBlaster = has('blaster') || has('scatter-blaster') || has('pulse-blaster')
    const hasMissiles = has('missiles') || has('cluster-missiles')
    const hasOrbs = has('orb') || has('nova-orb')
    const fireRate = this.stats.fireRate


    // Per-weapon cooldowns so weapons don't rely on each other
    const step = (key: string, rate: number, fire: () => void) => {
      const oldCooldown = this.weaponCooldowns[key] ?? 0
      const cur = oldCooldown - dt
      this.weaponCooldowns[key] = cur
      if (cur <= 0 && this.player) {
        const newCooldown = 1 / Math.max(0.1, rate)
        this.weaponCooldowns[key] = newCooldown
        fire()
      }
    }
    const muzzle = 6
    // Blaster family
    if (hasBlaster) {
      step('blaster', fireRate, () => {
        const baseAngle = this.playerController?.getAimAngle(this.enemies) ?? 0
        const baseRad = Phaser.Math.DegToRad(baseAngle)
        const inlineCount = Math.max(0, Math.floor(this.stats.inlineExtraProjectiles))
        for (let i = 0; i <= inlineCount; i++) {
          const back = i * 8
          const speedScale = 1 - Math.min(0.6, i * 0.12)
          const ox = this.player!.x + Math.cos(baseRad) * (muzzle - back)
          const oy = this.player!.y + Math.sin(baseRad) * (muzzle - back)
          this.spawnBullet(ox, oy, baseAngle, 300 * speedScale, 'blaster')
        }
        const blasterLevel = (inv.weapons.find(w => w.key.includes('blaster'))?.level) || 1
        audio.sfxShotBlaster(blasterLevel)
        const spread = this.stats.spreadDeg || 10
        const fanShots = Math.max(1, Math.floor(this.stats.multishot))
        if (fanShots > 1) {
          const half = (fanShots - 1) / 2
          for (let i = -half; i <= half; i++) {
            if (i === 0) continue
            const a = baseAngle + (i as number) * spread
            const rad = Phaser.Math.DegToRad(a)
            const ox = this.player!.x + Math.cos(rad) * muzzle
            const oy = this.player!.y + Math.sin(rad) * muzzle
            this.spawnBullet(ox, oy, a, undefined, 'blaster')
          }
        }
      })
    }
    // Missiles
    if (hasMissiles) {
      step('missiles', fireRate, () => {
        const a = this.playerController?.getAimAngle(this.enemies) ?? 0
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player!.x + Math.cos(rad) * muzzle
        const oy = this.player!.y + Math.sin(rad) * muzzle
        this.spawnMissile(ox, oy, a)
        const missilesLevel = (inv.weapons.find(w => w.key.includes('missile'))?.level) || 1
        audio.sfxShotMissile(missilesLevel)
      })
    }
    // Orbs (staggered fire)
    if (hasOrbs) {
      step('orbs', fireRate, () => {
        const a = this.playerController?.getAimAngle(this.enemies) ?? 0
        const rad = Phaser.Math.DegToRad(a)
        const muzzleOrb = 12
        const ox = this.player!.x + Math.cos(rad) * muzzleOrb
        const oy = this.player!.y + Math.sin(rad) * muzzleOrb
        this.time.delayedCall(120, () => {
          this.spawnOrb(ox, oy, a)
          const orbLevel = (inv.weapons.find(w => w.key.includes('orb'))?.level) || 1
          audio.sfxShotOrb(orbLevel)
        })
      })
    }
    // Despawn far bullets
    const cam = this.cameras.main
    const bounds = new Phaser.Geom.Rectangle(cam.scrollX - 40, cam.scrollY - 40, cam.width + 80, cam.height + 80)
    const arrB = this.safeGroupChildren(this.bullets) as Phaser.Physics.Arcade.Sprite[]
    const arrM = this.safeGroupChildren(this.missileGroup) as Phaser.Physics.Arcade.Sprite[]
    const arrO = this.safeGroupChildren(this.orbGroup) as Phaser.Physics.Arcade.Sprite[]
    for (const b of [...arrB, ...arrM, ...arrO]) {
      if (!b.active) continue
      // simple homing for missiles
      if ((b as any).missile) {
        let nearest: Phaser.Physics.Arcade.Sprite | null = null
        let best = Infinity
        const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
        for (const e of enemies) {
          if (!e || !e.active) continue
          const dx = e.x - b.x, dy = e.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 < best) { best = d2; nearest = e }
        }
        if (nearest) {
          const dx = nearest.x - b.x, dy = nearest.y - b.y
          const sp = Math.hypot(b.body!.velocity.x, b.body!.velocity.y) || 140
          const ang = Math.atan2(dy, dx)
          b.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp)
        }
      }
      if (!Phaser.Geom.Rectangle.Contains(bounds, b.x, b.y)) {
        b.disableBody(true, true)
      }
    }

    // Handle laser spiral independently so it fires even when blaster cooldown is active
    const wLaser = inv.weapons.find((w) => w.key === 'laser')
    const wBeam = inv.weapons.find((w) => w.key === 'beam-laser')
    const hasLaser = !!wLaser
    const hasBeamLaser = !!wBeam
    if (this.player && (hasLaser || hasBeamLaser)) {
      const lvl = (wBeam?.level ?? wLaser?.level ?? 1)
      // Level-scaled spin speed and fire rate (slow at low levels, faster later)
      const spinBase = 140 + 25 * (lvl - 1)
      const spinSpeed = spinBase * (hasBeamLaser ? 1.15 : 1)
      const baseRate = 0.5 + 0.35 * (lvl - 1) // beams per second before global modifiers
      const rate = baseRate * (fireRate / 1.2) * (hasBeamLaser ? 1.2 : 1)
      this.laserAngle = (this.laserAngle + spinSpeed * dt) % 360
      this.laserBeamAccum += dt
      if (this.laserBeamAccum >= 1 / Math.max(0.1, rate)) {
        this.laserBeamAccum -= 1 / Math.max(0.1, rate)
        const a = this.laserAngle
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player.x + Math.cos(rad) * 14
        const oy = this.player.y + Math.sin(rad) * 14
        const len = hasBeamLaser ? 140 : 105
        const thickness = (hasBeamLaser ? 6 : 4) + (lvl - 1) * (hasBeamLaser ? 2 : 1.5)
        this.spawnBeam(ox, oy, a, len, thickness)
        this.applyBeamDamage(ox, oy, a, len, Math.max(1, this.stats.bulletDamage * (hasBeamLaser ? 1.2 : 1.0)), thickness)
        const shot = this.bullets.get(ox, oy, 'laser-shot-tex') as Phaser.Physics.Arcade.Sprite
        if (shot) {
          shot.setTexture('laser-shot-tex')  // Ensure correct texture
          shot.setActive(true).setVisible(true)
          shot.enableBody(true, ox, oy, true, true)
          shot.setDepth(5)
          shot.body?.setSize(2, 2, true)
          shot.setCircle(1, 0, 0)
          const vs = 220
          const vrad = Phaser.Math.DegToRad(a)
          shot.setVelocity(Math.cos(vrad) * vs, Math.sin(vrad) * vs)
          ;(shot as any).damage = Math.max(1, Math.floor(this.stats.bulletDamage * 1.0))

          // Cancel any existing timer from previous use
          if ((shot as any).disableTimer) {
            (shot as any).disableTimer.remove()
          }
          ;(shot as any).disableTimer = this.time.delayedCall(300, () => shot.active && shot.disableBody(true, true))
        }
      }
    }
  }

  private spawnBullet(x: number, y: number, angleDeg: number, speedOverride?: number, weaponType?: string) {
    const tex = 'blaster-tex'
    this.ensureBulletAssets()
    if (!this.bullets) {
      return
    }
    let b = this.bullets.get(x, y, tex) as Phaser.Physics.Arcade.Sprite
    if (!b) {
      b = this.bullets.create(x, y, tex) as Phaser.Physics.Arcade.Sprite
      if (!b) {
        return
      }
    }
    b.setTexture(tex)  // Ensure correct texture when reusing pooled sprites
    b.setActive(true).setVisible(true)
    b.enableBody(true, x, y, true, true)
    b.setDepth(5)
    b.body?.setSize(2, 2, true)
    b.setCircle(1, 0, 0)
    // Reset any reused flags from enemy bullets or other projectile types
    ;(b as any).enemyBullet = false
    delete (b as any).missile
    delete (b as any).orb
    const speed = typeof speedOverride === 'number' ? speedOverride : 300
    const rad = Phaser.Math.DegToRad(angleDeg)
    b.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(b as any).damage = this.stats.bulletDamage
    ;(b as any).weaponType = weaponType || 'unknown'

    // Cancel any existing timer from previous use
    if ((b as any).disableTimer) {
      (b as any).disableTimer.remove()
    }

    if (import.meta.env.DEV) {
      const dbg = this.add.rectangle(x, y, 2, 2, 0x00ff00, 0.6).setDepth(1000)
      this.tweens.add({ targets: dbg, alpha: 0, duration: 400, onComplete: () => dbg.destroy() })
    }
    // Auto-disable after 2s to avoid endless bullets
    ;(b as any).disableTimer = this.time.delayedCall(2000, () => {
      if (b.active) {
        b.disableBody(true, true)
      }
    })
  }

  private spawnMissile(x: number, y: number, angleDeg: number) {
    this.ensureBulletAssets()
    if (!this.missileGroup) {
      return
    }
    let m = this.missileGroup.get(x, y, 'missile-tex') as Phaser.Physics.Arcade.Sprite
    if (!m) {
      m = this.missileGroup.create(x, y, 'missile-tex') as Phaser.Physics.Arcade.Sprite
      if (!m) return
    }
    m.setTexture('missile-tex')  // Ensure correct texture
    m.setActive(true).setVisible(true)
    m.enableBody(true, x, y, true, true)
    m.setDepth(5)
    m.body?.setSize(5, 5, true)
    m.setCircle(3, 0, 0)
    const speed = 160
    const rad = Phaser.Math.DegToRad(angleDeg)
    m.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(m as any).damage = Math.max(1, Math.floor(this.stats.bulletDamage * 1.5))
    ;(m as any).missile = true
    ;(m as any).weaponType = 'missile'

    // Cancel any existing timer from previous use
    if ((m as any).disableTimer) {
      (m as any).disableTimer.remove()
    }

    ;(m as any).disableTimer = this.time.delayedCall(3500, () => {
      if (m.active) {
        m.disableBody(true, true)
      }
    })
  }

  private spawnOrb(x: number, y: number, angleDeg: number) {
    this.ensureBulletAssets()
    if (!this.orbGroup) {
      return
    }
    let o = this.orbGroup.get(x, y, 'orb-tex') as Phaser.Physics.Arcade.Sprite
    if (!o) {
      o = this.orbGroup.create(x, y, 'orb-tex') as Phaser.Physics.Arcade.Sprite
      if (!o) {
        return
      }
    }
    o.setTexture('orb-tex')  // Ensure correct texture
    o.setActive(true).setVisible(true)
    o.enableBody(true, x, y, true, true)
    o.setDepth(5)
    o.body?.setSize(8, 8, true)
    o.setCircle(4, 0, 0)
    const speed = 110
    const rad = Phaser.Math.DegToRad(angleDeg)
    o.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(o as any).damage = this.stats.bulletDamage
    ;(o as any).orb = true
    ;(o as any).exploded = false
    ;(o as any).bornUntil = this.time.now + 120
    ;(o as any).weaponType = 'orb'
    
  }

  private explodeOrb(o: Phaser.Physics.Arcade.Sprite) {
    if ((o as any).exploded) return
    ;(o as any).exploded = true
    const radius = 28
    const cx = o.x, cy = o.y
    this.showExplosion(cx, cy, radius)
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const e of children) {
      if (!e || !e.active) continue
      const dx = e.x - cx, dy = e.y - cy
      if (dx * dx + dy * dy <= radius * radius) {
        this.showHitSpark(e.x, e.y)
        this.enemyManager?.applyDamage(e, Math.max(1, Math.floor(this.stats.bulletDamage * 1.2)))
      }
    }
    o.disableBody(true, true)
  }

  private spawnBeam(x: number, y: number, angleDeg: number, length: number, thickness: number) {
    const img = this.add.image(x, y, 'beam-tex').setOrigin(0, 0.5).setDepth(900)
    img.rotation = Phaser.Math.DegToRad(angleDeg)
    // scale X stretches the beam texture; scale Y controls visual thickness
    img.setScale(length / 8, Math.max(1, thickness / 3))
    this.tweens.add({ targets: img, alpha: 0, duration: 120, onComplete: () => img.destroy() })
  }

  private applyBeamDamage(x: number, y: number, angleDeg: number, length: number, dmg: number, thickness: number) {
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
    const rad = Phaser.Math.DegToRad(angleDeg)
    const dirx = Math.cos(rad)
    const diry = Math.sin(rad)
    thickness = Math.max(4, thickness)
    // Draw corridor for the beam hitbox (always visible briefly)
    const g = this.add.graphics().setDepth(999)
    g.fillStyle(0x00ffff, 0.15)
    const nx = -diry, ny = dirx
    const hx = nx * thickness
    const hy = ny * thickness
    g.beginPath()
    g.moveTo(x + hx, y + hy)
    g.lineTo(x - hx, y - hy)
    g.lineTo(x - hx + dirx * length, y - hy + diry * length)
    g.lineTo(x + hx + dirx * length, y + hy + diry * length)
    g.closePath()
    g.fillPath()
    this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() })
    for (const e of enemies) {
      if (!e || !e.active) continue
      const vx = e.x - x
      const vy = e.y - y
      const t = vx * dirx + vy * diry
      if (t < 0 || t > length) continue
      const px = x + dirx * t
      const py = y + diry * t
      const dx = e.x - px
      const dy = e.y - py
      if (dx * dx + dy * dy <= thickness * thickness) {
        this.showHitSpark(e.x, e.y)
        const marker = this.add.rectangle(e.x, e.y, 3, 3, 0x00ffff, 0.9).setDepth(1000)
        this.tweens.add({ targets: marker, alpha: 0, duration: 250, onComplete: () => marker.destroy() })
        this.enemyManager?.applyDamage(e, Math.max(1, Math.floor(dmg)))
      }
    }
  }

  private showExplosion(x: number, y: number, radius: number) {
    const ex = this.add.image(x, y, 'explosion-tex').setDepth(850)
    const scale = Math.max(0.5, radius / 16)
    ex.setScale(scale)
    this.tweens.add({ targets: ex, alpha: 0, scale: scale * 1.2, duration: 220, onComplete: () => ex.destroy() })
    // Explosion SFX
    audio.sfxExplosion()
  }

  private showHitSpark(x: number, y: number) {
    const s = this.add.rectangle(x, y, 3, 3, 0xffffff, 1).setDepth(900)
    this.tweens.add({ targets: s, alpha: 0, duration: 120, onComplete: () => s.destroy() })
  }

  // Defensive helper for groups that may be undefined early in scene lifecycle
  private safeGroupChildren(group?: Phaser.GameObjects.Group | Phaser.Physics.Arcade.Group) {
    const anyGroup: any = group as any
    if (!anyGroup || !anyGroup.children || !anyGroup.children.entries) return []
    return anyGroup.children.entries as Phaser.GameObjects.GameObject[]
  }

  private onBulletHit(bullet: Phaser.GameObjects.GameObject, enemyObj: Phaser.GameObjects.GameObject) {
    const b = bullet as Phaser.Physics.Arcade.Sprite
    const e = enemyObj as Phaser.Physics.Arcade.Sprite
    if ((b as any).enemyBullet) return
    // If an orb touches an enemy, trigger explosion immediately
    if ((b as any).orb) {
      // Ignore collisions for newly spawned orbs to avoid immediate detonation
      const bornUntil = (b as any).bornUntil as number | undefined
      if (!bornUntil || this.time.now >= bornUntil) {
        this.explodeOrb(b)
      }
      return
    }
    const damage = (b as any).damage ?? 1
    this.showHitSpark(e.x, e.y)
    b.disableBody(true, true)
    if ((b as any).missile) {
      this.showExplosion(e.x, e.y, 20)
    }
    this.enemyManager?.applyDamage(e, damage)
  }

  private onPlayerTouched(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!this.player || this.hurtCooldown > 0 || !this.progressManager) return
    const dmg = ((enemy as any).touchDamage as number) || 1
    const result = this.progressManager.takeDamage(dmg)
    this.stats.hpCur = result.hpCur
    this.stats.hpMax = result.hpMax
    this.hurtCooldown = 0.8
    audio.sfxHurt()
    // Knockback player away from enemy
    const dxp = this.player.x - enemy.x
    const dyp = this.player.y - enemy.y
    const ang = Math.atan2(dyp, dxp)
    const kb = 140
    this.player.setVelocity(Math.cos(ang) * kb, Math.sin(ang) * kb)
    // Flash
    this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true, duration: 80, repeat: 4 })
    // Subtle screen shake on hit if enabled
    if (getOptions().screenShake) this.cameras.main.shake(120, 0.004)
    // Brief enemy knockback and stun
    const kbe = 90
    if (enemy && (enemy as any).setVelocity) {
      enemy.setVelocity(Math.cos(ang + Math.PI) * kbe, Math.sin(ang + Math.PI) * kbe)
    }
    ;(enemy as any).stunUntil = this.time.now + 200
    if (result.died) {
      audio.stopMusic() // Stop background music when player dies
      this.time.delayedCall(0, () => {
        this.scene.stop('HUD')
        this.scene.stop('Game')
        this.scene.start('GameOver')
      })
    }
  }

  private onPlayerHitProjectile(px: number, py: number, dmg: number) {
    if (!this.player || this.hurtCooldown > 0 || !this.progressManager) return
    const result = this.progressManager.takeDamage(dmg)
    this.stats.hpCur = result.hpCur
    this.stats.hpMax = result.hpMax
    this.hurtCooldown = 0.8
    audio.sfxHurt()
    // Knockback away from projectile position
    const dxp = this.player.x - px
    const dyp = this.player.y - py
    const ang = Math.atan2(dyp, dxp)
    const kb = 120
    this.player.setVelocity(Math.cos(ang) * kb, Math.sin(ang) * kb)
    this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true, duration: 80, repeat: 3 })
    if (getOptions().screenShake) this.cameras.main.shake(90, 0.003)
    if (result.died) {
      audio.stopMusic() // Stop background music when player dies
      this.time.delayedCall(0, () => {
        this.scene.stop('HUD')
        this.scene.stop('Game')
        this.scene.start('GameOver')
      })
    }
  }

  private getCameraCenter() {
    const cam = this.cameras.main
    return { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2 }
  }

  private updateDynamicQuality(dt: number) {
    // Track FPS windows to adjust quality for iPhone 14 target (~60fps)
    const fps = this.game.loop.actualFps
    this.fpsAcc += dt
    if (fps < 50) {
      this.lowFpsTime += dt
      this.highFpsTime = 0
    } else if (fps > 58) {
      this.highFpsTime += dt
      this.lowFpsTime = 0
    } else {
      this.lowFpsTime = Math.max(0, this.lowFpsTime - dt)
      this.highFpsTime = Math.max(0, this.highFpsTime - dt)
    }
    // If sustained low FPS for 2s, lower quality (increase zoom, reduce spawns)
    if (this.lowFpsTime > 2 && this.qualityLevel < 2) {
      this.qualityLevel += 1
      this.lowFpsTime = 0
      this.handleResize(new Phaser.Structs.Size(this.scale.width, this.scale.height))
    }
    // If sustained high FPS for 6s, raise quality
    if (this.highFpsTime > 6 && this.qualityLevel > 0) {
      this.qualityLevel -= 1
      this.highFpsTime = 0
      this.handleResize(new Phaser.Structs.Size(this.scale.width, this.scale.height))
    }
  }

  private spawnEnemyBullet(x: number, y: number, angleDeg: number) {
    const b = this.enemyBullets.get(x, y, this.bulletTextureKey) as Phaser.Physics.Arcade.Sprite
    if (!b) return
    b.enableBody(true, x, y, true, true)
    b.setDepth(4)
    b.body?.setSize(2, 2, true)
    b.setCircle(1, 0, 0)
    const speed = 120
    const rad = Phaser.Math.DegToRad(angleDeg)
    b.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(b as any).damage = 1
    this.time.delayedCall(3000, () => b.active && b.disableBody(true, true))
  }

  private onAsteroidHit(objA: Phaser.Physics.Arcade.Sprite, objB: Phaser.Physics.Arcade.Sprite) {
    const now = this.time.now
    const hurt = (t: Phaser.Physics.Arcade.Sprite, amount: number, src: Phaser.Physics.Arcade.Sprite) => {
      if (t === this.player && this.progressManager) {
        if (this.hurtCooldown > 0) return
        this.hurtCooldown = 0.6
        const result = this.progressManager.takeDamage(amount)
        this.stats.hpCur = result.hpCur
        this.stats.hpMax = result.hpMax
        audio.sfxHurt()
        const ang = Math.atan2(this.player!.y - src.y, this.player!.x - src.x)
        this.player!.setVelocity(Math.cos(ang) * 120, Math.sin(ang) * 120)
        if (result.died) {
          audio.stopMusic()
          this.scene.stop('HUD')
          this.scene.start('GameOver')
        }
      } else {
        ;(t as any).hp = Math.max(0, ((t as any).hp ?? 2) - amount)
        if ((t as any).hp <= 0) t.disableBody(true, true)
      }
    }
    const tryDamage = (rock: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite) => {
      const cd = (rock as any).damageCooldownUntil as number
      if (now < cd) return
      ;(rock as any).damageCooldownUntil = now + 500
      hurt(target, 1, rock)
    }
    if ((objA as any).isAsteroid) tryDamage(objA, objB)
    else if ((objB as any).isAsteroid) tryDamage(objB, objA)
  }
}
