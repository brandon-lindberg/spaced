import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'
import { attachGamepad, attachGamepadDebug, ensureMobileGamepadInit } from '../systems/gamepad'

export default class OptionsScene extends Phaser.Scene {
  constructor() { super('Options') }

  create() {
    const { width, height } = this.scale
    const panel = this.add.rectangle(width/2, height/2, 240, 150, 0x0b0e20, 0.9).setOrigin(0.5)
    panel.setStrokeStyle(1, 0x3355ff, 1)
    this.add.text(width/2, height/2 - 64, 'Options', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)

    // Scrollable content area inside panel
    const viewport = new Phaser.Geom.Rectangle(width/2 - 108, height/2 - 56, 216, 112)
    const maskRect = this.add.rectangle(viewport.x, viewport.y, viewport.width, viewport.height, 0x000000, 0).setOrigin(0,0)
    const mask = maskRect.createGeometryMask()
    const content = this.add.container(viewport.x, viewport.y)
    content.setMask(mask)

    const info = () => `Music ${Math.round(getOptions().musicVolume*100)}% | SFX ${Math.round(getOptions().sfxVolume*100)}%`
    const volText = this.add.text(viewport.width/2, 0, info(), { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5, 0)
    const musicDown = this.add.text(viewport.width/2 - 70, 20, 'Music -', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5,0).setInteractive({ useHandCursor: true })
    const musicUp = this.add.text(viewport.width/2 + 70, 20, 'Music +', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5,0).setInteractive({ useHandCursor: true })
    const sfxDown = this.add.text(viewport.width/2 - 70, 40, 'SFX -', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5,0).setInteractive({ useHandCursor: true })
    const sfxUp = this.add.text(viewport.width/2 + 70, 40, 'SFX +', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5,0).setInteractive({ useHandCursor: true })

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
    const gpHdr = this.add.text(viewport.width/2, 68, 'Gamepad', { fontFamily:'monospace', fontSize:'11px', color:'#ffffff'}).setOrigin(0.5,0)
    const invertXBtn = this.add.text(viewport.width/2 - 70, 86, `Invert X: ${getOptions().gamepad?.invertX ? 'ON' : 'OFF'}`, { fontFamily:'monospace', fontSize:'10px', color:'#ffffff', backgroundColor:'#111144', padding:{x:6,y:3} }).setOrigin(0.5,0).setInteractive({ useHandCursor:true })
    const toggleInvertX = () => { const cur = getOptions().gamepad || { confirm:0, cancel:1, pauseStart:9, pauseSelect:8, invertX:false, invertY:false }; const gp = { ...cur, invertX: !cur.invertX }; setOptions({ gamepad: gp }); this.game.events.emit('options-updated'); invertXBtn.setText(`Invert X: ${gp.invertX ? 'ON' : 'OFF'}`) }
    invertXBtn.on('pointerdown', toggleInvertX)
    const invertYBtn = this.add.text(viewport.width/2 + 70, 86, `Invert Y: ${getOptions().gamepad?.invertY ? 'ON' : 'OFF'}`, { fontFamily:'monospace', fontSize:'10px', color:'#ffffff', backgroundColor:'#111144', padding:{x:6,y:3} }).setOrigin(0.5,0).setInteractive({ useHandCursor:true })
    const toggleInvertY = () => { const cur = getOptions().gamepad || { confirm:0, cancel:1, pauseStart:9, pauseSelect:8, invertX:false, invertY:false }; const gp = { ...cur, invertY: !cur.invertY }; setOptions({ gamepad: gp }); this.game.events.emit('options-updated'); invertYBtn.setText(`Invert Y: ${gp.invertY ? 'ON' : 'OFF'}`) }
    invertYBtn.on('pointerdown', toggleInvertY)
    const mapBtn = this.add.text(viewport.width/2, 108, 'Gamepad Controls…', { fontFamily:'monospace', fontSize:'10px', color:'#ffffff', backgroundColor:'#111144', padding:{x:6,y:3} }).setOrigin(0.5,0).setInteractive({ useHandCursor:true })
    mapBtn.on('pointerdown', () => this.scene.start('OptionsGamepad'))

    const backBtn = this.add.text(viewport.width/2, 128, 'Back', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#111144', padding: { x:6, y:3 } }).setOrigin(0.5,0).setInteractive({ useHandCursor: true })
    backBtn.on('pointerdown', () => this.scene.start('Menu'))

    // add to content container
    content.add([volText, musicDown, musicUp, sfxDown, sfxUp, gpHdr, invertXBtn, invertYBtn, mapBtn, backBtn])
    const getContentHeight = () => Math.max(...content.list.map((o: any) => (o.y as number) + ((o as any).height ?? 14)))
    const clampScroll = () => {
      const ch = getContentHeight()
      const minY = viewport.y + Math.min(0, viewport.height - ch - 8)
      const maxY = viewport.y
      content.y = Phaser.Math.Clamp(content.y, minY, maxY)
    }
    clampScroll()
    this.input.on('wheel', (_p: any, _dx: number, dy: number) => { content.y -= dy * 0.3; clampScroll() })
    // Mobile swipe to scroll
    let lastY = 0; let dragging = false
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (panel.getBounds().contains(p.x,p.y)) { dragging = true; lastY = p.y } })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (!dragging) return; const dy = p.y - lastY; lastY = p.y; content.y += dy; clampScroll() })
    const endDrag = () => { dragging = false }
    this.input.on('pointerup', endDrag); this.input.on('pointerupoutside', endDrag)

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
    const ensureVisible = () => {
      const node = controls[sel].node
      const ny = content.y + node.y
      const top = viewport.y + 4
      const bottom = viewport.y + viewport.height - 18
      if (ny < top) { content.y += (top - ny); clampScroll() }
      else if (ny > bottom) { content.y -= (ny - bottom); clampScroll() }
    }
    attachGamepad(this, {
      left: () => { sel = Math.max(0, sel-1); hi(); updateFocus(); ensureVisible() },
      right: () => { sel = Math.min(controls.length-1, sel+1); hi(); updateFocus(); ensureVisible() },
      up: () => { sel = Math.max(0, sel-1); hi(); updateFocus(); ensureVisible() },
      down: () => { sel = Math.min(controls.length-1, sel+1); hi(); updateFocus(); ensureVisible() },
      confirm: () => { controls[sel].onConfirm() },
      cancel: () => this.scene.start('Menu'),
    })
    // clearer focus box
    const focus = this.add.graphics().setDepth(999)
    const updateFocus = () => {
      const w = controls[sel].node
      const b = w.getBounds() // world-space bounds accounts for origin and containers
      focus.clear(); focus.lineStyle(1,0xffff66,1); focus.strokeRect(b.x-3, b.y-3, b.width+6, b.height+6)
    }
    updateFocus()
    ensureMobileGamepadInit(this)
    attachGamepadDebug(this)
  }

  // moved to OptionsGamepad scene
}


