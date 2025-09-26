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
    this.input.keyboard?.once('keydown-R', () => this.retry())
    this.input.once('pointerdown', () => this.retry())
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


