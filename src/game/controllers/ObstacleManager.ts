import Phaser from 'phaser'
export interface ObstacleManagerConfig {
  enemyGroup: Phaser.Physics.Arcade.Group
  onCollision: (objA: Phaser.Physics.Arcade.Sprite, objB: Phaser.Physics.Arcade.Sprite) => void
}

export class ObstacleManager {
  private readonly scene: Phaser.Scene
  private readonly config: ObstacleManagerConfig
  private asteroidStatics?: Phaser.Physics.Arcade.Group
  private asteroidMovers?: Phaser.Physics.Arcade.Group
  private spawnAcc = 0
  private moverSpawnAcc = 0
  private player?: Phaser.Physics.Arcade.Sprite
  private enemyCollidersAttached = false
  private playerCollidersAttached = false

  constructor(scene: Phaser.Scene, config: ObstacleManagerConfig) {
    this.scene = scene
    this.config = config
  }

  setPlayer(player?: Phaser.Physics.Arcade.Sprite) {
    this.player = player
    this.attachColliders()
  }

  reset() {
    this.spawnAcc = 0
    this.moverSpawnAcc = 0
  }

  update(dt: number, camCenter: { x: number; y: number }) {
    this.ensureGroups()
    if (!this.asteroidStatics || !this.asteroidMovers) return

    this.spawnAcc += dt
    this.moverSpawnAcc += dt
    if (this.spawnAcc > 2.5 && this.asteroidStatics.countActive(true) < 32) {
      this.spawnAcc = 0
      this.spawnAsteroidStatic(camCenter.x, camCenter.y)
    }
    if (this.moverSpawnAcc > 4 && this.asteroidMovers.countActive(true) < 16) {
      this.moverSpawnAcc = 0
      this.spawnAsteroidMover(camCenter.x, camCenter.y)
    }

    const maxR = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 1.8
    const cull = (group: Phaser.Physics.Arcade.Group) => {
      const arr = group.getChildren() as Phaser.Physics.Arcade.Sprite[]
      for (const asteroid of arr) {
        const dx = asteroid.x - camCenter.x
        const dy = asteroid.y - camCenter.y
        if (dx * dx + dy * dy > maxR * maxR) asteroid.disableBody(true, true)
      }
    }
    cull(this.asteroidStatics)
    cull(this.asteroidMovers)
  }

  private ensureGroups() {
    if (!this.asteroidStatics) {
      this.asteroidStatics = this.scene.physics.add.group({ immovable: true, allowGravity: false, maxSize: 40 })
      this.attachColliders()
    }
    if (!this.asteroidMovers) {
      this.asteroidMovers = this.scene.physics.add.group({ allowGravity: false, maxSize: 20 })
      this.attachColliders()
    }
    if (!this.scene.textures.exists('asteroid-rock')) {
      const g = this.scene.add.graphics()
      g.fillStyle(0x7a7f88, 1)
      g.fillCircle(48, 48, 48)
      g.fillStyle(0x9aa0aa, 1)
      g.fillCircle(30, 36, 18)
      g.generateTexture('asteroid-rock', 96, 96)
      g.destroy()
    }
  }

  private attachColliders() {
    const handler: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (obj1, obj2) => {
      const spriteA = (obj1 as Phaser.Physics.Arcade.Sprite)
      const spriteB = (obj2 as Phaser.Physics.Arcade.Sprite)
      this.config.onCollision(spriteA, spriteB)
    }
    if (this.asteroidStatics && this.asteroidMovers && !this.enemyCollidersAttached) {
      this.scene.physics.add.collider(this.config.enemyGroup, this.asteroidStatics, handler)
      this.scene.physics.add.collider(this.config.enemyGroup, this.asteroidMovers, handler)
      this.enemyCollidersAttached = true
    }
    if (this.player && this.asteroidStatics && this.asteroidMovers && !this.playerCollidersAttached) {
      this.scene.physics.add.collider(this.player, this.asteroidStatics, handler)
      this.scene.physics.add.collider(this.player, this.asteroidMovers, handler)
      this.playerCollidersAttached = true
    }
  }

  private spawnAsteroidStatic(cx: number, cy: number) {
    if (!this.asteroidStatics) return
    const viewRadius = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 0.5
    const inner = viewRadius * 0.9
    const outer = inner + 720
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const asteroid = this.asteroidStatics.get(x, y, 'asteroid-rock') as Phaser.Physics.Arcade.Sprite
    if (!asteroid) return
    asteroid.enableBody(true, x, y, true, true)
    asteroid.setCircle(42, 6, 6)
    asteroid.setImmovable(true)
    ;(asteroid as any).isAsteroid = true
    ;(asteroid as any).damageCooldownUntil = 0
  }

  private spawnAsteroidMover(cx: number, cy: number) {
    if (!this.asteroidMovers) return
    const viewRadius = Math.hypot(this.scene.scale.width, this.scene.scale.height) * 0.5
    const inner = viewRadius * 0.9
    const outer = inner + 840
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const radius = Phaser.Math.FloatBetween(inner, outer)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const asteroid = this.asteroidMovers.get(x, y, 'asteroid-rock') as Phaser.Physics.Arcade.Sprite
    if (!asteroid) return
    asteroid.enableBody(true, x, y, true, true)
    asteroid.setCircle(42, 6, 6)
    ;(asteroid as any).isAsteroid = true
    ;(asteroid as any).damageCooldownUntil = 0
    const toCenter = Math.atan2(cy - y, cx - x)
    const speed = Phaser.Math.Between(12, 28)
    asteroid.setVelocity(Math.cos(toCenter) * speed * 6, Math.sin(toCenter) * speed * 6)
    asteroid.setAngularVelocity(Phaser.Math.Between(-40, 40))
  }
}
