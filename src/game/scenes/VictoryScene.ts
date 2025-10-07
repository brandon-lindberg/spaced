import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { addToBankGold } from '../systems/storage'
import { MenuButton } from '../ui/MenuComponents'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'
import { IconGenerator } from '../ui/IconGenerator'

export default class VictoryScene extends Phaser.Scene {
  private buttons: MenuButton[] = []
  private navigator?: MenuNavigator

  constructor() {
    super('Victory')
  }

  create() {
    // Generate icons
    IconGenerator.generateIcons(this)

    const { width, height } = this.scale
    const level = runState.state?.level ?? 1
    const runGold = (this.registry.get('gold') as number) || 0
    const isFinalVictory = level >= (runState.state?.maxLevels ?? 5)

    // Background overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setDepth(1000)

    // Victory banner with glow (responsive)
    const bannerColor = isFinalVictory ? '#ffdd33' : '#88ff88'
    const bannerText = isFinalVictory ? '🏆 RUN COMPLETE!' : '✨ LEVEL CLEAR'
    const titleFontSize = Math.min(isFinalVictory ? 168 : 144, width * (isFinalVictory ? 0.0875 : 0.075))

    const title = this.add.text(width / 2, height / 2 - height * 0.44, bannerText, {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: bannerColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.max(12, titleFontSize * 0.143),
    }).setOrigin(0.5).setDepth(1010)

    // Pulse animation
    this.tweens.add({
      targets: title,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Particle celebration effect
    this.createCelebrationParticles(width / 2, height / 2 - height * 0.44)

    if (isFinalVictory) {
      // Final victory: show stats and return to menu (responsive)
      const newBank = addToBankGold(runGold)
      const statsFontSize = Math.min(84, width * 0.044)
      const descFontSize = Math.min(72, width * 0.0375)
      const buttonWidth = Math.min(1200, width * 0.625)
      const buttonHeight = Math.min(240, height * 0.222)

      this.add.text(width / 2, height / 2 - height * 0.11,
        `Gold Earned: +${runGold}g\nTotal Bank: ${newBank}g`, {
        fontFamily: 'monospace',
        fontSize: `${statsFontSize}px`,
        color: '#ffcc66',
        align: 'center',
      }).setOrigin(0.5).setDepth(1010)

      this.add.text(width / 2, height / 2 + height * 0.167,
        'Congratulations! You completed all levels!', {
        fontFamily: 'monospace',
        fontSize: `${descFontSize}px`,
        color: '#cccccc',
        align: 'center',
      }).setOrigin(0.5).setDepth(1010)

      // Return to menu button (responsive)
      const returnButton = new MenuButton({
        scene: this,
        x: width / 2 - buttonWidth / 2,
        y: height / 2 + height * 0.44,
        width: buttonWidth,
        height: buttonHeight,
        text: 'Return to Menu',
        primary: true,
        onClick: () => this.returnToMenu(),
      })
      returnButton.getContainer().setDepth(1010)
      this.buttons.push(returnButton)

      // Setup simple navigation (just one button)
      const navigableItems: NavigableItem[] = [{
        index: 0,
        onFocus: () => {},
        onBlur: () => {},
        onActivate: () => this.returnToMenu(),
      }]

      this.navigator = new MenuNavigator({
        scene: this,
        items: navigableItems,
        columns: 1,
        onActivate: () => this.returnToMenu(),
        onCancel: () => this.returnToMenu(),
      })
    } else {
      // Between-level: show level info and shop button (responsive)
      const levelFontSize = Math.min(108, width * 0.056)
      const goldFontSize = Math.min(84, width * 0.044)
      const prepFontSize = Math.min(66, width * 0.034)
      const buttonWidth = Math.min(1200, width * 0.625)
      const buttonHeight = Math.min(240, height * 0.222)

      this.add.text(width / 2, height / 2 - height * 0.11,
        `Level ${level} Complete`, {
        fontFamily: 'monospace',
        fontSize: `${levelFontSize}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1010)

      this.add.text(width / 2, height / 2 + height * 0.056,
        `Gold Earned: ${runGold}g`, {
        fontFamily: 'monospace',
        fontSize: `${goldFontSize}px`,
        color: '#ffcc66',
      }).setOrigin(0.5).setDepth(1010)

      this.add.text(width / 2, height / 2 + height * 0.194,
        'Prepare for the next challenge!', {
        fontFamily: 'monospace',
        fontSize: `${prepFontSize}px`,
        color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(1010)

      // Continue to shop button (responsive)
      const shopButton = new MenuButton({
        scene: this,
        x: width / 2 - buttonWidth / 2,
        y: height / 2 + height * 0.44,
        width: buttonWidth,
        height: buttonHeight,
        text: 'Continue',
        primary: true,
        onClick: () => this.goToShop(),
      })
      shopButton.getContainer().setDepth(1010)
      this.buttons.push(shopButton)

      // Setup navigation
      const navigableItems: NavigableItem[] = [{
        index: 0,
        onFocus: () => {},
        onBlur: () => {},
        onActivate: () => this.goToShop(),
      }]

      this.navigator = new MenuNavigator({
        scene: this,
        items: navigableItems,
        columns: 1,
        onActivate: () => this.goToShop(),
        onCancel: () => this.goToShop(),
      })
    }
  }

  private createCelebrationParticles(x: number, y: number) {
    const particleCount = 30
    const colors = [0xffdd33, 0xff6666, 0x66ff66, 0x6666ff, 0xff66ff]
    const { width, height } = this.scale
    const particleSize = Math.min(36, width * 0.019)
    const distance = Math.min(900, width * 0.469)
    const yOffset = Math.min(300, height * 0.278)

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const color = Phaser.Utils.Array.GetRandom(colors)

      const particle = this.add.rectangle(x, y, particleSize, particleSize, color, 1).setDepth(1005)

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - yOffset,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 1000 + Math.random() * 500,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      })
    }
  }

  private goToShop() {
    this.cleanup()
    this.scene.start('Cutscene')
  }

  private returnToMenu() {
    this.cleanup()
    this.scene.start('Menu')
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
