const BANK_KEY = 'spaced.bankGold'

export function getBankGold(): number {
  try {
    const raw = localStorage.getItem(BANK_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function setBankGold(amount: number): void {
  try {
    const v = Math.max(0, Math.floor(amount))
    localStorage.setItem(BANK_KEY, String(v))
  } catch {
    /* ignore */
  }
}

export function addToBankGold(delta: number): number {
  const cur = getBankGold()
  const next = Math.max(0, cur + Math.floor(delta))
  setBankGold(next)
  return next
}


