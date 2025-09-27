import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { getBankGold } from '../systems/storage'

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

    const bank = this.add.text(6, height - 14, `Bank: ${getBankGold()}g`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffcc33',
    })
    bank.setScrollFactor(0)

    // Ensure input is enabled after returning from other scenes
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true

    const start = () => {
      runState.newRun()
      this.scene.start('Game')
      this.scene.launch('HUD')
    }
    this.input.keyboard?.once('keydown', start)
    this.input.keyboard?.once('keydown-SPACE', start)
    this.input.keyboard?.once('keydown-ENTER', start)
    this.input.once('pointerdown', start)
  }
}


