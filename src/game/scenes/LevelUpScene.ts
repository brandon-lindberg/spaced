import Phaser from 'phaser'

export type LevelUpChoice = { key: string; label: string; color: string }

export default class LevelUpScene extends Phaser.Scene {
  private choices: LevelUpChoice[] = []

  constructor() {
    super('LevelUp')
  }

  init(data: { choices?: LevelUpChoice[] }) {
    this.choices = data?.choices ?? []
  }

  create() {
    const { width, height } = this.scale

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
    overlay.setOrigin(0, 0)
    this.add
      .text(width / 2, height / 2 - 30, 'Level Up!', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    const visibleChoices = this.choices.length
      ? this.choices
      : [
          { key: 'speed', label: 'Thrusters +10% speed', color: '#66ccff' },
          { key: 'magnet', label: 'Magnet +24px', color: '#ffcc33' },
          { key: 'gold', label: 'Bounty +5 gold now', color: '#88ff88' },
        ]

    const startY = height / 2 + 4
    visibleChoices.forEach((c, i) => {
      const y = startY + i * 14
      const t = this.add.text(width / 2, y, c.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: c.color,
        backgroundColor: '#000000',
        padding: { x: 3, y: 1 },
      })
      t.setOrigin(0.5)
      t.setInteractive({ useHandCursor: true })
      t.on('pointerover', () => t.setStyle({ backgroundColor: '#111111' }))
      t.on('pointerout', () => t.setStyle({ backgroundColor: '#000000' }))
      t.on('pointerdown', () => this.choose(c.key))
    })
  }

  private choose(key: string) {
    this.game.events.emit('levelup-apply', key)
    this.scene.stop()
  }
}


