import Phaser from 'phaser'
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons, MAX_ACCESSORIES, MAX_ACCESSORY_LEVEL, MAX_WEAPONS, MAX_WEAPON_LEVEL } from '../systems/inventory'
import type { InventoryState } from '../systems/inventory'
import { runState } from '../systems/runState'
import { attachGamepad, attachGamepadDebug, ensureMobileGamepadInit } from '../systems/gamepad'

type ShopButton = {
  r: Phaser.GameObjects.Rectangle
  t: Phaser.GameObjects.Text
  onClick: () => void
  refreshLabel?: () => void
}

export default class ShopScene extends Phaser.Scene {
  private buttons: ShopButton[] = []
  private selectedIndex = 0

  constructor() {
    super('Shop')
  }

  create() {
    this.buttons = []

    const { width, height } = this.scale
    this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0, 0)
    const frame = this.add.graphics()
    frame.lineStyle(2, 0x444466, 1)
    frame.strokeRect(6, 6, width - 12, height - 12)
    this.add.text(width / 2, 12, 'Between-level Shop', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' }).setOrigin(0.5, 0)

    const footerSpace = 140
    const panelPadding = 16
    const headerBottom = 48
    const listArea = {
      x: panelPadding + 10,
      y: headerBottom,
      width: Math.max(220, width - (panelPadding + 10) * 2),
      height: Math.max(160, height - headerBottom - footerSpace),
    }

    const goldText = this.add.text(width - 20, 16, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffcc66' }).setOrigin(1, 0)
    const infoY = Phaser.Math.Clamp(listArea.y + listArea.height + 16, headerBottom + 8, height - 80)
    const invText = this.add.text(listArea.x, infoY, '', { fontFamily: 'monospace', fontSize: '10px', color: '#cccccc' })

    const getGold = () => (this.registry.get('gold') as number) || 0
    const setGold = (n: number) => this.registry.set('gold', Math.max(0, Math.floor(n)))
    const updateHUD = () => {
      goldText.setText(`Gold: ${getGold()}`)
      const invState = (this.registry.get('inv') as InventoryState) || createInventory()
      invText.setText(`W: ${describeWeapons(invState)}\nA: ${describeAccessories(invState)}`)
    }
    updateHUD()

    const price = {
      weapon: (level: number) => 30 + level * 20,
      accessory: (level: number) => 25 + level * 15,
      healFull: 60,
      reroll: 25,
      dmg: (n: number) => 40 + n * 10,
      rate: (n: number) => 35 + n * 10,
      healSmall: (n: number) => 20 + n * 5,
    }

    const listContainer = this.add.container(listArea.x, listArea.y)
    const maskGraphics = this.add.graphics()
    maskGraphics.fillStyle(0xffffff, 1)
    maskGraphics.fillRect(listArea.x, listArea.y, listArea.width, listArea.height)
    const listMask = maskGraphics.createGeometryMask()
    listContainer.setMask(listMask)
    maskGraphics.setVisible(false)

    const scrollbarTrack = this.add.rectangle(listArea.x + listArea.width + 6, listArea.y, 6, listArea.height, 0x111122, 0.45).setOrigin(0, 0)
    const scrollbarThumb = this.add.rectangle(listArea.x + listArea.width + 7, listArea.y, 4, 24, 0x666688, 0.9).setOrigin(0, 0)
    scrollbarTrack.setVisible(false)
    scrollbarThumb.setVisible(false)

    const focus = this.add.graphics().setDepth(999)
    const listPadding = 8
    const buttonWidth = Math.max(160, listArea.width - listPadding * 2)
    const baseButtonHeight = 32
    const buttonGap = 10

    let contentHeight = 0
    let scrollOffset = 0

    const updateFocus = () => {
      if (this.buttons.length === 0) {
        focus.clear()
        return
      }
      const current = this.buttons[this.selectedIndex]
      if (!current) {
        focus.clear()
        return
      }
      const bounds = current.r.getBounds()
      focus.clear()
      focus.lineStyle(1, 0xffff66, 1)
      focus.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4)
    }

    const getMaxScroll = () => Math.max(0, contentHeight - listArea.height)
    const updateScrollbar = () => {
      const maxScroll = getMaxScroll()
      if (maxScroll <= 0 || contentHeight <= 0) {
        scrollbarTrack.setVisible(false)
        scrollbarThumb.setVisible(false)
        return
      }
      scrollbarTrack.setVisible(true)
      scrollbarThumb.setVisible(true)
      const ratio = listArea.height / contentHeight
      const thumbHeight = Phaser.Math.Clamp(listArea.height * ratio, 18, listArea.height)
      scrollbarThumb.height = thumbHeight
      const progress = scrollOffset / maxScroll
      scrollbarThumb.y = listArea.y + progress * (listArea.height - thumbHeight)
    }
    const applyScroll = () => {
      scrollOffset = Phaser.Math.Clamp(scrollOffset, 0, getMaxScroll())
      listContainer.y = listArea.y - scrollOffset
      updateScrollbar()
      updateFocus()
    }

    const addSpacer = (amount = 12) => {
      contentHeight += amount
    }
    const addHeading = (text: string) => {
      const heading = this.add.text(listPadding, contentHeight, text, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffcc',
      }).setOrigin(0, 0)
      listContainer.add(heading)
      contentHeight += heading.height + 6
    }
    const addDivider = () => {
      const divider = this.add.rectangle(listPadding, contentHeight, buttonWidth, 1, 0x444466, 0.4).setOrigin(0, 0)
      listContainer.add(divider)
      contentHeight += 12
    }

