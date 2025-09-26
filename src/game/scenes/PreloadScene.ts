import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload() {
    // Load placeholder assets here later
  }

  create() {
    this.scene.start('Menu')
  }
}


