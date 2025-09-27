import Phaser from 'phaser'
import { runState } from '../systems/runState'

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0,0)
    this.add.text(width / 2, height / 2 - 8, 'Game Over', { fontFamily: 'monospace', fontSize: '14px', color: '#ff6666' }).setOrigin(0.5)
    const btn = this.add.rectangle(width / 2, height / 2 + 10, 120, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.add.text(btn.x, btn.y, 'Retry (R/Enter/Click)', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true
    this.input.keyboard?.removeAllListeners()
    this.input.removeAllListeners()
    const start = () => this.retry()
    btn.on('pointerdown', start)
    this.input.keyboard?.once('keydown-ENTER', start)
    this.input.keyboard?.once('keydown-SPACE', start)
    this.input.keyboard?.once('keydown-R', start)
    this.input.once('pointerdown', start)
  }

  private retry() {
    // Stop overlays
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    this.scene.stop('Pause')
    this.scene.stop('Shop')
    this.scene.stop('Cutscene')
    this.scene.stop('Victory')
    // Restart Game fresh
    const gameScene = this.scene.get('Game') as Phaser.Scene | undefined
    if (gameScene) {
      gameScene.input?.removeAllListeners()
      gameScene.time?.removeAllEvents()
      runState.newRun()
      gameScene.scene.start('Game')
    } else {
      runState.newRun()
      this.scene.start('Game')
    }
    // Close GameOver and relaunch HUD
    this.scene.stop()
    this.scene.launch('HUD')
  }
}


