import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { addToBankGold } from '../systems/storage'

export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory')
  }

  create() {
    const { width, height } = this.scale
    const level = (runState.state?.level ?? 1)
    const runGold = (this.registry.get('gold') as number) || 0
    if (level >= (runState.state?.maxLevels ?? 5)) {
      // Final victory: add remaining run gold to bank and return to menu
      const newBank = addToBankGold(runGold)
      this.add.text(width / 2, height / 2, `Run Complete! +${runGold} gold (bank: ${newBank})`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#88ff88',
      }).setOrigin(0.5)
      const proceed = () => this.scene.start('Menu')
      this.input.keyboard?.once('keydown-ENTER', proceed)
      this.input.once('pointerdown', proceed)
    } else {
      // Between-level: go to Cutscene then Shop
      this.add.text(width / 2, height / 2 - 10, `Level ${level} Clear`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5)
      this.add.text(width / 2, height / 2 + 10, `Open Shop to spend ${runGold} gold`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffcc66',
      }).setOrigin(0.5)
      const proceed = () => this.scene.start('Cutscene')
      this.input.keyboard?.once('keydown-ENTER', proceed)
      this.input.once('pointerdown', proceed)
    }
  }
}


