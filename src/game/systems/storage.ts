import type { ShipId } from './shipConfig'

const BANK_KEY = 'spaced.bankGold'
const SELECTED_SHIP_KEY = 'spaced.selectedShip'

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

export function getSelectedShip(): ShipId {
  try {
    const raw = localStorage.getItem(SELECTED_SHIP_KEY)
    return (raw === 'ship-1' || raw === 'ship-2') ? raw : 'ship-1'
  } catch {
    return 'ship-1'
  }
}

export function setSelectedShip(shipId: ShipId): void {
  try {
    localStorage.setItem(SELECTED_SHIP_KEY, shipId)
  } catch {
    /* ignore */
  }
}


