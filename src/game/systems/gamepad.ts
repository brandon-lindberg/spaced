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
    // Auto-enable on mobile for easier debugging
    try { if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true } catch {}
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

// iOS/mobile requires user gesture before gamepad API is accessible
export function ensureMobileGamepadInit(scene: Phaser.Scene) {
  // Only run on mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (!isMobile) return

  // Check if we've already initialized
  const storageKey = 'spaced.gamepad.mobile.initialized'
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1') {
      // Already initialized, ensure manual polling is active
      startMobileGamepadPolling(scene)
      return
    }
  } catch {}

  // Create an overlay prompt for user interaction
  const { width, height } = scene.scale
  const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0).setDepth(10000).setScrollFactor(0)
  const promptBg = scene.add.rectangle(width/2, height/2, 200, 60, 0x222244, 1).setOrigin(0.5).setDepth(10001).setScrollFactor(0)
  promptBg.setStrokeStyle(2, 0x3355ff, 1)
  const promptText = scene.add.text(width/2, height/2 - 8, 'Tap to enable\ngamepad', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
    align: 'center'
  }).setOrigin(0.5).setDepth(10002).setScrollFactor(0)

  // Make the overlay interactive
  overlay.setInteractive({ useHandCursor: true })
  
  const activate = () => {
    // Call getGamepads to trigger browser's gamepad initialization
    // This MUST be called during a user gesture on iOS/mobile browsers
    try {
      const pads = navigator.getGamepads()
      console.log('[Mobile Gamepad Init] Gamepads after user gesture:', pads)
      
      // Check if any gamepads are connected
      const connected = Array.from(pads).filter(p => p !== null)
      if (connected.length > 0) {
        scene.registry.set('toast', 'Controller ready!')
        console.log('[Mobile Gamepad Init] Found controllers:', connected)
        
        // Start manual polling for mobile
        startMobileGamepadPolling(scene)
        
        // Manually trigger Phaser's gamepad connected event
        connected.forEach(pad => {
          try { 
            (scene.input.gamepad as any)?.emit?.('connected', pad)
          } catch {}
        })
      } else {
        // No gamepad detected - show helpful message
        console.log('[Mobile Gamepad Init] No gamepads detected. Make sure your controller is connected.')
        scene.registry.set('toast', 'No controller detected')
      }
    } catch (err) {
      console.warn('[Mobile Gamepad Init] Error accessing gamepads:', err)
    }

    // Mark as initialized
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, '1')
      }
    } catch {}

    // Remove the overlay
    overlay.destroy()
    promptBg.destroy()
    promptText.destroy()
  }

  overlay.on('pointerdown', activate)

  // Clean up if scene changes
  const cleanup = () => {
    try {
      overlay.destroy()
      promptBg.destroy()
      promptText.destroy()
    } catch {}
  }
  scene.events.once('shutdown', cleanup)
  scene.events.once('destroy', cleanup)
}

// Mobile browsers need manual polling of gamepad state
function startMobileGamepadPolling(scene: Phaser.Scene) {
  // Check if already polling (global flag)
  if ((window as any).__spacedGamepadPolling) {
    console.log('[Mobile Gamepad Poll] Already running globally')
    return
  }
  (window as any).__spacedGamepadPolling = true
  
  // Track previous button states to detect changes
  const previousButtonStates = new Map<number, boolean[]>()
  
  const poll = () => {
    try {
      const pads = navigator.getGamepads()
      
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i]
        if (!pad) continue
        
        const prevStates = previousButtonStates.get(i) || []
        const currentStates: boolean[] = []
        
        // Check each button
        pad.buttons.forEach((button, btnIndex) => {
          const isPressed = button.pressed
          currentStates[btnIndex] = isPressed
          
          // Detect button press (was not pressed, now is pressed)
          if (isPressed && !prevStates[btnIndex]) {
            console.log('[Mobile Gamepad Poll] Button pressed:', btnIndex, 'on gamepad', i)
            
            // Get all running scenes and emit to each
            const game = scene.game
            const sceneManager = game.scene
            
            sceneManager.scenes.forEach((s: Phaser.Scene) => {
              if (s.scene.isActive() && s.input.gamepad) {
                try {
                  // Create mock Phaser objects for the event
                  const mockButton = { index: btnIndex, value: button.value, pressed: true }
                  // Try to use existing Phaser pad or create a mock
                  const phaserPad = s.input.gamepad.gamepads?.[i] || pad as any
                  
                  s.input.gamepad.emit('down', phaserPad, mockButton)
                } catch (err) {
                  console.warn('[Mobile Gamepad Poll] Error emitting to scene:', s.scene.key, err)
                }
              }
            })
          }
        })
        
        previousButtonStates.set(i, currentStates)
      }
    } catch (err) {
      console.warn('[Mobile Gamepad Poll] Error polling:', err)
    }
  }
  
  // Poll at 60fps
  const timer = scene.time.addEvent({ delay: 16, loop: true, callback: poll })
  
  // Clean up when game ends (not per-scene)
  const cleanup = () => {
    try { timer.remove(false) } catch {}
    previousButtonStates.clear()
    delete (window as any).__spacedGamepadPolling
    console.log('[Mobile Gamepad Poll] Stopped')
  }
  
  // Only clean up on game destroy, not scene changes
  scene.game.events.once('destroy', cleanup)
  
  console.log('[Mobile Gamepad Poll] Started manual polling globally')
}


