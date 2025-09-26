import Phaser from 'phaser'

export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2, 'Victory!', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#88ff88',
    })
    text.setOrigin(0.5)
    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.stop('HUD')
      this.scene.start('Menu')
    })
  }
}


