import Phaser from 'phaser'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    const { width, height } = this.scale
    const title = this.add.text(width / 2, height / 2 - 10, 'Spaced', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
    })
    title.setOrigin(0.5)

    const press = this.add.text(width / 2, height / 2 + 20, 'Press any key', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#aaaaaa',
    })
    press.setOrigin(0.5)

    // Remove any stale listeners before re-registering
    this.input.keyboard?.removeAllListeners()
    this.input.removeAllListeners()

    this.input.keyboard?.once('keydown', () => {
      this.scene.start('Game')
      this.scene.launch('HUD')
    })
    this.input.once('pointerdown', () => {
      this.scene.start('Game')
      this.scene.launch('HUD')
    })
  }
}


