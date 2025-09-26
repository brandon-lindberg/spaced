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
    // Stop all running scenes cleanly
    this.scene.stop('HUD')
    this.scene.stop('Game')
    this.scene.stop('LevelUp')
    this.scene.stop() // stop GameOver itself
    // Restart Menu fresh
    this.scene.start('Menu')
  }
}


