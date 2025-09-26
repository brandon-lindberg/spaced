import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BASE_WIDTH, BASE_HEIGHT, GAME_BACKGROUND_COLOR } from './config'
import BootScene from './scenes/BootScene'
import PreloadScene from './scenes/PreloadScene'
import MenuScene from './scenes/MenuScene'
import LobbyScene from './scenes/LobbyScene'
import GameScene from './scenes/GameScene'
import HUDScene from './scenes/HUDScene'
import ShopScene from './scenes/ShopScene'
import CutsceneScene from './scenes/CutsceneScene'
import PauseScene from './scenes/PauseScene'
import GameOverScene from './scenes/GameOverScene'
import VictoryScene from './scenes/VictoryScene'
import LevelUpScene from './scenes/LevelUpScene'

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: GAME_BACKGROUND_COLOR,
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        expandParent: true,
      },
      render: {
        antialias: false,
        pixelArt: true,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [
        BootScene,
        PreloadScene,
        MenuScene,
        LobbyScene,
        GameScene,
        HUDScene,
        ShopScene,
        CutsceneScene,
        LevelUpScene,
        PauseScene,
        GameOverScene,
        VictoryScene,
      ],
    }

    const game = new Phaser.Game(config)

    // Orientation / aspect hint overlay for unsupported portrait
    const updateOverlay = () => {
      if (!containerRef.current) return
      const isPortrait = window.innerHeight > window.innerWidth
      if (isPortrait) {
        containerRef.current.setAttribute('data-rotate', 'true')
      } else {
        containerRef.current.removeAttribute('data-rotate')
      }
    }
    updateOverlay()
    window.addEventListener('resize', updateOverlay)

    return () => {
      game.destroy(true)
      window.removeEventListener('resize', updateOverlay)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black text-white"
      style={{ touchAction: 'none' }}
    />
  )
}


