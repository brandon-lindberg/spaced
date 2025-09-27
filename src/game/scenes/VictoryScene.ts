import Phaser from 'phaser'
import { runState } from '../systems/runState'
import { addToBankGold, getBankGold } from '../systems/storage'

export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory')
  }

  create() {
    const { width, height } = this.scale
    const runGold = (this.registry.get('gold') as number) || 0
    const newBank = addToBankGold(runGold)

    const text = this.add.text(width / 2, height / 2, `Victory!  +${runGold} gold (bank: ${newBank})`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#88ff88',
    })
    text.setOrigin(0.5)
    const proceed = () => {
      const level = (runState.state?.level ?? 1) + 1
      if (level <= (runState.state?.maxLevels ?? 5)) {
        runState.startLevel(level, this.time.now)
        this.scene.start('Game')
        this.scene.launch('HUD')
      } else {
        this.scene.start('Menu')
      }
    }
    this.input.keyboard?.once('keydown-ENTER', proceed)
    this.input.once('pointerdown', proceed)
  }
}


