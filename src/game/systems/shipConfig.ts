import type { WeaponKey } from './inventory'

export type ShipId = 'ship-1' | 'ship-2'

export interface ShipConfig {
  id: ShipId
  name: string
  idleTexture: string
  movingTexture: string
  defaultWeapon: WeaponKey
  description: string
  iconTexture: string
}

export const SHIPS: Record<ShipId, ShipConfig> = {
  'ship-1': {
    id: 'ship-1',
    name: 'Blaster',
    idleTexture: 'player-ship-idle-1',
    movingTexture: 'player-ship-1',
    defaultWeapon: 'blaster',
    description: 'Balanced ship with rapid-fire blaster',
    iconTexture: 'player-ship-idle-1',
  },
  'ship-2': {
    id: 'ship-2',
    name: 'Missile',
    idleTexture: 'player-ship-idle-2',
    movingTexture: 'player-ship-2',
    defaultWeapon: 'missiles',
    description: 'Heavy ship with explosive missiles',
    iconTexture: 'player-ship-idle-2',
  },
}

export const SHIP_IDS: ShipId[] = ['ship-1', 'ship-2']
