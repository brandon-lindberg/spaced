import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create() {
    // Notify game that pause started (for timer adjustments)
    this.game.events.emit('pause-opened')
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2 - 20, 'Paused', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    })
    text.setOrigin(0.5)

    const mkToggle = (label: string, getVal: () => boolean, setVal: (b: boolean) => void, y: number) => {
      const t = this.add.text(width / 2, height / 2 + y, `${label}: ${getVal() ? 'ON' : 'OFF'}`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x: 4, y: 2 }
      }).setOrigin(0.5)
      t.setInteractive({ useHandCursor: true })
      const toggle = () => { setVal(!getVal()); t.setText(`${label}: ${getVal() ? 'ON' : 'OFF'}`); this.game.events.emit('options-updated') }
      t.on('pointerdown', toggle)
    }
    mkToggle('Screen Shake', () => getOptions().screenShake, (b) => setOptions({ screenShake: b }), -2)
    mkToggle('Show FPS', () => getOptions().showFPS, (b) => setOptions({ showFPS: b }), 12)
    const vol = this.add.text(width / 2, height / 2 + 28, `Music ${Math.round(getOptions().musicVolume * 100)}% | SFX ${Math.round(getOptions().sfxVolume * 100)}%`, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }).setOrigin(0.5)
    vol.setInteractive({ useHandCursor: true })
    vol.on('pointerdown', () => {
      const o = getOptions()
      const nextMusic = Math.max(0, Math.min(1, o.musicVolume + 0.1))
      const nextSfx = Math.max(0, Math.min(1, o.sfxVolume + 0.1))
      setOptions({ musicVolume: nextMusic, sfxVolume: nextSfx })
      vol.setText(`Music ${Math.round(nextMusic * 100)}% | SFX ${Math.round(nextSfx * 100)}%`)
      this.game.events.emit('options-updated')
    })
    const close = () => { this.game.events.emit('pause-closed'); this.scene.stop(); this.scene.resume('Game') }
    this.input.keyboard?.once('keydown-P', close)
    this.input.keyboard?.once('keydown-ESC', close)
  }
}


