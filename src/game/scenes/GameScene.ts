import Phaser from 'phaser'
// options are referenced dynamically in onPlayerTouched to avoid import inlining issues
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons, MAX_WEAPON_LEVEL, MAX_ACCESSORY_LEVEL } from '../systems/inventory'
import { evolveWeapon } from '../systems/inventory'
import { defaultBaseStats, applyWeaponLevel, applyAccessoryLevel, computeEvolution } from '../systems/items'
import { getOptions } from '../systems/options'
import { runState } from '../systems/runState'
import type { InventoryState } from '../systems/inventory'

export default class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>
  private lastAimDeg = 0
  private lastMoveX = 0
  private lastMoveY = 0

  // Boss state
  private bossActive = false
  private gauntletActive = false
  private gauntletStage = 0
  private bossTimers: Phaser.Time.TimerEvent[] = []
  private currentBoss?: Phaser.Physics.Arcade.Sprite
  private currentBossType = 0
  private currentBossPhase = -1

  private bgFar?: Phaser.GameObjects.TileSprite
  private bgMid?: Phaser.GameObjects.TileSprite
  private bgNear?: Phaser.GameObjects.TileSprite
  private bgSun?: Phaser.GameObjects.Image
  // Asteroid obstacles (Level 2)
  private asteroidStatics?: Phaser.Physics.Arcade.Group
  private asteroidMovers?: Phaser.Physics.Arcade.Group
  private asteroidSpawnAcc = 0
  private asteroidMoveSpawnAcc = 0

  private enemies!: Phaser.Physics.Arcade.Group
  private enemyTextureKey = 'enemy-square'
  private spawnAccumulator = 0
  private levelStartMs = 0

  private xpGroup!: Phaser.Physics.Arcade.Group
  private goldGroup!: Phaser.Physics.Arcade.Group
  private healthGroup!: Phaser.Physics.Arcade.Group
  private powerupGroup!: Phaser.Physics.Arcade.Group
  private xpTextureKey = 'xp-gem'
  private goldTextureKey = 'gold-coin'
  private healthTextureKey = 'health-pack'
  private powerupTextureKey = 'powerup-chip'
  // removed passive pickup spawners

  private level = 1
  private xpToNext = 3
  private magnetRadius = 16
  private speedMultiplier = 1

  // Basic weapon: Blaster
  private bullets!: Phaser.Physics.Arcade.Group
  private missileGroup!: Phaser.Physics.Arcade.Group
  private orbGroup!: Phaser.Physics.Arcade.Group
  private enemyBullets!: Phaser.Physics.Arcade.Group
  private bulletTextureKey = 'bullet'
  private fireRate = 0.8 // slower base; upgrades increase this
  private bulletDamage = 1
  private multishot = 1
  private inlineExtraProjectiles = 0
  private spreadDeg = 10
  // In-run bonus modifiers from level-up choices (applied on top of inventory stats)
  private bonusFireRateMul = 1
  private bonusDamage = 0
  private bonusMultishot = 0
  private bonusSpeedMul = 1
  private bonusMagnet = 0
  private bonusLevelsUsed = 0
  private readonly maxBonusLevels = 10
  // Per-weapon cooldowns so weapons fire independently
  private weaponCooldowns: Record<string, number> = {}
  private laserAngle = 0
  private laserBeamAccum = 0
  private pauseStartMs: number | null = null
  // private laserTickCooldown = 0

  // Player health
  private hpMax = 10
  private hpCur = 10
  private hurtCooldown = 0

  // Dynamic quality scaling
  private qualityLevel = 0 // 0 = high, 1 = medium, 2 = low
  private fpsAcc = 0
  private lowFpsTime = 0
  private highFpsTime = 0
  private readonly qualityZoom: number[] = [1.0, 1.15, 1.3]
  private readonly spawnCapScale: number[] = [1.0, 0.85, 0.7]
  private readonly spawnRateScale: number[] = [1.0, 0.9, 0.8]

  // Touch joystick
  private joyBase?: Phaser.GameObjects.Arc
  private joyThumb?: Phaser.GameObjects.Arc
  private joyActive = false
  private joyPointerId: number | null = null
  private joyCenterX = 0
  private joyCenterY = 0
  private joyVecX = 0
  private joyVecY = 0
  private readonly joyRadius = 26

  constructor() {
    super('Game')
  }

  create() {
    // Restore health at the start of every level
    this.hpCur = this.hpMax
    // Build background for current level
    this.setupBackgroundForLevel((runState.state?.level ?? 1))

    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2
    this.player = this.physics.add.sprite(centerX, centerY, '')
    // Player hitbox tuning: slightly smaller than sprite for fair collisions
    this.player.setCircle(3, 1, 1)
    this.player.setCollideWorldBounds(false)

    const gfx = this.add.graphics()
    gfx.fillStyle(0xffffff, 1)
    gfx.fillRect(-4, -4, 8, 8)
    const textureKey = 'player-square'
    gfx.generateTexture(textureKey, 8, 8)
    gfx.destroy()
    this.player.setTexture(textureKey)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.cursors = this.input.keyboard?.createCursorKeys()
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>

    this.scale.on('resize', this.handleResize, this)

    // Make sure input is enabled every run
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true

    this.createEnemyTexture(this.enemyTextureKey)
    this.enemies = this.physics.add.group()
    // Prevent enemies from overlapping each other (basic separation)
    this.physics.add.collider(this.enemies, this.enemies)
    const rs = runState.startLevel(runState.state?.level ?? 1, this.time.now)
    this.levelStartMs = rs?.levelStartMs ?? this.time.now

    // Reset per-level state
    this.level = 1
    this.xpToNext = 3
    this.spawnAccumulator = 0
    this.registry.set('xp', 0)
    this.registry.set('level', 1)
    this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
    if (this.registry.get('gold') === undefined || this.registry.get('gold') === null) {
      this.registry.set('gold', 0)
    }
    this.registry.set('boss-hp', null)
    // Reset in-run bonus modifiers
    this.bonusFireRateMul = 1
    this.bonusDamage = 0
    this.bonusMultishot = 0
    this.bonusSpeedMul = 1
    this.bonusMagnet = 0
    this.bonusLevelsUsed = 0
    // Reset per-run firing bonuses and cooldowns
    this.inlineExtraProjectiles = 0
    this.weaponCooldowns = {}
    this.laserBeamAccum = 0

    // Pickups
    this.createXPGemTexture(this.xpTextureKey)
    this.createXPGemEliteTexture('xp-gem-elite')
    this.createGoldTexture(this.goldTextureKey)
    this.createGoldEliteTexture('gold-coin-elite')
    this.createHealthTexture(this.healthTextureKey)
    this.createPowerupTexture(this.powerupTextureKey)
    this.xpGroup = this.physics.add.group()
    this.goldGroup = this.physics.add.group()
    this.healthGroup = this.physics.add.group()
    this.powerupGroup = this.physics.add.group()
    // Separate enemy bullet group
    this.enemyBullets = this.physics.add.group({ maxSize: 300 })
    // Collide enemy bullets with player only
    this.physics.add.overlap(this.player, this.enemyBullets, (_p, b) => {
      const bullet = b as Phaser.Physics.Arcade.Sprite
      bullet.disableBody(true, true)
      const dmg = (bullet as any).damage ?? 1
      this.onPlayerHitProjectile(bullet.x, bullet.y, dmg)
    })

    this.physics.add.overlap(this.player, this.xpGroup, (_, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      const isXp = (sprite.texture && sprite.texture.key === this.xpTextureKey) || (sprite.getData && sprite.getData('kind') === 'xp')
      if (!isXp) return
      sprite.destroy()
      const cur = (this.registry.get('xp') as number) || 0
      const next = cur + 1
      this.registry.set('xp', next)
      this.checkLevelProgress(next)
    })
    this.physics.add.overlap(this.player, this.goldGroup, (_, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      const isGold = (sprite.texture && sprite.texture.key === this.goldTextureKey) || (sprite.getData && sprite.getData('kind') === 'gold')
      if (!isGold) return
      sprite.destroy()
      const cur = (this.registry.get('gold') as number) || 0
      this.registry.set('gold', cur + 1)
    })
    this.physics.add.overlap(this.player, this.healthGroup, (_, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      sprite.destroy()
      const heal = Math.max(1, Math.ceil(this.hpMax * 0.2)) // 20% heal, min 1
      this.hpCur = Math.min(this.hpMax, this.hpCur + heal)
      this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
    })
    this.physics.add.overlap(this.player, this.powerupGroup, (_, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      sprite.destroy()
      const label = this.applyPowerupReward()
      if (label) this.registry.set('toast', `Power-up: ${label}`)
    })

    // Player <-> enemy collision damage
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Phaser.Physics.Arcade.Sprite
      if (!enemy.active) return
      this.onPlayerTouched(enemy)
    })

    // Inventory (persist across level restarts within run)
    let inv = (this.registry.get('inv') as InventoryState) || createInventory()
    // Ensure a fresh run starts with only a weapon and no accessories
    if (!inv.weapons || inv.weapons.length === 0) {
      addWeapon(inv, 'blaster')
      inv.accessories = []
    }
    this.registry.set('inv', inv as unknown as InventoryState)
    this.registry.set('inv-weapons', describeWeapons(inv))
    this.registry.set('inv-accessories', describeAccessories(inv))
    this.recomputeEffectiveStats()

    // Touch joystick UI (mobile)
    this.createTouchJoystick()

    // Gamepad setup
    this.input.gamepad?.once('connected', () => {})

    // Pause wiring: ESC or P opens Pause
    const openPause = () => {
      // Avoid stacking multiple Pause scenes
      if (this.scene.isPaused()) return
      this.scene.launch('Pause')
      this.scene.pause()
    }
    this.input.keyboard?.on('keydown-ESC', openPause)
    this.input.keyboard?.on('keydown-P', openPause)
  }

  update(time: number, delta: number) {
    if (!this.player) return
    const speed = 80 * this.speedMultiplier

    let vx = 0
    let vy = 0
    // Keyboard
    if (this.cursors?.left?.isDown || this.wasd?.A.isDown) vx -= 1
    if (this.cursors?.right?.isDown || this.wasd?.D.isDown) vx += 1
    if (this.cursors?.up?.isDown || this.wasd?.W.isDown) vy -= 1
    if (this.cursors?.down?.isDown || this.wasd?.S.isDown) vy += 1
    // Gamepad (left stick)
    const pad = this.input.gamepad?.getPad(0)
    if (pad) {
      const gx = pad.axes.length > 0 ? pad.axes[0].getValue() : 0
      const gy = pad.axes.length > 1 ? pad.axes[1].getValue() : 0
      if (Math.hypot(gx, gy) > 0.2) {
        vx = gx
        vy = gy
      }
    }
    // Touch joystick
    if (this.joyActive) {
      vx = this.joyVecX
      vy = this.joyVecY
    }

    const len = Math.hypot(vx, vy) || 1
    this.lastMoveX = vx / len
    this.lastMoveY = vy / len
    this.player.setVelocity(this.lastMoveX * speed, this.lastMoveY * speed)

    const cam = this.cameras.main
    if (this.bgFar) {
      this.bgFar.tilePositionX = cam.scrollX * 0.1
      this.bgFar.tilePositionY = cam.scrollY * 0.1
    }
    if (this.bgMid) {
      this.bgMid.tilePositionX = cam.scrollX * 0.25
      this.bgMid.tilePositionY = cam.scrollY * 0.25
    }
    if (this.bgNear) {
      this.bgNear.tilePositionX = cam.scrollX * 0.5
      this.bgNear.tilePositionY = cam.scrollY * 0.5
    }
    if (this.bgSun) {
      // Keep sun anchored relative to screen; subtle drift for parallax feel
      this.bgSun.x = this.scale.width - 80 + cam.scrollX * 0.02
      this.bgSun.y = 80 + cam.scrollY * 0.02
    }

    // Spawning logic: ring around camera
    const dt = delta / 1000
    this.updateDynamicQuality(dt)
    const elapsedSec = (time - this.levelStartMs) / 1000
    // If paused by LevelUp, keep timer frozen by shifting levelStartMs forward
    if (this.scene.isPaused()) {
      if (this.pauseStartMs == null) this.pauseStartMs = time
    } else if (this.pauseStartMs != null) {
      // Adjust start so elapsed ignores pause duration
      const pausedDur = time - this.pauseStartMs
      this.levelStartMs += pausedDur
      this.pauseStartMs = null
    }
    // Spawn curve with waves: slow start then ramps, slight oscillation
    const wave = 0.6 + 0.4 * Math.sin(elapsedSec * 0.25)
    const spawnPerSecBase = Math.min(5, (0.3 + elapsedSec * 0.015) * wave)
    const spawnPerSec = spawnPerSecBase * this.spawnRateScale[this.qualityLevel]
    this.spawnAccumulator += spawnPerSec * dt
    const activeEnemies = this.enemies.countActive(true)
    const capBase = Math.min(70, 10 + Math.floor(elapsedSec * 0.5))
    const targetCap = Math.floor(capBase * this.spawnCapScale[this.qualityLevel])
    const camCenter = this.getCameraCenter()

    while (!this.bossActive && this.spawnAccumulator >= 1 && activeEnemies + 1 <= targetCap) {
      this.spawnAccumulator -= 1
      this.spawnEnemyVariant(camCenter.x, camCenter.y, elapsedSec)
    }

    this.updateEnemies(camCenter.x, camCenter.y)

    // Level 2 asteroid obstacles: sparse statics and movers
    if ((runState.state?.level ?? 1) === 2) {
      this.ensureAsteroidObstacles()
      this.asteroidSpawnAcc += dt
      this.asteroidMoveSpawnAcc += dt
      // statics: ~1 every 2.5s capped by group size
      if (this.asteroidSpawnAcc > 2.5 && (this.asteroidStatics?.countActive(true) || 0) < 32) {
        this.asteroidSpawnAcc = 0
        this.spawnAsteroidStatic(camCenter.x, camCenter.y)
      }
      // movers: ~1 every 4s capped
      if (this.asteroidMoveSpawnAcc > 4 && (this.asteroidMovers?.countActive(true) || 0) < 16) {
        this.asteroidMoveSpawnAcc = 0
        this.spawnAsteroidMover(camCenter.x, camCenter.y)
      }
      // cull far movers/statics
      const maxR = Math.hypot(this.scale.width, this.scale.height) * 1.8
      const cull = (grp?: Phaser.Physics.Arcade.Group) => {
        if (!grp) return
        const arr = grp.getChildren() as Phaser.Physics.Arcade.Sprite[]
        for (const a of arr) {
          const dx = a.x - camCenter.x, dy = a.y - camCenter.y
          if (dx * dx + dy * dy > maxR * maxR) a.disableBody(true, true)
        }
      }
      cull(this.asteroidStatics)
      cull(this.asteroidMovers)
    }

    // Ambient health spawn (rare)
    if (!this.bossActive) {
      const healthPerSec = 0.02
      if (Math.random() < healthPerSec * dt) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
        const radius = Math.hypot(this.scale.width, this.scale.height) * 0.55
        const x = camCenter.x + Math.cos(angle) * radius
        const y = camCenter.y + Math.sin(angle) * radius
        const p = this.healthGroup.create(x, y, this.healthTextureKey) as Phaser.Physics.Arcade.Sprite
        if (p) {
          p.setActive(true); p.setVisible(true)
          // visual distinction for health (no tint so white cross stays white)
          this.tweens.add({ targets: p, scale: 1.15, yoyo: true, duration: 500, repeat: -1, ease: 'Sine.easeInOut' })
        }
      }
    }
    // Update magnetization/despawn for pickups
    this.updatePickups(camCenter.x, camCenter.y)

    // Level timer and victory
    const remain = runState.getRemainingSec(time)
    this.registry.set('time-left', remain)
    if (remain <= 0) {
      const level = runState.state?.level ?? 1
      if (level < 5) {
        if (!this.bossActive) {
          this.spawnBoss(camCenter.x, camCenter.y)
          this.bossActive = true
        }
      } else {
        // Level 5: gauntlet
        if (!this.gauntletActive) {
          this.gauntletActive = true
          this.gauntletStage = 0
          this.spawnNextGauntletBoss(camCenter.x, camCenter.y)
        }
      }
    }
    // Slight boss balance tuning based on elapsed
    if (this.bossActive) {
      // reserved for future boss dynamic tuning
    }

    // Autofire weapon
    this.updateWeapon(dt)

    // hurt cooldown tick
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const width = gameSize.width
    const height = gameSize.height
    this.bgFar?.setSize(width, height)
    this.bgMid?.setSize(width, height)
    this.bgNear?.setSize(width, height)
    // Apply camera zoom based on quality level (lower quality => zoom in slightly)
    const cam = this.cameras.main
    cam.setZoom(this.qualityZoom[this.qualityLevel])
    // Reposition joystick on resize
    if (this.joyBase && this.joyThumb) {
      const x = 40
      const y = this.scale.height - 40
      this.joyBase.setPosition(x, y)
      this.joyThumb.setPosition(x, y)
      this.joyCenterX = x
      this.joyCenterY = y
    }
  }

  private createStarTexture(key: string, size: number, count: number) {
    if (this.textures.exists(key)) return
    const tex = this.textures.createCanvas(key, size, size)
    const ctx = tex?.getContext()
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = Math.random() < 0.85 ? 0.5 + Math.random() * 0.8 : 1 + Math.random() * 1.2
      const a = 0.3 + Math.random() * 0.7
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`
      ctx.fill()
    }
    tex?.refresh()
  }

  private createAsteroidFieldTexture(key: string, size: number, count: number) {
    if (this.textures.exists(key)) return
    const tex = this.textures.createCanvas(key, size, size)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#000'
    c.fillRect(0, 0, size, size)
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 3 + Math.random() * 10
      const tilt = Math.random() * Math.PI
      const rx = r * (0.6 + Math.random() * 0.8)
      const ry = r
      c.save()
      c.translate(x, y)
      c.rotate(tilt)
      c.fillStyle = '#666a72'
      c.beginPath()
      c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#8a9099'
      c.beginPath()
      c.arc(-rx * 0.3, -ry * 0.2, Math.max(1, rx * 0.3), 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    tex?.refresh()
  }

  private createPlanetTile(key: string) {
    if (this.textures.exists(key)) return
    const s = 256
    const tex = this.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#3b2f22'
    c.fillRect(0, 0, s, s)
    // soil noise dots
    for (let i = 0; i < 1200; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#46382a' : '#2e241a'
      c.fillRect(Math.random() * s, Math.random() * s, 1, 1)
    }
    // green river (sinusoidal band across tile)
    c.strokeStyle = '#1fa84a'
    c.lineWidth = 12
    c.beginPath()
    for (let x = -16; x <= s + 16; x += 8) {
      const y = s * 0.5 + Math.sin((x / s) * Math.PI * 2) * 24
      if (x === -16) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
    tex?.refresh()
  }

  private createCityTile(key: string) {
    if (this.textures.exists(key)) return
    const s = 256
    const tex = this.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#0b0e12'
    c.fillRect(0, 0, s, s)
    // grid roads
    c.strokeStyle = '#1a2030'
    c.lineWidth = 3
    for (let i = 0; i <= s; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke()
      c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke()
    }
    // buildings
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(Math.random() * s)
      const y = Math.floor(Math.random() * s)
      const w = 6 + Math.random() * 18
      const h = 6 + Math.random() * 18
      c.fillStyle = '#2a3a55'
      c.fillRect(x, y, w, h)
      // windows
      c.fillStyle = Math.random() < 0.3 ? '#ffd966' : '#334a6b'
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        for (let wy = y + 2; wy < y + h - 2; wy += 4) {
          if (Math.random() < 0.4) c.fillRect(wx, wy, 2, 2)
        }
      }
    }
    tex?.refresh()
  }

  private createSunTexture(key: string) {
    if (this.textures.exists(key)) return
    const s = 256
    const tex = this.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    const cx = s / 2, cy = s / 2, r = s / 2
    const grad = c.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#fff4a3')
    grad.addColorStop(0.5, '#ffcc44')
    grad.addColorStop(1, 'rgba(255,180,0,0)')
    c.fillStyle = grad
    c.fillRect(0, 0, s, s)
    tex?.refresh()
  }

  private setupBackgroundForLevel(level: number) {
    // Destroy previous layers if any
    this.bgFar?.destroy(); this.bgMid?.destroy(); this.bgNear?.destroy(); this.bgSun?.destroy(); this.bgSun = undefined

    if (level === 1) {
      this.createStarTexture('stars-far', 512, 60)
      this.createStarTexture('stars-mid', 512, 100)
      this.createStarTexture('stars-near', 512, 160)
      this.bgFar = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-far').setOrigin(0,0).setScrollFactor(0).setDepth(-1000)
      this.bgMid = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-mid').setOrigin(0,0).setScrollFactor(0).setDepth(-999)
      this.bgNear = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-near').setOrigin(0,0).setScrollFactor(0).setDepth(-998)
      return
    }
    if (level === 2) {
      // Parallax asteroid field akin to level 1 starfield
      this.createAsteroidFieldTexture('asteroids-far', 512, 60)
      this.createAsteroidFieldTexture('asteroids-mid', 512, 100)
      this.createAsteroidFieldTexture('asteroids-near', 512, 160)
      this.bgFar = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'asteroids-far').setOrigin(0,0).setScrollFactor(0).setDepth(-1000)
      this.bgMid = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'asteroids-mid').setOrigin(0,0).setScrollFactor(0).setDepth(-999)
      this.bgNear = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'asteroids-near').setOrigin(0,0).setScrollFactor(0).setDepth(-998)
      return
    }
    if (level === 3) {
      this.createPlanetTile('planet-tile')
      this.bgFar = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'planet-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-1000)
      this.bgMid = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'planet-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-999)
      this.bgNear = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'planet-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-998)
      return
    }
    if (level === 4) {
      this.createCityTile('city-tile')
      this.bgFar = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'city-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-1000)
      this.bgMid = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'city-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-999)
      this.bgNear = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'city-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-998)
      return
    }
    // level 5: space with sun
    this.createStarTexture('stars-far', 512, 60)
    this.createStarTexture('stars-mid', 512, 100)
    this.createStarTexture('stars-near', 512, 160)
    this.createSunTexture('sun-tex')
    this.bgFar = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-far').setOrigin(0,0).setScrollFactor(0).setDepth(-1000)
    this.bgMid = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-mid').setOrigin(0,0).setScrollFactor(0).setDepth(-999)
    this.bgNear = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-near').setOrigin(0,0).setScrollFactor(0).setDepth(-998)
    this.bgSun = this.add.image(this.scale.width - 80, 80, 'sun-tex').setScrollFactor(0).setDepth(-997)
    this.bgSun.setScale(1.2)
  }

  private createEnemyTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 8
    const gfx = this.add.graphics()
    gfx.fillStyle(0xff4444, 1)
    gfx.fillRect(0, 0, size, size)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  private ensureBulletAssets() {
    if (!this.bullets || !(this as any).bullets?.children?.entries) {
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
      // Debug: draw bullet collider rects briefly after spawn
    }
    // Ensure enemy bullet group exists and colliders are set (player overlap added in create)
    if (!this.enemyBullets || !(this as any).enemyBullets?.children?.entries) {
      this.enemyBullets = this.physics.add.group({ maxSize: 300 })
    }
    if (!this.missileGroup || !(this as any).missileGroup?.children?.entries) {
      this.missileGroup = this.physics.add.group({ maxSize: 120 })
      this.physics.add.overlap(this.missileGroup, this.enemies, (_b, _e) => this.onBulletHit(_b as any, _e as any))
    }
    if (!this.orbGroup || !(this as any).orbGroup?.children?.entries) {
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
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()
    const has = (k: string) => inv.weapons.some((w) => w.key === k)
    const hasBlaster = has('blaster') || has('scatter-blaster') || has('pulse-blaster')
    const hasMissiles = has('missiles') || has('cluster-missiles')
    const hasOrbs = has('orb') || has('nova-orb')

    // Per-weapon cooldowns so weapons don't rely on each other
    const step = (key: string, rate: number, fire: () => void) => {
      const cur = (this.weaponCooldowns[key] ?? 0) - dt
      this.weaponCooldowns[key] = cur
      if (cur <= 0 && this.player) {
        this.weaponCooldowns[key] = 1 / Math.max(0.1, rate)
        fire()
      }
    }
    const muzzle = 6
    // Blaster family
    if (hasBlaster) {
      step('blaster', this.fireRate, () => {
        const baseAngle = this.getAimAngle()
        const baseRad = Phaser.Math.DegToRad(baseAngle)
        const inlineCount = Math.max(0, Math.floor(this.inlineExtraProjectiles))
        for (let i = 0; i <= inlineCount; i++) {
          const back = i * 8
          const speedScale = 1 - Math.min(0.6, i * 0.12)
          const ox = this.player!.x + Math.cos(baseRad) * (muzzle - back)
          const oy = this.player!.y + Math.sin(baseRad) * (muzzle - back)
          this.spawnBullet(ox, oy, baseAngle, 300 * speedScale)
        }
        const spread = this.spreadDeg || 10
        const fanShots = Math.max(1, Math.floor(this.multishot))
        if (fanShots > 1) {
          const half = (fanShots - 1) / 2
          for (let i = -half; i <= half; i++) {
            if (i === 0) continue
            const a = baseAngle + (i as number) * spread
            const rad = Phaser.Math.DegToRad(a)
            const ox = this.player!.x + Math.cos(rad) * muzzle
            const oy = this.player!.y + Math.sin(rad) * muzzle
            this.spawnBullet(ox, oy, a)
          }
        }
      })
    }
    // Missiles
    if (hasMissiles) {
      step('missiles', this.fireRate, () => {
        const a = this.getAimAngle()
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player!.x + Math.cos(rad) * muzzle
        const oy = this.player!.y + Math.sin(rad) * muzzle
        this.spawnMissile(ox, oy, a)
      })
    }
    // Orbs (staggered fire)
    if (hasOrbs) {
      step('orbs', this.fireRate, () => {
        const a = this.getAimAngle()
        const rad = Phaser.Math.DegToRad(a)
        const muzzleOrb = 12
        const ox = this.player!.x + Math.cos(rad) * muzzleOrb
        const oy = this.player!.y + Math.sin(rad) * muzzleOrb
        this.time.delayedCall(120, () => this.spawnOrb(ox, oy, a))
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
      if (!Phaser.Geom.Rectangle.Contains(bounds, b.x, b.y)) b.disableBody(true, true)
    }

    // Handle laser spiral independently so it fires even when blaster cooldown is active
    const inv2 = (this.registry.get('inv') as InventoryState) || createInventory()
    const wLaser = inv2.weapons.find((w) => w.key === 'laser')
    const wBeam = inv2.weapons.find((w) => w.key === 'beam-laser')
    const hasLaser = !!wLaser
    const hasBeamLaser = !!wBeam
    if (this.player && (hasLaser || hasBeamLaser)) {
      const lvl = (wBeam?.level ?? wLaser?.level ?? 1)
      // Level-scaled spin speed and fire rate (slow at low levels, faster later)
      const spinBase = 140 + 25 * (lvl - 1)
      const spinSpeed = spinBase * (hasBeamLaser ? 1.15 : 1)
      const baseRate = 0.5 + 0.35 * (lvl - 1) // beams per second before global modifiers
      const rate = baseRate * (this.fireRate / 1.2) * (hasBeamLaser ? 1.2 : 1)
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
        this.applyBeamDamage(ox, oy, a, len, Math.max(1, this.bulletDamage * (hasBeamLaser ? 0.9 : 0.6)), thickness)
        const shot = this.bullets.get(ox, oy, 'laser-shot-tex') as Phaser.Physics.Arcade.Sprite
        if (shot) {
          shot.enableBody(true, ox, oy, true, true)
          shot.setDepth(5)
          shot.body?.setSize(2, 2, true)
          shot.setCircle(1, 0, 0)
          const vs = 220
          const vrad = Phaser.Math.DegToRad(a)
          shot.setVelocity(Math.cos(vrad) * vs, Math.sin(vrad) * vs)
          ;(shot as any).damage = Math.max(1, Math.floor(this.bulletDamage * 0.6))
          this.time.delayedCall(300, () => shot.active && shot.disableBody(true, true))
        }
      }
    }
  }

  private spawnBullet(x: number, y: number, angleDeg: number, speedOverride?: number) {
    const tex = 'blaster-tex'
    this.ensureBulletAssets()
    if (!this.bullets || !(this as any).bullets?.children?.entries) return
    let b = this.bullets.get(x, y, tex) as Phaser.Physics.Arcade.Sprite
    if (!b) {
      b = this.bullets.create(x, y, tex) as Phaser.Physics.Arcade.Sprite
      if (!b) return
      b.setActive(true).setVisible(true)
    }
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
    ;(b as any).damage = this.bulletDamage
    if (import.meta.env.DEV) {
      const dbg = this.add.rectangle(x, y, 2, 2, 0x00ff00, 0.6).setDepth(1000)
      this.tweens.add({ targets: dbg, alpha: 0, duration: 400, onComplete: () => dbg.destroy() })
    }
    // Auto-disable after 2s to avoid endless bullets
    this.time.delayedCall(2000, () => {
      if (b.active) b.disableBody(true, true)
    })
  }

  private spawnMissile(x: number, y: number, angleDeg: number) {
    this.ensureBulletAssets()
    if (!this.missileGroup || !(this as any).missileGroup?.children?.entries) return
    const m = this.missileGroup.get(x, y, 'missile-tex') as Phaser.Physics.Arcade.Sprite
    if (!m) return
    m.enableBody(true, x, y, true, true)
    m.setDepth(5)
    m.body?.setSize(5, 5, true)
    m.setCircle(3, 0, 0)
    const speed = 160
    const rad = Phaser.Math.DegToRad(angleDeg)
    m.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(m as any).damage = Math.max(1, Math.floor(this.bulletDamage * 1.5))
    ;(m as any).missile = true
    this.time.delayedCall(3500, () => m.active && m.disableBody(true, true))
  }

  private spawnOrb(x: number, y: number, angleDeg: number) {
    this.ensureBulletAssets()
    if (!this.orbGroup || !(this as any).orbGroup?.children?.entries) return
    let o = this.orbGroup.get(x, y, 'orb-tex') as Phaser.Physics.Arcade.Sprite
    if (!o) {
      o = this.orbGroup.create(x, y, 'orb-tex') as Phaser.Physics.Arcade.Sprite
      if (!o) return
      o.setActive(true).setVisible(true)
    }
    o.enableBody(true, x, y, true, true)
    o.setDepth(5)
    o.body?.setSize(8, 8, true)
    o.setCircle(4, 0, 0)
    const speed = 110
    const rad = Phaser.Math.DegToRad(angleDeg)
    o.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(o as any).damage = this.bulletDamage
    ;(o as any).orb = true
    ;(o as any).exploded = false
    ;(o as any).bornUntil = this.time.now + 120
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
        const hp = ((e as any).hp ?? 2) - Math.max(1, Math.floor(this.bulletDamage * 1.2))
        ;(e as any).hp = hp
        this.showHitSpark(e.x, e.y)
        if (hp <= 0) {
          const isBoss = !!(e as any).isBoss
          e.disableBody(true, true)
          if (!isBoss) {
            if (Math.random() < 0.65) this.xpGroup.create(e.x, e.y, this.xpTextureKey).setActive(true).setVisible(true)
            if (Math.random() < 0.3) this.goldGroup.create(e.x, e.y, this.goldTextureKey).setActive(true).setVisible(true)
          }
        }
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
        const hp = ((e as any).hp ?? 2) - Math.max(1, Math.floor(dmg))
        ;(e as any).hp = hp
        this.showHitSpark(e.x, e.y)
        console.log('[LaserHit]', { x: e.x, y: e.y, hp })
        const m = this.add.rectangle(e.x, e.y, 3, 3, 0x00ffff, 0.9).setDepth(1000)
        this.tweens.add({ targets: m, alpha: 0, duration: 250, onComplete: () => m.destroy() })
        if (hp <= 0) {
          const isBoss = !!(e as any).isBoss
          e.disableBody(true, true)
          if (!isBoss) {
            if (Math.random() < 0.8) this.xpGroup.create(e.x, e.y, this.xpTextureKey).setActive(true).setVisible(true)
            if (Math.random() < 0.3) this.goldGroup.create(e.x, e.y, this.goldTextureKey).setActive(true).setVisible(true)
          } else {
            // Boss died by beam
            this.clearBossTimers()
            this.bossActive = false
            this.registry.set('boss-hp', null)
            if (getOptions().screenShake) this.cameras.main.shake(200, 0.01)
            const level = runState.state?.level ?? 1
            if (level < 5) {
              this.scene.stop('HUD')
              this.scene.start('Victory')
            } else if (this.gauntletActive) {
              this.gauntletStage += 1
              if (this.gauntletStage < 5) {
                const camCenter = this.getCameraCenter()
                this.spawnNextGauntletBoss(camCenter.x, camCenter.y)
              } else {
                this.gauntletActive = false
                this.scene.stop('HUD')
                this.scene.start('Victory')
              }
            }
          }
        } else if ((e as any).isBoss) {
          this.registry.set('boss-hp', { cur: hp, max: (e as any).hpMax || 80 })
        }
      }
    }
  }

  private showExplosion(x: number, y: number, radius: number) {
    const ex = this.add.image(x, y, 'explosion-tex').setDepth(850)
    const scale = Math.max(0.5, radius / 16)
    ex.setScale(scale)
    this.tweens.add({ targets: ex, alpha: 0, scale: scale * 1.2, duration: 220, onComplete: () => ex.destroy() })
  }

  private showHitSpark(x: number, y: number) {
    const s = this.add.rectangle(x, y, 3, 3, 0xffffff, 1).setDepth(900)
    this.tweens.add({ targets: s, alpha: 0, duration: 120, onComplete: () => s.destroy() })
  }

  private showTelegraphLine(x1: number, y1: number, x2: number, y2: number, durationMs: number) {
    const g = this.add.graphics().setDepth(980)
    g.lineStyle(2, 0xff4444, 0.8)
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.strokePath()
    this.tweens.add({ targets: g, alpha: 0, duration: durationMs, onComplete: () => g.destroy() })
  }

  private showTelegraphCircle(x: number, y: number, radius: number, durationMs: number) {
    const g = this.add.graphics().setDepth(980)
    g.lineStyle(2, 0xffaa00, 0.85)
    g.strokeCircle(x, y, radius)
    this.tweens.add({ targets: g, alpha: 0, duration: durationMs, onComplete: () => g.destroy() })
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
    const hp = ((e as any).hp ?? 2) - damage
    ;(e as any).hp = hp
    // Hit feedback (applies to blaster, laser shot, missiles, etc.)
    this.showHitSpark(e.x, e.y)
    b.disableBody(true, true)
    // Missile impact explosion always on contact
    if ((b as any).missile) {
      this.showExplosion(e.x, e.y, 20)
    }
    if (hp <= 0) {
      // Drops on enemy death (from kills only)
      const isElite = !!((e as any).elite || (e as any).isElite)
      if (isElite) {
        // Elite weighted drop: 3% power-up, 50% XP (with 10–40% bonus), else gold 47%
        const r = Math.random()
        if (r < 0.03) {
          const p = this.powerupGroup.create(e.x, e.y, this.powerupTextureKey) as Phaser.Physics.Arcade.Sprite
          if (p) {
            p.setActive(true); p.setVisible(true)
            // visual distinction for power-ups
            p.setTint(0x22ddaa)
            p.setScale(1)
            this.tweens.add({ targets: p, y: p.y - 2, yoyo: true, duration: 450, repeat: -1, ease: 'Sine.easeInOut' })
            this.tweens.add({ targets: p, alpha: 0.7, yoyo: true, duration: 600, repeat: -1, ease: 'Sine.easeInOut' })
          }
        } else if (r < 0.53) {
          const bonus = Phaser.Math.FloatBetween(0.1, 0.4)
          const count = 1 + (Math.random() < Math.min(0.9, 0.4 + bonus) ? 1 : 0)
          for (let i = 0; i < count; i++) {
            const xp = this.xpGroup.create(e.x, e.y, 'xp-gem-elite') as Phaser.Physics.Arcade.Sprite
            xp.setActive(true).setVisible(true)
            xp.setData('kind', 'xp')
            this.tweens.add({ targets: xp, alpha: 0.85, yoyo: true, duration: 520, repeat: -1, ease: 'Sine.easeInOut' })
          }
        } else {
          // Drop 5 gold coins for elite kill
          for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2
            const dist = Math.random() * 6
            const gx = e.x + Math.cos(angle) * dist
            const gy = e.y + Math.sin(angle) * dist
            const g = this.goldGroup.create(gx, gy, 'gold-coin-elite') as Phaser.Physics.Arcade.Sprite
            g.setActive(true).setVisible(true)
            g.setData('kind', 'gold')
            this.tweens.add({ targets: g, scale: { from: 1, to: 1.15 }, alpha: { from: 1, to: 0.9 }, yoyo: true, duration: 350, repeat: -1, ease: 'Sine.easeInOut' })
          }
        }
      } else {
        // Non-elite: standard XP/gold small chances
        if (Math.random() < 0.8) this.xpGroup.create(e.x, e.y, this.xpTextureKey).setActive(true).setVisible(true)
        if (Math.random() < 0.3) this.goldGroup.create(e.x, e.y, this.goldTextureKey).setActive(true).setVisible(true)
      }
      const isBoss = !!(e as any).isBoss
      e.disableBody(true, true)
    if (isBoss) {
      this.clearBossTimers()
      this.bossActive = false
      if (getOptions().screenShake) this.cameras.main.shake(200, 0.01)
        const level = runState.state?.level ?? 1
        if (level < 5) {
          this.scene.stop('HUD')
          this.scene.start('Victory')
        } else if (this.gauntletActive) {
          this.gauntletStage += 1
          if (this.gauntletStage < 5) {
            const camCenter = this.getCameraCenter()
            this.spawnNextGauntletBoss(camCenter.x, camCenter.y)
          } else {
            // Gauntlet complete
            this.gauntletActive = false
            this.scene.stop('HUD')
            this.scene.start('Victory')
          }
        }
      }
    } else {
      if ((e as any).isBoss) {
        this.registry.set('boss-hp', { cur: hp, max: (e as any).hpMax || 80 })
        if (getOptions().screenShake) this.cameras.main.shake(100, 0.005)
        this.configureBossPhase()
      }
    }
  }

  private recomputeEffectiveStats() {
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()
    const s = { ...defaultBaseStats }
    for (const w of inv.weapons) applyWeaponLevel(s as any, w.key as any, w.level)
    for (const a of inv.accessories) applyAccessoryLevel(s as any, a.key as any, a.level)
    // apply in-run bonus modifiers
    this.fireRate = Math.min(8, s.fireRate * this.bonusFireRateMul)
    this.bulletDamage = Math.max(1, s.bulletDamage + this.bonusDamage)
    this.multishot = Math.min(7, Math.max(1, Math.floor(s.multishot + this.bonusMultishot)))
    this.speedMultiplier = Math.max(0.5, Math.min(2.5, s.speedMultiplier * this.bonusSpeedMul))
    this.magnetRadius = Math.max(16, Math.min(280, s.magnetRadius + this.bonusMagnet))
    this.spreadDeg = Math.max(4, Math.min(30, s.spreadDeg ?? 10))

    // Accessory set bonuses
    const has = (k: string, lvl = 1) => inv.accessories.some((a) => a.key === k && a.level >= lvl)
    const sets: string[] = []
    if (has('power-cell') && has('magnet-core')) {
      this.bulletDamage += 1
      sets.push('Core')
    }
    if (has('ammo-loader') && has('thrusters') && has('splitter')) {
      this.fireRate = Math.min(8, this.fireRate * 1.1)
      this.spreadDeg = Math.max(this.spreadDeg, 12)
      sets.push('Rapid')
    }
    this.registry.set('sets-summary', sets.join(', '))
  }
  private tryEvolveWeapons() {
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()
    const evolved = computeEvolution(inv.weapons, inv.accessories)
    if (evolved) {
      // Find the base from the rule again to replace
      // Simple approach: evolve first weapon that has a rule producing this evolved key
      const base = inv.weapons.find((w) => computeEvolution([w], inv.accessories) === evolved)
      if (base && evolveWeapon(inv, base.key as any, evolved as any)) {
        this.registry.set('inv', inv)
        this.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.registry.set('toast', `Evolved: ${evolved}!`)
      }
    }
  }

  private getAimAngle(): number {
    if (!this.player) return 0
    let nearest: Phaser.Physics.Arcade.Sprite | null = null
    let bestDist = Number.POSITIVE_INFINITY
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const e of children) {
      if (!e || !e.active) continue
      const dx = e.x - this.player.x
      const dy = e.y - this.player.y
      const d2 = dx * dx + dy * dy
      if (d2 < bestDist) {
        bestDist = d2
        nearest = e
      }
    }
    // If no enemies, aim in movement direction; if stationary, keep last aim
    if (!nearest) {
      if (Math.hypot(this.lastMoveX, this.lastMoveY) > 0.1) {
        this.lastAimDeg = Phaser.Math.RadToDeg(Math.atan2(this.lastMoveY, this.lastMoveX))
      }
      return this.lastAimDeg
    }
    const dx = nearest.x - this.player.x
    const dy = nearest.y - this.player.y
    this.lastAimDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx))
    return this.lastAimDeg
  }

  private onPlayerTouched(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!this.player) return
    if (this.hurtCooldown > 0) return
    const dmg = ((enemy as any).touchDamage as number) || 1
    this.hurtCooldown = 0.8
    this.hpCur = Math.max(0, this.hpCur - dmg)
    this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
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
    if (this.hpCur <= 0) {
      this.time.delayedCall(0, () => {
        this.scene.stop('HUD')
        this.scene.stop('Game')
        this.scene.start('GameOver')
      })
    }
  }

  private onPlayerHitProjectile(px: number, py: number, dmg: number) {
    if (!this.player) return
    if (this.hurtCooldown > 0) return
    this.hurtCooldown = 0.8
    this.hpCur = Math.max(0, this.hpCur - dmg)
    this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
    // Knockback away from projectile position
    const dxp = this.player.x - px
    const dyp = this.player.y - py
    const ang = Math.atan2(dyp, dxp)
    const kb = 120
    this.player.setVelocity(Math.cos(ang) * kb, Math.sin(ang) * kb)
    this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true, duration: 80, repeat: 3 })
    if (getOptions().screenShake) this.cameras.main.shake(90, 0.003)
    if (this.hpCur <= 0) {
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

  private createTouchJoystick() {
    const x = 40
    const y = this.scale.height - 40
    this.joyCenterX = x
    this.joyCenterY = y
    this.joyBase = this.add.circle(x, y, this.joyRadius, 0xffffff, 0.08).setScrollFactor(0).setDepth(999)
    this.joyThumb = this.add.circle(x, y, 12, 0xffffff, 0.15).setScrollFactor(0).setDepth(1000)
    this.joyBase.setVisible(true)
    this.joyThumb.setVisible(true)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.joyActive) return
      // Only left third of screen activates joystick
      if (p.x <= this.scale.width * 0.5) {
        this.joyActive = true
        this.joyPointerId = p.id
        this.updateJoystick(p.x, p.y)
      }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.joyActive || this.joyPointerId !== p.id) return
      this.updateJoystick(p.x, p.y)
    })
    const end = (p: Phaser.Input.Pointer) => {
      if (!this.joyActive || this.joyPointerId !== p.id) return
      this.joyActive = false
      this.joyPointerId = null
      this.joyVecX = 0
      this.joyVecY = 0
      this.joyThumb?.setPosition(this.joyCenterX, this.joyCenterY)
    }
    this.input.on('pointerup', end)
    this.input.on('pointerupoutside', end)
  }

  private updateJoystick(px: number, py: number) {
    const dx = px - this.joyCenterX
    const dy = py - this.joyCenterY
    const d = Math.hypot(dx, dy)
    const clamped = Math.min(1, d / this.joyRadius)
    const nx = (dx / (d || 1)) * clamped
    const ny = (dy / (d || 1)) * clamped
    this.joyVecX = nx
    this.joyVecY = ny
    this.joyThumb?.setPosition(this.joyCenterX + nx * this.joyRadius, this.joyCenterY + ny * this.joyRadius)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  private spawnEnemyVariant(cx: number, cy: number, elapsedSec: number) {
    // Choose type by time: fodder, chaser, tank
    const roll = Math.random()
    let type: 'fodder' | 'chaser' | 'tank' = 'fodder'
    if (elapsedSec > 120 && roll < 0.15) type = 'tank'
    else if (elapsedSec > 45 && roll < 0.45) type = 'chaser'

    const viewRadius = Math.hypot(this.scale.width, this.scale.height) * 0.5
    const inner = viewRadius * 0.9
    const outer = inner + 80
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    const enemy = (this.enemies.get(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite) ||
      (this.enemies.create(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite)
    enemy.enableBody(true, x, y, true, true)
    enemy.setCircle(3, 1, 1)
    enemy.setCollideWorldBounds(false)

    const elapsed = (this.time.now - this.levelStartMs) / 1000
    const touch = 1 + Math.floor(elapsed / 90)

    // Base HP and per-level caps: fodder easy early; cap modestly
    const playerLevel = (this.registry.get('level') as number) || 1
    const hpScale = 1 + Math.min(playerLevel - 1, 8) * 0.2 // cap +160%
    if (type === 'fodder') {
      ;(enemy as any).hp = Math.max(1, Math.round(2 * hpScale))
      ;(enemy as any).chase = 42
      ;(enemy as any).touchDamage = touch
      enemy.setTint(0xff6666)
    } else if (type === 'chaser') {
      ;(enemy as any).hp = Math.round(4 * hpScale)
      ;(enemy as any).chase = 64
      ;(enemy as any).touchDamage = touch
      enemy.setTint(0x66ccff)
    } else {
      ;(enemy as any).hp = Math.round(7 * hpScale)
      ;(enemy as any).chase = 24
      ;(enemy as any).touchDamage = touch + 1
      enemy.setTint(0xaaaa55)
    }
    ;(enemy as any).stunUntil = 0

    // Chance to spawn elite variant: boosted stats and distinct color.
    // Scale over level time and cap global ratio.
    const remain = runState.getRemainingSec(this.time.now)
    const total = (runState.state?.levelDurationSec ?? 900)
    const progress = 1 - Math.max(0, Math.min(1, remain / Math.max(1, total)))
    if (!('eliteStats' in (this as any))) {
      ;(this as any).eliteStats = { total: 0, elite: 0 }
    }
    ;(this as any).eliteStats.total++
    const stats = (this as any).eliteStats
    const curRatio = stats.elite / Math.max(1, stats.total)
    // Reduce base spawn chance for elites; ramp late but stay sparse
    const baseChance = 0.004 + progress * 0.015 + (remain <= 120 ? 0.03 : 0)
    const targetMax = Math.min(0.2, 0.03 + progress * 0.12)
    if (Math.random() < baseChance && curRatio < targetMax) {
      stats.elite++
      ;(enemy as any).elite = true
      // Significantly higher HP for elites
      ;(enemy as any).hp = Math.round(((enemy as any).hp || 4) * 4.5)
      ;(enemy as any).chase = Math.max(16, Math.round(((enemy as any).chase || 40) * 0.85))
      ;(enemy as any).touchDamage = ((enemy as any).touchDamage || 1) + 1
      enemy.setTint(0xff00ff)
      enemy.setScale(1.15)
      ;(enemy as any).isElite = true
      // Some elites shoot projectiles periodically
      if (Math.random() < 0.5) {
        const fireDelay = Phaser.Math.Between(1200, 1800)
        const timer = this.time.addEvent({ delay: fireDelay, loop: true, callback: () => {
          if (!enemy.active) { timer.remove(false); return }
          const ang = this.player ? Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x) : Math.random() * Math.PI * 2
          this.spawnEnemyBullet(enemy.x, enemy.y, Phaser.Math.RadToDeg(ang))
        }})
        // Tie timer lifetime to enemy
        ;(enemy as any).on('destroy', () => timer.remove(false))
      }
    }
  }

  private spawnBoss(cx: number, cy: number, type?: number) {
    const radius = Math.hypot(this.scale.width, this.scale.height) * 0.4
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const boss = (this.enemies.get(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite) ||
      (this.enemies.create(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite)
    boss.enableBody(true, x, y, true, true)
    boss.setScale(2)
    boss.setCircle(6, 2, 2)
    ;(boss as any).hp = type === 5 ? 260 : 80
    ;(boss as any).hpMax = (boss as any).hp
    ;(boss as any).touchDamage = 2
    ;(boss as any).chase = 25
    ;(boss as any).isBoss = true
    this.registry.set('boss-hp', { cur: (boss as any).hp, max: (boss as any).hpMax || (boss as any).hp })
    this.clearNonBossEnemies()
    this.clearBossTimers()
    this.currentBoss = boss
    this.currentBossType = type ?? (runState.state?.level ?? 1)
    this.currentBossPhase = -1
    this.configureBossPhase()
  }

  private spawnNextGauntletBoss(cx: number, cy: number) {
    // Stages 0-3: previous 4 bosses placeholder; stage 4: final boss
    if (this.gauntletStage < 4) {
      this.spawnBoss(cx, cy, this.gauntletStage + 1)
      this.bossActive = true
    } else {
      // Final boss with extra HP
      const radius = Math.hypot(this.scale.width, this.scale.height) * 0.35
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius
      const boss = (this.enemies.get(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite) ||
        (this.enemies.create(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite)
      boss.enableBody(true, x, y, true, true)
      boss.setScale(2.2)
      boss.setCircle(7, 2, 2)
      ;(boss as any).hp = 260
      ;(boss as any).hpMax = 260
      ;(boss as any).touchDamage = 3
      ;(boss as any).chase = 30
      ;(boss as any).isBoss = true
      this.bossActive = true
      this.registry.set('boss-hp', { cur: (boss as any).hp, max: (boss as any).hpMax || (boss as any).hp })
      this.clearNonBossEnemies()
      this.clearBossTimers()
      // Final boss combo patterns
      let a = 0
      this.bossTimers.push(this.time.addEvent({ delay: 60, loop: true, callback: () => {
        if (!boss.active) return
        const c = { x: boss.x, y: boss.y }
        this.spawnEnemyBullet(c.x, c.y, a)
        a = (a + 24) % 360
      }}))
    }
  }

  private clearNonBossEnemies() {
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const enemy of children) {
      if (!enemy || !enemy.active) continue
      if (!(enemy as any).isBoss) enemy.disableBody(true, true)
    }
  }

  private clearBossTimers() {
    for (const t of this.bossTimers) t.remove(false)
    this.bossTimers = []
  }

  private configureBossPhase() {
    const boss = this.currentBoss
    if (!boss || !boss.active) return
    const hp = (boss as any).hp as number
    const hpMax = (boss as any).hpMax as number
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, hpMax)))
    let nextPhase = 0
    if (this.currentBossType === 5) {
      // Final boss thresholds: >66%, 66–33%, <33–15%, <14%
      if (pct > 0.66) nextPhase = 0
      else if (pct > 0.33) nextPhase = 1
      else if (pct > 0.15) nextPhase = 2
      else nextPhase = 3
    } else {
      // Bosses 1–4: >66%, 66–33%, <33%
      if (pct > 0.66) nextPhase = 0
      else if (pct > 0.33) nextPhase = 1
      else nextPhase = 2
    }
    if (nextPhase === this.currentBossPhase) return
    this.currentBossPhase = nextPhase
    this.clearBossTimers()

    // Reconfigure timers by boss type and phase
    const c = () => ({ x: boss.x, y: boss.y })
    const aimToPlayer = () => this.player ? Math.atan2(this.player.y - boss.y, this.player.x - boss.x) : 0

    if (this.currentBossType === 1) {
      // Radial volleys → faster, denser
      const bursts = [12, 16, 20]
      const delays = [1400, 1100, 900]
      const i = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.time.addEvent({ delay: delays[i], loop: true, callback: () => {
        if (!boss.active) return
        const center = c()
        const count = bursts[i]
        for (let k = 0; k < count; k++) this.spawnEnemyBullet(center.x, center.y, (k / count) * 360)
      }}))
    } else if (this.currentBossType === 2) {
      // Spiral stream → speed/rate ramps
      let a = 0
      const delays = [90, 70, 55]
      const step = [18, 22, 26]
      const i = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.time.addEvent({ delay: delays[i], loop: true, callback: () => {
        if (!boss.active) return
        const center = c()
        this.spawnEnemyBullet(center.x, center.y, a)
        a = (a + step[i]) % 360
      }}))
    } else if (this.currentBossType === 3) {
      // Dashes → shorter telegraph, faster dash per phase
      const tele = [350, 300, 240]
      const spd = [160, 190, 220]
      const dur = [420, 450, 520]
      const i = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.time.addEvent({ delay: 2200 - i * 300, loop: true, callback: () => {
        if (!boss.active) return
        const ang = aimToPlayer()
        this.showTelegraphLine(boss.x, boss.y, boss.x + Math.cos(ang) * 140, boss.y + Math.sin(ang) * 140, tele[i])
        this.time.delayedCall(tele[i], () => {
          if (!boss.active) return
          boss.setVelocity(Math.cos(ang) * spd[i], Math.sin(ang) * spd[i])
          this.time.delayedCall(dur[i], () => boss.active && boss.setVelocity(0, 0))
        })
      }}))
    } else if (this.currentBossType === 4) {
      // Ring burst → more telegraphs, then bigger burst
      const ringR = [60, 68, 76]
      const count = [10, 14, 18]
      const tele = [400, 350, 300]
      const delay = [2500, 2200, 1900]
      const i = Math.min(this.currentBossPhase, 2)
      this.bossTimers.push(this.time.addEvent({ delay: delay[i], loop: true, callback: () => {
        if (!boss.active) return
        const center = c()
        for (let k = 0; k < count[i]; k++) {
          const ang = (k / count[i]) * Math.PI * 2
          const rx = center.x + Math.cos(ang) * ringR[i]
          const ry = center.y + Math.sin(ang) * ringR[i]
          this.showTelegraphCircle(rx, ry, 8, tele[i])
        }
        this.time.delayedCall(tele[i], () => {
          if (!boss.active) return
          for (let k = 0; k < count[i]; k++) this.spawnEnemyBullet(center.x, center.y, (k / count[i]) * 360)
        })
      }}))
    } else {
      // Final boss multi-phase combo
      if (this.currentBossPhase === 0) {
        // Faster spiral
        let a = 0
        this.bossTimers.push(this.time.addEvent({ delay: 70, loop: true, callback: () => {
          if (!boss.active) return
          const center = c()
          this.spawnEnemyBullet(center.x, center.y, a)
          a = (a + 20) % 360
        }}))
      } else if (this.currentBossPhase === 1) {
        // Spiral + occasional dash
        let a = 0
        this.bossTimers.push(this.time.addEvent({ delay: 65, loop: true, callback: () => {
          if (!boss.active) return
          const center = c()
          this.spawnEnemyBullet(center.x, center.y, a)
          a = (a + 22) % 360
        }}))
        this.bossTimers.push(this.time.addEvent({ delay: 2600, loop: true, callback: () => {
          if (!boss.active) return
          const ang = aimToPlayer()
          this.showTelegraphLine(boss.x, boss.y, boss.x + Math.cos(ang) * 150, boss.y + Math.sin(ang) * 150, 320)
          this.time.delayedCall(320, () => boss.active && boss.setVelocity(Math.cos(ang) * 185, Math.sin(ang) * 185))
          this.time.delayedCall(670, () => boss.active && boss.setVelocity(0, 0))
        }}))
      } else if (this.currentBossPhase === 2) {
        // Add ring bursts
        let a = 0
        this.bossTimers.push(this.time.addEvent({ delay: 60, loop: true, callback: () => {
          if (!boss.active) return
          const center = c()
          this.spawnEnemyBullet(center.x, center.y, a)
          a = (a + 24) % 360
        }}))
        this.bossTimers.push(this.time.addEvent({ delay: 2000, loop: true, callback: () => {
          if (!boss.active) return
          const center = c()
          const cnt = 16
          for (let k = 0; k < cnt; k++) this.spawnEnemyBullet(center.x, center.y, (k / cnt) * 360)
        }}))
      } else {
        // Enrage: fast dashes + dense rings
        let a = 0
        this.bossTimers.push(this.time.addEvent({ delay: 55, loop: true, callback: () => {
          if (!boss.active) return
          const center = c()
          this.spawnEnemyBullet(center.x, center.y, a)
          a = (a + 26) % 360
        }}))
        this.bossTimers.push(this.time.addEvent({ delay: 1600, loop: true, callback: () => {
          if (!boss.active) return
          const center = c()
          const cnt = 22
          for (let k = 0; k < cnt; k++) this.spawnEnemyBullet(center.x, center.y, (k / cnt) * 360)
        }}))
        this.bossTimers.push(this.time.addEvent({ delay: 2200, loop: true, callback: () => {
          if (!boss.active) return
          const ang = aimToPlayer()
          this.showTelegraphLine(boss.x, boss.y, boss.x + Math.cos(ang) * 160, boss.y + Math.sin(ang) * 160, 260)
          this.time.delayedCall(260, () => boss.active && boss.setVelocity(Math.cos(ang) * 200, Math.sin(ang) * 200))
          this.time.delayedCall(600, () => boss.active && boss.setVelocity(0, 0))
        }}))
      }
    }
  }

  private updateEnemies(cx: number, cy: number) {
    const despawnRadius = Math.hypot(this.scale.width, this.scale.height)
    const chaseSpeedBase = 40
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const enemy of children) {
      if (!enemy || !enemy.active || !this.player) continue
      // ensure body is enabled and visible if active
      if (!enemy.body) enemy.enableBody(true, enemy.x, enemy.y, true, true)
      // skip chase while stunned
      const stunUntil = ((enemy as any).stunUntil as number) || 0
      if (this.time.now < stunUntil) continue
      const chaseSpeed = ((enemy as any).chase as number) || chaseSpeedBase
      const dx = this.player.x - enemy.x
      const dy = this.player.y - enemy.y
      const len = Math.hypot(dx, dy) || 1
      enemy.setVelocity((dx / len) * chaseSpeed, (dy / len) * chaseSpeed)

      const dcx = enemy.x - cx
      const dcy = enemy.y - cy
      const distCam = Math.hypot(dcx, dcy)
      if (distCam > despawnRadius * 1.5) enemy.disableBody(true, true)
    }
  }

  private ensureAsteroidObstacles() {
    if (!this.asteroidStatics) {
      this.asteroidStatics = this.physics.add.group({ immovable: true, allowGravity: false, maxSize: 40 })
      if (this.player) this.physics.add.collider(this.player, this.asteroidStatics, (_p, a) => this.onAsteroidHit(_p as any, a as any))
      this.physics.add.collider(this.enemies, this.asteroidStatics, (_e, a) => this.onAsteroidHit(_e as any, a as any))
    }
    if (!this.asteroidMovers) {
      this.asteroidMovers = this.physics.add.group({ allowGravity: false, maxSize: 20 })
      if (this.player) this.physics.add.collider(this.player, this.asteroidMovers, (_p, a) => this.onAsteroidHit(_p as any, a as any))
      this.physics.add.collider(this.enemies, this.asteroidMovers, (_e, a) => this.onAsteroidHit(_e as any, a as any))
    }
    if (!this.textures.exists('asteroid-rock')) {
      const g = this.add.graphics(); g.fillStyle(0x7a7f88, 1); g.fillCircle(8, 8, 8); g.fillStyle(0x9aa0aa, 1); g.fillCircle(5, 6, 3); g.generateTexture('asteroid-rock', 16, 16); g.destroy()
    }
  }

  private spawnAsteroidStatic(cx: number, cy: number) {
    this.ensureAsteroidObstacles()
    const viewRadius = Math.hypot(this.scale.width, this.scale.height) * 0.5
    const inner = viewRadius * 0.9
    const outer = inner + 120
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const a = this.asteroidStatics!.get(x, y, 'asteroid-rock') as Phaser.Physics.Arcade.Sprite
    if (!a) return
    a.enableBody(true, x, y, true, true)
    a.setCircle(7, 1, 1)
    a.setImmovable(true)
    ;(a as any).isAsteroid = true
    ;(a as any).damageCooldownUntil = 0
  }

  private spawnAsteroidMover(cx: number, cy: number) {
    this.ensureAsteroidObstacles()
    const viewRadius = Math.hypot(this.scale.width, this.scale.height) * 0.5
    const inner = viewRadius * 0.9
    const outer = inner + 140
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const a = this.asteroidMovers!.get(x, y, 'asteroid-rock') as Phaser.Physics.Arcade.Sprite
    if (!a) return
    a.enableBody(true, x, y, true, true)
    a.setCircle(7, 1, 1)
    ;(a as any).isAsteroid = true
    ;(a as any).damageCooldownUntil = 0
    const toCenter = Math.atan2(cy - y, cx - x)
    const speed = Phaser.Math.Between(12, 28)
    a.setVelocity(Math.cos(toCenter) * speed, Math.sin(toCenter) * speed)
    a.setAngularVelocity(Phaser.Math.Between(-40, 40))
  }

  private onAsteroidHit(objA: Phaser.Physics.Arcade.Sprite, objB: Phaser.Physics.Arcade.Sprite) {
    const now = this.time.now
    const hurt = (t: Phaser.Physics.Arcade.Sprite, amount: number, src: Phaser.Physics.Arcade.Sprite) => {
      if (t === this.player) {
        if (this.hurtCooldown > 0) return
        this.hurtCooldown = 0.6
        this.hpCur = Math.max(0, this.hpCur - amount)
        this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
        const ang = Math.atan2(this.player!.y - src.y, this.player!.x - src.x)
        this.player!.setVelocity(Math.cos(ang) * 120, Math.sin(ang) * 120)
        if (this.hpCur <= 0) { this.scene.stop('HUD'); this.scene.start('GameOver') }
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

  private createXPGemTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 6
    const gfx = this.add.graphics()
    gfx.fillStyle(0x66ccff, 1)
    gfx.fillTriangle(3, 0, 6, 3, 0, 3)
    gfx.fillTriangle(0, 3, 6, 3, 3, 6)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  private createXPGemEliteTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 6
    const g = this.add.graphics()
    // purple gem
    g.fillStyle(0xaa66ff, 1)
    g.fillTriangle(3, 0, 6, 3, 0, 3)
    g.fillTriangle(0, 3, 6, 3, 3, 6)
    // small white glint
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(2, 1, 1, 1)
    g.generateTexture(key, size, size)
    g.destroy()
  }

  private createGoldTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 6
    const gfx = this.add.graphics()
    gfx.fillStyle(0xffcc33, 1)
    gfx.fillCircle(size / 2, size / 2, size / 2)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  private createGoldEliteTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 8
    const g = this.add.graphics()
    // coin base
    g.fillStyle(0xffcc33, 1)
    g.fillCircle(size / 2, size / 2, size / 2 - 1)
    // star glint (simple 4-point star using triangles)
    g.fillStyle(0xffffff, 0.95)
    const cx = size / 2, cy = size / 2
    g.fillTriangle(cx, cy - 2, cx - 1, cy, cx + 1, cy)
    g.fillTriangle(cx, cy + 2, cx - 1, cy, cx + 1, cy)
    g.fillTriangle(cx - 2, cy, cx, cy - 1, cx, cy + 1)
    g.fillTriangle(cx + 2, cy, cx, cy - 1, cx, cy + 1)
    g.generateTexture(key, size, size)
    g.destroy()
  }

  private createPowerupTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 8
    const gfx = this.add.graphics()
    gfx.fillStyle(0x99ffcc, 1)
    gfx.fillRect(0, 0, size, size)
    gfx.fillStyle(0x006644, 1)
    gfx.fillRect(2, 2, size - 4, size - 4)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  private applyPowerupReward(): string | null {
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()
    // Choose a random owned weapon or accessory
    const owned: { kind: 'w' | 'a'; key: string; level: number }[] = []
    for (const w of inv.weapons) owned.push({ kind: 'w', key: w.key, level: w.level })
    for (const a of inv.accessories) owned.push({ kind: 'a', key: a.key, level: a.level })
    if (owned.length === 0) {
      // fallback: give gold
      this.registry.set('gold', ((this.registry.get('gold') as number) || 0) + 25)
      return 'Gold +25'
    }
    const pick = Phaser.Utils.Array.GetRandom(owned)
    const isMax = pick.kind === 'w' ? pick.level >= MAX_WEAPON_LEVEL : pick.level >= MAX_ACCESSORY_LEVEL
    if (isMax) {
      // 50 gold or full heal
      if (Math.random() < 0.5) {
        this.registry.set('gold', ((this.registry.get('gold') as number) || 0) + 50)
        return 'Gold +50'
      } else {
        this.hpCur = this.hpMax
        this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
        return 'Full Heal'
      }
    }
    if (pick.kind === 'w') {
      // level up weapon
      const w = inv.weapons.find((x) => x.key === pick.key)
      if (w) w.level = Math.min(MAX_WEAPON_LEVEL, w.level + 1)
      this.registry.set('inv', inv)
      this.registry.set('inv-weapons', describeWeapons(inv))
      this.recomputeEffectiveStats()
      return `${pick.key} Lv${w?.level}`
    } else {
      const a = inv.accessories.find((x) => x.key === pick.key)
      if (a) a.level = Math.min(MAX_ACCESSORY_LEVEL, a.level + 1)
      this.registry.set('inv', inv)
      this.registry.set('inv-accessories', describeAccessories(inv))
      this.recomputeEffectiveStats()
      return `${pick.key} Lv${a?.level}`
    }
    return null
  }

  private createHealthTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 7
    const gfx = this.add.graphics()
    gfx.fillStyle(0x33ff66, 1)
    gfx.fillRect(0, 0, size, size)
    gfx.fillStyle(0xffffff, 1)
    // simple plus sign
    gfx.fillRect(size/2 - 1, 1, 2, size - 2)
    gfx.fillRect(1, size/2 - 1, size - 2, 2)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  private updatePickups(cx: number, cy: number) {
    const despawnRadius = Math.hypot(this.scale.width, this.scale.height)
    const groups = [this.xpGroup, this.goldGroup, this.healthGroup, this.powerupGroup]
    for (const g of groups) {
      const children = g.getChildren() as Phaser.Physics.Arcade.Sprite[]
      for (const obj of children) {
        const dcx = obj.x - cx
        const dcy = obj.y - cy
        const distCam = Math.hypot(dcx, dcy)
        if (distCam > despawnRadius * 1.5) obj.disableBody(true, true)

        // Magnet collection radius around player
        if (this.player) {
          const dx = obj.x - this.player.x
          const dy = obj.y - this.player.y
          const d = Math.hypot(dx, dy)
          if (d < this.magnetRadius) {
            const pull = 80
            const nx = dx / (d || 1)
            const ny = dy / (d || 1)
            obj.body && (obj.body as Phaser.Physics.Arcade.Body).setVelocity(-nx * pull, -ny * pull)
          }
        }
      }
    }
  }

  private checkLevelProgress(currentXP: number) {
    if (currentXP >= this.xpToNext) {
      this.level += 1
      this.registry.set('level', this.level)
      this.registry.set('xp', 0)
      this.xpToNext = Math.floor(this.xpToNext * 1.5 + 3)
      this.tryEvolveWeapons()
      // Pause gameplay and freeze level timer
      this.scene.pause()
      this.time.timeScale = 0
      // Build 3-of-N choices
      const pool = [
        { key: 'gold', label: 'Bounty +5 gold now', color: '#88ff88' },
        { key: 'firerate', label: 'Blaster +15% fire rate', color: '#88ff88' },
        { key: 'damage', label: 'Blaster +1 damage', color: '#ff8866' },
        { key: 'multishot', label: 'Blaster +1 projectile', color: '#ccccff' },
        { key: 'hpmax', label: 'Hull plating +15% Max HP', color: '#66ff66' },
        { key: 'acc-thrusters', label: 'Accessory: Thrusters', color: '#66ccff' },
        { key: 'acc-magnet-core', label: 'Accessory: Tractor Beam', color: '#33ff99' },
        { key: 'acc-ammo-loader', label: 'Accessory: Ammo Loader', color: '#ffaa66' },
        { key: 'acc-power-cell', label: 'Accessory: Power Cell', color: '#ff8866' },
        { key: 'acc-splitter', label: 'Accessory: Splitter', color: '#ccccff' },
        { key: 'w-laser', label: 'Weapon: Laser', color: '#ff66ff' },
        { key: 'w-missiles', label: 'Weapon: Missiles', color: '#ffcc66' },
        { key: 'w-orb', label: 'Weapon: Orb', color: '#66ccff' },
      ]
      const choices = Phaser.Utils.Array.Shuffle(pool).slice(0, 3)
      this.scene.launch('LevelUp', { choices })
      // Apply choice when LevelUpScene emits
      const applyOnce = (key: string) => {
        if (this.bonusLevelsUsed >= this.maxBonusLevels) { this.game.events.off('levelup-apply', applyOnce as any); this.scene.resume(); return }
        // speed and magnet inline bonuses removed (use accessories instead)
        if (key === 'gold') this.registry.set('gold', ((this.registry.get('gold') as number) || 0) + 5)
        if (key === 'firerate') { this.bonusFireRateMul = Math.min(3, this.bonusFireRateMul * 1.15); this.bonusLevelsUsed++ }
        if (key === 'damage') { this.bonusDamage = Math.min(99, this.bonusDamage + 1); this.bonusLevelsUsed++ }
        if (key === 'multishot') { this.inlineExtraProjectiles = Math.min(6, this.inlineExtraProjectiles + 1); this.bonusLevelsUsed++ }
        if (key === 'hpmax') {
          const inc = Math.max(1, Math.floor(this.hpMax * 0.15))
          this.hpMax = Math.min(99, this.hpMax + inc)
          this.hpCur = Math.min(this.hpMax, this.hpCur + inc) // small immediate heal
          this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
          this.bonusLevelsUsed++
        }
        // Accessories
        if (key.startsWith('acc-')) {
          const inv = (this.registry.get('inv') as InventoryState) || createInventory()
          const cleanKey = key.replace('acc-', '')
          addAccessory(inv, cleanKey)
          this.registry.set('inv', inv)
          this.registry.set('inv-accessories', describeAccessories(inv))
        }
        // Weapons
        if (key.startsWith('w-')) {
          const inv = (this.registry.get('inv') as InventoryState) || createInventory()
          const wKey = key.replace('w-', '') as any
          addWeapon(inv, wKey)
          this.registry.set('inv', inv)
          this.registry.set('inv-weapons', describeWeapons(inv))
        }
        this.recomputeEffectiveStats()
        this.game.events.off('levelup-apply', applyOnce as any)
        // Resume gameplay and unfreeze level timer
        this.time.timeScale = 1
        this.scene.resume()
      }
      this.game.events.on('levelup-apply', applyOnce as any)
    }
  }
}


