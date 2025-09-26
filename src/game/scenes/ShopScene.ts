import Phaser from 'phaser'

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2, 'Shop (placeholder)', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    })
    text.setOrigin(0.5)
  }
}


