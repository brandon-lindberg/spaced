import Phaser from 'phaser'

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2, 'Game Over - Press R to retry', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ff4444',
    })
    text.setOrigin(0.5)
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true
    this.input.keyboard?.removeAllListeners()
    this.input.removeAllListeners()
    const start = () => this.retry()
    this.input.keyboard?.once('keydown', start)
    this.input.keyboard?.once('keydown-R', start)
    this.input.once('pointerdown', start)
  }

  private retry() {
    // Stop overlays
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    // Restart Game fresh
    const gameScene = this.scene.get('Game') as Phaser.Scene | undefined
    if (gameScene) {
      gameScene.input?.removeAllListeners()
      gameScene.time?.removeAllEvents()
      gameScene.scene.restart()
    } else {
      this.scene.start('Game')
    }
    // Close GameOver and relaunch HUD
    this.scene.stop()
    this.scene.launch('HUD')
  }
}