    type ButtonOptions = { tooltip?: string; iconKey?: string }
    const resolveLabel = (label: string | (() => string)) => (typeof label === 'function' ? label() : label)

    const createListButton = (label: string | (() => string), onClick: () => void, options: ButtonOptions = {}) => {
      const y = contentHeight
      let currentHeight = baseButtonHeight
      const baseColor = 0x222233
      const hoverColor = 0x333355

      const rect = this.add.rectangle(listPadding, y, buttonWidth, currentHeight, baseColor, 1)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
      rect.setData('baseColor', baseColor)
      rect.setData('hoverColor', hoverColor)
      listContainer.add(rect)

      const hasIcon = !!options.iconKey && this.textures.exists(options.iconKey)
      let icon: Phaser.GameObjects.Image | undefined
      if (hasIcon) {
        icon = this.add.image(listPadding + 18, y + currentHeight / 2, options.iconKey!)
        icon.setDisplaySize(20, 20)
        icon.setOrigin(0.5)
        listContainer.add(icon)
      }

      const text = this.add.text(
        listPadding + (hasIcon ? 38 : 14),
        y + currentHeight / 2,
        resolveLabel(label),
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          wordWrap: { width: buttonWidth - (hasIcon ? 50 : 28) },
        }
      ).setOrigin(0, 0.5)
      listContainer.add(text)

      const adjustHeight = () => {
        const needed = Math.max(baseButtonHeight, text.height + 14)
        if (needed !== currentHeight) {
          currentHeight = needed
          rect.setSize(buttonWidth, needed)
          rect.setDisplaySize(buttonWidth, needed)
          if (icon) icon.y = y + currentHeight / 2
          text.y = y + currentHeight / 2
        }
      }
      adjustHeight()

