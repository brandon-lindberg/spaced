import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { attachGamepad, attachGamepadDebug, ensureMobileGamepadInit } from '../systems/gamepad'

type ActionKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'pause'

export default class OptionsGamepadScene extends Phaser.Scene {
  private rows: { key: ActionKey; label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }[] = []

  constructor() { super('OptionsGamepad') }

  create() {
    // Clear any previous state
    this.rows = []

    const { width, height } = this.scale

    // Background overlay to match Options menu
    this.add.rectangle(0, 0, width, height, 0x0a0d1f, 1).setOrigin(0, 0)

    // Panel background - scaled down to match Options menu
    const panelWidth = Math.min(650, width - 80)
    const panelHeight = Math.min(550, height - 100)
    const panelX = width / 2
    const panelY = height / 2

    const panel = this.add.graphics()
    panel.fillStyle(0x0b0e20, 0.95)
    panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 16)
    panel.lineStyle(3, 0x3355ff, 1)
    panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 16)

    // Title
    this.add.text(panelX, panelY - panelHeight / 2 + 35, 'Gamepad Controls', {
      fontFamily:'monospace',
      fontSize:'28px',
      color:'#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const actions: ActionKey[] = ['up','down','left','right','confirm','cancel','pause']
    const gp = getOptions().gamepad || { confirm:0, cancel:1, pause:9, pauseStart:9, pauseSelect:8, up:12, down:13, left:14, right:15, invertX:false, invertY:false }
    const startY = panelY - panelHeight / 2 + 80
    actions.forEach((a, i) => {
      const y = startY + i * 50
      const label = this.add.text(panelX - 180, y, a.toUpperCase().padEnd(8,' '), {
        fontFamily:'monospace',
        fontSize:'16px',
        color:'#ffffff',
        backgroundColor:'#222244',
        padding:{x:8,y:4}
      }).setDepth(1005)
      const val = this.add.text(panelX + 60, y, this.describeButton((gp as any)[a]), {
        fontFamily:'monospace',
        fontSize:'16px',
        color:'#ffffcc',
        backgroundColor:'#222244',
        padding:{x:8,y:4}
      }).setDepth(1005).setInteractive({ useHandCursor:true })
      val.on('pointerdown', () => this.capture(a, val))
      val.on('pointerover', () => {
        if (val && val.active) {
          val.setStyle({ backgroundColor: '#3355ff', color: '#ffffff' })
        }
      })
      val.on('pointerout', () => {
        if (val && val.active) {
          val.setStyle({ backgroundColor: '#222244', color: '#ffffcc' })
        }
      })
      this.rows.push({ key:a, label, value: val })
    })

    const back = this.add.text(panelX, panelY + panelHeight / 2 - 35, '← Back', {
      fontFamily:'monospace',
      fontSize:'18px',
      color:'#ffffff',
      backgroundColor:'#2a3a2a',
      padding:{x:15,y:8},
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1010).setInteractive({ useHandCursor:true })
    back.on('pointerdown', () => {
      console.log('Back button clicked')
      this.scene.start('Options')
    })
    back.on('pointerover', () => {
      if (back && back.active) {
        back.setStyle({ backgroundColor: '#3c5a3c', color: '#ffffcc' })
      }
    })
    back.on('pointerout', () => {
      if (back && back.active) {
        back.setStyle({ backgroundColor: '#2a3a2a', color: '#ffffff' })
      }
    })

    // keyboard/gamepad navigation
    let sel = 0
    const hi = () => this.rows.forEach((r, i) => r.value.setColor(i===sel?'#ffffff':'#ffffcc'))
    const focus = this.add.graphics().setDepth(999)
    const updateFocus = () => {
      const w = this.rows[sel].value
      const b = w.getBounds()
      focus.clear()
      focus.lineStyle(2, 0xffff66, 1)
      focus.strokeRect(b.x - 6, b.y - 6, b.width + 12, b.height + 12)
    }
    hi(); updateFocus(); ensureMobileGamepadInit(this); attachGamepadDebug(this)
    attachGamepad(this, {
      up: () => { sel=(sel+actions.length-1)%actions.length; hi(); updateFocus() },
      down: () => { sel=(sel+1)%actions.length; hi(); updateFocus() },
      confirm: () => this.capture(actions[sel], this.rows[sel].value),
      cancel: () => this.scene.start('Options')
    })
    this.input.keyboard?.on('keydown-UP', () => { sel=(sel+actions.length-1)%actions.length; hi(); updateFocus() })
    this.input.keyboard?.on('keydown-DOWN', () => { sel=(sel+1)%actions.length; hi(); updateFocus() })
    this.input.keyboard?.on('keydown-ENTER', () => this.capture(actions[sel], this.rows[sel].value))
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Options'))
  }

  private describeButton(idx: number | undefined) { return (typeof idx === 'number') ? `B${idx}` : '—' }

  private capture(action: ActionKey, target: Phaser.GameObjects.Text) {
    const prompt = this.add.text(this.scale.width/2, target.y, `Press a button for ${action.toUpperCase()}`, {
      fontFamily:'monospace',
      fontSize:'14px',
      color:'#ffffcc',
      backgroundColor:'#000000',
      padding:{x:10,y:5}
    }).setOrigin(0.5).setDepth(1000)
    const once = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      const cur = getOptions().gamepad || { confirm:0, cancel:1, pause:9, up:12, down:13, left:14, right:15, invertX:false, invertY:false }
      const gp: any = { ...cur }
      gp[action] = button.index
      setOptions({ gamepad: gp })
      target.setText(this.describeButton(button.index))
      prompt.destroy()
      this.game.events.emit('options-updated')
    }
    this.input.gamepad?.once('down', once as any)
    this.time.delayedCall(6000, () => { if (prompt.active) { prompt.destroy() } })
  }

  private cleanup() {
    this.rows = []
  }

  shutdown() {
    this.cleanup()
  }
}


