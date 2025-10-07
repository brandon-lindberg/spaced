import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { createInventory } from '../systems/inventory'
import { MenuButton } from '../ui/MenuComponents'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'

export default class GameOverScene extends Phaser.Scene {
  private buttons: MenuButton[] = []
  private navigator?: MenuNavigator

  constructor() {
    super('GameOver')
  }

  create() {
    const { width, height } = this.scale

    // Dark overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0, 0)
      .setDepth(1000)

    // Game Over title with glitch effect
    const title = this.add.text(width / 2, height / 2 - 360, '☠️ GAME OVER', {
      fontFamily: 'monospace',
      fontSize: '168px',
      color: '#ff6666',
      fontStyle: 'bold',
      stroke: '#330000',
      strokeThickness: 24,
    }).setOrigin(0.5).setDepth(1010)

    // Subtle shake animation
    this.tweens.add({
      targets: title,
      x: width / 2 + 12,
      duration: 100,
      yoyo: true,
      repeat: -1,
    })

    // Info text
    this.add.text(width / 2, height / 2 - 60,
      'Retry to continue with HP level-ups', {
      fontFamily: 'monospace',
      fontSize: '66px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5).setDepth(1010)

    // Retry button
    const retryButton = new MenuButton({
      scene: this,
      x: width / 2 - 660,
      y: height / 2 + 240,
      width: 600,
      height: 240,
      text: 'Retry',
      primary: true,
      onClick: () => this.retry(),
    })
    retryButton.getContainer().setDepth(1010)
    this.buttons.push(retryButton)

    // Return to title button
    const titleButton = new MenuButton({
      scene: this,
      x: width / 2 + 60,
      y: height / 2 + 240,
      width: 600,
      height: 240,
      text: 'Main Menu',
      onClick: () => this.toTitle(),
    })
    titleButton.getContainer().setDepth(1010)
    this.buttons.push(titleButton)

    // Setup navigation
    const navigableItems: NavigableItem[] = this.buttons.map((_button, index) => ({
      index,
      onFocus: () => {},
      onBlur: () => {},
      onActivate: () => {
        if (index === 0) this.retry()
        else this.toTitle()
      },
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: 2,
      onActivate: (index) => {
        if (index === 0) this.retry()
        else this.toTitle()
      },
      onCancel: () => this.toTitle(),
    })
  }

  private retry() {
    // Stop overlays
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    this.scene.stop('Pause')
    this.scene.stop('Shop')
    this.scene.stop('Cutscene')
    this.scene.stop('Victory')

    const hp = (this.registry.get('hp') as { cur: number; max: number } | undefined) ?? { cur: 10, max: 10 }
    const lvl = runState.state?.level ?? 1

    if (lvl === 1) {
      // Level 1: Reset everything to starting values (except health level-ups)
      this.registry.set('level', 1)
      this.registry.set('xp', 0)
      this.registry.set('xpToNext', 3)
      this.registry.set('gold', 0)
      this.registry.set('inv', createInventory())
      this.registry.set('boss-hp', null)
      this.registry.set('bonuses', {
        fireRateMul: 1,
        damage: 0,
        multishot: 0,
        speedMul: 1,
        magnet: 0,
        levelsUsed: 0,
        inlineExtra: 0,
      })
    } else {
      // Levels 2-5: Restore from checkpoint if available
      const snap = runState.getCheckpoint<any>(lvl)
      if (snap) {
        this.registry.set('level', snap.playerLevel)
        this.registry.set('xp', snap.xp)
        this.registry.set('xpToNext', snap.xpToNext)
        this.registry.set('gold', snap.gold)
        this.registry.set('inv', snap.inv)
        this.registry.set('boss-hp', null)
        this.registry.set('bonuses', snap.bonuses)
        runState.startLevel(snap.playerLevel, this.time.now)
      } else {
        // Fallback
        this.registry.set('level', 1)
        this.registry.set('xp', 0)
        this.registry.set('xpToNext', 3)
        this.registry.set('gold', 0)
        this.registry.set('inv', createInventory())
        this.registry.set('boss-hp', null)
        this.registry.set('bonuses', null)
        runState.startLevel(1, this.time.now)
      }
    }

    if (lvl === 1) {
      runState.startLevel(lvl, this.time.now)
    }

    this.registry.set('hp', { cur: hp.max, max: hp.max })

    const gameScene = this.scene.get('Game') as Phaser.Scene | undefined
    if (gameScene) gameScene.scene.stop()

    this.cleanup()
    this.time.delayedCall(0, () => {
      this.scene.start('Game')
      this.scene.launch('HUD')
      this.scene.stop()
    })
  }

  private toTitle() {
    // Stop overlays
    this.scene.stop('HUD')
    this.scene.stop('LevelUp')
    this.scene.stop('Pause')
    this.scene.stop('Shop')
    this.scene.stop('Cutscene')
    this.scene.stop('Victory')

    const gameScene = this.scene.get('Game') as Phaser.Scene | undefined
    if (gameScene) gameScene.scene.stop()

    runState.newRun()

    this.registry.set('gold', 0)
    this.registry.set('xp', 0)
    this.registry.set('inv', createInventory())
    this.registry.set('level', 1)
    this.registry.set('boss-hp', null)
    this.registry.set('hp', { cur: 10, max: 10 })

    this.cleanup()
    this.time.delayedCall(0, () => {
      this.scene.start('Menu')
      this.scene.stop()
    })
  }

  private cleanup() {
    this.navigator?.destroy()
    this.buttons.forEach((btn) => btn.destroy())
    this.buttons = []
  }

  shutdown() {
    this.cleanup()
  }
}
