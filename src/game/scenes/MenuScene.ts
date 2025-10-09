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
    // Clear any previous state
    this.buttons = []
    this.navigator?.destroy()
    this.navigator = undefined

    // Generate icons
    IconGenerator.generateIcons(this)

    // Use game dimensions (base resolution for positioning)
    const { width, height } = this.scale

    // Background
    this.add.rectangle(0, 0, width, height, 0x0a0d1f, 1).setOrigin(0, 0)

    // Title with glow (increased for mobile readability)
    const titleFontSize = Math.max(48, Math.min(128, width * 0.107))
    const title = this.add.text(width / 2, height * 0.2, 'SPACED', {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: '#66ccff',
      fontStyle: 'bold',
      stroke: '#0044aa',
      strokeThickness: Math.max(4, titleFontSize * 0.125),
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

    // Bank gold display (increased for mobile readability)
    const bankFontSize = Math.max(24, Math.min(48, width * 0.033))
    const bankPadding = Math.max(11, Math.min(32, width * 0.0167))
    this.add.text(bankPadding, height - bankPadding, `Bank: ${getBankGold()}g`, {
      fontFamily: 'monospace',
      fontSize: `${bankFontSize}px`,
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
    // Button sizing (increased for mobile readability)
    const buttonWidth = Math.max(267, Math.min(640, width * 0.533))
    const buttonHeight = Math.max(67, Math.min(112, height * 0.104))
    const buttonGap = Math.max(80, Math.min(128, height * 0.119))

    // Start Game button (responsive)
    const startButton = new MenuButton({
      scene: this,
      x: width / 2 - buttonWidth / 2,
      y: buttonY - buttonGap,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Start Game',
      primary: true,
      onClick: () => this.startGame(),
    })
    startButton.getContainer().setDepth(10)
    this.buttons.push(startButton)

    // Level Select button (responsive)
    const levelSelectButton = new MenuButton({
      scene: this,
      x: width / 2 - buttonWidth / 2,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Level Select',
      onClick: () => this.showLevelSelectMenu(),
    })
    levelSelectButton.getContainer().setDepth(10)
    this.buttons.push(levelSelectButton)

    // Options button (responsive)
    const optionsButton = new MenuButton({
      scene: this,
      x: width / 2 - buttonWidth / 2,
      y: buttonY + buttonGap,
      width: buttonWidth,
      height: buttonHeight,
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
    // Clear any previous run data from registry
    runState.clearRunRegistry(this.registry)
    runState.clearCheckpoints()
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

    // Title (responsive font size)
    const titleFontSize = Math.max(24, Math.min(48, width * 0.025))
    this.add.text(width / 2, height * 0.1, 'Select Level', {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10)

    // Level cards (responsive sizing based on screen dimensions)
    const levels = [1, 2, 3, 4, 5]
    // Calculate available space and scale cards appropriately
    const availableWidth = width * 0.9 // Use 90% of screen width
    const availableHeight = height * 0.6 // Use 60% of screen height

    // Calculate card size: fit 3 columns with gaps
    const cardWidth = Math.max(80, Math.min(150, (availableWidth - 60) / 3))
    const cardHeight = Math.max(60, Math.min(120, availableHeight / 2.5))
    const gap = Math.max(10, Math.min(30, width * 0.015))
    const startX = (width - (cardWidth * 3 + gap * 2)) / 2
    const startY = height / 2 - cardHeight / 2

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

    // Back button (responsive sizing with better mobile support)
    const buttonWidth = Math.max(120, Math.min(240, width * 0.3))
    const buttonHeight = Math.max(40, Math.min(60, height * 0.08))
    const backButton = new MenuButton({
      scene: this,
      x: width / 2 - buttonWidth / 2,
      y: height - Math.max(50, height * 0.1),
      width: buttonWidth,
      height: buttonHeight,
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
    // Clear any previous run data from registry to ensure fresh start
    runState.clearRunRegistry(this.registry)
    runState.clearCheckpoints()
    runState.newRun()
    runState.startLevel(level, this.time.now)

    // Create checkpoint with fresh state for the selected level
    const snapshot = {
      playerLevel: 1,
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
