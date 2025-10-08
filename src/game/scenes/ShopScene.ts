import Phaser from 'phaser'
import { addAccessory, addWeapon, createInventory, describeAccessories, describeWeapons, MAX_ACCESSORIES, MAX_ACCESSORY_LEVEL, MAX_WEAPONS, MAX_WEAPON_LEVEL } from '../systems/inventory'
import type { InventoryState } from '../systems/inventory'
import { runState } from '../systems/runState'
import { MenuSystem } from '../ui/MenuSystem'
import { MenuCard, MenuButton, MenuSection } from '../ui/MenuComponents'
import { MenuNavigator, type NavigableItem } from '../ui/MenuNavigator'
import { IconGenerator } from '../ui/IconGenerator'

type ShopItem = {
  card: MenuCard
  canAfford: () => boolean
  isDisabled: () => boolean
  refresh: () => void
}

export default class ShopScene extends Phaser.Scene {
  private menuSystem?: MenuSystem
  private navigator?: MenuNavigator
  private shopItems: ShopItem[] = []
  private continueButton?: MenuButton
  private goldText?: Phaser.GameObjects.Text
  private invText?: Phaser.GameObjects.Text

  private rerollBuys = 0
  private damageBoostPurchased = false

  init(data?: { preserveState?: boolean }) {
    if (!data?.preserveState) {
      this.rerollBuys = 0
      this.damageBoostPurchased = false
    }
  }

  constructor() {
    super('Shop')
  }

