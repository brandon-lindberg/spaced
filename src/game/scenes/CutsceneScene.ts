import Phaser from 'phaser'
import { runState } from '../systems/runState'

export default class CutsceneScene extends Phaser.Scene {
  constructor() {
    super('Cutscene')
  }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0,0)

    const level = runState.state?.level ?? 1

    if (level === 1) {
      const video = this.add.video(width / 2, height / 2, 'cutscene_level_one')
      video.setOrigin(0.5, 0.5)

      // Scale video to fit screen while maintaining aspect ratio
      const videoWidth = video.width
      const videoHeight = video.height
      if (videoWidth > 0 && videoHeight > 0) {
        const scaleX = width / videoWidth
        const scaleY = height / videoHeight
        const scale = Math.min(scaleX, scaleY)
        video.setScale(scale)
      }

      video.play()

      const proceed = () => this.scene.start('Shop')

      video.once('complete', proceed)
      this.input.keyboard?.once('keydown-ENTER', proceed)
      this.input.once('pointerdown', proceed)
    } else {
      this.add.text(width / 2, 20, `Chapter ${level}`, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5,0)
      this.add.text(width / 2, height / 2, 'Story panel... (placeholder art)', { fontFamily: 'monospace', fontSize: '10px', color: '#cccccc' }).setOrigin(0.5)
      this.add.text(width / 2, height - 16, 'Press Enter to continue', { fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa' }).setOrigin(0.5,1)
      const proceed = () => this.scene.start('Shop')
      this.input.keyboard?.once('keydown-ENTER', proceed)
      this.input.once('pointerdown', proceed)
    }
  }
}


