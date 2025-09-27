import Phaser from 'phaser'
import { runState } from '../systems/runState'

export default class CutsceneScene extends Phaser.Scene {
  constructor() {
    super('Cutscene')
  }

  create() {
    const { width, height } = this.scale
    const panel = this.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0,0)
    const level = runState.state?.level ?? 1
    const title = this.add.text(width / 2, 20, `Chapter ${level}`, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5,0)
    const body = this.add.text(width / 2, height / 2, 'Story panel... (placeholder art)', { fontFamily: 'monospace', fontSize: '10px', color: '#cccccc' }).setOrigin(0.5)
    const hint = this.add.text(width / 2, height - 16, 'Press Enter to continue', { fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa' }).setOrigin(0.5,1)
    const proceed = () => this.scene.start('Shop')
    this.input.keyboard?.once('keydown-ENTER', proceed)
    this.input.once('pointerdown', proceed)
  }
}