      let tooltipText: Phaser.GameObjects.Text | null = null
      const showTooltip = () => {
        if (!options.tooltip || tooltipText) return
        const bounds = rect.getBounds()
        tooltipText = this.add.text(bounds.right + 8, bounds.top, options.tooltip, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#cccccc',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 },
          wordWrap: { width: 200 },
        }).setDepth(1000)
      }
      const hideTooltip = () => {
        tooltipText?.destroy()
        tooltipText = null
      }

      const updateLabel = () => {
        text.setText(resolveLabel(label))
        adjustHeight()
        applyScroll()
      }

      const handleClick = () => {
        onClick()
        updateHUD()
        if (typeof label === 'function') updateLabel()
      }

      const btn: ShopButton = {
        r: rect,
        t: text,
        onClick: handleClick,
        refreshLabel: typeof label === 'function' ? updateLabel : undefined,
      }

      rect.on('pointerover', () => {
        const idx = this.buttons.indexOf(btn)
        if (idx >= 0) {
          this.selectedIndex = idx
          highlight()
        }
        showTooltip()
      })
      rect.on('pointerout', () => {
        hideTooltip()
      })
      rect.on('pointerdown', () => {
        btn.onClick()
        highlight()
      })

      if (icon) {
        icon.setInteractive({ useHandCursor: true })
        icon.on('pointerover', () => rect.emit('pointerover'))
        icon.on('pointerout', () => rect.emit('pointerout'))
        icon.on('pointerdown', () => rect.emit('pointerdown'))
      }

      this.buttons.push(btn)
      contentHeight = y + currentHeight + buttonGap
      return btn
    }

    const createFixedButton = (x: number, y: number, widthPx: number, heightPx: number, label: string, onClick: () => void) => {
      const baseColor = 0x2a3a2a
      const hoverColor = 0x3c5a3c
      const rect = this.add.rectangle(x, y, widthPx, heightPx, baseColor, 1)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      rect.setData('baseColor', baseColor)
      rect.setData('hoverColor', hoverColor)
      const text = this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)

      const btn: ShopButton = {
        r: rect,
        t: text,
        onClick: () => {
          onClick()
          updateHUD()
        },
      }

      rect.on('pointerover', () => {
        const idx = this.buttons.indexOf(btn)
        if (idx >= 0) {
          this.selectedIndex = idx
          highlight()
        }
      })
      rect.on('pointerout', () => {
        highlight()
      })
      rect.on('pointerdown', () => {
        btn.onClick()
        highlight()
      })

      this.buttons.push(btn)
      return btn
    }

    let sectionStarted = false
    const beginSection = (title: string) => {
      if (sectionStarted) addDivider()
      addHeading(title)
      addSpacer(6)
      sectionStarted = true
    }

    const inv = (this.registry.get('inv') as InventoryState) || createInventory()

    const owned: { kind: 'w' | 'a'; key: string }[] = []
    for (const w of inv.weapons) if (w.level < MAX_WEAPON_LEVEL) owned.push({ kind: 'w', key: w.key })
    for (const a of inv.accessories) if (a.level < MAX_ACCESSORY_LEVEL) owned.push({ kind: 'a', key: a.key })
    Phaser.Utils.Array.Shuffle(owned)
    const picks = owned.slice(0, 3)
    if (picks.length > 0) {
      beginSection('Loadout Upgrades')
      picks.forEach((p) => {
        const isWeapon = p.kind === 'w'
        const labelPrefix = isWeapon ? 'Upgrade Weapon' : 'Upgrade Acc'
        const maxLevel = isWeapon ? MAX_WEAPON_LEVEL : MAX_ACCESSORY_LEVEL
        const tooltip = isWeapon ? 'Increase weapon damage or rate based on weapon type' : 'Boost passive stats for this run'
        const icon = isWeapon ? 'icon-weapon' : 'icon-acc'
        const getCurrentLevel = () => {
          if (isWeapon) return inv.weapons.find((w) => w.key === p.key)?.level ?? 0
          return inv.accessories.find((a) => a.key === p.key)?.level ?? 0
        }
        const label = () => {
          const level = getCurrentLevel()
          if (level >= maxLevel) return `${labelPrefix} ${p.key} (MAX)`
          const cost = isWeapon ? price.weapon(level) : price.accessory(level)
          return `${labelPrefix} ${p.key} Lv${level}→${level + 1} - ${cost}`
        }
        createListButton(label, () => {
          const level = getCurrentLevel()
          if (level >= maxLevel) return
          const cost = isWeapon ? price.weapon(level) : price.accessory(level)
          if (getGold() < cost) return
          setGold(getGold() - cost)
          if (isWeapon) addWeapon(inv, p.key as any)
          else addAccessory(inv, p.key)
          this.registry.set('inv', inv)
        }, { tooltip, iconKey: icon })
      })
    }

    const game = this.scene.get('Game') as any
    let dmgBuys = 0
    let rateBuys = 0
    let healSmallBuys = 0

    beginSection('Run Boosters')
    createListButton(() => `+1 Damage (${price.dmg(dmgBuys)})`, () => {
      const cost = price.dmg(dmgBuys)
      if (getGold() < cost || !game) return
      setGold(getGold() - cost)
      game.bonusDamage = Math.min(99, (game.bonusDamage || 0) + 1)
      game.recomputeEffectiveStats && game.recomputeEffectiveStats()
      dmgBuys++
    }, { tooltip: 'Increase base bullet damage for this run', iconKey: 'icon-weapon' })
    createListButton(() => `+10% Fire Rate (${price.rate(rateBuys)})`, () => {
      const cost = price.rate(rateBuys)
      if (getGold() < cost || !game) return
      setGold(getGold() - cost)
      game.bonusFireRateMul = Math.min(3, (game.bonusFireRateMul || 1) * 1.1)
      game.recomputeEffectiveStats && game.recomputeEffectiveStats()
      rateBuys++
    }, { tooltip: 'Increase blaster/beam firing speed for this run', iconKey: 'icon-weapon-laser' })
    createListButton(() => `Heal +3 (${price.healSmall(healSmallBuys)})`, () => {
      const cost = price.healSmall(healSmallBuys)
      if (getGold() < cost || !game) return
      setGold(getGold() - cost)
      const hp = this.registry.get('hp') as { cur: number; max: number } | undefined
      const cur = hp?.cur ?? (game.hpCur || 0)
      const max = hp?.max ?? (game.hpMax || 10)
      game.hpCur = Math.min(max, cur + 3)
      this.registry.set('hp', { cur: game.hpCur, max })
      healSmallBuys++
    }, { tooltip: 'Recover some health immediately', iconKey: 'icon-acc' })

    beginSection('Utilities')
    createListButton(`Full Heal (${price.healFull})`, () => {
      if (getGold() < price.healFull) return
      setGold(getGold() - price.healFull)
      if (game) {
        game.hpCur = game.hpMax
        this.registry.set('hp', { cur: game.hpCur, max: game.hpMax })
      }
    })
    createListButton(`Reroll (${price.reroll})`, () => {
      if (getGold() < price.reroll) return
      setGold(getGold() - price.reroll)
      this.scene.restart()
    })

    if (inv.weapons.length < MAX_WEAPONS || inv.accessories.length < MAX_ACCESSORIES) {
      beginSection('New Gear')
      if (inv.weapons.length < MAX_WEAPONS) {
        createListButton(() => (inv.weapons.length >= MAX_WEAPONS ? 'Buy new weapon (slots full)' : 'Buy new weapon (80)'), () => {
          if (inv.weapons.length >= MAX_WEAPONS) return
          if (getGold() < 80) return
          setGold(getGold() - 80)
          const pool = ['laser', 'missiles', 'orb', 'railgun', 'shotgun']
          const key = Phaser.Utils.Array.GetRandom(pool) as any
          if (addWeapon(inv, key)) {
            this.registry.set('inv', inv)
          }
        }, { tooltip: 'Add a new weapon up to 5 max', iconKey: 'icon-weapon' })
      }
      if (inv.accessories.length < MAX_ACCESSORIES) {
        createListButton(() => (inv.accessories.length >= MAX_ACCESSORIES ? 'Buy new accessory (slots full)' : 'Buy new accessory (60)'), () => {
          if (inv.accessories.length >= MAX_ACCESSORIES) return
          if (getGold() < 60) return
          setGold(getGold() - 60)
          const pool = ['thrusters', 'magnet-core', 'ammo-loader', 'power-cell', 'splitter', 'overclock', 'coolant', 'autoloader', 'targeting']
          const key = Phaser.Utils.Array.GetRandom(pool)
          if (addAccessory(inv, key)) {
            this.registry.set('inv', inv)
          }
        }, { tooltip: 'Add a new accessory up to 5 max', iconKey: 'icon-acc' })
      }
    }

    applyScroll()

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      if (contentHeight <= listArea.height) return
      scrollOffset = Phaser.Math.Clamp(scrollOffset + dy * 0.5, 0, getMaxScroll())
      applyScroll()
    })

    const continueBtn = createFixedButton(width / 2, height - 32, Math.min(280, listArea.width), 40, 'Continue', () => {
      const next = (runState.state?.level ?? 1) + 1
      runState.startLevel(next, this.time.now)
      this.scene.start('Game')
      this.scene.launch('HUD')
    })

    const highlight = () => {
      this.buttons.forEach((btn, index) => {
        const isSelected = index === this.selectedIndex
        const baseColor = btn.r.getData('baseColor') ?? 0x222233
        const hoverColor = btn.r.getData('hoverColor') ?? 0x333355
        btn.r.setFillStyle(isSelected ? hoverColor : baseColor, 1)
        btn.t.setColor(isSelected ? '#ffffcc' : '#ffffff')
      })
      updateFocus()
    }

    const ensureSelectionInView = () => {
      const current = this.buttons[this.selectedIndex]
      if (!current) return
      if (current.r.parentContainer !== listContainer) return
      const localTop = current.r.y
      const localBottom = localTop + current.r.displayHeight
      const viewTop = scrollOffset
      const viewBottom = scrollOffset + listArea.height
      if (localTop < viewTop + listPadding) {
        scrollOffset = Math.max(0, localTop - listPadding)
        applyScroll()
      } else if (localBottom > viewBottom - listPadding) {
        scrollOffset = Math.min(getMaxScroll(), localBottom - listArea.height + listPadding)
        applyScroll()
      }
    }

    if (this.buttons.length === 0) {
      this.selectedIndex = 0
    } else {
      this.selectedIndex = Phaser.Math.Clamp(this.selectedIndex, 0, this.buttons.length - 1)
    }
    highlight()
    ensureSelectionInView()

    const continueIndex = this.buttons.indexOf(continueBtn)

    ensureMobileGamepadInit(this)
    attachGamepad(this, {
      up: () => {
        if (this.buttons.length === 0) return
        this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length
        ensureSelectionInView()
        highlight()
      },
      down: () => {
        if (this.buttons.length === 0) return
        this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length
        ensureSelectionInView()
        highlight()
      },
      left: () => {
        if (this.buttons.length === 0) return
        this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length
        ensureSelectionInView()
        highlight()
      },
      right: () => {
        if (this.buttons.length === 0) return
        this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length
        ensureSelectionInView()
        highlight()
      },
      confirm: () => {
        if (this.buttons.length === 0) return
        const btn = this.buttons[this.selectedIndex]
        btn.onClick()
        highlight()
        ensureSelectionInView()
      },
      cancel: () => {
        if (continueIndex >= 0) {
          this.buttons[continueIndex].onClick()
        }
      },
    })
    attachGamepadDebug(this)
  }

}
