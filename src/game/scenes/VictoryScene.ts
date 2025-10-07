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

    // Victory banner with glow
    const bannerColor = isFinalVictory ? '#ffdd33' : '#88ff88'
    const bannerText = isFinalVictory ? '🏆 RUN COMPLETE!' : '✨ LEVEL CLEAR'

    const title = this.add.text(width / 2, height / 2 - 480, bannerText, {
      fontFamily: 'monospace',
      fontSize: isFinalVictory ? '168px' : '144px',
      color: bannerColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 24,
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
    this.createCelebrationParticles(width / 2, height / 2 - 480)

    if (isFinalVictory) {
      // Final victory: show stats and return to menu
      const newBank = addToBankGold(runGold)

      this.add.text(width / 2, height / 2 - 120,
        `Gold Earned: +${runGold}g\nTotal Bank: ${newBank}g`, {
        fontFamily: 'monospace',
        fontSize: '84px',
        color: '#ffcc66',
        align: 'center',
      }).setOrigin(0.5).setDepth(1010)

      this.add.text(width / 2, height / 2 + 180,
        'Congratulations! You completed all levels!', {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#cccccc',
        align: 'center',
      }).setOrigin(0.5).setDepth(1010)

      // Return to menu button
      const returnButton = new MenuButton({
        scene: this,
        x: width / 2 - 600,
        y: height / 2 + 480,
        width: 1200,
        height: 240,
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
      // Between-level: show level info and shop button
      this.add.text(width / 2, height / 2 - 120,
        `Level ${level} Complete`, {
        fontFamily: 'monospace',
        fontSize: '108px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1010)

      this.add.text(width / 2, height / 2 + 60,
        `Gold Earned: ${runGold}g`, {
        fontFamily: 'monospace',
        fontSize: '84px',
        color: '#ffcc66',
      }).setOrigin(0.5).setDepth(1010)

      this.add.text(width / 2, height / 2 + 210,
        'Prepare for the next challenge!', {
        fontFamily: 'monospace',
        fontSize: '66px',
        color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(1010)

      // Continue to shop button
      const shopButton = new MenuButton({
        scene: this,
        x: width / 2 - 600,
        y: height / 2 + 480,
        width: 1200,
        height: 240,
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

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const distance = 900
      const color = Phaser.Utils.Array.GetRandom(colors)

      const particle = this.add.rectangle(x, y, 36, 36, color, 1).setDepth(1005)

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 300,
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
