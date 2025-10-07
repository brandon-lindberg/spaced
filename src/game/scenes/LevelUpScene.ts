import Phaser from 'phaser'
import { MenuCard } from '../ui/MenuComponents'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'
import { IconGenerator } from '../ui/IconGenerator'

export type LevelUpChoice = { key: string; label: string; color: string }

export default class LevelUpScene extends Phaser.Scene {
  private choices: LevelUpChoice[] = []
  private cards: MenuCard[] = []
  private navigator?: MenuNavigator
  private overlay?: Phaser.GameObjects.Rectangle
  private title?: Phaser.GameObjects.Text

  constructor() {
    super('LevelUp')
  }

  init(data: { choices?: LevelUpChoice[] }) {
    this.choices = data?.choices ?? []
  }

  create() {
    // Generate icons
    IconGenerator.generateIcons(this)

    const { width, height } = this.scale

    // Semi-transparent overlay
    this.overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setDepth(1000)

    // Title with glow effect (responsive)
    const titleFontSize = Math.max(24, Math.min(72, width * 0.0625))
    this.title = this.add.text(width / 2, height / 2 - height * 0.38, '⬆️ LEVEL UP!', {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: '#ffff66',
      fontStyle: 'bold',
      stroke: '#ff6600',
      strokeThickness: Math.max(4, titleFontSize * 0.08),
    }).setOrigin(0.5).setDepth(1010)

    // Pulse animation for title
    this.tweens.add({
      targets: this.title,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const visibleChoices = this.choices.length
      ? this.choices
      : [
          { key: 'acc-thrusters', label: 'Thrusters', color: '#66ccff' },
          { key: 'acc-magnet-core', label: 'Tractor Beam', color: '#33ff99' },
          { key: 'acc-ammo-loader', label: 'Ammo Loader', color: '#ffaa66' },
          { key: 'acc-power-cell', label: 'Power Cell', color: '#ff8866' },
          { key: 'acc-splitter', label: 'Splitter', color: '#ccccff' },
          { key: 'w-laser', label: 'Laser', color: '#ff66ff' },
          { key: 'w-missiles', label: 'Missiles', color: '#ffcc66' },
          { key: 'w-orb', label: 'Orb', color: '#66ccff' },
          { key: 'gold', label: 'Bounty +5g', color: '#88ff88' },
        ]

    // Create choice cards in a grid (responsive)
    const cardWidth = Math.max(200, Math.min(400, width * 0.28))
    const cardHeight = Math.max(180, Math.min(320, height * 0.42))
    const gap = Math.max(15, Math.min(30, width * 0.02))
    const columns = Math.min(3, visibleChoices.length)
    const rows = Math.ceil(visibleChoices.length / columns)
    const gridWidth = columns * cardWidth + (columns - 1) * gap
    const gridHeight = rows * cardHeight + (rows - 1) * gap
    const startX = (width - gridWidth) / 2
    const startY = (height - gridHeight) / 2 + Math.max(30, height * 0.06)

    visibleChoices.forEach((c, i) => {
      const col = i % columns
      const row = Math.floor(i / columns)
      const x = startX + col * (cardWidth + gap)
      const y = startY + row * (cardHeight + gap)

      // Determine icon based on choice key
      let icon = 'icon-acc'
      if (c.key.startsWith('w-laser')) icon = 'icon-weapon-laser'
      else if (c.key.startsWith('w-missile')) icon = 'icon-weapon-missiles'
      else if (c.key.startsWith('w-orb')) icon = 'icon-weapon-orb'
      else if (c.key.startsWith('w-')) icon = 'icon-weapon'
      else if (c.key === 'gold') icon = 'icon-gold'

      // Get description
      const desc = this.getDescription(c.key)

      // Parse color
      const colorValue = parseInt(c.color.replace('#', ''), 16)

      const card = new MenuCard({
        scene: this,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        title: c.label,
        description: desc,
        icon,
        color: colorValue,
        onClick: () => this.choose(c.key),
      })

      card.getContainer().setDepth(1010)

      // Stagger animation for card entrance
      card.getContainer().setAlpha(0)
      card.getContainer().setScale(0.8)
      this.tweens.add({
        targets: card.getContainer(),
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        delay: i * 80,
        ease: 'Back.easeOut',
      })

      this.cards.push(card)
    })

    // Setup navigation
    const navigableItems: NavigableItem[] = this.cards.map((card, index) => ({
      index,
      onFocus: () => card.setFocused(true),
      onBlur: () => card.setFocused(false),
      onActivate: () => this.choose(visibleChoices[index].key),
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns,
      onActivate: (index) => this.choose(visibleChoices[index].key),
    })
  }

  private getDescription(key: string): string {
    if (key === 'w-laser') return 'Spinning beam with continuous damage'
    if (key === 'w-missiles') return 'Homing projectiles with high impact'
    if (key === 'w-orb') return 'Detonates for area-of-effect blast'
    if (key === 'acc-thrusters') return '+Speed: Move faster'
    if (key === 'acc-magnet-core') return '+Pickup Range: Collect from farther'
    if (key === 'acc-ammo-loader') return '+Fire Rate: Shoot faster'
    if (key === 'acc-power-cell') return '+Damage: Hit harder'
    if (key === 'acc-splitter') return '+Multishot: More projectiles'
    if (key === 'gold') return 'Gain 5 gold immediately'
    return 'Upgrade'
  }

  private choose(key: string) {
    // Play exit animation
    this.tweens.add({
      targets: this.cards.map((c) => c.getContainer()),
      alpha: 0,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 200,
      ease: 'Quad.easeIn',
    })

    this.tweens.add({
      targets: [this.title, this.overlay],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.game.events.emit('levelup-apply', key)
        this.cleanup()
        this.scene.stop()
      },
    })
  }

  private cleanup() {
    this.navigator?.destroy()
    this.cards.forEach((card) => card.destroy())
    this.cards = []
  }

  shutdown() {
    this.cleanup()
  }
}
