import Phaser from 'phaser'
import { getOptions } from './options'

export type GamepadHandlers = {
  pause?: () => void
  confirm?: () => void
  cancel?: () => void
  up?: () => void
  down?: () => void
  left?: () => void
  right?: () => void
}

export function attachGamepad(scene: Phaser.Scene, handlers: GamepadHandlers) {
  const debugOn = () => {
    try {
      if ((import.meta as any)?.env?.DEV) return true
    } catch { /* ignore */ }
    try { if (typeof window !== 'undefined' && window.location && window.location.hash.includes('gpdebug')) return true } catch {}
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem('spaced.gpdebug') === '1') return true } catch {}
    return false
  }
  const onDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    const idx = button.index
    const gp = getOptions().gamepad || { confirm: 0, cancel: 1, pauseStart: 9, pauseSelect: 8, pause: 9, up: 12, down: 13, left: 14, right: 15 }
    let action: string | null = null

    // Pause candidates (Start/Select/pause fallback)
    if (idx === gp.pause || idx === gp.pauseStart || idx === gp.pauseSelect || idx === 9 || idx === 8) { action = 'pause'; handlers.pause && handlers.pause(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }

    // Confirm/Cancel with fallbacks to common face buttons (A/X confirm, B/Y cancel)
    if (idx === gp.confirm || idx === 0 || idx === 2) { action = 'confirm'; handlers.confirm && handlers.confirm(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }
    if (idx === gp.cancel || idx === 1 || idx === 3) { action = 'cancel'; handlers.cancel && handlers.cancel(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }

    // DPAD or remapped directions (fallback to standard 12-15)
    if (idx === (gp.up ?? 12) || idx === 12) { action = 'up'; handlers.up && handlers.up(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }
    if (idx === (gp.down ?? 13) || idx === 13) { action = 'down'; handlers.down && handlers.down(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }
    if (idx === (gp.left ?? 14) || idx === 14) { action = 'left'; handlers.left && handlers.left(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }
    if (idx === (gp.right ?? 15) || idx === 15) { action = 'right'; handlers.right && handlers.right(); if (debugOn()) console.log('[GP] idx', idx, '->', action); return }

    if (debugOn()) console.log('[GP] unmapped idx=', idx)
  }
  scene.input.gamepad?.on('down', onDown)
  const detach = () => { scene.input.gamepad?.off('down', onDown) }
  scene.events.once('shutdown', detach)
  scene.events.once('destroy', detach)
  return detach
}

export function attachGamepadDebug(scene: Phaser.Scene) {
  const debugOn = () => {
    try { if ((import.meta as any)?.env?.DEV) return true } catch {}
    try { if (typeof window !== 'undefined' && window.location && window.location.hash.includes('gpdebug')) return true } catch {}
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem('spaced.gpdebug') === '1') return true } catch {}
    return false
  }
  if (!debugOn()) return
  const txt = scene.add.text(4, scene.scale.height - 10, 'GP: —', { fontFamily:'monospace', fontSize:'9px', color:'#00ffcc', backgroundColor:'#00000066', padding:{ x:3, y:1 } }).setScrollFactor(0).setDepth(2000)
  const onDown = (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    const idx = button.index
    const ax = pad.axes?.[0]?.getValue?.() ?? 0
    const ay = pad.axes?.[1]?.getValue?.() ?? 0
    const gp = getOptions().gamepad || { confirm:0, cancel:1, pause:9, up:12, down:13, left:14, right:15 }
    let action = 'unmapped'
    if (idx === gp.pause || idx === 9 || idx === 8) action = 'pause'
    else if (idx === gp.confirm || idx === 0 || idx === 2) action = 'confirm'
    else if (idx === gp.cancel || idx === 1 || idx === 3) action = 'cancel'
    else if (idx === (gp.up ?? 12) || idx === 12) action = 'up'
    else if (idx === (gp.down ?? 13) || idx === 13) action = 'down'
    else if (idx === (gp.left ?? 14) || idx === 14) action = 'left'
    else if (idx === (gp.right ?? 15) || idx === 15) action = 'right'
    txt.setText(`GP: idx=${idx} -> ${action} | axes=(${ax.toFixed(2)},${ay.toFixed(2)})`)
  }
  const onConn = () => txt.setText('GP: connected')
  scene.input.gamepad?.on('down', onDown)
  scene.input.gamepad?.once('connected', onConn)
  const detach = () => { scene.input.gamepad?.off('down', onDown); scene.input.gamepad?.off('connected', onConn); txt.destroy() }
  scene.events.once('shutdown', detach)
  scene.events.once('destroy', detach)
}

// iOS/Safari sometimes doesn't fire 'gamepadconnected' reliably; probe periodically.
export function ensureGamepadProbe(scene: Phaser.Scene) {
  const onNativeConnected = () => {
    try { scene.registry.set('toast', 'Controller detected') } catch {}
  }
  window.addEventListener('gamepadconnected', onNativeConnected, { once: true })
  let seen = false
  const poll = () => {
    try {
      const pads = (navigator as any)?.getGamepads?.() || []
      const any = pads && Array.from(pads).some((p: any) => !!p)
      if (any && !seen) {
        seen = true
        const first = Array.from(pads).find((p: any) => !!p)
        try { (scene.input.gamepad as any)?.emit?.('connected', first) } catch {}
        try { scene.registry.set('toast', 'Controller detected') } catch {}
      }
    } catch {}
  }
  const timer = scene.time.addEvent({ delay: 800, loop: true, callback: poll })
  scene.events.once('shutdown', () => { try { timer.remove(false) } catch {}; window.removeEventListener('gamepadconnected', onNativeConnected) })
  scene.events.once('destroy', () => { try { timer.remove(false) } catch {}; window.removeEventListener('gamepadconnected', onNativeConnected) })
}


