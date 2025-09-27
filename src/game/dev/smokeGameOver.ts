import Phaser from 'phaser'

export function attachGameOverSmokeTest(game: Phaser.Game) {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''
  if (!hash.includes('test-gameover')) return

  const sm = game.scene

  const log = (msg: string) => console.log(`[GameOverSmokeTest] ${msg}`)
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`)
  }

  // Start base scenes
  sm.start('Menu')
  sm.start('Game')
  ;(sm as any).launch('HUD') // TS: SceneManager typings omit launch; cast to any

  // Open GameOver
  sm.start('GameOver')

  // Phase 1: Retry path
  window.setTimeout(() => {
    try {
      const go: any = sm.getScene('GameOver')
      go.retry()
      window.setTimeout(() => {
        assert(sm.isActive('Game'), 'Game should be active after Retry')
        assert(sm.isActive('HUD'), 'HUD should be active after Retry')
        assert(!sm.isActive('GameOver'), 'GameOver should be closed after Retry')
        log('Retry path PASS')

        // Phase 2: Title path
        sm.start('GameOver')
        window.setTimeout(() => {
          const go2: any = sm.getScene('GameOver')
          go2.toTitle()
          window.setTimeout(() => {
            assert(sm.isActive('Menu'), 'Menu should be active after Return to Title')
            assert(!sm.isActive('Game'), 'Game should be stopped after Return to Title')
            assert(!sm.isActive('GameOver'), 'GameOver should be closed after Return to Title')
            log('Title path PASS')
            ;(window as any).GAMEOVER_SMOKETEST = 'PASS'
          }, 300)
        }, 100)
      }, 300)
    } catch (e) {
      console.error(e)
      ;(window as any).GAMEOVER_SMOKETEST = 'FAIL'
    }
  }, 100)
}


