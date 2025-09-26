import Phaser from 'phaser'

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2, 'Lobby (placeholder)', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    })
    text.setOrigin(0.5)
  }
}


