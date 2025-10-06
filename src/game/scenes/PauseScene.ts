import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { attachGamepad, attachGamepadDebug, ensureMobileGamepadInit } from '../systems/gamepad'

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create() {
    // Notify game that pause started (for timer adjustments)
    this.game.events.emit('pause-opened')
    const { width, height } = this.scale
    // Panel
    const panel = this.add.rectangle(width/2, height/2, 220, 165, 0x0b0e20, 0.9).setOrigin(0.5)
    panel.setStrokeStyle(1, 0x3355ff, 1)
    const text = this.add.text(width / 2, height / 2 - 40, 'Paused', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    })
    text.setOrigin(0.5)

    const mkToggle = (label: string, getVal: () => boolean, setVal: (b: boolean) => void, y: number) => {
      const t = this.add.text(width / 2, height / 2 + y, `${label}: ${getVal() ? 'ON' : 'OFF'}`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x: 6, y: 3 }
      }).setOrigin(0.5)
      t.setInteractive({ useHandCursor: true })
      const toggle = () => { setVal(!getVal()); t.setText(`${label}: ${getVal() ? 'ON' : 'OFF'}`); this.game.events.emit('options-updated') }
      t.on('pointerdown', toggle)
      return { node: t, toggle }
    }
    const wShake = mkToggle('Screen Shake', () => getOptions().screenShake, (b) => setOptions({ screenShake: b }), -36)
    const wCrt = mkToggle('CRT Filter', () => getOptions().crtFilter, (b) => setOptions({ crtFilter: b }), -12)
    const wFps = mkToggle('Show FPS', () => getOptions().showFPS, (b) => setOptions({ showFPS: b }), 12)
    const vol = this.add.text(width / 2, height / 2 + 40, `Music ${Math.round(getOptions().musicVolume * 100)}% | SFX ${Math.round(getOptions().sfxVolume * 100)}%`, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x: 6, y: 3 } }).setOrigin(0.5)
    vol.setInteractive({ useHandCursor: true })
    const incVol = () => {
      const o = getOptions()
      const nextMusic = Math.max(0, Math.min(1, o.musicVolume + 0.1))
      const nextSfx = Math.max(0, Math.min(1, o.sfxVolume + 0.1))
      setOptions({ musicVolume: nextMusic, sfxVolume: nextSfx }); vol.setText(`Music ${Math.round(nextMusic * 100)}% | SFX ${Math.round(nextSfx * 100)}%`); this.game.events.emit('options-updated')
    }
    const decVol = () => {
      const o = getOptions()
      const nextMusic = Math.max(0, Math.min(1, o.musicVolume - 0.1))
      const nextSfx = Math.max(0, Math.min(1, o.sfxVolume - 0.1))
      setOptions({ musicVolume: nextMusic, sfxVolume: nextSfx }); vol.setText(`Music ${Math.round(nextMusic * 100)}% | SFX ${Math.round(nextSfx * 100)}%`); this.game.events.emit('options-updated')
    }
    vol.on('pointerdown', incVol)
    const volDown = this.add.text(width / 2, height / 2 + 68, 'Vol -', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x: 6, y: 3 } }).setOrigin(0.5)
    volDown.setInteractive({ useHandCursor: true })
    volDown.on('pointerdown', decVol)

    const widgets = [wShake.node, wCrt.node, wFps.node, vol, volDown]
    let sel = 0
    const highlight = () => {
      widgets.forEach((w, i) => w.setStyle({ backgroundColor: i === sel ? '#3355ff' : '#111144', color: i === sel ? '#ffffcc' : '#ffffff' }))
    }
    highlight()
    // Focus outline for accessibility
    const focus = this.add.graphics().setDepth(999)
    const updateFocus = () => {
      const w = widgets[sel]
      const b = w.getBounds()
      focus.clear(); focus.lineStyle(1,0xffff66,1); focus.strokeRect(b.x-3, b.y-3, b.width+6, b.height+6)
    }
    updateFocus()

    const close = () => { this.game.events.emit('pause-closed'); this.scene.stop(); this.scene.resume('Game') }
    this.input.keyboard?.once('keydown-P', close)
    this.input.keyboard?.once('keydown-ESC', close)
    attachGamepad(this, {
      pause: close,
      cancel: close,
      up: () => { sel = (sel + widgets.length - 1) % widgets.length; highlight(); updateFocus() },
      down: () => { sel = (sel + 1) % widgets.length; highlight(); updateFocus() },
      left: () => { if (widgets[sel] === vol || widgets[sel] === volDown) decVol() },
      right: () => { if (widgets[sel] === vol || widgets[sel] === volDown) incVol() },
      confirm: () => {
        if (widgets[sel] === wShake.node) wShake.toggle()
        else if (widgets[sel] === wCrt.node) wCrt.toggle()
        else if (widgets[sel] === wFps.node) wFps.toggle()
        else if (widgets[sel] === vol) incVol()
        else if (widgets[sel] === volDown) decVol()
      },
    })
    // Mobile tap-to-close anywhere outside panel
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!panel.getBounds().contains(p.x, p.y)) close()
    })
    ensureMobileGamepadInit(this)
    attachGamepadDebug(this)
  }
}


