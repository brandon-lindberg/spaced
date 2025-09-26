import Phaser from 'phaser'

export default class CutsceneScene extends Phaser.Scene {
  constructor() {
    super('Cutscene')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2, 'Cutscene (placeholder)', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    })
    text.setOrigin(0.5)
  }
}


