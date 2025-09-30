import Phaser from 'phaser'
import { attachGamepad, ensureMobileGamepadInit } from '../systems/gamepad'

export type LevelUpChoice = { key: string; label: string; color: string }

export default class LevelUpScene extends Phaser.Scene {
  private choices: LevelUpChoice[] = []
  private selected = 0
  private choiceTexts: Phaser.GameObjects.Text[] = []

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
          { key: 'acc-thrusters', label: 'Accessory: Thrusters (+speed)', color: '#66ccff' },
          { key: 'acc-magnet-core', label: 'Accessory: Tractor Beam (+pickup)', color: '#33ff99' },
          { key: 'acc-ammo-loader', label: 'Accessory: Ammo Loader (+fire rate)', color: '#ffaa66' },
          { key: 'acc-power-cell', label: 'Accessory: Power Cell (+damage)', color: '#ff8866' },
          { key: 'acc-splitter', label: 'Accessory: Splitter (+multishot)', color: '#ccccff' },
          { key: 'w-laser', label: 'Weapon: Laser', color: '#ff66ff' },
          { key: 'w-missiles', label: 'Weapon: Missiles', color: '#ffcc66' },
          { key: 'w-orb', label: 'Weapon: Orb', color: '#66ccff' },
          { key: 'gold', label: 'Bounty +5 gold now', color: '#88ff88' },
        ]

    const startY = height / 2 + 4
    this.choiceTexts = []
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
      // Basic tooltip explaining item
      let tip: Phaser.GameObjects.Text | null = null
      const explain = () => {
        if (tip) return
        const desc =
          c.key === 'w-laser' ? 'Laser: spinning beam, ticks damage around you' :
          c.key === 'w-missiles' ? 'Missiles: homing, high impact' :
          c.key === 'w-orb' ? 'Orb: detonates for AoE blast' :
          c.key === 'acc-thrusters' ? 'Thrusters: move faster' :
          c.key === 'acc-magnet-core' ? 'Tractor Beam: larger pickup radius' :
          c.key === 'acc-ammo-loader' ? 'Ammo Loader: higher fire rate' :
          c.key === 'acc-power-cell' ? 'Power Cell: more damage' :
          c.key === 'acc-splitter' ? 'Splitter: more projectiles' :
          c.key === 'gold' ? 'Gain 5 gold now' :
          'Upgrade'
        tip = this.add.text(width / 2, y + 8, desc, { fontFamily: 'monospace', fontSize: '9px', color: '#cccccc', backgroundColor: '#000000', padding: { x: 3, y: 1 } }).setOrigin(0.5, 0)
      }
      const clearTip = () => { tip?.destroy(); tip = null }
      t.on('pointerover', explain)
      t.on('pointerout', clearTip)
      t.on('pointerdown', () => this.choose(c.key))
      this.choiceTexts.push(t)
    })

    const applyHighlight = () => {
      this.choiceTexts.forEach((t, i) => t.setStyle({ backgroundColor: i === this.selected ? '#111111' : '#000000' }))
    }
    applyHighlight()

    const moveSel = (dir: number) => {
      const n = this.choiceTexts.length
      if (!n) return
      this.selected = (this.selected + dir + n) % n
      applyHighlight()
    }

    ensureMobileGamepadInit(this)
    attachGamepad(this, {
      up: () => moveSel(-1),
      down: () => moveSel(1),
      confirm: () => {
        const c = visibleChoices[this.selected]
        if (c) this.choose(c.key)
      },
      cancel: () => undefined,
    })
  }

  private choose(key: string) {
    this.game.events.emit('levelup-apply', key)
    this.scene.stop()
  }
}


