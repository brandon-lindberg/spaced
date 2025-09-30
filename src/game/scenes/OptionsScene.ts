import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { attachGamepad, attachGamepadDebug } from '../systems/gamepad'

export default class OptionsScene extends Phaser.Scene {
  constructor() { super('Options') }

  create() {
    const { width, height } = this.scale
    this.add.text(width/2, height/2 - 30, 'Options', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)

    const info = () => `Music ${Math.round(getOptions().musicVolume*100)}% | SFX ${Math.round(getOptions().sfxVolume*100)}%`
    const volText = this.add.text(width/2, height/2 - 8, info(), { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x:4, y:2 } }).setOrigin(0.5)
    const musicDown = this.add.text(width/2 - 52, height/2 + 8, 'Music -', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x:4, y:2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    const musicUp = this.add.text(width/2 + 52, height/2 + 8, 'Music +', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x:4, y:2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    const sfxDown = this.add.text(width/2 - 52, height/2 + 22, 'SFX -', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x:4, y:2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    const sfxUp = this.add.text(width/2 + 52, height/2 + 22, 'SFX +', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x:4, y:2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    const apply = (m: number, s: number) => {
      setOptions({ musicVolume: Math.max(0, Math.min(1, m)), sfxVolume: Math.max(0, Math.min(1, s)) })
      volText.setText(info())
      this.game.events.emit('options-updated')
    }
    musicDown.on('pointerdown', () => apply(getOptions().musicVolume - 0.1, getOptions().sfxVolume))
    musicUp.on('pointerdown', () => apply(getOptions().musicVolume + 0.1, getOptions().sfxVolume))
    sfxDown.on('pointerdown', () => apply(getOptions().musicVolume, getOptions().sfxVolume - 0.1))
    sfxUp.on('pointerdown', () => apply(getOptions().musicVolume, getOptions().sfxVolume + 0.1))

    // Gamepad mapping (confirm/cancel/start/select)
    this.add.text(width/2, height/2 + 34, 'Gamepad', { fontFamily:'monospace', fontSize:'11px', color:'#ffffff'}).setOrigin(0.5)
    const invertXBtn = this.add.text(width/2 - 56, height/2 + 46, `Invert X: ${getOptions().gamepad?.invertX ? 'ON' : 'OFF'}`, { fontFamily:'monospace', fontSize:'10px', color:'#ffffff', backgroundColor:'#111144', padding:{x:6,y:3} }).setOrigin(0.5).setInteractive({ useHandCursor:true })
    const toggleInvertX = () => { const cur = getOptions().gamepad || { confirm:0, cancel:1, pauseStart:9, pauseSelect:8, invertX:false, invertY:true }; const gp = { ...cur, invertX: !cur.invertX }; setOptions({ gamepad: gp }); this.game.events.emit('options-updated'); invertXBtn.setText(`Invert X: ${gp.invertX ? 'ON' : 'OFF'}`) }
    invertXBtn.on('pointerdown', toggleInvertX)
    const invertYBtn = this.add.text(width/2 + 56, height/2 + 46, `Invert Y: ${getOptions().gamepad?.invertY ? 'ON' : 'OFF'}`, { fontFamily:'monospace', fontSize:'10px', color:'#ffffff', backgroundColor:'#111144', padding:{x:6,y:3} }).setOrigin(0.5).setInteractive({ useHandCursor:true })
    const toggleInvertY = () => { const cur = getOptions().gamepad || { confirm:0, cancel:1, pauseStart:9, pauseSelect:8, invertX:false, invertY:true }; const gp = { ...cur, invertY: !cur.invertY }; setOptions({ gamepad: gp }); this.game.events.emit('options-updated'); invertYBtn.setText(`Invert Y: ${gp.invertY ? 'ON' : 'OFF'}`) }
    invertYBtn.on('pointerdown', toggleInvertY)
    const mapBtn = this.add.text(width/2, height/2 + 62, 'Gamepad Controls…', { fontFamily:'monospace', fontSize:'10px', color:'#ffffff', backgroundColor:'#00000066', padding:{x:4,y:2} }).setOrigin(0.5).setInteractive({ useHandCursor:true })
    mapBtn.on('pointerdown', () => this.scene.start('OptionsGamepad'))

    // Back
    const backBtn = this.add.text(width/2, height/2 + 80, 'Back', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    backBtn.on('pointerdown', () => this.scene.start('Menu'))

    let sel = 0
    type Control = { node: Phaser.GameObjects.Text; onConfirm: () => void }
    const controls: Control[] = [
      { node: musicDown, onConfirm: () => apply(getOptions().musicVolume - 0.1, getOptions().sfxVolume) },
      { node: musicUp,   onConfirm: () => apply(getOptions().musicVolume + 0.1, getOptions().sfxVolume) },
      { node: sfxDown,   onConfirm: () => apply(getOptions().musicVolume, getOptions().sfxVolume - 0.1) },
      { node: sfxUp,     onConfirm: () => apply(getOptions().musicVolume, getOptions().sfxVolume + 0.1) },
      { node: invertXBtn, onConfirm: toggleInvertX },
      { node: invertYBtn, onConfirm: toggleInvertY },
      { node: mapBtn,     onConfirm: () => this.scene.start('OptionsGamepad') },
      { node: backBtn,    onConfirm: () => this.scene.start('Menu') },
    ]
    const hi = () => controls.forEach((c,i)=> c.node.setColor(i===sel?'#ffffcc':'#ffffff'))
    hi()
    attachGamepad(this, {
      left: () => { sel = Math.max(0, sel-1); hi(); updateFocus() },
      right: () => { sel = Math.min(controls.length-1, sel+1); hi(); updateFocus() },
      up: () => { sel = Math.max(0, sel-1); hi(); updateFocus() },
      down: () => { sel = Math.min(controls.length-1, sel+1); hi(); updateFocus() },
      confirm: () => { controls[sel].onConfirm() },
      cancel: () => this.scene.start('Menu'),
    })
    // clearer focus box
    const focus = this.add.rectangle(0,0,0,0,0x000000,0).setStrokeStyle(1,0xffff66).setDepth(999)
    const updateFocus = () => { const w = controls[sel].node; focus.setPosition(w.getCenter().x, w.getCenter().y); focus.setSize(w.width+6, w.height+6) }
    updateFocus()
    attachGamepadDebug(this)
  }

  // moved to OptionsGamepad scene
}


