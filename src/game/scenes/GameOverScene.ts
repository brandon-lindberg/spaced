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

    // Game Over title with glitch effect (increased for readability)
    const titleFontSize = Math.max(64, Math.min(128, width * 0.0875))
    const shakeOffset = Math.max(6, titleFontSize * 0.071)

    const title = this.add.text(width / 2, height / 2 - height * 0.333, '☠️ GAME OVER', {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: '#ff6666',
      fontStyle: 'bold',
      stroke: '#330000',
      strokeThickness: Math.max(8, titleFontSize * 0.1),
    }).setOrigin(0.5).setDepth(1010)

    // Subtle shake animation
    this.tweens.add({
      targets: title,
      x: width / 2 + shakeOffset,
      duration: 100,
      yoyo: true,
      repeat: -1,
    })

    // Info text (responsive - increased for readability)
    const infoFontSize = Math.max(18, Math.min(88, width * 0.045))
    this.add.text(width / 2, height / 2 - height * 0.056,
      'Retry to continue with HP level-ups', {
      fontFamily: 'monospace',
      fontSize: `${infoFontSize}px`,
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5).setDepth(1010)

    // Buttons (responsive with proper margins)
    const margin = Math.max(20, width * 0.02)
    const buttonGap = Math.max(27, Math.min(80, width * 0.042))
    const maxButtonWidth = (width - margin * 2 - buttonGap) / 2
    const buttonWidth = Math.max(200, Math.min(maxButtonWidth, width * 0.35))
    const buttonHeight = Math.max(60, Math.min(160, height * 0.148))

    const verticalMargin = Math.max(20, height * 0.02)
    const buttonY = Math.min(height / 2 + height * 0.222, height - verticalMargin - buttonHeight / 2)

    // Retry button (properly positioned left of center)
    const retryButton = new MenuButton({
      scene: this,
      x: width / 2 - buttonGap / 2 - buttonWidth,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Retry',
      primary: true,
      onClick: () => this.retry(),
    })
    retryButton.getContainer().setDepth(1010)
    this.buttons.push(retryButton)

    // Return to title button (properly positioned right of center)
    const titleButton = new MenuButton({
      scene: this,
      x: width / 2 + buttonGap / 2,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
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

    const lvl = runState.state?.level ?? 1

    // Get current hpMaxPersistent (this persists across retries)
    const persistentHpMax = (this.registry.get('hpMaxPersistent') as number) || 10

    // Restore from retry checkpoint
    const retrySnap = runState.getRetryCheckpoint<any>(lvl)
    if (retrySnap) {
      // Restore state from when the level started (excludes HP)
      this.registry.set('level', retrySnap.playerLevel || 1)
      this.registry.set('xp', retrySnap.xp || 0)
      this.registry.set('xpToNext', retrySnap.xpToNext || 3)
      this.registry.set('gold', retrySnap.gold || 0)
      this.registry.set('inv', retrySnap.inv || createInventory())
      this.registry.set('bonuses', retrySnap.bonuses || {
        fireRateMul: 1,
        damage: 0,
        multishot: 0,
        speedMul: 1,
        magnet: 0,
        levelsUsed: 0,
        inlineExtra: 0,
      })
    } else {
      // Fallback: Reset to fresh state (Level 1 or fresh level select)
      this.registry.set('level', 1)
      this.registry.set('xp', 0)
      this.registry.set('xpToNext', 3)
      this.registry.set('gold', 0)
      this.registry.set('inv', createInventory())
      this.registry.set('bonuses', {
        fireRateMul: 1,
        damage: 0,
        multishot: 0,
        speedMul: 1,
        magnet: 0,
        levelsUsed: 0,
        inlineExtra: 0,
      })
    }

    // Set HP to persistent max (this survives retries and includes HP from failed attempt)
    this.registry.set('hp', { cur: persistentHpMax, max: persistentHpMax })
    this.registry.set('hpMaxPersistent', persistentHpMax)
    this.registry.set('boss-hp', null)

    // Set retry flag so GameScene knows to use retry checkpoint instead of progress checkpoint
    this.registry.set('isRetry', true)

    runState.startLevel(lvl, this.time.now)

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
