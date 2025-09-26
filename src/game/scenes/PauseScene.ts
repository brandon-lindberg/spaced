import Phaser from 'phaser'

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2, 'Paused', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    })
    text.setOrigin(0.5)
    this.input.keyboard?.once('keydown-P', () => {
      this.scene.stop()
      this.scene.resume('Game')
    })
  }
}


