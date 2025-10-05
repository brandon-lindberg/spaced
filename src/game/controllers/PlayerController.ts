import Phaser from 'phaser'
import type { SceneContext } from './SceneServices'

interface JoypadState {
  active: boolean
  pointerId: number | null
  base?: Phaser.GameObjects.Arc
  thumb?: Phaser.GameObjects.Arc
  centerX: number
  centerY: number
  vecX: number
  vecY: number
  radius: number
}

export class PlayerController {
  private ctx: SceneContext
  private readonly idleTextureKey = 'player-ship-idle-1'
  private readonly movingTextureKey = 'player-ship-1'
  private currentTextureKey = this.idleTextureKey
  private player?: Phaser.Physics.Arcade.Sprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>
  private lastMoveX = 0
  private lastMoveY = 0
  private lastAimDeg = 0
  private joy: JoypadState = { active: false, pointerId: null, centerX: 0, centerY: 0, vecX: 0, vecY: 0, radius: 26 }
  private detachHandlers: Array<() => void> = []

  constructor(ctx: SceneContext) {
    this.ctx = ctx
  }

  initSprite(): Phaser.Physics.Arcade.Sprite {
    const centerX = this.ctx.scale.width / 2
    const centerY = this.ctx.scale.height / 2
    const sprite = this.ctx.physics.add.sprite(centerX, centerY, this.currentTextureKey)
    sprite.setCollideWorldBounds(false)
    sprite.setScale(0.02734375) // 28px ship
    sprite.setOrigin(0.5, 0.5)
    sprite.body?.setSize(16, 16, true)
    this.ctx.cameras.main.startFollow(sprite, true, 0.15, 0.15)

    this.player = sprite
    this.cursors = this.ctx.input.keyboard?.createCursorKeys()
    this.wasd = this.ctx.input.keyboard?.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>

    this.ensureTouchJoystick()
    return sprite
  }

  update(speed: number) {
    if (!this.player) return
    let vx = 0
    let vy = 0
    if (this.cursors?.left?.isDown || this.wasd?.A?.isDown) vx -= 1
    if (this.cursors?.right?.isDown || this.wasd?.D?.isDown) vx += 1
    if (this.cursors?.up?.isDown || this.wasd?.W?.isDown) vy -= 1
    if (this.cursors?.down?.isDown || this.wasd?.S?.isDown) vy += 1

    const pad = this.ctx.input.gamepad?.getPad(0)
    if (pad) {
      const options = this.ctx.getOptions().gamepad || { invertX: false, invertY: false }
      const rawX = pad.axes.length > 0 ? pad.axes[0].getValue() : 0
      const rawY = pad.axes.length > 1 ? pad.axes[1].getValue() : 0
      const mapX = options.invertX ? -rawX : rawX
      const baselineY = -rawY
      const mapY = options.invertY ? baselineY : -baselineY
      if (Math.hypot(mapX, mapY) > 0.2) {
        vx = mapX
        vy = mapY
      }
    }

    if (this.joy.active) {
      vx = this.joy.vecX
      vy = this.joy.vecY
    }

    const len = Math.hypot(vx, vy) || 1
    this.lastMoveX = vx / len
    this.lastMoveY = vy / len
    this.player.setVelocity(this.lastMoveX * speed, this.lastMoveY * speed)

    const isMoving = Math.hypot(this.lastMoveX, this.lastMoveY) > 0.1
    this.updateTexture(isMoving)

    if (isMoving) {
      const angle = Math.atan2(this.lastMoveY, this.lastMoveX) + Math.PI / 2
      this.player.setRotation(angle)
    }
  }

  getSprite() {
    return this.player
  }

  private updateTexture(isMoving: boolean) {
    if (!this.player) return
    const targetKey = isMoving ? this.movingTextureKey : this.idleTextureKey
    if (this.currentTextureKey === targetKey) return
    this.player.setTexture(targetKey)
    this.currentTextureKey = targetKey
  }

  getMovementVector() {
    return { x: this.lastMoveX, y: this.lastMoveY }
  }

  getAimAngle(targets: Phaser.Physics.Arcade.Group) {
    if (!this.player) return this.lastAimDeg
    let nearest: Phaser.Physics.Arcade.Sprite | null = null
    let bestDist = Number.POSITIVE_INFINITY
    const children = targets.getChildren() as Phaser.Physics.Arcade.Sprite[]
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

  handleResize(_width: number, height: number) {
    if (this.joy.base && this.joy.thumb) {
      const x = 40
      const y = height - 40
      this.joy.base.setPosition(x, y)
      this.joy.thumb.setPosition(x, y)
      this.joy.centerX = x
      this.joy.centerY = y
    }
  }

  destroy() {
    this.player?.destroy()
    this.player = undefined
    this.detachHandlers.forEach((fn) => fn())
    this.detachHandlers = []
  }

  private ensureTouchJoystick() {
    const isMobileDevice = /iPhone|iPad|Android/i.test(navigator.userAgent)
    if (!isMobileDevice) return
    if (this.ctx.getOptions().showTouchJoystick === false) return
    const x = 40
    const y = this.ctx.scale.height - 40
    this.joy.centerX = x
    this.joy.centerY = y
    this.joy.base = this.ctx.scene.add.circle(x, y, this.joy.radius, 0xffffff, 0.08).setScrollFactor(0).setDepth(999)
    this.joy.thumb = this.ctx.scene.add.circle(x, y, 12, 0xffffff, 0.15).setScrollFactor(0).setDepth(1000)

    const pointerDown = (p: Phaser.Input.Pointer) => {
      if (this.joy.active) return
      if (p.x <= this.ctx.scale.width * 0.5) {
        this.joy.active = true
        this.joy.pointerId = p.id
        this.updateJoystick(p.x, p.y)
      }
    }
    const pointerMove = (p: Phaser.Input.Pointer) => {
      if (!this.joy.active || this.joy.pointerId !== p.id) return
      this.updateJoystick(p.x, p.y)
    }
    const pointerEnd = (p: Phaser.Input.Pointer) => {
      if (!this.joy.active || this.joy.pointerId !== p.id) return
      this.joy.active = false
      this.joy.pointerId = null
      this.joy.vecX = 0
      this.joy.vecY = 0
      this.joy.thumb?.setPosition(this.joy.centerX, this.joy.centerY)
    }

    this.ctx.input.on('pointerdown', pointerDown)
    this.ctx.input.on('pointermove', pointerMove)
    this.ctx.input.on('pointerup', pointerEnd)
    this.ctx.input.on('pointerupoutside', pointerEnd)

    this.detachHandlers.push(() => {
      this.ctx.input.off('pointerdown', pointerDown)
      this.ctx.input.off('pointermove', pointerMove)
      this.ctx.input.off('pointerup', pointerEnd)
      this.ctx.input.off('pointerupoutside', pointerEnd)
      this.joy.base?.destroy(); this.joy.base = undefined
      this.joy.thumb?.destroy(); this.joy.thumb = undefined
    })
  }

  private updateJoystick(px: number, py: number) {
    const dx = px - this.joy.centerX
    const dy = py - this.joy.centerY
    const d = Math.hypot(dx, dy)
    const clamped = Math.min(1, d / this.joy.radius)
    const nx = (dx / (d || 1)) * clamped
    const ny = (dy / (d || 1)) * clamped
    this.joy.vecX = nx
    this.joy.vecY = ny
    this.joy.thumb?.setPosition(this.joy.centerX + nx * this.joy.radius, this.joy.centerY + ny * this.joy.radius)
  }
}
