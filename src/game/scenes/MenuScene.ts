import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { getBankGold } from '../systems/storage'
import { attachGamepad, attachGamepadDebug, ensureGamepadProbe, ensureMobileGamepadInit } from '../systems/gamepad'
//

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    const { width, height } = this.scale
    const title = this.add.text(width / 2, height / 2 - 70, 'Spaced', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
    })
    title.setOrigin(0.5).setScrollFactor(0)

    // Panel container
    const panel = this.add.rectangle(width / 2, height / 2 + 24, 220, 100, 0x0b0e20, 0.85).setOrigin(0.5)
    panel.setStrokeStyle(1, 0x3355ff, 1).setScrollFactor(0)

    // Buttons: Start Game, Options (vertical list)
    const startBtn = this.add.rectangle(width / 2, height / 2 + 6, 180, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0)
    const startTxt = this.add.text(startBtn.x, startBtn.y, 'Start Game', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
    const optBtn = this.add.rectangle(width / 2, height / 2 + 30, 180, 18, 0x222233, 1).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0)
    const optTxt = this.add.text(optBtn.x, optBtn.y, 'Options', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)

    const bank = this.add.text(6, height - 14, `Bank: ${getBankGold()}g`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffcc33',
    })
    bank.setScrollFactor(0)

    // Ensure input is enabled after returning from other scenes
    this.input.enabled = true
    if (this.input.keyboard) this.input.keyboard.enabled = true

    const start = () => {
      runState.newRun()
      this.scene.start('Game')
      this.scene.launch('HUD')
    }
    startBtn.on('pointerdown', start)
    optBtn.on('pointerdown', () => this.scene.start('Options'))
    // Keyboard navigation
    this.input.keyboard?.on('keydown-UP', () => { sel = (sel + 1) % 2; highlight() })
    this.input.keyboard?.on('keydown-DOWN', () => { sel = (sel + 1) % 2; highlight() })
    this.input.keyboard?.on('keydown-ENTER', () => sel === 0 ? start() : this.scene.start('Options'))

    // Gamepad: confirm to start; down/up to navigate; cancel no-op
    let sel = 0
    const highlight = () => {
      const on = (r: Phaser.GameObjects.Rectangle, t: Phaser.GameObjects.Text, active: boolean) => {
        r.setFillStyle(active ? 0x333355 : 0x222233, 1)
        t.setColor(active ? '#ffffcc' : '#ffffff')
      }
      on(startBtn, startTxt, sel === 0)
      on(optBtn, optTxt, sel === 1)
    }
    highlight()
    const focus = this.add.graphics().setDepth(999).setScrollFactor(0)
    const updateFocus = () => {
      const w = sel===0?startTxt:optTxt
      const b = w.getBounds()
      focus.clear(); focus.lineStyle(1, 0xffff66, 1); focus.strokeRect(b.x-3, b.y-3, b.width+6, b.height+6)
    }
    updateFocus()
    attachGamepad(this, {
      up: () => { sel = (sel + 1) % 2; highlight(); updateFocus() },
      down: () => { sel = (sel + 1) % 2; highlight(); updateFocus() },
      confirm: () => sel === 0 ? start() : this.scene.start('Options'),
    })
    attachGamepadDebug(this)
    ensureMobileGamepadInit(this)
    ensureGamepadProbe(this)

    // Show toast when a controller connects
    this.input.gamepad?.once('connected', () => {
      this.registry.set('toast', 'Controller detected')
    })
  }
}


