import Phaser from 'phaser'
import { getOptions, setOptions } from '../systems/options'

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create() {
    const { width, height } = this.scale
    const text = this.add.text(width / 2, height / 2 - 20, 'Paused', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    })
    text.setOrigin(0.5)

    const opts = getOptions()
    const mkToggle = (label: string, getVal: () => boolean, setVal: (b: boolean) => void, y: number) => {
      const t = this.add.text(width / 2, height / 2 + y, `${label}: ${getVal() ? 'ON' : 'OFF'}`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066', padding: { x: 4, y: 2 }
      }).setOrigin(0.5)
      t.setInteractive({ useHandCursor: true })
      const toggle = () => { setVal(!getVal()); t.setText(`${label}: ${getVal() ? 'ON' : 'OFF'}`) }
      t.on('pointerdown', toggle)
    }
    mkToggle('Screen Shake', () => getOptions().screenShake, (b) => setOptions({ screenShake: b }), -2)
    mkToggle('Show FPS', () => getOptions().showFPS, (b) => setOptions({ showFPS: b }), 12)
    this.input.keyboard?.once('keydown-P', () => {
      this.scene.stop()
      this.scene.resume('Game')
    })
  }
}


