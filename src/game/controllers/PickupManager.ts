import Phaser from 'phaser'
import { TextureFactory } from './TextureFactory'
import { RunProgressManager } from './RunProgressManager'

export interface PickupManagerDeps {
  progress: RunProgressManager
}

export class PickupManager {
  private scene: Phaser.Scene
  private deps: PickupManagerDeps
  private xpGroup!: Phaser.Physics.Arcade.Group
  private goldGroup!: Phaser.Physics.Arcade.Group
  private healthGroup!: Phaser.Physics.Arcade.Group
  private powerupGroup!: Phaser.Physics.Arcade.Group
  private player?: Phaser.Physics.Arcade.Sprite

  constructor(scene: Phaser.Scene, deps: PickupManagerDeps) {
    this.scene = scene
    this.deps = deps
  }

  initGroups() {
    TextureFactory.ensurePickupTextures(this.scene)
    this.xpGroup = this.scene.physics.add.group()
    this.goldGroup = this.scene.physics.add.group()
    this.healthGroup = this.scene.physics.add.group()
    this.powerupGroup = this.scene.physics.add.group()
    return {
      xpGroup: this.xpGroup,
      goldGroup: this.goldGroup,
      healthGroup: this.healthGroup,
      powerupGroup: this.powerupGroup,
    }
  }

  setupPlayerColliders(player: Phaser.Physics.Arcade.Sprite) {
    this.player = player
    this.scene.physics.add.overlap(player, this.xpGroup, (_p, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      const kind = sprite.getData('kind') as string | undefined
      const textureKey = sprite.texture?.key
      const isXp = textureKey?.startsWith('xp-gem') || kind === 'xp' || kind === 'xp-elite'
      if (!isXp) return
      const customXP = sprite.getData('customXP') as number | undefined
      sprite.destroy()
      const elite = textureKey === 'xp-gem-elite' || kind === 'xp-elite'
      this.deps.progress.handlePickupXP(elite, customXP)
    })

    this.scene.physics.add.overlap(player, this.goldGroup, (_p, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      const isGold = sprite.getData('kind') === 'gold' || sprite.texture?.key?.startsWith('gold-coin')
      if (!isGold) return
      sprite.destroy()
      const elite = sprite.texture?.key === 'gold-coin-elite'
      this.deps.progress.handlePickupGold(elite)
    })

    this.scene.physics.add.overlap(player, this.healthGroup, (_p, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      sprite.destroy()
      this.deps.progress.handlePickupHealth()
    })

    this.scene.physics.add.overlap(player, this.powerupGroup, (_p, pickup) => {
      const sprite = pickup as Phaser.Physics.Arcade.Sprite
      sprite.destroy()
      this.deps.progress.handlePowerupPickup()
    })
  }

  spawnXP(x: number, y: number, elite = false, customValue?: number, customColor?: number) {
    const key = elite ? 'xp-gem-elite' : 'xp-gem'
    const xp = this.xpGroup.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    if (!xp) return
    xp.setActive(true).setVisible(true)
    xp.setData('kind', elite ? 'xp-elite' : 'xp')
    if (customValue !== undefined) {
      xp.setData('customXP', customValue)
    }
    if (customColor !== undefined) {
      xp.setTint(customColor)
    }
    if (elite) {
      this.scene.tweens.add({ targets: xp, alpha: 0.85, yoyo: true, duration: 520, repeat: -1, ease: 'Sine.easeInOut' })
    }
  }

  spawnGold(x: number, y: number, elite = false) {
    const key = elite ? 'gold-coin-elite' : 'gold-coin'
    const gold = this.goldGroup.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    if (!gold) return
    gold.setActive(true).setVisible(true)
    gold.setData('kind', 'gold')
    if (elite) {
      this.scene.tweens.add({ targets: gold, scale: { from: 1, to: 1.15 }, alpha: { from: 1, to: 0.9 }, yoyo: true, duration: 350, repeat: -1, ease: 'Sine.easeInOut' })
    }
  }

  spawnGoldBurst(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 6
      this.spawnGold(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, true)
    }
  }

  spawnHealth(x: number, y: number) {
    const health = this.healthGroup.create(x, y, 'health-pack') as Phaser.Physics.Arcade.Sprite
    if (!health) return
    health.setActive(true).setVisible(true)
    this.scene.tweens.add({ targets: health, scale: 1.15, yoyo: true, duration: 500, repeat: -1, ease: 'Sine.easeInOut' })
  }

  spawnPowerup(x: number, y: number) {
    const p = this.powerupGroup.create(x, y, 'powerup-chip') as Phaser.Physics.Arcade.Sprite
    if (!p) return
    p.setActive(true).setVisible(true)
    p.setTint(0x22ddaa)
    p.setScale(1)
    this.scene.tweens.add({ targets: p, y: p.y - 2, yoyo: true, duration: 450, repeat: -1, ease: 'Sine.easeInOut' })
    this.scene.tweens.add({ targets: p, alpha: 0.7, yoyo: true, duration: 600, repeat: -1, ease: 'Sine.easeInOut' })
  }

  update(dt: number, magnetRadius: number, camCenter: { x: number; y: number }, bossActive: boolean) {
    if (!bossActive) {
      const healthPerSec = 0.02
      if (Math.random() < healthPerSec * dt) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
        const radius = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 0.55
        const x = camCenter.x + Math.cos(angle) * radius
        const y = camCenter.y + Math.sin(angle) * radius
        this.spawnHealth(x, y)
      }
    }
    this.updatePickups(magnetRadius, camCenter)
  }

  updatePickups(magnetRadius: number, camCenter: { x: number; y: number }) {
    const despawnRadius = Math.hypot(this.scene.scale.width, this.scene.scale.height)
    const groups = [this.xpGroup, this.goldGroup, this.healthGroup, this.powerupGroup]
    const playerSprite = this.player
    for (const g of groups) {
      const children = g.getChildren() as Phaser.Physics.Arcade.Sprite[]
      for (const obj of children) {
        const dcx = obj.x - camCenter.x
        const dcy = obj.y - camCenter.y
        const distCam = Math.hypot(dcx, dcy)
        if (distCam > despawnRadius * 1.5) obj.disableBody(true, true)
      }
    }
    if (!playerSprite) return
    for (const g of groups) {
      const children = g.getChildren() as Phaser.Physics.Arcade.Sprite[]
      for (const obj of children) {
        const dx = obj.x - playerSprite.x
        const dy = obj.y - playerSprite.y
        const d = Math.hypot(dx, dy)
        if (d < magnetRadius) {
          const pull = 80
          const nx = dx / (d || 1)
          const ny = dy / (d || 1)
          obj.body && (obj.body as Phaser.Physics.Arcade.Body).setVelocity(-nx * pull, -ny * pull)
        }
      }
    }
  }

  getGroups() {
    return {
      xpGroup: this.xpGroup,
      goldGroup: this.goldGroup,
      healthGroup: this.healthGroup,
      powerupGroup: this.powerupGroup,
    }
  }
}
