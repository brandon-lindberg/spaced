import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { createInventory } from '../systems/inventory'

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0,0)
    this.add.text(width / 2, height / 2 - 16, 'Game Over', { fontFamily: 'monospace', fontSize: '14px', color: '#ff6666' }).setOrigin(0.5)

    // Retry button
    const retryBtn = this.add.rectangle(width / 2, height / 2 + 2, 140, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.add.text(retryBtn.x, retryBtn.y, 'Retry', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    // Return to title button
    const titleBtn = this.add.rectangle(width / 2, height / 2 + 24, 140, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.add.text(titleBtn.x, titleBtn.y, 'Return to Title', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true
    this.input.keyboard?.removeAllListeners()
    this.input.removeAllListeners()
    retryBtn.on('pointerdown', () => this.retry())
    titleBtn.on('pointerdown', () => this.toTitle())
  }

  private retry() {
    // Stop overlays
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    this.scene.stop('Pause')
    this.scene.stop('Shop')
    this.scene.stop('Cutscene')
    this.scene.stop('Victory')
    // Prepare new run starting from current level
    const currentLevel = runState.state?.level ?? 1
    runState.newRun()
    runState.startLevel(currentLevel, this.time.now)
    // Reset run-specific registry data
    this.registry.set('gold', 0)
    this.registry.set('xp', 0)
    this.registry.set('inv', createInventory())
    // Stop any existing Game scene
    const gameScene = this.scene.get('Game') as Phaser.Scene | undefined
    if (gameScene) gameScene.scene.stop()
    // Transition on next tick to avoid mid-callback conflicts
    this.time.delayedCall(0, () => {
      this.scene.start('Game')
      this.scene.launch('HUD')
      this.scene.stop()
    })
  }

  private toTitle() {
    // Stop overlays and game
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    this.scene.stop('Pause')
    this.scene.stop('Shop')
    this.scene.stop('Cutscene')
    this.scene.stop('Victory')
    const gameScene = this.scene.get('Game') as Phaser.Scene | undefined
    if (gameScene) gameScene.scene.stop()
    runState.newRun()
    // Transition on next tick
    this.time.delayedCall(0, () => {
      this.scene.start('Menu')
      this.scene.stop()
    })
  }
}


