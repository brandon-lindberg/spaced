import Phaser from 'phaser'

/**
 * Shared set of Phaser references and global services exposed to controllers so they
 * can operate without tightly coupling to GameScene. The scene instance is the
 * authoritative owner of lifecycle events.
 */
export interface SceneServices {
  scene: Phaser.Scene
  audio: typeof import('../systems/audio').audio
  runState: typeof import('../systems/runState').runState
  getOptions: typeof import('../systems/options').getOptions
}

export interface SceneContext extends SceneServices {
  physics: Phaser.Physics.Arcade.ArcadePhysics
  registry: Phaser.Data.DataManager
  time: Phaser.Time.Clock
  tweens: Phaser.Tweens.TweenManager
  scale: Phaser.Scale.ScaleManager
  cameras: Phaser.Cameras.Scene2D.CameraManager
  input: Phaser.Input.InputPlugin
  game: Phaser.Game
}

export function createSceneContext(scene: Phaser.Scene, deps: Pick<SceneServices, 'audio' | 'runState' | 'getOptions'>): SceneContext {
  return {
    scene,
    audio: deps.audio,
    runState: deps.runState,
    getOptions: deps.getOptions,
    physics: scene.physics as Phaser.Physics.Arcade.ArcadePhysics,
    registry: scene.registry,
    time: scene.time,
    tweens: scene.tweens,
    scale: scene.scale,
    cameras: scene.cameras,
    input: scene.input,
    game: scene.game,
  }
}
