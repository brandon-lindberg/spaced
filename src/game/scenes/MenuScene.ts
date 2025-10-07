import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { getBankGold } from '../systems/storage'
import { createInventory } from '../systems/inventory'
import { MenuButton, MenuCard } from '../ui/MenuComponents'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'
import { IconGenerator } from '../ui/IconGenerator'
import { ensureGamepadProbe } from '../systems/gamepad'

export default class MenuScene extends Phaser.Scene {
  private buttons: MenuButton[] = []
  private navigator?: MenuNavigator

  constructor() {
    super('Menu')
  }

  create() {
    // Generate icons
    IconGenerator.generateIcons(this)

    // Use game dimensions (base resolution for positioning)
    const { width, height } = this.scale

    // Background
    this.add.rectangle(0, 0, width, height, 0x0a0d1f, 1).setOrigin(0, 0)

    // Title with glow
    const title = this.add.text(width / 2, 180, 'SPACED', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#66ccff',
      fontStyle: 'bold',
      stroke: '#0044aa',
      strokeThickness: 12,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10)

    // Pulse animation
    this.tweens.add({
      targets: title,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Bank gold display
    this.add.text(24, height - 24, `Bank: ${getBankGold()}g`, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffcc33',
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(10)

    // Create main menu buttons
    this.createMainMenu(width, height)

    // Ensure input is enabled
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true

    // Gamepad setup
    ensureGamepadProbe(this)

    // Toast for controller connection
    this.input.gamepad?.once('connected', () => {
      this.registry.set('toast', 'Controller detected')
    })
  }

  private createMainMenu(width: number, height: number) {
    const buttonY = height / 2
    const buttonGap = 96

    // Start Game button
    const startButton = new MenuButton({
      scene: this,
      x: width / 2 - 240,
      y: buttonY - buttonGap,
      width: 480,
      height: 84,
      text: 'Start Game',
      primary: true,
      onClick: () => this.startGame(),
    })
    startButton.getContainer().setDepth(10)
    this.buttons.push(startButton)

    // Level Select button
    const levelSelectButton = new MenuButton({
      scene: this,
      x: width / 2 - 240,
      y: buttonY,
      width: 480,
      height: 84,
      text: 'Level Select',
      onClick: () => this.showLevelSelectMenu(),
    })
    levelSelectButton.getContainer().setDepth(10)
    this.buttons.push(levelSelectButton)

    // Options button
    const optionsButton = new MenuButton({
      scene: this,
      x: width / 2 - 240,
      y: buttonY + buttonGap,
      width: 480,
      height: 84,
      text: 'Options',
      onClick: () => this.scene.start('Options'),
    })
    optionsButton.getContainer().setDepth(10)
    this.buttons.push(optionsButton)

    // Setup navigation
    const navigableItems: NavigableItem[] = this.buttons.map((_button, index) => ({
      index,
      onFocus: () => {},
      onBlur: () => {},
      onActivate: () => {
        if (index === 0) this.startGame()
        else if (index === 1) this.showLevelSelectMenu()
        else this.scene.start('Options')
      },
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: 1,
      onActivate: (index) => {
        if (index === 0) this.startGame()
        else if (index === 1) this.showLevelSelectMenu()
        else this.scene.start('Options')
      },
    })
  }

  private startGame() {
    runState.newRun()
    this.cleanup()
    this.scene.start('Game')
    this.scene.launch('HUD')
  }

  private showLevelSelectMenu() {
    // Clear existing UI
    this.cleanup()
    this.children.removeAll()

    const { width, height } = this.scale

    // Background
    this.add.rectangle(0, 0, width, height, 0x000000, 0.9).setOrigin(0, 0).setDepth(5)

    // Title
    this.add.text(width / 2, 240, 'Select Level', {
      fontFamily: 'monospace',
      fontSize: '60px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10)

    // Level cards
    const levels = [1, 2, 3, 4, 5]
    const cardWidth = 180
    const cardHeight = 144
    const gap = 36
    const startX = (width - (cardWidth * 3 + gap * 2)) / 2
    const startY = height / 2 - 60

    const levelCards: MenuCard[] = []

    levels.forEach((level, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = startX + col * (cardWidth + gap)
      const y = startY + row * (cardHeight + gap)

      const card = new MenuCard({
        scene: this,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        title: `Level ${level}`,
        description: '',
        onClick: () => this.startLevel(level),
      })
      card.getContainer().setDepth(10)
      levelCards.push(card)
    })

    // Back button
    const backButton = new MenuButton({
      scene: this,
      x: width / 2 - 150,
      y: height - 180,
      width: 300,
      height: 72,
      text: 'Back',
      onClick: () => {
        levelCards.forEach((c) => c.destroy())
        this.scene.restart()
      },
    })
    backButton.getContainer().setDepth(10)

    // Setup navigation for level select
    const navigableItems: NavigableItem[] = [
      ...levelCards.map((card, index) => ({
        index,
        onFocus: () => card.setFocused(true),
        onBlur: () => card.setFocused(false),
        onActivate: () => this.startLevel(levels[index]),
      })),
      {
        index: levelCards.length,
        onFocus: () => {},
        onBlur: () => {},
        onActivate: () => {
          levelCards.forEach((c) => c.destroy())
          this.scene.restart()
        },
      },
    ]

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: 3,
      onCancel: () => {
        levelCards.forEach((c) => c.destroy())
        this.scene.restart()
      },
    })
  }

  private startLevel(level: number) {
    runState.newRun()
    runState.startLevel(level, this.time.now)

    // Create checkpoint for level select
    if (level > 1) {
      const snapshot = {
        playerLevel: level,
        xp: 0,
        xpToNext: 3,
        gold: 0,
        inv: createInventory(),
        bonuses: {
          fireRateMul: 1,
          damage: 0,
          multishot: 0,
          speedMul: 1,
          magnet: 0,
          levelsUsed: 0,
          inlineExtra: 0,
        },
      }
      runState.setCheckpoint(level, snapshot)
    }

    this.cleanup()
    this.scene.start('Game')
    this.scene.launch('HUD')
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
