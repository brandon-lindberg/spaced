const OPTIONS_KEY = 'spaced.options'

export type Options = {
  screenShake: boolean
  showFPS: boolean
  showTouchJoystick: boolean
  crtFilter: boolean
  musicVolume: number
  sfxVolume: number
  gamepad?: {
    confirm: number
    cancel: number
    pauseStart: number
    pauseSelect: number
    pause?: number
    up?: number
    down?: number
    left?: number
    right?: number
    invertX?: boolean
    invertY?: boolean
  }
}

const defaultOptions: Options = {
  screenShake: true,
  showFPS: false,
  showTouchJoystick: true,
  crtFilter: false,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  gamepad: { confirm: 0, cancel: 1, pauseStart: 9, pauseSelect: 8, pause: 9, up: 12, down: 13, left: 14, right: 15, invertX: false, invertY: false },
}

let cached: Options | null = null

export function getOptions(): Options {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(OPTIONS_KEY)
    if (!raw) {
      const next = { ...defaultOptions }
      cached = next
      return next
    }
    const parsed = JSON.parse(raw)
    const merged: Options = { ...defaultOptions, ...parsed }
    cached = merged
    return merged
  } catch {
    const fallback = { ...defaultOptions }
    cached = fallback
    return fallback
  }
}

export function setOptions(next: Partial<Options>) {
  const cur = getOptions()
  const merged = { ...cur, ...next }
  cached = merged
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(merged))
  } catch {
    /* ignore */
  }
}