  create() {
    // Generate icons
    IconGenerator.generateIcons(this)

    const { width, height } = this.scale

    // Create menu system
    this.menuSystem = new MenuSystem({
      scene: this,
      width,
      height,
      padding: 96,
      backgroundColor: 0x000000,
      backgroundAlpha: 0.9,
      borderColor: 0x4455ff,
      borderWidth: 12,
    })

    // Header (responsive)
    const titleFontSize = Math.max(24, Math.min(60, width * 0.05))
    const topMargin = Math.max(20, Math.min(40, height * 0.037))
    this.add.text(width / 2, topMargin, '🛒 SHOP', {
      fontFamily: 'monospace',
      fontSize: `${titleFontSize}px`,
      color: '#ffdd66',
      fontStyle: 'bold',
      stroke: '#aa6600',
      strokeThickness: Math.max(3, titleFontSize * 0.06),
    }).setOrigin(0.5, 0).setDepth(1010)

    // Gold and inventory display (responsive)
    const goldFontSize = Math.max(16, Math.min(32, width * 0.026))
    const invFontSize = Math.max(12, Math.min(20, width * 0.016))
    const sideMargin = Math.max(15, Math.min(30, width * 0.015))

    this.goldText = this.add.text(width - sideMargin, topMargin, '', {
      fontFamily: 'monospace',
      fontSize: `${goldFontSize}px`,
      color: '#ffcc66',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(1010)

    this.invText = this.add.text(sideMargin, height - Math.max(80, Math.min(120, height * 0.11)), '', {
      fontFamily: 'monospace',
      fontSize: `${invFontSize}px`,
      color: '#e0e0e0',
    }).setOrigin(0, 0).setDepth(1010)

    this.updateHUD()
    this.buildShopContent()

    // Continue button (fixed at bottom, responsive)
    const buttonWidth = Math.max(200, Math.min(420, width * 0.35))
    const buttonHeight = Math.max(40, Math.min(60, height * 0.056))
    const buttonY = height - Math.max(50, Math.min(72, height * 0.067))
    this.continueButton = new MenuButton({
      scene: this,
      x: width / 2 - buttonWidth / 2,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Continue',
      primary: true,
      onClick: () => this.continue(),
    })
    this.continueButton.getContainer().setDepth(1010)

    // Setup navigation
    this.setupNavigation()
  }

  update() {
    this.menuSystem?.update()
  }

  private buildShopContent() {
    if (!this.menuSystem) return

    const layout = this.menuSystem.getLayout()
    const scrollContainer = this.menuSystem.getScrollContainer()
    const scrollArea = this.menuSystem.getScrollArea()

    let currentY = 0
    this.shopItems = []

    const getGold = () => (this.registry.get('gold') as number) || 0
    const setGold = (n: number) => {
      this.registry.set('gold', Math.max(0, Math.floor(n)))
      this.updateHUD()
      this.refreshAllItems()
    }

    const inv = (this.registry.get('inv') as InventoryState) || createInventory()

    const price = {
      weapon: (level: number) => 30 + level * 20,
      accessory: (level: number) => 25 + level * 15,
      healFull: 60,
      reroll: 100,
      dmg: (n: number) => 40 + n * 10,
      rate: (n: number) => 35 + n * 10,
      healSmall: (n: number) => 20 + n * 5,
    }

    // Helper to add items to grid
    let itemIndex = 0
    const addItem = (config: {
      title: string
      description: string
      price: number
      icon?: string
      color?: number
      onClick: () => void
      isDisabled?: () => boolean
      canAfford?: () => boolean
    }) => {
      const col = itemIndex % layout.columns
      const row = Math.floor(itemIndex / layout.columns)
      const x = col * (layout.cardWidth + layout.gap)
      const y = currentY + row * (layout.cardHeight + layout.gap)

      const isDisabled = config.isDisabled?.() || false
      const canAfford = config.canAfford?.() !== false

      const card = new MenuCard({
        scene: this,
        x,
        y,
        width: layout.cardWidth,
        height: layout.cardHeight,
        title: config.title,
        description: config.description,
        price: config.price,
        icon: config.icon,
        color: config.color,
        disabled: isDisabled || !canAfford,
        onClick: () => {
          if (!isDisabled && canAfford) {
            config.onClick()
          }
        },
      })

      scrollContainer.add(card.getContainer())

      const shopItem: ShopItem = {
        card,
        canAfford: config.canAfford || (() => true),
        isDisabled: config.isDisabled || (() => false),
        refresh: () => {
          const nowDisabled = shopItem.isDisabled()
          const nowAfford = shopItem.canAfford()
          card.setDisabled(nowDisabled || !nowAfford)
        },
      }

      this.shopItems.push(shopItem)
      itemIndex++

      return card
    }

    const addSection = (title: string) => {
      // Calculate row height for last items
      if (itemIndex > 0) {
        const lastRow = Math.floor((itemIndex - 1) / layout.columns)
        currentY += (lastRow + 1) * (layout.cardHeight + layout.gap) + 120
      }

      const section = new MenuSection({
        scene: this,
        title,
        x: 0,
        y: currentY,
        width: scrollArea.width,
      })

      scrollContainer.add(section.getContainer())
      currentY += section.getHeight() + 48
      itemIndex = 0
    }

    // Build shop sections

    // Section: Loadout Upgrades
    const owned: { kind: 'w' | 'a'; key: string; level: number }[] = []
    for (const w of inv.weapons) {
      if (w.level < MAX_WEAPON_LEVEL) owned.push({ kind: 'w', key: w.key, level: w.level })
    }
    for (const a of inv.accessories) {
      if (a.level < MAX_ACCESSORY_LEVEL) owned.push({ kind: 'a', key: a.key, level: a.level })
    }
    Phaser.Utils.Array.Shuffle(owned)
    const picks = owned.slice(0, 3)

    if (picks.length > 0) {
      addSection('⚙️ Loadout Upgrades')

      picks.forEach((p) => {
        const isWeapon = p.kind === 'w'
        const maxLevel = isWeapon ? MAX_WEAPON_LEVEL : MAX_ACCESSORY_LEVEL
        const cost = isWeapon ? price.weapon(p.level) : price.accessory(p.level)

        let icon = isWeapon ? 'icon-weapon' : 'icon-acc'
        if (isWeapon) {
          if (/laser/i.test(p.key)) icon = 'icon-weapon-laser'
          else if (/missile/i.test(p.key)) icon = 'icon-weapon-missiles'
          else if (/orb/i.test(p.key)) icon = 'icon-weapon-orb'
        }

        addItem({
          title: `${p.key} Lv${p.level} → ${p.level + 1}`,
          description: isWeapon ? 'Upgrade weapon power' : 'Boost accessory stats',
          price: cost,
          icon,
          color: isWeapon ? 0x4488ff : 0x44ff88,
          onClick: () => {
            if (p.level >= maxLevel || getGold() < cost) return
            setGold(getGold() - cost)
            if (isWeapon) addWeapon(inv, p.key as any)
            else addAccessory(inv, p.key)
            this.registry.set('inv', inv)
          },
          isDisabled: () => p.level >= maxLevel,
          canAfford: () => getGold() >= cost,
        })
      })
    }

    // Section: Run Boosters
    addSection('🚀 Run Boosters')

    let dmgBuys = this.damageBoostPurchased ? 1 : 0
    let rateBuys = 0
    let healSmallBuys = 0

    addItem({
      title: 'Power-up: +1 Damage',
      description: 'Permanently boost bullet damage for this run',
      price: price.dmg(dmgBuys),
      icon: 'icon-weapon',
      color: 0xff6644,
      onClick: () => {
        if (this.damageBoostPurchased) return
        const cost = price.dmg(dmgBuys)
        if (getGold() < cost) return
        setGold(getGold() - cost)
        const game = this.scene.get('Game') as any
        if (game) {
          game.bonusDamage = Math.min(99, (game.bonusDamage || 0) + 1)
          game.recomputeEffectiveStats && game.recomputeEffectiveStats()
        }
        this.damageBoostPurchased = true
      },
      isDisabled: () => this.damageBoostPurchased,
      canAfford: () => getGold() >= price.dmg(dmgBuys),
    })

    addItem({
      title: '+10% Fire Rate',
      description: 'Shoot faster for this run',
      price: price.rate(rateBuys),
      icon: 'icon-speed',
      color: 0xffaa44,
      onClick: () => {
        const cost = price.rate(rateBuys)
        if (getGold() < cost) return
        setGold(getGold() - cost)
        const game = this.scene.get('Game') as any
        if (game) {
          game.bonusFireRateMul = Math.min(3, (game.bonusFireRateMul || 1) * 1.1)
          game.recomputeEffectiveStats && game.recomputeEffectiveStats()
        }
        rateBuys++
      },
      canAfford: () => getGold() >= price.rate(rateBuys),
    })

    addItem({
      title: 'Heal +3 HP',
      description: 'Recover health immediately',
      price: price.healSmall(healSmallBuys),
      icon: 'icon-health',
      color: 0xff6666,
      onClick: () => {
        const cost = price.healSmall(healSmallBuys)
        if (getGold() < cost) return
        setGold(getGold() - cost)
        const hp = this.registry.get('hp') as { cur: number; max: number } | undefined
        const game = this.scene.get('Game') as any
        const cur = hp?.cur ?? (game?.hpCur || 0)
        const max = hp?.max ?? (game?.hpMax || 10)
        const newCur = Math.min(max, cur + 3)
        if (game) game.hpCur = newCur
        this.registry.set('hp', { cur: newCur, max })
        healSmallBuys++
      },
      canAfford: () => getGold() >= price.healSmall(healSmallBuys),
    })

    // Section: Utilities
    addSection('🔧 Utilities')

    addItem({
      title: 'Full Heal',
      description: 'Restore all HP',
      price: price.healFull,
      icon: 'icon-health',
      color: 0xff4444,
      onClick: () => {
        if (getGold() < price.healFull) return
        setGold(getGold() - price.healFull)
        const game = this.scene.get('Game') as any
        if (game) {
          game.hpCur = game.hpMax
          this.registry.set('hp', { cur: game.hpCur, max: game.hpMax })
        }
      },
      canAfford: () => getGold() >= price.healFull,
    })

    const maxRerolls = 3
    addItem({
      title: `Reroll Shop (${maxRerolls - this.rerollBuys} left)`,
      description: 'Refresh available items',
      price: price.reroll,
      icon: 'icon-reroll',
      color: 0xaa88ff,
      onClick: () => {
        if (this.rerollBuys >= maxRerolls) return
        if (getGold() < price.reroll) return
        setGold(getGold() - price.reroll)
        this.rerollBuys++
        this.scene.restart({ preserveState: true })
      },
      isDisabled: () => this.rerollBuys >= maxRerolls,
      canAfford: () => getGold() >= price.reroll,
    })

    // Section: New Gear
    if (inv.weapons.length < MAX_WEAPONS || inv.accessories.length < MAX_ACCESSORIES) {
      addSection('✨ New Gear')

      if (inv.weapons.length < MAX_WEAPONS) {
        addItem({
          title: 'Buy New Weapon',
          description: 'Add a random weapon to your arsenal',
          price: 80,
          icon: 'icon-weapon',
          color: 0x6688ff,
          onClick: () => {
            if (inv.weapons.length >= MAX_WEAPONS || getGold() < 80) return
            setGold(getGold() - 80)
            const pool = ['laser', 'missiles', 'orb', 'railgun', 'shotgun']
            const key = Phaser.Utils.Array.GetRandom(pool) as any
            if (addWeapon(inv, key)) {
              this.registry.set('inv', inv)
            }
          },
          isDisabled: () => inv.weapons.length >= MAX_WEAPONS,
          canAfford: () => getGold() >= 80,
        })
      }

      if (inv.accessories.length < MAX_ACCESSORIES) {
        addItem({
          title: 'Buy New Accessory',
          description: 'Add a random accessory for passive boosts',
          price: 60,
          icon: 'icon-acc',
          color: 0x66ff88,
          onClick: () => {
            if (inv.accessories.length >= MAX_ACCESSORIES || getGold() < 60) return
            setGold(getGold() - 60)
            const pool = ['thrusters', 'magnet-core', 'ammo-loader', 'power-cell', 'splitter', 'overclock', 'coolant', 'autoloader', 'targeting']
            const key = Phaser.Utils.Array.GetRandom(pool)
            if (addAccessory(inv, key)) {
              this.registry.set('inv', inv)
            }
          },
          isDisabled: () => inv.accessories.length >= MAX_ACCESSORIES,
          canAfford: () => getGold() >= 60,
        })
      }
    }

    // Update content height for scrolling
    const totalRows = Math.ceil(itemIndex / layout.columns)
    const finalHeight = currentY + totalRows * (layout.cardHeight + layout.gap) + 240
    this.menuSystem.setContentHeight(finalHeight)
  }

  private setupNavigation() {
    if (!this.menuSystem) return

    const navigableItems: NavigableItem[] = this.shopItems.map((item, index) => ({
      index,
      isDisabled: item.isDisabled() || !item.canAfford(),
      onFocus: () => item.card.setFocused(true),
      onBlur: () => item.card.setFocused(false),
      onActivate: () => item.card.getContainer().emit('pointerdown'),
    }))

    this.navigator = new MenuNavigator({
      scene: this,
      items: navigableItems,
      columns: this.menuSystem.getLayout().columns,
      onNavigate: (index) => {
        this.menuSystem?.scrollToItem(index)
      },
      onCancel: () => this.continue(),
    })
  }

  private refreshAllItems() {
    this.shopItems.forEach((item) => item.refresh())

    // Update navigator
    if (this.navigator) {
      const navigableItems: NavigableItem[] = this.shopItems.map((item, index) => ({
        index,
        isDisabled: item.isDisabled() || !item.canAfford(),
        onFocus: () => item.card.setFocused(true),
        onBlur: () => item.card.setFocused(false),
        onActivate: () => item.card.getContainer().emit('pointerdown'),
      }))

      this.navigator.setItems(navigableItems, this.menuSystem!.getLayout().columns)
    }
  }

  private updateHUD() {
    const gold = (this.registry.get('gold') as number) || 0
    const inv = (this.registry.get('inv') as InventoryState) || createInventory()

    this.goldText?.setText(`💰 ${gold}g`)
    this.invText?.setText(`Weapons: ${describeWeapons(inv)}\nAccessories: ${describeAccessories(inv)}`)
  }

  private continue() {
    const next = (runState.state?.level ?? 1) + 1
    runState.startLevel(next, this.time.now)
    this.cleanup()
    this.scene.start('Game')
    this.scene.launch('HUD')
  }

  private cleanup() {
    this.menuSystem?.destroy()
    this.navigator?.destroy()
    this.continueButton?.destroy()
    this.shopItems.forEach((item) => item.card.destroy())
    this.shopItems = []
  }

  shutdown() {
    this.cleanup()
  }
}
