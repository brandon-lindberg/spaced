import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { createInventory } from '../systems/inventory'
import { attachGamepad, ensureMobileGamepadInit } from '../systems/gamepad'

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
    // Explanatory note placed below buttons so it isn't obscured
    this.add.text(width / 2, titleBtn.y + 16 + 8, 'Retry: HP persists; everything else resets.', { fontFamily: 'monospace', fontSize: '9px', color: '#cccccc' }).setOrigin(0.5)

    ensureMobileGamepadInit(this)
    attachGamepad(this, { confirm: () => this.retry(), cancel: () => this.toTitle() })
  }

  private retry() {
    // Stop overlays
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    this.scene.stop('Pause')
    this.scene.stop('Shop')
    this.scene.stop('Cutscene')
    this.scene.stop('Victory')
    // Preserve HP across retry, restore snapshot for current level
    const hp = (this.registry.get('hp') as { cur: number; max: number } | undefined) ?? { cur: 10, max: 10 }
    const lvl = runState.state?.level ?? 1
    const snap = runState.getCheckpoint<any>(lvl)
    if (snap) {
      this.registry.set('level', snap.playerLevel)
      this.registry.set('xp', snap.xp)
      this.registry.set('xpToNext', snap.xpToNext)
      this.registry.set('gold', snap.gold)
      this.registry.set('inv', snap.inv)
      this.registry.set('boss-hp', null)
      this.registry.set('bonuses', snap.bonuses)
    } else {
      // fallback minimal - reset to level 1 if no checkpoint
      this.registry.set('level', 1)
      this.registry.set('xp', 0)
      this.registry.set('xpToNext', 3)
      this.registry.set('gold', 0)
      this.registry.set('boss-hp', null)
    }
    runState.startLevel(lvl, this.time.now)
    // restore HP state (persist current HP)
    this.registry.set('hp', { cur: Math.max(0, Math.min(hp.cur, hp.max)), max: hp.max })
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
    // Full reset including HP
    this.registry.set('gold', 0)
    this.registry.set('xp', 0)
    this.registry.set('inv', createInventory())
    this.registry.set('level', 1)
    this.registry.set('boss-hp', null)
    this.registry.set('hp', { cur: 10, max: 10 })
    // Transition on next tick
    this.time.delayedCall(0, () => {
      this.scene.start('Menu')
      this.scene.stop()
    })
  }
}


