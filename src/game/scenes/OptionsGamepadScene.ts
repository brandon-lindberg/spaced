import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { attachGamepad, attachGamepadDebug, ensureMobileGamepadInit } from '../systems/gamepad'

type ActionKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'pause'

export default class OptionsGamepadScene extends Phaser.Scene {
  constructor() { super('OptionsGamepad') }

  create() {
    const { width, height } = this.scale
    const panel = this.add.rectangle(width/2, height/2, 1560, 1020, 0x0b0e20, 0.9).setOrigin(0.5)
    panel.setStrokeStyle(6, 0x3355ff, 1)
    this.add.text(width/2, height/2 - 420, 'Gamepad Controls', { fontFamily:'monospace', fontSize:'84px', color:'#ffffff' }).setOrigin(0.5)

    const actions: ActionKey[] = ['up','down','left','right','confirm','cancel','pause']
    const gp = getOptions().gamepad || { confirm:0, cancel:1, pause:9, pauseStart:9, pauseSelect:8, up:12, down:13, left:14, right:15, invertX:false, invertY:false }

    const rows: { key: ActionKey; label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }[] = []
    const startY = height/2 - 288
    actions.forEach((a, i) => {
      const y = startY + i * 84
      const label = this.add.text(240, y, a.toUpperCase().padEnd(8,' '), { fontFamily:'monospace', fontSize:'60px', color:'#ffffff', backgroundColor:'#00000066', padding:{x:18,y:6} })
      const val = this.add.text(840, y, this.describeButton((gp as any)[a]), { fontFamily:'monospace', fontSize:'60px', color:'#ffffcc', backgroundColor:'#00000066', padding:{x:18,y:6} }).setInteractive({ useHandCursor:true })
      val.on('pointerdown', () => this.capture(a, val))
      rows.push({ key:a, label, value: val })
    })

    const back = this.add.text(width/2, height/2 + 408, 'Back', { fontFamily:'monospace', fontSize:'60px', color:'#ffffff', backgroundColor:'#111144', padding:{x:36,y:18} }).setOrigin(0.5).setInteractive({ useHandCursor:true })
    back.on('pointerdown', () => this.scene.start('Options'))

    // keyboard/gamepad navigation
    let sel = 0
    const hi = () => rows.forEach((r, i) => r.value.setColor(i===sel?'#ffffff':'#ffffcc'))
    const focus = this.add.graphics().setDepth(999)
    const updateFocus = () => { const w = rows[sel].value; const b = w.getBounds(); focus.clear(); focus.lineStyle(6,0xffff66,1); focus.strokeRect(b.x-18, b.y-18, b.width+36, b.height+36) }
    hi(); updateFocus(); ensureMobileGamepadInit(this); attachGamepadDebug(this)
    attachGamepad(this, { up: () => { sel=(sel+actions.length-1)%actions.length; hi(); updateFocus() }, down: () => { sel=(sel+1)%actions.length; hi(); updateFocus() }, confirm: () => this.capture(actions[sel], rows[sel].value), cancel: () => this.scene.start('Options') })
    this.input.keyboard?.on('keydown-UP', () => { sel=(sel+actions.length-1)%actions.length; hi() })
    this.input.keyboard?.on('keydown-DOWN', () => { sel=(sel+1)%actions.length; hi() })
    this.input.keyboard?.on('keydown-ENTER', () => this.capture(actions[sel], rows[sel].value))
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Options'))
  }

  private describeButton(idx: number | undefined) { return (typeof idx === 'number') ? `B${idx}` : '—' }

  private capture(action: ActionKey, target: Phaser.GameObjects.Text) {
    const prompt = this.add.text(this.scale.width/2, target.y, `Press a button for ${action.toUpperCase()}`, { fontFamily:'monospace', fontSize:'60px', color:'#ffffcc', backgroundColor:'#000000', padding:{x:18,y:6} }).setOrigin(0.5)
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
}


