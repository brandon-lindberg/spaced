const OPTIONS_KEY = 'spaced.options'

export type Options = {
  screenShake: boolean
  showFPS: boolean
}

const defaultOptions: Options = {
  screenShake: true,
  showFPS: false,
}

let cached: Options = { ...defaultOptions }

export function getOptions(): Options {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(OPTIONS_KEY)
    if (!raw) return cached
    const parsed = JSON.parse(raw)
    cached = { ...defaultOptions, ...parsed }
    return cached
  } catch {
    return cached
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


