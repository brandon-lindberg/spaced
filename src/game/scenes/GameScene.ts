import Phaser from 'phaser'
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons } from '../systems/inventory'
import { evolveWeapon } from '../systems/inventory'
import { defaultBaseStats, applyWeaponLevel, applyAccessoryLevel } from '../systems/items'
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

  private bgFar?: Phaser.GameObjects.TileSprite
  private bgMid?: Phaser.GameObjects.TileSprite
  private bgNear?: Phaser.GameObjects.TileSprite
  private bgSun?: Phaser.GameObjects.Image

  private enemies!: Phaser.Physics.Arcade.Group
  private enemyTextureKey = 'enemy-square'
  private spawnAccumulator = 0
  private levelStartMs = 0

  private xpGroup!: Phaser.Physics.Arcade.Group
  private goldGroup!: Phaser.Physics.Arcade.Group
  private xpTextureKey = 'xp-gem'
  private goldTextureKey = 'gold-coin'
  private xpSpawnAcc = 0
  private goldSpawnAcc = 0

  private level = 1
  private xpToNext = 5
  private magnetRadius = 16
  private speedMultiplier = 1

  // Basic weapon: Blaster
  private bullets!: Phaser.Physics.Arcade.Group
  private missileGroup!: Phaser.Physics.Arcade.Group
  private orbGroup!: Phaser.Physics.Arcade.Group
  private bulletTextureKey = 'bullet'
  private fireCooldown = 0
  private fireRate = 1.2 // shots per second (easier early game)
  private bulletDamage = 1
  private multishot = 1
  private spreadDeg = 10
  private weaponCooldowns: Record<string, number> = {}
  private laserAngle = 0
  private laserBeamAccum = 0
  private laserTickCooldown = 0

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
    const rs = runState.startLevel(runState.state?.level ?? 1, this.time.now)
    this.levelStartMs = rs?.levelStartMs ?? this.time.now

    // Reset per-level state
    this.registry.set('xp', 0)
    this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })
    if (this.registry.get('gold') === undefined || this.registry.get('gold') === null) {
      this.registry.set('gold', 0)
    }

    // Pickups
    this.createXPGemTexture(this.xpTextureKey)
    this.createGoldTexture(this.goldTextureKey)
    this.xpGroup = this.physics.add.group()
    this.goldGroup = this.physics.add.group()

    this.physics.add.overlap(this.player, this.xpGroup, (_, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      sprite.destroy()
      const cur = (this.registry.get('xp') as number) || 0
      const next = cur + 1
      this.registry.set('xp', next)
      this.checkLevelProgress(next)
    })
    this.physics.add.overlap(this.player, this.goldGroup, (_, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      sprite.destroy()
      const cur = (this.registry.get('gold') as number) || 0
      this.registry.set('gold', cur + 1)
    })

    // Player <-> enemy collision damage
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Phaser.Physics.Arcade.Sprite
      if (!enemy.active) return
      this.onPlayerTouched(enemy)
    })

    // Inventory (persist across level restarts within run)
    let inv = (this.registry.get('inv') as InventoryState) || createInventory()
    if (!inv.weapons || inv.weapons.length === 0) addWeapon(inv, 'blaster')
    this.registry.set('inv', inv as unknown as InventoryState)
    this.registry.set('inv-weapons', describeWeapons(inv))
    this.registry.set('inv-accessories', describeAccessories(inv))
    this.recomputeEffectiveStats()

    // Touch joystick UI (mobile)
    this.createTouchJoystick()

    // Gamepad setup
    this.input.gamepad?.once('connected', () => {})
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

    // Pickup spawns (placeholder: also spawned from ring for testing)
    const xpPerSec = 0.25
    const goldPerSec = 0.15
    this.xpSpawnAcc += xpPerSec * dt
    this.goldSpawnAcc += goldPerSec * dt
    while (this.xpSpawnAcc >= 1) {
      this.xpSpawnAcc -= 1
      this.spawnPickupInRing(camCenter.x, camCenter.y, 'xp')
    }
    while (this.goldSpawnAcc >= 1) {
      this.goldSpawnAcc -= 1
      this.spawnPickupInRing(camCenter.x, camCenter.y, 'gold')
    }

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

  private createAsteroidTile(key: string) {
    if (this.textures.exists(key)) return
    const s = 256
    const tex = this.textures.createCanvas(key, s, s)
    const c = tex?.getContext()
    if (!c) return
    c.fillStyle = '#0a0a15'
    c.fillRect(0, 0, s, s)
    const rocks = 18
    for (let i = 0; i < rocks; i++) {
      const x = Math.random() * s
      const y = Math.random() * s
      const r = 6 + Math.random() * 18
      c.fillStyle = '#777777'
      c.beginPath()
      c.ellipse(x, y, r, r * (0.6 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#999999'
      c.beginPath()
      c.arc(x - r * 0.3, y - r * 0.2, r * 0.3, 0, Math.PI * 2)
      c.fill()
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
      this.createAsteroidTile('asteroid-tile')
      this.bgFar = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'asteroid-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-1000)
      this.bgMid = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'asteroid-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-999)
      this.bgNear = this.add.tileSprite(0,0,this.scale.width,this.scale.height,'asteroid-tile').setOrigin(0,0).setScrollFactor(0).setDepth(-998)
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
      // Debug: draw bullet collider rects briefly after spawn
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
    this.fireCooldown -= dt
    if (this.fireCooldown <= 0 && this.player) {
      this.fireCooldown = 1 / this.fireRate
      const baseAngle = this.getAimAngle()
      const spread = this.spreadDeg || 10
      const angles: number[] = []
      if (this.multishot <= 1) {
        angles.push(baseAngle)
      } else {
        const half = (this.multishot - 1) / 2
        for (let i = -half; i <= half; i++) angles.push(baseAngle + (i as number) * spread)
      }
      const muzzle = 6
      for (const a of angles) {
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player.x + Math.cos(rad) * muzzle
        const oy = this.player.y + Math.sin(rad) * muzzle
        this.spawnBullet(ox, oy, a)
      }

      // Distinct patterns for additional weapons
      const inv = (this.registry.get('inv') as InventoryState) || createInventory()
      const has = (k: string) => inv.weapons.some((w) => w.key === k)
      // laser/missile/orb handled below as well
      if (has('missiles') || has('cluster-missiles')) {
        const a = baseAngle
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player.x + Math.cos(rad) * muzzle
        const oy = this.player.y + Math.sin(rad) * muzzle
        this.spawnMissile(ox, oy, a)
      }
      if (has('orb') || has('nova-orb')) {
        const a = baseAngle
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player.x + Math.cos(rad) * muzzle
        const oy = this.player.y + Math.sin(rad) * muzzle
        this.spawnOrb(ox, oy, a)
      }
    }
    // Despawn far bullets
    const cam = this.cameras.main
    const bounds = new Phaser.Geom.Rectangle(cam.scrollX - 40, cam.scrollY - 40, cam.width + 80, cam.height + 80)
    const arrB = this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]
    const arrM = this.missileGroup ? (this.missileGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]) : []
    const arrO = this.orbGroup ? (this.orbGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]) : []
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
    const hasLaser = inv2.weapons.some((w) => w.key === 'laser')
    const hasBeamLaser = inv2.weapons.some((w) => w.key === 'beam-laser')
    if (this.player && (hasLaser || hasBeamLaser)) {
      const spinSpeed = hasBeamLaser ? 240 : 180
      const rate = this.fireRate * (hasBeamLaser ? 1.6 : 1.2)
      this.laserAngle = (this.laserAngle + spinSpeed * dt) % 360
      this.laserBeamAccum += dt
      if (this.laserBeamAccum >= 1 / Math.max(0.1, rate)) {
        this.laserBeamAccum -= 1 / Math.max(0.1, rate)
        const a = this.laserAngle
        const rad = Phaser.Math.DegToRad(a)
        const ox = this.player.x + Math.cos(rad) * 12
        const oy = this.player.y + Math.sin(rad) * 12
        const len = hasBeamLaser ? 130 : 100
        this.spawnBeam(ox, oy, a, len)
        const shot = this.bullets.get(ox, oy, 'laser-shot-tex') as Phaser.Physics.Arcade.Sprite
        if (shot) {
          shot.enableBody(true, ox, oy, true, true)
          this.time.delayedCall(100, () => shot.active && shot.disableBody(true, true))
        }
      }
    }
  }

  private spawnBullet(x: number, y: number, angleDeg: number) {
    const tex = 'blaster-tex'
    const b = this.bullets.get(x, y, tex) as Phaser.Physics.Arcade.Sprite
    if (!b) return
    b.enableBody(true, x, y, true, true)
    b.setDepth(5)
    b.body?.setSize(2, 2, true)
    b.setCircle(1, 0, 0)
    const speed = 300
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
    const m = this.missileGroup.get(x, y, 'missile-tex') as Phaser.Physics.Arcade.Sprite
    if (!m) return
    m.enableBody(true, x, y, true, true)
    m.setDepth(5)
    m.body?.setSize(3, 3, true)
    m.setCircle(2, 0, 0)
    const speed = 160
    const rad = Phaser.Math.DegToRad(angleDeg)
    m.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(m as any).damage = Math.max(1, Math.floor(this.bulletDamage * 1.5))
    ;(m as any).missile = true
    this.time.delayedCall(3500, () => m.active && m.disableBody(true, true))
  }

  private spawnOrb(x: number, y: number, angleDeg: number) {
    const o = this.orbGroup.get(x, y, 'orb-tex') as Phaser.Physics.Arcade.Sprite
    if (!o) return
    o.enableBody(true, x, y, true, true)
    o.setDepth(5)
    o.body?.setSize(4, 4, true)
    o.setCircle(2, 0, 0)
    const speed = 90
    const rad = Phaser.Math.DegToRad(angleDeg)
    o.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(o as any).damage = this.bulletDamage
    ;(o as any).orb = true
    this.time.delayedCall(800, () => this.explodeOrb(o))
  }

  private explodeOrb(o: Phaser.Physics.Arcade.Sprite) {
    if (!o.active) return
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

  private spawnBeam(x: number, y: number, angleDeg: number, length: number) {
    const img = this.add.image(x, y, 'beam-tex').setOrigin(0, 0.5).setDepth(900)
    img.rotation = Phaser.Math.DegToRad(angleDeg)
    img.setScale(length / 8, 1.6)
    this.tweens.add({ targets: img, alpha: 0, duration: 120, onComplete: () => img.destroy() })
  }

  private showExplosion(x: number, y: number, radius: number) {
    const ex = this.add.image(x, y, 'explosion-tex').setDepth(850)
    const scale = Math.max(0.5, radius / 16)
    ex.setScale(scale)
    this.tweens.add({ targets: ex, alpha: 0, scale: scale * 1.2, duration: 220, onComplete: () => ex.destroy() })
  }

  private onBulletHit(bullet: Phaser.GameObjects.GameObject, enemyObj: Phaser.GameObjects.GameObject) {
    const b = bullet as Phaser.Physics.Arcade.Sprite
    const e = enemyObj as Phaser.Physics.Arcade.Sprite
    if ((b as any).enemyBullet) return
    const damage = (b as any).damage ?? 1
    const hp = ((e as any).hp ?? 2) - damage
    ;(e as any).hp = hp
    b.disableBody(true, true)
    // Missile impact explosion
    if ((b as any).missile) {
      this.showExplosion(e.x, e.y, 16)
    }
    if (hp <= 0) {
      // Drop a bit of XP/gold occasionally
      if (Math.random() < 0.65) this.xpGroup.create(e.x, e.y, this.xpTextureKey).setActive(true).setVisible(true)
      if (Math.random() < 0.3) this.goldGroup.create(e.x, e.y, this.goldTextureKey).setActive(true).setVisible(true)
      const isBoss = !!(e as any).isBoss
      e.disableBody(true, true)
      if (isBoss) {
        this.bossActive = false
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
      }
    }
  }

  private recomputeEffectiveStats() {
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()
    const s = { ...defaultBaseStats }
    for (const w of inv.weapons) applyWeaponLevel(s as any, w.key as any, w.level)
    for (const a of inv.accessories) applyAccessoryLevel(s as any, a.key as any, a.level)
    this.fireRate = Math.min(8, s.fireRate)
    this.bulletDamage = Math.max(1, s.bulletDamage)
    this.multishot = Math.min(7, Math.max(1, Math.floor(s.multishot)))
    this.speedMultiplier = Math.max(0.5, Math.min(2.5, s.speedMultiplier))
    this.magnetRadius = Math.max(16, Math.min(280, s.magnetRadius))
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
    const hasBlaster = inv.weapons.some((w) => w.key === 'blaster' && w.level >= 3)
    const hasSplitter = inv.accessories.some((a) => a.key === 'splitter' && a.level >= 1)
    const hasPower = inv.accessories.some((a) => a.key === 'power-cell' && a.level >= 1)
    if (hasBlaster && hasSplitter && hasPower) {
      if (evolveWeapon(inv, 'blaster', 'scatter-blaster')) {
        this.registry.set('inv', inv)
        this.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.registry.set('toast', 'Evolved: Scatter Blaster!')
      }
    }
    // Second synergy: Blaster + Ammo Loader + Thrusters => Pulse Blaster
    const hasAmmo = inv.accessories.some((a) => a.key === 'ammo-loader' && a.level >= 1)
    const hasThrusters = inv.accessories.some((a) => a.key === 'thrusters' && a.level >= 1)
    if (hasBlaster && hasAmmo && hasThrusters) {
      if (evolveWeapon(inv, 'blaster', 'pulse-blaster')) {
        this.registry.set('inv', inv)
        this.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.registry.set('toast', 'Evolved: Pulse Blaster!')
      }
    }
    // Laser -> Beam Laser (requires Magnet Core)
    const hasLaser = inv.weapons.some((w) => w.key === 'laser' && w.level >= 3)
    const hasMagnet = inv.accessories.some((a) => a.key === 'magnet-core' && a.level >= 1)
    if (hasLaser && hasMagnet) {
      if (evolveWeapon(inv, 'laser', 'beam-laser')) {
        this.registry.set('inv', inv)
        this.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.registry.set('toast', 'Evolved: Beam Laser!')
      }
    }
    // Missiles -> Cluster Missiles (requires Splitter)
    const hasMissiles = inv.weapons.some((w) => w.key === 'missiles' && w.level >= 2)
    if (hasMissiles && hasSplitter) {
      if (evolveWeapon(inv, 'missiles', 'cluster-missiles')) {
        this.registry.set('inv', inv)
        this.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.registry.set('toast', 'Evolved: Cluster Missiles!')
      }
    }
    // Orb -> Nova Orb (requires Power Cell)
    const hasOrb = inv.weapons.some((w) => w.key === 'orb' && w.level >= 2)
    if (hasOrb && hasPower) {
      if (evolveWeapon(inv, 'orb', 'nova-orb')) {
        this.registry.set('inv', inv)
        this.registry.set('inv-weapons', describeWeapons(inv))
        this.recomputeEffectiveStats()
        this.registry.set('toast', 'Evolved: Nova Orb!')
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
    // Brief enemy knockback and stun
    const kbe = 90
    enemy.setVelocity(Math.cos(ang + Math.PI) * kbe, Math.sin(ang + Math.PI) * kbe)
    ;(enemy as any).stunUntil = this.time.now + 200
    if (this.hpCur <= 0) {
      this.scene.stop('HUD')
      this.scene.start('GameOver')
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

  private spawnEnemyInRing(cx: number, cy: number) {
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
    // Enemy hitbox slightly smaller
    enemy.setCircle(3, 1, 1)
    enemy.setCollideWorldBounds(false)
    ;(enemy as any).hp = 4
    // Scale enemy touch damage very slowly over time (every 90s +1)
    const elapsedSec = (this.time.now - this.levelStartMs) / 1000
    ;(enemy as any).touchDamage = 1 + Math.floor(elapsedSec / 90)
    ;(enemy as any).stunUntil = 0
  }

  private spawnEnemyBullet(x: number, y: number, angleDeg: number) {
    const b = this.bullets.get(x, y, this.bulletTextureKey) as Phaser.Physics.Arcade.Sprite
    if (!b) return
    b.enableBody(true, x, y, true, true)
    b.setDepth(4)
    b.body?.setSize(2, 2, true)
    b.setCircle(1, 0, 0)
    const speed = 120
    const rad = Phaser.Math.DegToRad(angleDeg)
    b.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed)
    ;(b as any).damage = 0
    ;(b as any).enemyBullet = true
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
    } else if (type === 'chaser') {
      ;(enemy as any).hp = Math.round(4 * hpScale)
      ;(enemy as any).chase = 70
      ;(enemy as any).touchDamage = touch
    } else {
      ;(enemy as any).hp = Math.round(7 * hpScale)
      ;(enemy as any).chase = 28
      ;(enemy as any).touchDamage = touch + 1
    }
    ;(enemy as any).stunUntil = 0
  }

  private spawnBoss(cx: number, cy: number) {
    const radius = Math.hypot(this.scale.width, this.scale.height) * 0.4
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const boss = (this.enemies.get(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite) ||
      (this.enemies.create(x, y, this.enemyTextureKey) as Phaser.Physics.Arcade.Sprite)
    boss.enableBody(true, x, y, true, true)
    boss.setScale(2)
    boss.setCircle(6, 2, 2)
    ;(boss as any).hp = 80
    ;(boss as any).hpMax = 80
    ;(boss as any).touchDamage = 2
    ;(boss as any).chase = 25
    ;(boss as any).isBoss = true
    this.registry.set('boss-hp', { cur: (boss as any).hp, max: (boss as any).hpMax || (boss as any).hp })
    this.clearNonBossEnemies()
    // Simple radial bullet spray every 1.5s
    this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        if (!boss.active) return
        const center = { x: boss.x, y: boss.y }
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * 360
          this.spawnEnemyBullet(center.x, center.y, ang)
        }
      },
    })
  }

  private spawnNextGauntletBoss(cx: number, cy: number) {
    // Stages 0-3: previous 4 bosses placeholder; stage 4: final boss
    if (this.gauntletStage < 4) {
      this.spawnBoss(cx, cy)
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
      ;(boss as any).hp = 140
      ;(boss as any).hpMax = 140
      ;(boss as any).touchDamage = 3
      ;(boss as any).chase = 30
      ;(boss as any).isBoss = true
      this.bossActive = true
      this.registry.set('boss-hp', { cur: (boss as any).hp, max: (boss as any).hpMax || (boss as any).hp })
      this.clearNonBossEnemies()
    }
  }

  private clearNonBossEnemies() {
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const enemy of children) {
      if (!enemy || !enemy.active) continue
      if (!(enemy as any).isBoss) enemy.disableBody(true, true)
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

  private createGoldTexture(key: string) {
    if (this.textures.exists(key)) return
    const size = 6
    const gfx = this.add.graphics()
    gfx.fillStyle(0xffcc33, 1)
    gfx.fillCircle(size / 2, size / 2, size / 2)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  private spawnPickupInRing(cx: number, cy: number, kind: 'xp' | 'gold') {
    const viewRadius = Math.hypot(this.scale.width, this.scale.height) * 0.5
    const inner = viewRadius * 0.9
    const outer = inner + 60
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (kind === 'xp') {
      const p = this.xpGroup.create(x, y, this.xpTextureKey) as Phaser.Physics.Arcade.Sprite
      p.setActive(true)
      p.setVisible(true)
    } else {
      const p = this.goldGroup.create(x, y, this.goldTextureKey) as Phaser.Physics.Arcade.Sprite
      p.setActive(true)
      p.setVisible(true)
    }
  }

  private updatePickups(cx: number, cy: number) {
    const despawnRadius = Math.hypot(this.scale.width, this.scale.height)
    const groups = [this.xpGroup, this.goldGroup]
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
      this.scene.pause()
      // Build 3-of-N choices
      const pool = [
        { key: 'speed', label: 'Thrusters +10% speed', color: '#66ccff' },
        { key: 'magnet', label: 'Magnet +24px', color: '#ffcc33' },
        { key: 'gold', label: 'Bounty +5 gold now', color: '#88ff88' },
        { key: 'firerate', label: 'Blaster +15% fire rate', color: '#88ff88' },
        { key: 'damage', label: 'Blaster +1 damage', color: '#ff8866' },
        { key: 'multishot', label: 'Blaster +1 projectile', color: '#ccccff' },
        { key: 'acc-thrusters', label: 'Accessory: Thrusters', color: '#66ccff' },
        { key: 'acc-magnet-core', label: 'Accessory: Magnet Core', color: '#33ff99' },
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
        if (key === 'speed') this.speedMultiplier = Math.min(2, this.speedMultiplier + 0.1)
        if (key === 'magnet') this.magnetRadius = Math.min(200, this.magnetRadius + 24)
        if (key === 'gold') this.registry.set('gold', ((this.registry.get('gold') as number) || 0) + 5)
        if (key === 'firerate') this.fireRate = Math.min(8, this.fireRate * 1.15)
        if (key === 'damage') this.bulletDamage = Math.min(99, this.bulletDamage + 1)
        if (key === 'multishot') this.multishot = Math.min(7, this.multishot + 1)
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
        this.scene.resume()
      }
      this.game.events.on('levelup-apply', applyOnce as any)
    }
  }
}


