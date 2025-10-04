import Phaser from 'phaser'
import { TextureFactory } from './TextureFactory'

export interface BackgroundConfig {
  qualityZoom: number[]
}

export class BackgroundController {
  private scene: Phaser.Scene
  private config: BackgroundConfig
  private bgFar?: Phaser.GameObjects.TileSprite
  private bgMid?: Phaser.GameObjects.TileSprite
  private bgNear?: Phaser.GameObjects.TileSprite
  private bgSun?: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, config: BackgroundConfig) {
    this.scene = scene
    this.config = config
  }

  init(level: number) {
    this.destroy()
    const { width, height } = this.scene.scale
    if (level === 1) {
      TextureFactory.ensureStarField(this.scene, 'stars-far', 512, 60)
      TextureFactory.ensureStarField(this.scene, 'stars-mid', 512, 100)
      TextureFactory.ensureStarField(this.scene, 'stars-near', 512, 160)
      this.createLayer('stars-far', width, height, -1000)
      this.createLayer('stars-mid', width, height, -999)
      this.createLayer('stars-near', width, height, -998)
      return
    }
    if (level === 2) {
      TextureFactory.ensureAsteroidField(this.scene, 'asteroids-far', 512, 60)
      TextureFactory.ensureAsteroidField(this.scene, 'asteroids-mid', 512, 100)
      TextureFactory.ensureAsteroidField(this.scene, 'asteroids-near', 512, 160)
      this.createLayer('asteroids-far', width, height, -1000)
      this.createLayer('asteroids-mid', width, height, -999)
      this.createLayer('asteroids-near', width, height, -998)
      return
    }
    if (level === 3) {
      TextureFactory.ensurePlanetTile(this.scene, 'planet-tile')
      this.createLayer('planet-tile', width, height, -1000)
      this.createLayer('planet-tile', width, height, -999)
      this.createLayer('planet-tile', width, height, -998)
      return
    }
    if (level === 4) {
      TextureFactory.ensureCityTile(this.scene, 'city-tile')
      this.createLayer('city-tile', width, height, -1000)
      this.createLayer('city-tile', width, height, -999)
      this.createLayer('city-tile', width, height, -998)
      return
    }
    TextureFactory.ensureStarField(this.scene, 'stars-far', 512, 60)
    TextureFactory.ensureStarField(this.scene, 'stars-mid', 512, 100)
    TextureFactory.ensureStarField(this.scene, 'stars-near', 512, 160)
    TextureFactory.ensureSun(this.scene, 'sun-tex')
    this.createLayer('stars-far', width, height, -1000)
    this.createLayer('stars-mid', width, height, -999)
    this.createLayer('stars-near', width, height, -998)
    this.bgSun = this.scene.add.image(width - 80, 80, 'sun-tex').setScrollFactor(0).setDepth(-997)
    this.bgSun.setScale(1.2)
  }

  update(camera: Phaser.Cameras.Scene2D.Camera) {
    if (this.bgFar) {
      this.bgFar.tilePositionX = camera.scrollX * 0.1
      this.bgFar.tilePositionY = camera.scrollY * 0.1
    }
    if (this.bgMid) {
      this.bgMid.tilePositionX = camera.scrollX * 0.25
      this.bgMid.tilePositionY = camera.scrollY * 0.25
    }
    if (this.bgNear) {
      this.bgNear.tilePositionX = camera.scrollX * 0.5
      this.bgNear.tilePositionY = camera.scrollY * 0.5
    }
    if (this.bgSun) {
      this.bgSun.x = this.scene.scale.width - 80 + camera.scrollX * 0.02
      this.bgSun.y = 80 + camera.scrollY * 0.02
    }
  }

  handleResize(width: number, height: number, qualityLevel: number) {
    this.bgFar?.setSize(width, height)
    this.bgMid?.setSize(width, height)
    this.bgNear?.setSize(width, height)
    const cam = this.scene.cameras?.main
    if (cam) cam.setZoom(this.config.qualityZoom[qualityLevel] ?? 1)
    if (this.bgSun) {
      this.bgSun.setPosition(width - 80, 80)
    }
  }

  destroy() {
    this.bgFar?.destroy(); this.bgFar = undefined
    this.bgMid?.destroy(); this.bgMid = undefined
    this.bgNear?.destroy(); this.bgNear = undefined
    this.bgSun?.destroy(); this.bgSun = undefined
  }

  private createLayer(key: string, width: number, height: number, depth: number) {
    const layer = this.scene.add.tileSprite(0, 0, width, height, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth)
    if (!this.bgFar) this.bgFar = layer
    else if (!this.bgMid) this.bgMid = layer
    else this.bgNear = layer
  }
}
