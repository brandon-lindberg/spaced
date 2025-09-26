import Phaser from 'phaser'
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons } from '../systems/inventory'
import type { InventoryState } from '../systems/inventory'

export default class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>
  private lastAimDeg = 0
  private lastMoveX = 0
  private lastMoveY = 0

  private bgFar?: Phaser.GameObjects.TileSprite
  private bgMid?: Phaser.GameObjects.TileSprite
  private bgNear?: Phaser.GameObjects.TileSprite

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
  private bulletTextureKey = 'bullet'
  private fireCooldown = 0
  private fireRate = 1.2 // shots per second (easier early game)
  private bulletDamage = 1
  private multishot = 1

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
    this.createStarTexture('stars-far', 512, 60)
    this.createStarTexture('stars-mid', 512, 100)
    this.createStarTexture('stars-near', 512, 160)

    this.bgFar = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-far')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-1000)
    this.bgMid = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-mid')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-999)
    this.bgNear = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'stars-near')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-998)

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
    this.levelStartMs = this.time.now

    // Reset registry run-specific state
    this.registry.set('xp', 0)
    this.registry.set('level', 1)
    this.registry.set('gold', 0)
    this.registry.set('hp', { cur: this.hpCur, max: this.hpMax })

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

    // Inventory
    const inv = createInventory()
    addWeapon(inv, 'blaster')
    this.registry.set('inv', inv as unknown as InventoryState)
    this.registry.set('inv-weapons', describeWeapons(inv))
    this.registry.set('inv-accessories', describeAccessories(inv))

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

    while (this.spawnAccumulator >= 1 && activeEnemies + 1 <= targetCap) {
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
    if (!this.textures.exists(this.bulletTextureKey)) {
      const size = 2
      const gfx = this.add.graphics()
      gfx.fillStyle(0x88ff88, 1)
      gfx.fillRect(0, 0, size, size)
      gfx.generateTexture(this.bulletTextureKey, size, size)
      gfx.destroy()
    }
  }

  private updateWeapon(dt: number) {
    this.ensureBulletAssets()
    this.fireCooldown -= dt
    if (this.fireCooldown <= 0 && this.player) {
      this.fireCooldown = 1 / this.fireRate
      const baseAngle = this.getAimAngle()
      const spread = 10
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
    }
    // Despawn far bullets
    const cam = this.cameras.main
    const bounds = new Phaser.Geom.Rectangle(cam.scrollX - 40, cam.scrollY - 40, cam.width + 80, cam.height + 80)
    const arr = this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const b of arr) if (b.active && !Phaser.Geom.Rectangle.Contains(bounds, b.x, b.y)) b.disableBody(true, true)
  }

  private spawnBullet(x: number, y: number, angleDeg: number) {
    const b = this.bullets.get(x, y, this.bulletTextureKey) as Phaser.Physics.Arcade.Sprite
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

  private onBulletHit(bullet: Phaser.GameObjects.GameObject, enemyObj: Phaser.GameObjects.GameObject) {
    const b = bullet as Phaser.Physics.Arcade.Sprite
    const e = enemyObj as Phaser.Physics.Arcade.Sprite
    const damage = (b as any).damage ?? 1
    const hp = ((e as any).hp ?? 2) - damage
    ;(e as any).hp = hp
    b.disableBody(true, true)
    if (hp <= 0) {
      // Drop a bit of XP/gold occasionally
      if (Math.random() < 0.65) this.xpGroup.create(e.x, e.y, this.xpTextureKey).setActive(true).setVisible(true)
      if (Math.random() < 0.3) this.goldGroup.create(e.x, e.y, this.goldTextureKey).setActive(true).setVisible(true)
      e.disableBody(true, true)
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
      this.scene.pause()
      // Build 3-of-N choices
      const pool = [
        { key: 'speed', label: 'Thrusters +10% speed', color: '#66ccff' },
        { key: 'magnet', label: 'Magnet +24px', color: '#ffcc33' },
        { key: 'gold', label: 'Bounty +5 gold now', color: '#88ff88' },
        { key: 'firerate', label: 'Blaster +15% fire rate', color: '#88ff88' },
        { key: 'damage', label: 'Blaster +1 damage', color: '#ff8866' },
        { key: 'multishot', label: 'Blaster +1 projectile', color: '#ccccff' },
        { key: 'acc-armor', label: 'Armor +1 (accessory)', color: '#ffaa88' },
        { key: 'acc-magnet', label: 'Magnet Core +1 (accessory)', color: '#ffee66' },
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
        // Accessories (placeholder increments only)
        if (key.startsWith('acc-')) {
          const inv = (this.registry.get('inv') as InventoryState) || createInventory()
          addAccessory(inv, key)
          this.registry.set('inv', inv)
          this.registry.set('inv-accessories', describeAccessories(inv))
        }
        this.game.events.off('levelup-apply', applyOnce as any)
        this.scene.resume()
      }
      this.game.events.on('levelup-apply', applyOnce as any)
    }
  }
}


