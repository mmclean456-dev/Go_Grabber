// Quest of the Dragon's Gold - Main Game Engine
// A Cross-Genre Point-and-Click Adventure

const TILE_SIZE = 48;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

// Seed for procedural generation (changes each playthrough)
const WORLD_SEED = Date.now();
let seededRandom = (function(seed) {
    return function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
})(WORLD_SEED);

// Random events that can occur during exploration
const RANDOM_EVENTS = [
    {
        id: 'wandering_merchant',
        name: 'Wandering Merchant',
        chance: 0.02,
        minLevel: 1,
        action: (game) => {
            const discount = Math.floor(Math.random() * 30) + 10;
            game.notify(`A wandering merchant offers you a discount! ${discount}% off next purchase.`);
            game.gameFlags.merchantDiscount = discount;
        }
    },
    {
        id: 'treasure_find',
        name: 'Hidden Treasure',
        chance: 0.015,
        minLevel: 1,
        action: (game) => {
            const gold = Math.floor(Math.random() * 50) + 20;
            game.player.gold += gold;
            game.notify(`You found a hidden pouch with ${gold} gold!`);
            game.updateHUD();
        }
    },
    {
        id: 'ambush',
        name: 'Bandit Ambush',
        chance: 0.025,
        minLevel: 3,
        action: (game) => {
            if (!game.inCombat) {
                game.notify('Bandits ambush you!');
                const ambusher = {
                    x: game.player.x + 50,
                    y: game.player.y,
                    type: NPC_TYPES.BANDIT,
                    name: 'Ambushing Bandit',
                    hostile: true,
                    alive: true,
                    health: game.player.level * 15 + 30,
                    maxHealth: game.player.level * 15 + 30,
                    attack: game.player.level * 2 + 5,
                    defense: game.player.level,
                    level: Math.max(1, game.player.level - 1)
                };
                game.npcs.push(ambusher);
                setTimeout(() => game.combat.start(ambusher), 500);
            }
        }
    },
    {
        id: 'mysterious_potion',
        name: 'Mysterious Potion',
        chance: 0.01,
        minLevel: 2,
        action: (game) => {
            const effects = [
                { msg: 'The potion heals you!', effect: () => { game.player.health = game.player.maxHealth; } },
                { msg: 'The potion makes you stronger!', effect: () => { game.player.attack += 2; } },
                { msg: 'The potion makes you tougher!', effect: () => { game.player.defense += 2; } },
                { msg: 'The potion was poison! You feel weak...', effect: () => { game.player.health = Math.max(1, game.player.health - 20); } }
            ];
            const chosen = effects[Math.floor(Math.random() * effects.length)];
            chosen.effect();
            game.notify(`You find a glowing potion and drink it. ${chosen.msg}`);
            game.updateHUD();
        }
    },
    {
        id: 'helpful_fairy',
        name: 'Helpful Fairy',
        chance: 0.008,
        minLevel: 1,
        action: (game) => {
            game.player.health = Math.min(game.player.health + 50, game.player.maxHealth);
            game.notify('A magical fairy heals your wounds! +50 HP');
            game.updateHUD();
        }
    },
    {
        id: 'weather_change',
        name: 'Weather Event',
        chance: 0.03,
        minLevel: 1,
        action: (game) => {
            const weathers = ['sunny', 'foggy', 'rainy', 'stormy'];
            game.weather = weathers[Math.floor(Math.random() * weathers.length)];
            game.notify(`The weather changes to ${game.weather}!`);
        }
    },
    {
        id: 'lost_traveler',
        name: 'Lost Traveler',
        chance: 0.012,
        minLevel: 1,
        action: (game) => {
            const reward = Math.floor(Math.random() * 30) + 10;
            game.player.gold += reward;
            game.gainXP(15);
            game.notify(`You help a lost traveler find their way. They reward you with ${reward} gold!`);
        }
    },
    {
        id: 'ancient_shrine',
        name: 'Ancient Shrine',
        chance: 0.005,
        minLevel: 5,
        action: (game) => {
            game.player.maxHealth += 10;
            game.player.health = game.player.maxHealth;
            game.notify('You discover an ancient shrine. Your max health increases by 10!');
            game.updateHUD();
        }
    }
];

// Procedural name generator for variety
const NAME_PARTS = {
    prefixes: ['Old', 'Dark', 'Brave', 'Swift', 'Iron', 'Golden', 'Silver', 'Black', 'Red', 'One-Eyed', 'Lucky', 'Mad', 'Crazy', 'Sly', 'Quick'],
    names: ['Jack', 'Pete', 'Bill', 'Sam', 'Tom', 'Joe', 'Mike', 'Dan', 'Bob', 'Jim', 'Frank', 'Duke', 'Earl', 'Rex', 'Max'],
    suffixes: ['the Bold', 'the Brave', 'Longbeard', 'Ironfist', 'Shadowwalker', 'Quickdraw', 'the Terrible', 'the Wise', '']
};

function generateName() {
    const usePrefix = Math.random() < 0.3;
    const useSuffix = Math.random() < 0.3;
    let name = NAME_PARTS.names[Math.floor(Math.random() * NAME_PARTS.names.length)];
    if (usePrefix) {
        name = NAME_PARTS.prefixes[Math.floor(Math.random() * NAME_PARTS.prefixes.length)] + ' ' + name;
    }
    if (useSuffix) {
        name = name + ' ' + NAME_PARTS.suffixes[Math.floor(Math.random() * NAME_PARTS.suffixes.length)];
    }
    return name.trim();
}

// Tile types
const TILES = {
    GRASS: 0,
    WATER: 1,
    SAND: 2,
    STONE: 3,
    WOOD: 4,
    DIRT: 5,
    SNOW: 6,
    LAVA: 7,
    BRIDGE: 8,
    DOCK: 9
};

const TILE_COLORS = {
    [TILES.GRASS]: '#3d8b40',
    [TILES.WATER]: '#2266aa',
    [TILES.SAND]: '#d4b896',
    [TILES.STONE]: '#666677',
    [TILES.WOOD]: '#8b6914',
    [TILES.DIRT]: '#8b7355',
    [TILES.SNOW]: '#e8e8f0',
    [TILES.LAVA]: '#cc4400',
    [TILES.BRIDGE]: '#a08060',
    [TILES.DOCK]: '#9a7b4f'
};

const WALKABLE = [TILES.GRASS, TILES.SAND, TILES.STONE, TILES.WOOD, TILES.DIRT, TILES.SNOW, TILES.BRIDGE, TILES.DOCK];

// Game regions
const REGIONS = {
    STARTING_VILLAGE: 'starting_village',
    FOREST: 'forest',
    PIRATE_COVE: 'pirate_cove',
    WESTERN_TOWN: 'western_town',
    MEDIEVAL_CASTLE: 'medieval_castle',
    MOUNTAIN_PASS: 'mountain_pass',
    DRAGON_LAIR: 'dragon_lair',
    MYSTIC_SWAMP: 'mystic_swamp'
};

// Generate procedural world map
function generateWorld() {
    const worldWidth = 200;
    const worldHeight = 150;
    const map = [];
    
    // Key locations for land generation
    const landCenters = [
        { x: 50, y: 75, radius: 20 },   // Starting village
        { x: 100, y: 75, radius: 18 },  // Forest
        { x: 150, y: 90, radius: 15 },  // Pirate cove
        { x: 30, y: 50, radius: 15 },   // Medieval castle
        { x: 80, y: 40, radius: 12 },   // Western town
        { x: 100, y: 20, radius: 12 },  // Mountain pass
        { x: 175, y: 15, radius: 15 },  // Dragon lair
        { x: 120, y: 100, radius: 12 }  // Mystic swamp
    ];
    
    // Noise-based terrain generation
    for (let y = 0; y < worldHeight; y++) {
        map[y] = [];
        for (let x = 0; x < worldWidth; x++) {
            // Check distance to nearest land center
            let minDist = Infinity;
            for (const center of landCenters) {
                const dist = Math.hypot(x - center.x, y - center.y);
                if (dist < minDist) minDist = dist;
            }
            
            // Land generation based on distance to centers
            const landInfluence = Math.max(0, 1 - minDist / 25);
            
            const noise1 = Math.sin(x * 0.08) * Math.cos(y * 0.08);
            const noise2 = Math.sin(x * 0.15 + 50) * Math.cos(y * 0.12);
            const combined = (noise1 + noise2) / 2 + landInfluence * 0.5;
            
            if (combined < -0.2) {
                map[y][x] = TILES.WATER;
            } else if (combined < 0.0) {
                map[y][x] = TILES.SAND;
            } else if (combined < 0.5) {
                map[y][x] = TILES.GRASS;
            } else if (combined < 0.7) {
                map[y][x] = TILES.DIRT;
            } else {
                map[y][x] = TILES.STONE;
            }
            
            // Ensure land near key locations
            for (const center of landCenters) {
                const dist = Math.hypot(x - center.x, y - center.y);
                if (dist < center.radius) {
                    if (map[y][x] === TILES.WATER) {
                        map[y][x] = dist < center.radius * 0.5 ? TILES.GRASS : TILES.SAND;
                    }
                }
            }
            
            // Snow in northern areas
            if (y < 20 && map[y][x] !== TILES.WATER) {
                map[y][x] = TILES.SNOW;
            }
            
            // Dragon lair area (northeast) - volcanic
            if (x > 165 && y < 25) {
                if (seededRandom() < 0.25) map[y][x] = TILES.LAVA;
                else if (map[y][x] !== TILES.WATER) map[y][x] = TILES.STONE;
            }
            
            // Swamp area - more marshy
            if (x > 110 && x < 135 && y > 95 && y < 115) {
                if (map[y][x] === TILES.GRASS) {
                    map[y][x] = seededRandom() < 0.3 ? TILES.WATER : TILES.GRASS;
                }
            }
        }
    }
    
    // Create paths between regions (wider paths)
    createPath(map, 50, 75, 100, 75, 3); // Starting village to forest
    createPath(map, 100, 75, 150, 90, 3); // Forest to pirate cove
    createPath(map, 50, 75, 30, 50, 3); // To medieval castle
    createPath(map, 100, 75, 80, 40, 3); // To western town
    createPath(map, 80, 40, 100, 20, 2); // To mountain pass
    createPath(map, 100, 20, 175, 15, 2); // To dragon lair
    createPath(map, 100, 75, 120, 100, 2); // To mystic swamp
    
    return { map, width: worldWidth, height: worldHeight };
}

function createPath(map, x1, y1, x2, y2, width = 2) {
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
        // Create path with specified width
        for (let dy = -width; dy <= width; dy++) {
            for (let dx = -width; dx <= width; dx++) {
                const px = x + dx;
                const py = y + dy;
                if (map[py] && map[py][px] !== undefined) {
                    if (map[py][px] === TILES.WATER) {
                        map[py][px] = TILES.BRIDGE;
                    } else if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                        map[py][px] = TILES.DIRT;
                    }
                }
            }
        }
        if (x < x2) x++;
        else if (x > x2) x--;
        if (y < y2) y++;
        else if (y > y2) y--;
    }
}

// NPC definitions with dynamic behavior
const NPC_TYPES = {
    VILLAGER: { sprite: '👨‍🌾', hostile: false, dialogue: true },
    MERCHANT: { sprite: '🧔', hostile: false, dialogue: true, shop: true },
    KNIGHT: { sprite: '🤺', hostile: false, dialogue: true, canRecruit: true },
    PIRATE: { sprite: '🏴‍☠️', hostile: 'variable', dialogue: true },
    COWBOY: { sprite: '🤠', hostile: false, dialogue: true },
    BANDIT: { sprite: '🦹', hostile: true, dialogue: false },
    WIZARD: { sprite: '🧙', hostile: false, dialogue: true, canRecruit: true },
    BEAST: { sprite: '🐺', hostile: true, dialogue: false },
    DRAGON: { sprite: '🐉', hostile: true, dialogue: true, boss: true },
    BARTENDER: { sprite: '🍺', hostile: false, dialogue: true, gambling: true },
    BLACKSMITH: { sprite: '⚒️', hostile: false, dialogue: true, shop: true },
    PIRATE_CAPTAIN: { sprite: '🏴‍☠️', hostile: 'variable', dialogue: true, special: 'cardGame' },
    MYSTERIOUS_STRANGER: { sprite: '🎭', hostile: false, dialogue: true, clueGiver: true },
    MONSTER: { sprite: '👹', hostile: true, dialogue: false },
    GHOST: { sprite: '👻', hostile: 'variable', dialogue: true },
    ROYAL_GUARD: { sprite: '💂', hostile: false, dialogue: true },
    INNKEEPER: { sprite: '🏨', hostile: false, dialogue: true, rest: true },
    SHERIFF: { sprite: '⭐', hostile: false, dialogue: true, questGiver: true }
};

// Item Rarity System
const RARITY = {
    COMMON: { name: 'common', color: '#888888', order: 0 },
    UNCOMMON: { name: 'uncommon', color: '#44cc44', order: 1 },
    RARE: { name: 'rare', color: '#4488ff', order: 2 },
    EPIC: { name: 'epic', color: '#aa44ff', order: 3 },
    LEGENDARY: { name: 'legendary', color: '#ffaa00', order: 4 }
};

// Item definitions with rarity
const ITEMS = {
    // Weapons
    RUSTY_SWORD: { name: 'Rusty Sword', type: 'weapon', icon: '🗡️', attack: 5, price: 20, rarity: RARITY.COMMON, description: 'A worn blade, but still sharp enough.' },
    IRON_SWORD: { name: 'Iron Sword', type: 'weapon', icon: '⚔️', attack: 12, price: 80, rarity: RARITY.COMMON, description: 'A reliable sword forged from iron.' },
    STEEL_SWORD: { name: 'Steel Sword', type: 'weapon', icon: '🔪', attack: 20, price: 200, rarity: RARITY.UNCOMMON, description: 'High-quality steel, perfectly balanced.' },
    LEGENDARY_BLADE: { name: 'Legendary Blade', type: 'weapon', icon: '✨', attack: 35, price: 500, rarity: RARITY.LEGENDARY, description: 'A blade of legend, said to cut through anything.' },
    PISTOL: { name: 'Six Shooter', type: 'weapon', icon: '🔫', attack: 18, price: 150, rarity: RARITY.UNCOMMON, description: 'A quick-draw revolver from the West.' },
    CUTLASS: { name: 'Pirate Cutlass', type: 'weapon', icon: '🏴‍☠️', attack: 15, price: 120, rarity: RARITY.UNCOMMON, description: 'Curved blade favored by sea raiders.' },
    
    // Armor
    LEATHER_ARMOR: { name: 'Leather Armor', type: 'armor', icon: '🥋', defense: 5, price: 50, rarity: RARITY.COMMON, description: 'Basic protection, lightweight and flexible.' },
    CHAINMAIL: { name: 'Chainmail', type: 'armor', icon: '⛓️', defense: 12, price: 150, rarity: RARITY.UNCOMMON, description: 'Interlocking metal rings provide solid defense.' },
    PLATE_ARMOR: { name: 'Plate Armor', type: 'armor', icon: '🛡️', defense: 25, price: 400, rarity: RARITY.RARE, description: 'Heavy plate armor for serious protection.' },
    DRAGON_SCALE: { name: 'Dragon Scale Armor', type: 'armor', icon: '🐲', defense: 40, price: 1000, rarity: RARITY.LEGENDARY, description: 'Forged from real dragon scales. Nearly impervious.' },
    
    // Consumables
    HEALTH_POTION: { name: 'Health Potion', type: 'consumable', icon: '🧪', heal: 30, price: 25, stackable: true, rarity: RARITY.COMMON, description: 'Restores 30 health points.' },
    LARGE_POTION: { name: 'Large Health Potion', type: 'consumable', icon: '⚗️', heal: 75, price: 60, stackable: true, rarity: RARITY.UNCOMMON, description: 'Restores 75 health points.' },
    STRENGTH_ELIXIR: { name: 'Strength Elixir', type: 'consumable', icon: '💪', tempAttack: 10, duration: 3, price: 40, stackable: true, rarity: RARITY.UNCOMMON, description: 'Temporarily boosts attack power.' },
    
    // Special items
    SHIP_DEED: { name: 'Ship Deed', type: 'key', icon: '🚢', description: 'Proof of ship ownership', rarity: RARITY.RARE, price: 0 },
    DRAGON_MAP: { name: 'Dragon Map', type: 'key', icon: '🗺️', description: 'Shows path to dragon lair', rarity: RARITY.EPIC, price: 0 },
    CASTLE_KEY: { name: 'Castle Key', type: 'key', icon: '🔑', description: 'Opens the castle gate', rarity: RARITY.RARE, price: 0 },
    MYSTIC_AMULET: { name: 'Mystic Amulet', type: 'accessory', icon: '📿', special: 'reveal_clues', rarity: RARITY.EPIC, price: 500, description: 'Reveals hidden clues in the world.' },
    
    // Additional weapons
    DAGGER: { name: 'Dagger', type: 'weapon', icon: '🗡️', attack: 8, price: 40, rarity: RARITY.COMMON, description: 'A small but deadly blade.' },
    RAPIER: { name: 'Rapier', type: 'weapon', icon: '🤺', attack: 14, price: 100, rarity: RARITY.UNCOMMON, description: 'An elegant thrusting sword.' },
    BATTLE_AXE: { name: 'Battle Axe', type: 'weapon', icon: '🪓', attack: 22, price: 220, rarity: RARITY.RARE, description: 'Heavy axe that deals devastating blows.' },
    CROSSBOW: { name: 'Crossbow', type: 'weapon', icon: '🏹', attack: 16, price: 130, rarity: RARITY.UNCOMMON, description: 'Powerful ranged weapon.' },
    ROYAL_SWORD: { name: 'Royal Sword', type: 'weapon', icon: '👑', attack: 28, price: 350, rarity: RARITY.EPIC, description: 'A blade fit for royalty.' },
    DRAGON_SLAYER: { name: 'Dragon Slayer', type: 'weapon', icon: '🐲', attack: 45, price: 800, special: 'dragon_bonus', rarity: RARITY.LEGENDARY, description: 'Forged specifically to slay dragons. +50% damage vs dragons.' },
    HEIRLOOM_SWORD: { name: 'Ruby Heirloom Sword', type: 'weapon', icon: '💎', attack: 25, price: 0, rarity: RARITY.EPIC, description: 'A family treasure with a ruby in the hilt.' },
    
    // Additional armor
    KNIGHT_ARMOR: { name: 'Knight Armor', type: 'armor', icon: '⚔️', defense: 18, price: 280, rarity: RARITY.RARE, description: 'Standard issue for royal knights.' },
    ROYAL_ARMOR: { name: 'Royal Plate', type: 'armor', icon: '👑', defense: 32, price: 550, rarity: RARITY.EPIC, description: 'Ornate armor worn by the king\'s guard.' },
    FIRE_CLOAK: { name: 'Fire Resistant Cloak', type: 'armor', icon: '🔥', defense: 15, price: 300, special: 'fire_resist', rarity: RARITY.RARE, description: 'Provides resistance against fire damage.' },
    
    // Additional consumables
    ANTIDOTE: { name: 'Antidote', type: 'consumable', icon: '🧴', cure: 'poison', price: 30, stackable: true, rarity: RARITY.COMMON, description: 'Cures poison status.' },
    FIRE_RESIST_POTION: { name: 'Fire Resistance Potion', type: 'consumable', icon: '🔥', special: 'fire_resist', duration: 5, price: 150, stackable: true, rarity: RARITY.RARE, description: 'Grants temporary fire resistance.' },
    MEGA_POTION: { name: 'Mega Health Potion', type: 'consumable', icon: '💉', heal: 150, price: 120, stackable: true, rarity: RARITY.RARE, description: 'Restores 150 health points.' },
    ATTACK_BOOST: { name: 'Attack Boost', type: 'consumable', icon: '⚡', tempAttack: 15, duration: 5, price: 80, stackable: true, rarity: RARITY.UNCOMMON, description: 'Temporarily increases attack by 15.' },
    DEFENSE_BOOST: { name: 'Defense Boost', type: 'consumable', icon: '🛡️', tempDefense: 15, duration: 5, price: 80, stackable: true, rarity: RARITY.UNCOMMON, description: 'Temporarily increases defense by 15.' },
    
    // Accessories
    RING_OF_STRENGTH: { name: 'Ring of Strength', type: 'accessory', icon: '💪', attack: 5, price: 200, rarity: RARITY.RARE, description: 'Grants +5 attack when worn.' },
    RING_OF_PROTECTION: { name: 'Ring of Protection', type: 'accessory', icon: '🛡️', defense: 5, price: 200, rarity: RARITY.RARE, description: 'Grants +5 defense when worn.' },
    LUCKY_CHARM: { name: 'Lucky Charm', type: 'accessory', icon: '🍀', special: 'luck', price: 150, rarity: RARITY.UNCOMMON, description: 'Increases luck in combat and gambling.' },
    GOLD_RING: { name: 'Gold Ring', type: 'accessory', icon: '💍', price: 100, sellOnly: true, rarity: RARITY.COMMON, description: 'A simple gold ring. Valuable for selling.' }
};

// Fast Travel Locations
const FAST_TRAVEL_LOCATIONS = [
    { id: 'starting_village', name: 'Starting Village', icon: '🏘️', x: 50, y: 75, region: 'Starting Village' },
    { id: 'forest', name: 'Dark Forest', icon: '🌲', x: 100, y: 75, region: 'Dark Forest' },
    { id: 'pirate_cove', name: 'Pirate Cove', icon: '🏴‍☠️', x: 150, y: 90, region: 'Pirate Cove' },
    { id: 'western_town', name: 'Western Town', icon: '🤠', x: 80, y: 40, region: 'Western Town' },
    { id: 'medieval_castle', name: 'Medieval Castle', icon: '🏰', x: 30, y: 50, region: 'Medieval Castle' },
    { id: 'mystic_swamp', name: 'Mystic Swamp', icon: '🐸', x: 120, y: 100, region: 'Mystic Swamp' },
    { id: 'mountain_pass', name: 'Mountain Pass', icon: '⛰️', x: 100, y: 20, region: 'Mountain Pass' },
    { id: 'dragon_lair', name: "Dragon's Lair", icon: '🐉', x: 180, y: 12, region: "Dragon's Lair" }
];

// Clues for scavenger hunt
const CLUES = [
    { id: 'clue1', text: "Where steel meets fire, the smith knows more than he tells...", region: REGIONS.STARTING_VILLAGE, hint: 'Talk to the blacksmith' },
    { id: 'clue2', text: "The one-eyed captain guards a map, but values gold less than glory...", region: REGIONS.PIRATE_COVE, hint: 'Challenge the pirate captain' },
    { id: 'clue3', text: "In the west, where tumbleweeds roll, the sheriff keeps ancient secrets...", region: REGIONS.WESTERN_TOWN, hint: 'Help the sheriff' },
    { id: 'clue4', text: "The ghost of the tower remembers the dragon's weakness...", region: REGIONS.MEDIEVAL_CASTLE, hint: 'Find the ghost' },
    { id: 'clue5', text: "Swamp waters hide the final piece - the witch demands a trade...", region: REGIONS.MYSTIC_SWAMP, hint: 'Find the swamp witch' },
    { id: 'clue6', text: "When all clues align, the mountain pass reveals its path...", region: REGIONS.MOUNTAIN_PASS, hint: 'Gather all clues' }
];

// Quest definitions
const QUESTS = {
    MAIN_QUEST: {
        id: 'main',
        title: 'The Dragon\'s Gold',
        description: 'Seek the dragon\'s lair, defeat the beast, and claim the legendary treasure.',
        stages: [
            { id: 'start', description: 'Begin your journey - explore the village', completed: false },
            { id: 'gather_clues', description: 'Gather clues about the dragon\'s location (0/5)', completed: false, count: 0, required: 5 },
            { id: 'find_lair', description: 'Find the path to the Dragon\'s Lair', completed: false },
            { id: 'defeat_dragon', description: 'Defeat the Dragon', completed: false },
            { id: 'claim_gold', description: 'Claim the Dragon\'s Gold', completed: false }
        ]
    },
    PIRATE_SHIP: {
        id: 'pirate_ship',
        title: 'A Ship of Your Own',
        description: 'Win a ship from the pirate captain in a game of cards.',
        stages: [
            { id: 'find_captain', description: 'Find the Pirate Captain', completed: false },
            { id: 'win_game', description: 'Beat him at cards', completed: false }
        ]
    },
    SHERIFF_BOUNTY: {
        id: 'sheriff_bounty',
        title: 'Wanted: Dead or Alive',
        description: 'Help the sheriff capture dangerous bandits.',
        stages: [
            { id: 'talk_sheriff', description: 'Speak with the Sheriff', completed: false },
            { id: 'defeat_bandits', description: 'Defeat the bandits (0/3)', completed: false, count: 0, required: 3 },
            { id: 'return_sheriff', description: 'Return to the Sheriff', completed: false }
        ]
    },
    GHOST_MYSTERY: {
        id: 'ghost_mystery',
        title: 'The Castle Ghost',
        description: 'Uncover the mystery of the haunted castle.',
        stages: [
            { id: 'enter_castle', description: 'Enter the Medieval Castle', completed: false },
            { id: 'find_ghost', description: 'Find the Ghost', completed: false },
            { id: 'complete_task', description: 'Complete the Ghost\'s request', completed: false }
        ]
    },
    WOLF_HUNT: {
        id: 'wolf_hunt',
        title: 'Wolf Problem',
        description: 'Clear the wolves from the farmer\'s land.',
        stages: [
            { id: 'accept', description: 'Accept the farmer\'s request', completed: false },
            { id: 'kill_wolves', description: 'Kill the wolves (0/5)', completed: false, count: 0, required: 5 },
            { id: 'return_farmer', description: 'Return to the farmer', completed: false }
        ]
    },
    LOST_HEIRLOOM: {
        id: 'lost_heirloom',
        title: 'The Lost Heirloom',
        description: 'Recover the wounded knight\'s family sword.',
        stages: [
            { id: 'find_bandits', description: 'Find the bandits who took the sword', completed: false },
            { id: 'recover_sword', description: 'Defeat the bandits and recover the sword', completed: false },
            { id: 'return_sword', description: 'Return the sword to the knight', completed: false }
        ]
    },
    GOLD_MINE: {
        id: 'gold_mine',
        title: 'Gold Rush',
        description: 'Clear the bandits from the gold mine.',
        stages: [
            { id: 'find_mine', description: 'Find the gold mine', completed: false },
            { id: 'defeat_boss', description: 'Defeat Rattlesnake Rogers', completed: false },
            { id: 'claim_reward', description: 'Claim your share of the gold', completed: false }
        ]
    },
    RESCUE_PRINCE: {
        id: 'rescue_prince',
        title: 'The Lost Prince',
        description: 'Rescue the prince from the dragon\'s lair.',
        stages: [
            { id: 'learn_truth', description: 'Learn about the captured prince', completed: false },
            { id: 'defeat_dragon', description: 'Defeat the dragon', completed: false },
            { id: 'save_prince', description: 'Free the prince', completed: false }
        ]
    },
    ESCORT_MISSION: {
        id: 'escort_mission',
        title: 'Swamp Rescue',
        description: 'Help the lost traveler escape the swamp.',
        stages: [
            { id: 'find_traveler', description: 'Find the lost traveler', completed: false },
            { id: 'escort_safely', description: 'Escort them to safety', completed: false }
        ]
    }
};

// Visual Effects - Particle System
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.ambientParticles = [];
        this.clickRipples = [];
    }
    
    emit(x, y, type, count = 10) {
        const configs = {
            combat_hit: { colors: ['#ff4444', '#ff8844', '#ffcc44'], life: 30, speed: 4, size: 6, gravity: 0.15 },
            treasure: { colors: ['#ffd700', '#ffec8b', '#fff8dc'], life: 50, speed: 3, size: 5, gravity: -0.05 },
            levelup: { colors: ['#44ff44', '#88ff88', '#aaffaa', '#ffd700'], life: 60, speed: 5, size: 8, gravity: -0.08 },
            heal: { colors: ['#44ff88', '#88ffaa', '#aaffcc'], life: 40, speed: 2, size: 4, gravity: -0.1 },
            magic: { colors: ['#8844ff', '#aa66ff', '#cc88ff'], life: 45, speed: 3, size: 5, gravity: 0 },
            death: { colors: ['#444444', '#666666', '#888888', '#aa4444'], life: 50, speed: 4, size: 7, gravity: 0.2 },
            sparkle: { colors: ['#ffffff', '#ffffaa', '#ffff66'], life: 25, speed: 1, size: 3, gravity: 0 },
            fire: { colors: ['#ff4400', '#ff6600', '#ff8800', '#ffaa00'], life: 35, speed: 3, size: 5, gravity: -0.15 }
        };
        
        const config = configs[type] || configs.sparkle;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = config.speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: config.life * (0.7 + Math.random() * 0.3),
                maxLife: config.life,
                color: config.colors[Math.floor(Math.random() * config.colors.length)],
                size: config.size * (0.6 + Math.random() * 0.4),
                gravity: config.gravity,
                type: type
            });
        }
    }
    
    addClickRipple(x, y) {
        this.clickRipples.push({
            x, y,
            radius: 5,
            maxRadius: 40,
            alpha: 0.8,
            life: 20
        });
    }
    
    updateAmbientParticles(cameraX, cameraY, region, weather, timeOfDay) {
        const targetCount = weather === 'rainy' ? 80 : (weather === 'stormy' ? 120 : 40);
        
        while (this.ambientParticles.length < targetCount) {
            const regionConfigs = {
                forest: { colors: ['#88cc88', '#66aa66'], type: 'leaf' },
                swamp: { colors: ['#88aa66', '#669944'], type: 'bubble' },
                snow: { colors: ['#ffffff', '#eeeeff'], type: 'snow' },
                lava: { colors: ['#ff4400', '#ff6600', '#ff8800'], type: 'ember' },
                default: { colors: ['#ffffff', '#ffffcc'], type: 'dust' }
            };
            
            const config = regionConfigs[region] || regionConfigs.default;
            
            this.ambientParticles.push({
                x: cameraX + Math.random() * 1200,
                y: cameraY + Math.random() * 700,
                vx: (Math.random() - 0.5) * 0.5,
                vy: weather === 'rainy' || weather === 'stormy' ? 3 + Math.random() * 2 : (Math.random() - 0.5) * 0.3,
                size: weather === 'rainy' ? 2 : 2 + Math.random() * 3,
                color: config.colors[Math.floor(Math.random() * config.colors.length)],
                alpha: 0.3 + Math.random() * 0.4,
                type: config.type,
                oscillate: Math.random() * Math.PI * 2
            });
        }
    }
    
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life--;
            p.vx *= 0.98;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
            const p = this.ambientParticles[i];
            p.oscillate += 0.05;
            p.x += p.vx + Math.sin(p.oscillate) * 0.3;
            p.y += p.vy;
            
            if (p.y > p.startY + 800 || p.x < p.startX - 100 || p.x > p.startX + 1300) {
                this.ambientParticles.splice(i, 1);
            }
        }
        
        for (let i = this.clickRipples.length - 1; i >= 0; i--) {
            const r = this.clickRipples[i];
            r.radius += 2;
            r.alpha -= 0.04;
            r.life--;
            
            if (r.life <= 0 || r.alpha <= 0) {
                this.clickRipples.splice(i, 1);
            }
        }
    }
    
    render(ctx, cameraX, cameraY) {
        for (const p of this.particles) {
            const screenX = p.x - cameraX;
            const screenY = p.y - cameraY;
            const alpha = p.life / p.maxLife;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            
            if (p.type === 'levelup' || p.type === 'magic') {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
            }
            
            ctx.beginPath();
            ctx.arc(screenX, screenY, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        for (const r of this.clickRipples) {
            const screenX = r.x - cameraX;
            const screenY = r.y - cameraY;
            
            ctx.save();
            ctx.globalAlpha = r.alpha;
            ctx.strokeStyle = '#ffff88';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, r.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    renderAmbient(ctx, cameraX, cameraY, weather) {
        for (const p of this.ambientParticles) {
            const screenX = p.x - cameraX;
            const screenY = p.y - cameraY;
            
            if (screenX < -10 || screenX > 1210 || screenY < -10 || screenY > 710) continue;
            
            ctx.save();
            ctx.globalAlpha = p.alpha;
            
            if (weather === 'rainy' || weather === 'stormy') {
                ctx.strokeStyle = 'rgba(150, 180, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX + 2, screenY + 12);
                ctx.stroke();
            } else if (p.type === 'ember') {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'snow') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, p.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        this.particles = new ParticleSystem();
        this.hoveredNPC = null;
        this.lastClickTime = 0;
        
        this.world = generateWorld();
        this.camera = { x: 0, y: 0 };
        this.targetCamera = { x: 0, y: 0 };
        
        this.player = {
            x: 50 * TILE_SIZE,
            y: 75 * TILE_SIZE,
            targetX: 50 * TILE_SIZE,
            targetY: 75 * TILE_SIZE,
            speed: 4,
            maxSpeed: 6,
            acceleration: 0.3,
            deceleration: 0.15,
            velocityX: 0,
            velocityY: 0,
            sprite: '🤺',
            health: 100,
            maxHealth: 100,
            level: 1,
            xp: 0,
            xpToLevel: 100,
            gold: 50,
            attack: 10,
            defense: 5,
            baseAttack: 10,
            baseDefense: 5,
            inventory: [
                { item: ITEMS.RUSTY_SWORD, equipped: true },
                { item: ITEMS.HEALTH_POTION, count: 3 }
            ],
            equipment: {
                weapon: ITEMS.RUSTY_SWORD,
                armor: null,
                accessory: null
            },
            allies: [],
            reputation: {
                pirates: 0,
                cowboys: 0,
                kingdom: 50,
                outlaws: 0
            }
        };
        
        // Navigation state
        this.navigationState = {
            path: [],
            pathIndex: 0,
            isMoving: false,
            mouseDown: false,
            mouseX: 0,
            mouseY: 0,
            lastClickTime: 0,
            doubleClickTarget: null,
            showPathPreview: false,
            previewPath: [],
            wasdMovement: { w: false, a: false, s: false, d: false }
        };
        
        this.npcs = [];
        this.decorations = [];
        this.quests = JSON.parse(JSON.stringify(QUESTS));
        this.cluesFound = [];
        this.gameFlags = {};
        this.currentDialogue = null;
        this.inCombat = false;
        this.combatEnemy = null;
        
        this.running = false;
        this.lastTime = 0;
        
        // New systems for replayability
        this.weather = 'sunny';
        this.timeOfDay = 8; // Start at 8 AM
        this.dayCount = 1;
        this.dayNightCycle = true;
        this.eventCooldown = 0;
        this.treasureChests = [];
        this.discoveredLocations = new Set(['Starting Village']);
        this.playTime = 0;
        this.killCount = 0;
        this.distanceTraveled = 0;
        this.lastPosition = { x: 0, y: 0 };
        
        // QoL tracking variables
        this.totalGoldEarned = 50; // Starting gold counts
        this.totalXPGained = 0;
        this.itemsBought = 0;
        this.chestsOpened = 0;
        this.fastTravelCooldown = 0;
        this.inventorySortMode = 'type';
        
        this.combat = new CombatSystem(this);
        this.gambling = new GamblingSystem(this);
        
        this.init();
    }
    
    init() {
        this.generateNPCs();
        this.generateDecorations();
        this.generateTreasureChests();
        this.setupEventListeners();
        
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('loading-screen').style.display = 'none';
            // Initialize sound system on user interaction
            soundSystem.init();
            soundSystem.playClick();
            this.start();
        });
    }
    
    generateTreasureChests() {
        const chestLocations = [
            { x: 55, y: 78, loot: 'gold', amount: 30 },
            { x: 108, y: 70, loot: 'potion', amount: 1 },
            { x: 142, y: 92, loot: 'gold', amount: 75 },
            { x: 85, y: 45, loot: 'gold', amount: 50 },
            { x: 35, y: 55, loot: 'weapon', item: ITEMS.IRON_SWORD },
            { x: 125, y: 95, loot: 'armor', item: ITEMS.CHAINMAIL },
            { x: 95, y: 25, loot: 'gold', amount: 100 },
            { x: 165, y: 20, loot: 'potion', amount: 3 },
            { x: 175, y: 18, loot: 'weapon', item: ITEMS.LEGENDARY_BLADE }
        ];
        
        // Add some randomized chest locations
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(seededRandom() * 180) + 10;
            const y = Math.floor(seededRandom() * 130) + 10;
            if (this.isWalkable(x, y)) {
                const lootType = seededRandom() < 0.7 ? 'gold' : 'potion';
                chestLocations.push({
                    x, y,
                    loot: lootType,
                    amount: lootType === 'gold' ? Math.floor(seededRandom() * 40) + 15 : Math.floor(seededRandom() * 2) + 1
                });
            }
        }
        
        this.treasureChests = chestLocations.map(loc => ({
            ...loc,
            x: loc.x * TILE_SIZE + TILE_SIZE / 2,
            y: loc.y * TILE_SIZE + TILE_SIZE / 2,
            opened: false,
            sprite: '📦'
        }));
    }
    
    generateNPCs() {
        // Starting Village NPCs
        this.addNPC(48, 73, NPC_TYPES.VILLAGER, 'Elder Thomas', [
            { text: "Welcome, brave knight! Dark times have befallen our land.", choices: [
                { text: "What happened?", next: 1 },
                { text: "I'm looking for adventure.", next: 2 }
            ]},
            { text: "A fearsome dragon has made its lair in the northern mountains. It hoards treasure beyond imagination!", choices: [
                { text: "Where can I find this dragon?", next: 3 },
                { text: "I will slay this beast!", next: 4 }
            ]},
            { text: "Adventure finds those who seek it! But be warned - many dangers await.", choices: [
                { text: "Tell me more.", next: 1 }
            ]},
            { text: "No one knows exactly... But gather clues from across the lands. The blacksmith, the pirates, the western folk - they all know fragments of the truth.", action: 'startMainQuest', choices: [
                { text: "I'll find the dragon.", next: 4 }
            ]},
            { text: "May the gods protect you, brave knight. Seek the clues, gather allies, and grow stronger!", end: true }
        ]);
        
        this.addNPC(52, 76, NPC_TYPES.BLACKSMITH, 'Forge Master Aldric', [
            { text: "Ah, a knight seeking steel! I forge the finest weapons in the realm.", choices: [
                { text: "Show me your wares. [Shop]", action: 'openShop', shopType: 'blacksmith' },
                { text: "Do you know anything about the dragon?", next: 1 }
            ]},
            { text: "*lowers voice* The dragon... I've seen it, years ago. Its scales deflect ordinary steel.", choices: [
                { text: "How can it be defeated?", next: 2 },
                { text: "Show me your wares. [Shop]", action: 'openShop', shopType: 'blacksmith' }
            ]},
            { text: "Legend speaks of a weakness... its belly is soft. But you'd need to get close. Very close.", action: 'giveClue', clueId: 'clue1', choices: [
                { text: "Thank you for the information.", end: true }
            ]}
        ], { shop: 'blacksmith' });
        
        this.addNPC(45, 74, NPC_TYPES.MERCHANT, 'Traveling Merchant', [
            { text: "Potions, elixirs, rare goods! Everything an adventurer needs!", choices: [
                { text: "Let me see what you have. [Shop]", action: 'openShop', shopType: 'merchant' },
                { text: "Maybe later.", end: true }
            ]}
        ], { shop: 'merchant' });
        
        this.addNPC(53, 72, NPC_TYPES.INNKEEPER, 'Martha the Innkeeper', [
            { text: "Welcome to the Rusty Flagon! Need rest, weary traveler?", choices: [
                { text: "Rest and restore health. [20 gold]", action: 'rest', cost: 20 },
                { text: "Just passing through.", end: true }
            ]}
        ]);
        
        // Forest NPCs
        this.addNPC(95, 78, NPC_TYPES.WIZARD, 'Merlin the Wise', [
            { text: "Greetings, seeker. The mystical arts reveal much to those who listen.", choices: [
                { text: "Will you join me on my quest?", next: 1 },
                { text: "What do the stars say?", next: 2 }
            ]},
            { text: "Join you? Hmm... Prove your worth first. Bring me 3 beast fangs from the forest creatures.", action: 'startRecruitQuest', choices: [
                { text: "I'll return with the fangs.", end: true }
            ]},
            { text: "The stars speak of a great battle... a knight of honor against ancient evil. The path is treacherous, but not impossible.", choices: [
                { text: "Thank you, wise one.", end: true }
            ]}
        ], { canRecruit: true, recruitQuest: 'beast_fangs' });
        
        this.addNPC(105, 72, NPC_TYPES.BEAST, 'Wild Wolf', null, { hostile: true, level: 2, drops: ['beast_fang'] });
        this.addNPC(110, 80, NPC_TYPES.BEAST, 'Forest Bear', null, { hostile: true, level: 4, drops: ['beast_fang'] });
        this.addNPC(98, 82, NPC_TYPES.MONSTER, 'Forest Troll', null, { hostile: true, level: 5 });
        
        // Pirate Cove NPCs
        this.addNPC(148, 88, NPC_TYPES.PIRATE_CAPTAIN, 'Captain Blackbeard', [
            { text: "Arr! What brings a landlubber to me cove?", choices: [
                { text: "I seek passage across the sea.", next: 1 },
                { text: "I challenge you to a game of cards!", next: 2 },
                { text: "I'm looking for information.", next: 3 }
            ]},
            { text: "Ha! Passage ain't free. Win it from me in a game of cards, or pay 500 gold!", choices: [
                { text: "I'll play your game!", next: 2 },
                { text: "I'll find another way.", end: true }
            ]},
            { text: "A gambler, eh? I like that! If ye win, I'll give ye me ship's deed. If ye lose... ye work on me ship for a year!", action: 'startCardGame', choices: [
                { text: "Deal the cards!", action: 'openGambling', gamblingType: 'pirate' }
            ]},
            { text: "Information about what, exactly? The dragon? *laughs* That beast's lair is hidden well... but I've seen it.", choices: [
                { text: "Tell me what you know.", next: 4 }
            ]},
            { text: "Beat me at cards, and I'll mark it on yer map. That's me deal.", choices: [
                { text: "You're on!", action: 'openGambling', gamblingType: 'pirate' },
                { text: "I'll be back.", end: true }
            ]}
        ], { special: 'cardGame' });
        
        this.addNPC(155, 92, NPC_TYPES.PIRATE, 'Scurvy Pete', [
            { text: "Arr, watch where ye step! The captain don't like strangers.", choices: [
                { text: "I mean no trouble.", end: true },
                { text: "Try and stop me!", action: 'startCombat' }
            ]}
        ], { canTurnHostile: true });
        
        this.addNPC(145, 95, NPC_TYPES.BARTENDER, 'One-Eyed Jack', [
            { text: "Welcome to the Salty Dog Tavern! Best rum in all the seven seas!", choices: [
                { text: "I'd like to gamble. [Poker]", action: 'openGambling', gamblingType: 'tavern' },
                { text: "Just a drink.", next: 1 }
            ]},
            { text: "5 gold for our finest rum! Restores some health too!", choices: [
                { text: "I'll take it. [5 gold]", action: 'buyDrink', cost: 5 },
                { text: "No thanks.", end: true }
            ]}
        ], { gambling: true });
        
        // Western Town NPCs
        this.addNPC(78, 42, NPC_TYPES.SHERIFF, 'Sheriff John', [
            { text: "Howdy, stranger. You look like someone who can handle themselves.", choices: [
                { text: "I'm looking for work.", next: 1 },
                { text: "Just passing through.", end: true }
            ]},
            { text: "Well, I've got a bounty that needs collecting. Three outlaws been terrorizing the area. 200 gold reward.", action: 'startBountyQuest', choices: [
                { text: "I'll bring them in.", next: 2 },
                { text: "Maybe later.", end: true }
            ]},
            { text: "Good. They're hiding in the canyons to the east. Watch yourself - they're mean cusses.", end: true }
        ], { questGiver: true });
        
        this.addNPC(82, 38, NPC_TYPES.COWBOY, 'Dusty Dan', [
            { text: "Howdy partner! This here's the finest saloon in the West!", choices: [
                { text: "Deal me in! [Poker]", action: 'openGambling', gamblingType: 'saloon' },
                { text: "Know anything about the dragon?", next: 1 }
            ]},
            { text: "Dragon? Up in them mountains? Old legend says it's been there for centuries. Sheriff knows more - he's been up that way.", action: 'giveClue', clueId: 'clue3', choices: [
                { text: "Thanks for the tip.", end: true }
            ]}
        ]);
        
        this.addNPC(75, 45, NPC_TYPES.MERCHANT, 'Western Trader', [
            { text: "Got guns, ammo, and supplies! What'll it be?", choices: [
                { text: "Show me what you got. [Shop]", action: 'openShop', shopType: 'western' },
                { text: "Nothing right now.", end: true }
            ]}
        ], { shop: 'western' });
        
        // Bandits for bounty quest
        this.addNPC(90, 35, NPC_TYPES.BANDIT, 'Outlaw Bill', null, { hostile: true, level: 6, bountyTarget: true });
        this.addNPC(93, 38, NPC_TYPES.BANDIT, 'Crazy Pete', null, { hostile: true, level: 5, bountyTarget: true });
        this.addNPC(88, 32, NPC_TYPES.BANDIT, 'Snake Eye Sam', null, { hostile: true, level: 7, bountyTarget: true });
        
        // Medieval Castle NPCs
        this.addNPC(28, 48, NPC_TYPES.ROYAL_GUARD, 'Sir Galahad', [
            { text: "Halt! State your business at Castle Ironhold.", choices: [
                { text: "I seek audience with the king.", next: 1 },
                { text: "I'm hunting a dragon.", next: 2 }
            ]},
            { text: "The king sees no one. But... *whispers* the old tower holds secrets. A ghost dwells there.", choices: [
                { text: "A ghost?", next: 3 },
                { text: "Thank you.", end: true }
            ]},
            { text: "A dragon slayer? Then you'll need the castle's blessing. Speak to the ghost in the tower first.", choices: [
                { text: "Where is this tower?", next: 3 }
            ]},
            { text: "Northwest tower, but beware - the ghost only speaks to those pure of heart. You'll need the Castle Key from the blacksmith.", action: 'startGhostQuest', choices: [
                { text: "I'll find this ghost.", end: true }
            ]}
        ]);
        
        this.addNPC(25, 45, NPC_TYPES.GHOST, 'The Spirit of King Aldric', [
            { text: "*ethereal voice* Who disturbs my eternal rest...?", choices: [
                { text: "I seek knowledge of the dragon.", next: 1 },
                { text: "Forgive me, I'll leave.", end: true }
            ]},
            { text: "The dragon... I fought it once, long ago. I nearly won... but for its cunning.", choices: [
                { text: "What is its weakness?", next: 2 }
            ]},
            { text: "Fire cannot harm it, but cold... cold slows its black heart. And when it breathes flame, its chest is exposed.", action: 'giveClue', clueId: 'clue4', choices: [
                { text: "Thank you, noble spirit.", next: 3 }
            ]},
            { text: "Avenge me, knight. End the beast that took my life. Take this blessing...", action: 'giveBlessing', choices: [
                { text: "I will honor your memory.", end: true }
            ]}
        ], { questTarget: 'ghost_mystery' });
        
        this.addNPC(32, 52, NPC_TYPES.KNIGHT, 'Sir Roderick', [
            { text: "Well met, fellow knight! I've heard of your quest.", choices: [
                { text: "Will you join me?", next: 1 },
                { text: "What do you know?", next: 2 }
            ]},
            { text: "Join you? Against the dragon? *pauses* ...Yes. Someone must end this menace. I'll follow your lead.", action: 'recruitAlly', allyType: 'knight', choices: [
                { text: "Welcome, Sir Roderick.", end: true }
            ]},
            { text: "The dragon has plagued these lands for generations. The king himself fell trying to slay it.", choices: [
                { text: "Will you join me?", next: 1 }
            ]}
        ], { canRecruit: true });
        
        // Mystic Swamp NPCs
        this.addNPC(122, 105, NPC_TYPES.WIZARD, 'The Swamp Witch', [
            { text: "*cackles* A visitor! How delightful... and foolish.", choices: [
                { text: "I seek the dragon's lair.", next: 1 },
                { text: "I mean you no harm.", next: 2 }
            ]},
            { text: "Ohoho! The dragon? I know much, yes... but knowledge has a price.", choices: [
                { text: "What do you want?", next: 3 }
            ]},
            { text: "No harm? We shall see... What brings you to my swamp?", choices: [
                { text: "I seek the dragon's lair.", next: 1 }
            ]},
            { text: "Bring me the Mystic Amulet from the castle ghost. Then I'll tell you what I know.", action: 'startWitchQuest', choices: [
                { text: "I'll find this amulet.", end: true },
                { text: "I already have it!", next: 4, condition: 'hasMysticAmulet' }
            ]},
            { text: "*eyes widen* Impressive! Very well... The dragon sleeps through the day. Strike at noon, when its guard is lowest.", action: 'giveClue', clueId: 'clue5', choices: [
                { text: "Thank you, witch.", end: true }
            ]}
        ], { clueGiver: true });
        
        this.addNPC(118, 102, NPC_TYPES.MONSTER, 'Swamp Beast', null, { hostile: true, level: 8 });
        this.addNPC(125, 108, NPC_TYPES.MONSTER, 'Giant Serpent', null, { hostile: true, level: 9 });
        
        // Mountain Pass NPCs
        this.addNPC(105, 18, NPC_TYPES.MYSTERIOUS_STRANGER, 'The Guide', [
            { text: "Few make it this far. The mountain pass is treacherous.", choices: [
                { text: "I seek the dragon's lair.", next: 1 },
                { text: "What lies ahead?", next: 2 }
            ]},
            { text: "Have you gathered the clues? The dragon's lair can only be found by those who know the path.", choices: [
                { text: "I have all the clues.", next: 3, condition: 'hasAllClues' },
                { text: "Not yet.", next: 4 }
            ]},
            { text: "Death and glory await. The dragon guards treasure beyond imagination... but many have died trying.", choices: [
                { text: "I will not fail.", next: 1 }
            ]},
            { text: "Then you are ready. The lair lies to the northeast, through the fire mountains. May fortune favor you.", action: 'giveClue', clueId: 'clue6', unlockPath: true, choices: [
                { text: "Thank you, stranger.", end: true }
            ]},
            { text: "Then return when you are prepared. The clues are scattered across the lands - the village, the pirates, the west, the castle, the swamp.", end: true }
        ], { clueGiver: true });
        
        // Additional Village NPCs
        this.addNPC(55, 70, NPC_TYPES.VILLAGER, 'Worried Farmer', [
            { text: "My farm to the east is overrun by wolves! Please, brave knight, help me!", choices: [
                { text: "I'll clear out the wolves.", action: 'startWolfQuest', next: 1 },
                { text: "I'm busy with other matters.", end: true }
            ]},
            { text: "Thank you! There should be about 5 of them. Return to me when they're dealt with.", end: true }
        ], { questGiver: true });
        
        // Add more wolves for the quest
        for (let i = 0; i < 5; i++) {
            this.addNPC(65 + Math.floor(seededRandom() * 10), 70 + Math.floor(seededRandom() * 8), 
                NPC_TYPES.BEAST, 'Farm Wolf', null, { hostile: true, level: 2, farmWolf: true });
        }
        
        // Tavern in village
        this.addNPC(47, 77, NPC_TYPES.BARTENDER, 'Village Barkeep', [
            { text: "Welcome to the Golden Mug! Best ale in the realm!", choices: [
                { text: "I'd like to gamble. [Dice Game]", action: 'openGambling', gamblingType: 'tavern' },
                { text: "Any rumors worth hearing?", next: 1 },
                { text: "Just passing through.", end: true }
            ]},
            { text: "Well... *leans in* They say the old wizard in the forest knows where treasures are hidden. And the pirates? Their captain has a map to something big.", choices: [
                { text: "Interesting. Thanks.", end: true }
            ]}
        ], { gambling: true });
        
        // Forest additional NPCs
        this.addNPC(92, 82, NPC_TYPES.MYSTERIOUS_STRANGER, 'Hooded Figure', [
            { text: "*speaks in whispers* I know things... secrets... for the right price.", choices: [
                { text: "What kind of secrets?", next: 1 },
                { text: "I don't trust you.", end: true }
            ]},
            { text: "The dragon's lair... the treasure... 100 gold and I'll tell you something valuable.", choices: [
                { text: "Here's 100 gold. [Pay]", action: 'paySecret', cost: 100, next: 2 },
                { text: "Too rich for my blood.", end: true }
            ]},
            { text: "The dragon sleeps from noon to dusk. Strike then, and you'll catch it off guard. Also... check the old well near the castle. Something valuable lies within.", end: true }
        ]);
        
        this.addNPC(115, 68, NPC_TYPES.KNIGHT, 'Wounded Knight', [
            { text: "*coughs* Traveler... I was ambushed by bandits... they took my family heirloom sword.", choices: [
                { text: "Where did they go?", next: 1 },
                { text: "I'll help you.", next: 1 }
            ]},
            { text: "West... towards the canyons. Please... if you find it... bring it back. The sword has a ruby in the hilt.", action: 'startHeirloomQuest', choices: [
                { text: "I'll find it.", end: true }
            ]}
        ], { questGiver: true });
        
        // More Forest enemies
        this.addNPC(102, 85, NPC_TYPES.MONSTER, 'Giant Spider', null, { hostile: true, level: 4 });
        this.addNPC(108, 68, NPC_TYPES.BEAST, 'Dire Wolf', null, { hostile: true, level: 5 });
        
        // Pirates - more crew members
        this.addNPC(152, 85, NPC_TYPES.PIRATE, 'First Mate Morgan', [
            { text: "Arr! The cap'n's in a mood. Best not disturb him unless ye got business.", choices: [
                { text: "I'm here to play cards.", next: 1 },
                { text: "I seek information.", next: 2 }
            ]},
            { text: "Cards, eh? The cap'n loves a good game. Just don't cheat - he'll keelhaul ye!", end: true },
            { text: "Information costs gold on these docks, landlubber. What do ye want to know?", choices: [
                { text: "About the dragon. [50 gold]", action: 'pirateInfo', cost: 50 },
                { text: "Never mind.", end: true }
            ]}
        ]);
        
        this.addNPC(158, 95, NPC_TYPES.MERCHANT, 'Smuggler', [
            { text: "*looks around nervously* Psst! Looking for... special merchandise?", choices: [
                { text: "What do you have? [Shop]", action: 'openShop', shopType: 'smuggler' },
                { text: "Not interested.", end: true }
            ]}
        ], { shop: 'smuggler' });
        
        // Add sea monsters near pirate cove
        this.addNPC(160, 98, NPC_TYPES.MONSTER, 'Sea Serpent', null, { hostile: true, level: 7 });
        this.addNPC(140, 95, NPC_TYPES.MONSTER, 'Giant Crab', null, { hostile: true, level: 5 });
        
        // Western Town - more content
        this.addNPC(85, 35, NPC_TYPES.COWBOY, 'Prospector Pete', [
            { text: "I struck gold once, I tell ya! But then bandits took it all...", choices: [
                { text: "Where was this gold mine?", next: 1 },
                { text: "Tough luck, old timer.", end: true }
            ]},
            { text: "Up in the mountains, northwest of here. If ye can clear out the bandits, I'll split the gold with ye!", action: 'startMineQuest', choices: [
                { text: "Tell me more about these bandits.", next: 2 }
            ]},
            { text: "There's about 4 of 'em, led by a mean varmint named 'Rattlesnake' Rogers. They camp near the mine entrance.", end: true }
        ], { questGiver: true });
        
        // Add mine bandits
        this.addNPC(70, 30, NPC_TYPES.BANDIT, 'Rattlesnake Rogers', null, { hostile: true, level: 8, mineBoss: true });
        this.addNPC(68, 32, NPC_TYPES.BANDIT, 'Mine Bandit', null, { hostile: true, level: 5, mineBandit: true });
        this.addNPC(72, 28, NPC_TYPES.BANDIT, 'Mine Bandit', null, { hostile: true, level: 5, mineBandit: true });
        this.addNPC(74, 30, NPC_TYPES.BANDIT, 'Mine Bandit', null, { hostile: true, level: 6, mineBandit: true });
        
        this.addNPC(78, 48, NPC_TYPES.INNKEEPER, 'Western Innkeeper', [
            { text: "Howdy! The Dusty Trail Inn welcomes all travelers. Need a room?", choices: [
                { text: "Rest and restore health. [25 gold]", action: 'rest', cost: 25 },
                { text: "Any work available?", next: 1 },
                { text: "No thanks.", end: true }
            ]},
            { text: "The Sheriff's always got bounties. And old Prospector Pete's been looking for someone brave. Oh, and watch out for the canyon - rattlesnakes there'll kill ya dead.", end: true }
        ]);
        
        // Castle - more content
        this.addNPC(35, 48, NPC_TYPES.MERCHANT, 'Royal Armorer', [
            { text: "The finest armor in the kingdom! Fit for knights and kings!", choices: [
                { text: "Show me your wares. [Shop]", action: 'openShop', shopType: 'royal' },
                { text: "Maybe later.", end: true }
            ]}
        ], { shop: 'royal' });
        
        this.addNPC(22, 52, NPC_TYPES.VILLAGER, 'Castle Servant', [
            { text: "*whispers* The king hasn't been the same since the dragon took his son...", choices: [
                { text: "The dragon kidnapped the prince?", next: 1 },
                { text: "That's sad.", end: true }
            ]},
            { text: "Years ago, yes. They say the prince is still alive, trapped in the dragon's lair. If someone could save him...", choices: [
                { text: "I'll rescue the prince!", action: 'startPrinceQuest' },
                { text: "That sounds dangerous.", end: true }
            ]}
        ], { questGiver: true });
        
        // More castle guards
        this.addNPC(30, 55, NPC_TYPES.ROYAL_GUARD, 'Tower Guard', [
            { text: "The old tower is haunted. Only the brave or foolish enter.", choices: [
                { text: "I fear no ghost.", next: 1 },
                { text: "Thanks for the warning.", end: true }
            ]},
            { text: "Then seek the Ghost King there. He knows secrets of the dragon... things that could save your life.", end: true }
        ]);
        
        // Swamp - more content
        this.addNPC(130, 98, NPC_TYPES.VILLAGER, 'Lost Traveler', [
            { text: "Thank the gods! I've been lost in this swamp for days! Can you help me find my way out?", choices: [
                { text: "Follow me to safety.", action: 'escortTraveler', next: 1 },
                { text: "Sorry, I'm busy.", end: true }
            ]},
            { text: "Thank you! I was heading to the village. Lead the way!", action: 'startEscortQuest', end: true }
        ], { questGiver: true });
        
        this.addNPC(115, 108, NPC_TYPES.WIZARD, 'Hermit Alchemist', [
            { text: "Ah, a visitor to my humble abode! Seeking potions? Knowledge?", choices: [
                { text: "Sell me potions. [Shop]", action: 'openShop', shopType: 'alchemist' },
                { text: "What can you tell me about the dragon?", next: 1 }
            ]},
            { text: "The dragon Infernus? Ancient and terrible! But... I've created something. A fire resistance elixir!", choices: [
                { text: "Can I have some?", next: 2 },
                { text: "Interesting.", end: true }
            ]},
            { text: "For you? 200 gold. It will halve the dragon's fire damage - could save your life!", choices: [
                { text: "I'll take it! [200 gold]", action: 'buyFireResist', cost: 200 },
                { text: "Too expensive.", end: true }
            ]}
        ], { shop: 'alchemist' });
        
        // More swamp enemies
        this.addNPC(128, 102, NPC_TYPES.MONSTER, 'Swamp Troll', null, { hostile: true, level: 8 });
        this.addNPC(120, 112, NPC_TYPES.BEAST, 'Giant Crocodile', null, { hostile: true, level: 7 });
        this.addNPC(132, 105, NPC_TYPES.MONSTER, 'Bog Wraith', null, { hostile: true, level: 9 });
        
        // Mountain Pass - more content
        this.addNPC(95, 22, NPC_TYPES.COWBOY, 'Mountain Hermit', [
            { text: "You seek the dragon? Few who climb this far ever return.", choices: [
                { text: "I'm prepared.", next: 1 },
                { text: "What dangers lie ahead?", next: 2 }
            ]},
            { text: "Prepared? We shall see. The path ahead is treacherous. Ice elementals guard the peaks.", choices: [
                { text: "I'll face them.", end: true }
            ]},
            { text: "Ice creatures, mountain beasts, and the dragon's fire minions guard the approach. You'll need fire resistance for the dragon itself.", choices: [
                { text: "Thank you for the warning.", end: true }
            ]}
        ]);
        
        // Mountain enemies
        this.addNPC(98, 15, NPC_TYPES.MONSTER, 'Ice Elemental', null, { hostile: true, level: 10 });
        this.addNPC(105, 18, NPC_TYPES.MONSTER, 'Mountain Giant', null, { hostile: true, level: 11 });
        this.addNPC(110, 12, NPC_TYPES.BEAST, 'Snow Wolf Pack', null, { hostile: true, level: 9 });
        
        // Pre-dragon minions
        this.addNPC(165, 18, NPC_TYPES.MONSTER, 'Fire Imp', null, { hostile: true, level: 12 });
        this.addNPC(170, 15, NPC_TYPES.MONSTER, 'Fire Imp', null, { hostile: true, level: 12 });
        this.addNPC(168, 10, NPC_TYPES.MONSTER, 'Flame Guardian', null, { hostile: true, level: 15 });
        this.addNPC(175, 8, NPC_TYPES.MONSTER, 'Dragon Wyrmling', null, { hostile: true, level: 14 });
        
        // Dragon's Lair
        this.addNPC(180, 12, NPC_TYPES.DRAGON, 'Infernus the Ancient', [
            { text: "*ROARS* A mortal dares enter my domain?! You will burn like all the others!", choices: [
                { text: "I've come for your treasure, beast!", next: 1 },
                { text: "Prepare to die, dragon!", action: 'startDragonFight' }
            ]},
            { text: "*laughs, flames licking from nostrils* My treasure? Countless fools have tried. Their bones decorate my lair.", choices: [
                { text: "I am no ordinary fool!", action: 'startDragonFight' },
                { text: "Perhaps we can make a deal?", next: 2 }
            ]},
            { text: "*pauses* A deal? *considers* Interesting... No mortal has ever offered. But no - I am DRAGON! I do not bargain!", action: 'startDragonFight' }
        ], { boss: true, level: 20 });
    }
    
    addNPC(tileX, tileY, type, name, dialogue, extra = {}) {
        const npc = {
            x: tileX * TILE_SIZE + TILE_SIZE / 2,
            y: tileY * TILE_SIZE + TILE_SIZE / 2,
            type,
            name,
            dialogue,
            ...extra,
            alive: true,
            hostile: extra.hostile !== undefined ? extra.hostile : type.hostile,
            health: (extra.level || 1) * 20 + 30,
            maxHealth: (extra.level || 1) * 20 + 30,
            attack: (extra.level || 1) * 3 + 5,
            defense: (extra.level || 1) * 2,
            level: extra.level || 1
        };
        
        // Dynamic hostility based on reputation
        if (type.hostile === 'variable') {
            npc.hostile = false;
        }
        
        this.npcs.push(npc);
    }
    
    generateDecorations() {
        const decorTypes = ['🌲', '🌳', '🌴', '🌵', '🪨', '💀', '⛺', '🏠', '🏰', '🏚️', '⛪', '🗿'];
        
        // Forest decorations
        for (let i = 0; i < 50; i++) {
            const x = 85 + Math.random() * 40;
            const y = 65 + Math.random() * 25;
            this.decorations.push({
                x: x * TILE_SIZE,
                y: y * TILE_SIZE,
                sprite: Math.random() < 0.7 ? '🌲' : '🌳'
            });
        }
        
        // Desert/Western decorations
        for (let i = 0; i < 20; i++) {
            const x = 70 + Math.random() * 25;
            const y = 35 + Math.random() * 15;
            this.decorations.push({
                x: x * TILE_SIZE,
                y: y * TILE_SIZE,
                sprite: Math.random() < 0.5 ? '🌵' : '🪨'
            });
        }
        
        // Village buildings
        this.decorations.push({ x: 48 * TILE_SIZE, y: 72 * TILE_SIZE, sprite: '🏠' });
        this.decorations.push({ x: 52 * TILE_SIZE, y: 75 * TILE_SIZE, sprite: '⚒️' });
        this.decorations.push({ x: 53 * TILE_SIZE, y: 71 * TILE_SIZE, sprite: '🏨' });
        
        // Castle
        this.decorations.push({ x: 28 * TILE_SIZE, y: 47 * TILE_SIZE, sprite: '🏰' });
        this.decorations.push({ x: 25 * TILE_SIZE, y: 44 * TILE_SIZE, sprite: '🗼' });
        
        // Pirate cove
        this.decorations.push({ x: 150 * TILE_SIZE, y: 90 * TILE_SIZE, sprite: '🚢' });
        this.decorations.push({ x: 145 * TILE_SIZE, y: 94 * TILE_SIZE, sprite: '🍺' });
        
        // Western town
        this.decorations.push({ x: 80 * TILE_SIZE, y: 40 * TILE_SIZE, sprite: '🤠' });
        
        // Swamp
        for (let i = 0; i < 15; i++) {
            const x = 115 + Math.random() * 15;
            const y = 98 + Math.random() * 15;
            this.decorations.push({
                x: x * TILE_SIZE,
                y: y * TILE_SIZE,
                sprite: '🌿'
            });
        }
        
        // Dragon lair
        this.decorations.push({ x: 178 * TILE_SIZE, y: 10 * TILE_SIZE, sprite: '🔥' });
        this.decorations.push({ x: 182 * TILE_SIZE, y: 14 * TILE_SIZE, sprite: '💀' });
        this.decorations.push({ x: 175 * TILE_SIZE, y: 8 * TILE_SIZE, sprite: '🦴' });
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
        
        // Click-and-hold for continuous movement
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.navigationState.mouseDown = true;
                const rect = this.canvas.getBoundingClientRect();
                this.navigationState.mouseX = e.clientX - rect.left;
                this.navigationState.mouseY = e.clientY - rect.top;
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.navigationState.mouseDown = false;
            }
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.navigationState.mouseDown = false;
            this.navigationState.showPathPreview = false;
        });
        
        // Path preview on hover
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.navigationState.mouseX = e.clientX - rect.left;
            this.navigationState.mouseY = e.clientY - rect.top;
            
            // Check NPC hover for visual feedback - INCREASED hitbox to 64 pixels for easier interaction
            const mouseWorldX = this.navigationState.mouseX + this.camera.x;
            const mouseWorldY = this.navigationState.mouseY + this.camera.y;
            this.hoveredNPC = null;
            const NPC_INTERACTION_RADIUS = 64; // Increased from TILE_SIZE (48) for better UX
            for (const npc of this.npcs) {
                if (!npc.alive) continue;
                const dist = Math.hypot(mouseWorldX - npc.x, mouseWorldY - npc.y);
                if (dist < NPC_INTERACTION_RADIUS) {
                    this.hoveredNPC = npc;
                    this.canvas.style.cursor = 'pointer';
                    break;
                }
            }
            if (!this.hoveredNPC) {
                this.canvas.style.cursor = 'crosshair';
            }
            
            // Update path preview
            if (!this.inCombat && !this.currentDialogue) {
                this.updatePathPreview(e);
            }
        });
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Minimap click-to-move
        this.minimapCanvas.addEventListener('click', (e) => this.handleMinimapClick(e));
    }
    
    handleKeyDown(e) {
        // WASD movement
        const key = e.key.toLowerCase();
        if (key === 'w' || key === 'arrowup') {
            this.navigationState.wasdMovement.w = true;
            e.preventDefault();
        }
        if (key === 'a' || key === 'arrowleft') {
            this.navigationState.wasdMovement.a = true;
            e.preventDefault();
        }
        if (key === 's' || key === 'arrowdown') {
            this.navigationState.wasdMovement.s = true;
            e.preventDefault();
        }
        if (key === 'd' || key === 'arrowright') {
            this.navigationState.wasdMovement.d = true;
            e.preventDefault();
        }
        
        // Other key actions
        this.handleKeyPress(e);
    }
    
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        if (key === 'w' || key === 'arrowup') this.navigationState.wasdMovement.w = false;
        if (key === 'a' || key === 'arrowleft') this.navigationState.wasdMovement.a = false;
        if (key === 's' || key === 'arrowdown') this.navigationState.wasdMovement.s = false;
        if (key === 'd' || key === 'arrowright') this.navigationState.wasdMovement.d = false;
    }
    
    handleDoubleClick(e) {
        if (this.inCombat || this.currentDialogue) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.camera.x;
        const clickY = e.clientY - rect.top + this.camera.y;
        
        // INCREASED detection radius from TILE_SIZE * 1.5 (72) to 80 pixels for easier NPC targeting
        const NPC_DOUBLE_CLICK_RADIUS = 80;
        
        // Check for distant NPCs to auto-approach and interact
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const dist = Math.hypot(clickX - npc.x, clickY - npc.y);
            if (dist < NPC_DOUBLE_CLICK_RADIUS) {
                // Set target to move to NPC and interact
                const path = this.findPath(
                    Math.floor(this.player.x / TILE_SIZE),
                    Math.floor(this.player.y / TILE_SIZE),
                    Math.floor(npc.x / TILE_SIZE),
                    Math.floor(npc.y / TILE_SIZE)
                );
                if (path.length > 0) {
                    this.navigationState.path = path;
                    this.navigationState.pathIndex = 0;
                    this.player.interactTarget = npc;
                    this.navigationState.isMoving = true;
                }
                return;
            }
        }
    }
    
    updatePathPreview(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.camera.x;
        const clickY = e.clientY - rect.top + this.camera.y;
        const tileX = Math.floor(clickX / TILE_SIZE);
        const tileY = Math.floor(clickY / TILE_SIZE);
        
        if (this.isWalkable(tileX, tileY)) {
            this.navigationState.showPathPreview = true;
            this.navigationState.previewPath = this.findPath(
                Math.floor(this.player.x / TILE_SIZE),
                Math.floor(this.player.y / TILE_SIZE),
                tileX,
                tileY
            );
        } else {
            this.navigationState.showPathPreview = false;
            this.navigationState.previewPath = [];
        }
    }
    
    handleMinimapClick(e) {
        if (this.inCombat || this.currentDialogue) return;
        
        const rect = this.minimapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Convert minimap coordinates to world coordinates
        const worldX = Math.floor((clickX / 150) * this.world.width);
        const worldY = Math.floor((clickY / 150) * this.world.height);
        
        if (this.isWalkable(worldX, worldY)) {
            const path = this.findPath(
                Math.floor(this.player.x / TILE_SIZE),
                Math.floor(this.player.y / TILE_SIZE),
                worldX,
                worldY
            );
            
            if (path.length > 0) {
                this.navigationState.path = path;
                this.navigationState.pathIndex = 0;
                this.navigationState.isMoving = true;
                this.player.interactTarget = null;
                this.notify(`Moving to (${worldX}, ${worldY})`);
            }
        }
    }
    
    handleClick(e) {
        if (this.inCombat || this.currentDialogue) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.camera.x;
        const clickY = e.clientY - rect.top + this.camera.y;
        
        // Add click ripple effect
        this.particles.addClickRipple(clickX, clickY);
        
        // INCREASED NPC click detection radius from TILE_SIZE (48) to 64 pixels for easier interaction
        const NPC_CLICK_RADIUS = 64;
        
        // Check if clicking on NPC
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const dist = Math.hypot(clickX - npc.x, clickY - npc.y);
            if (dist < NPC_CLICK_RADIUS) {
                const playerDist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
                if (playerDist < TILE_SIZE * 3) {
                    this.interactWithNPC(npc);
                    return;
                } else {
                    // Use pathfinding to move towards NPC
                    const npcTileX = Math.floor(npc.x / TILE_SIZE);
                    const npcTileY = Math.floor(npc.y / TILE_SIZE);
                    const path = this.findPath(
                        Math.floor(this.player.x / TILE_SIZE),
                        Math.floor(this.player.y / TILE_SIZE),
                        npcTileX,
                        npcTileY - 1
                    );
                    if (path.length > 0) {
                        this.navigationState.path = path;
                        this.navigationState.pathIndex = 0;
                        this.navigationState.isMoving = true;
                    }
                    this.player.interactTarget = npc;
                    return;
                }
            }
        }
        
        // Point and click movement with pathfinding
        const tileX = Math.floor(clickX / TILE_SIZE);
        const tileY = Math.floor(clickY / TILE_SIZE);
        
        if (this.isWalkable(tileX, tileY)) {
            const path = this.findPath(
                Math.floor(this.player.x / TILE_SIZE),
                Math.floor(this.player.y / TILE_SIZE),
                tileX,
                tileY
            );
            
            if (path.length > 0) {
                this.navigationState.path = path;
                this.navigationState.pathIndex = 0;
                this.navigationState.isMoving = true;
            } else {
                // Fallback to direct movement if path not found
                this.player.targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
                this.player.targetY = tileY * TILE_SIZE + TILE_SIZE / 2;
            }
            this.player.interactTarget = null;
        }
    }
    
    // A* Pathfinding implementation
    findPath(startX, startY, endX, endY) {
        if (!this.isWalkable(endX, endY)) {
            // Find nearest walkable tile
            const alternatives = [
                {x: endX, y: endY - 1}, {x: endX, y: endY + 1},
                {x: endX - 1, y: endY}, {x: endX + 1, y: endY},
                {x: endX - 1, y: endY - 1}, {x: endX + 1, y: endY - 1},
                {x: endX - 1, y: endY + 1}, {x: endX + 1, y: endY + 1}
            ];
            for (const alt of alternatives) {
                if (this.isWalkable(alt.x, alt.y)) {
                    endX = alt.x;
                    endY = alt.y;
                    break;
                }
            }
        }
        
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const startKey = `${startX},${startY}`;
        const endKey = `${endX},${endY}`;
        
        openSet.push({ x: startX, y: startY });
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, endX, endY));
        
        const maxIterations = 1000;
        let iterations = 0;
        
        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // Get node with lowest fScore
            openSet.sort((a, b) => {
                const fA = fScore.get(`${a.x},${a.y}`) || Infinity;
                const fB = fScore.get(`${b.x},${b.y}`) || Infinity;
                return fA - fB;
            });
            
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;
            
            if (current.x === endX && current.y === endY) {
                // Reconstruct path
                return this.reconstructPath(cameFrom, current);
            }
            
            closedSet.add(currentKey);
            
            // Check neighbors (8-directional)
            const neighbors = [
                {x: current.x, y: current.y - 1},
                {x: current.x, y: current.y + 1},
                {x: current.x - 1, y: current.y},
                {x: current.x + 1, y: current.y},
                {x: current.x - 1, y: current.y - 1},
                {x: current.x + 1, y: current.y - 1},
                {x: current.x - 1, y: current.y + 1},
                {x: current.x + 1, y: current.y + 1}
            ];
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                if (closedSet.has(neighborKey)) continue;
                if (!this.isWalkable(neighbor.x, neighbor.y)) continue;
                
                // Diagonal movement check - don't cut corners
                if (neighbor.x !== current.x && neighbor.y !== current.y) {
                    if (!this.isWalkable(current.x, neighbor.y) || 
                        !this.isWalkable(neighbor.x, current.y)) {
                        continue;
                    }
                }
                
                const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;
                const moveCost = isDiagonal ? 1.414 : 1;
                const tentativeG = (gScore.get(currentKey) || 0) + moveCost;
                
                const existingG = gScore.get(neighborKey);
                if (existingG === undefined || tentativeG < existingG) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor.x, neighbor.y, endX, endY));
                    
                    if (!openSet.find(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        
        return []; // No path found
    }
    
    heuristic(x1, y1, x2, y2) {
        // Diagonal distance heuristic
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return dx + dy + (1.414 - 2) * Math.min(dx, dy);
    }
    
    reconstructPath(cameFrom, current) {
        const path = [{ x: current.x, y: current.y }];
        let currentKey = `${current.x},${current.y}`;
        
        while (cameFrom.has(currentKey)) {
            const prev = cameFrom.get(currentKey);
            path.unshift({ x: prev.x, y: prev.y });
            currentKey = `${prev.x},${prev.y}`;
        }
        
        return path;
    }
    
    handleRightClick(e) {
        // Right click to cancel movement
        this.navigationState.path = [];
        this.navigationState.pathIndex = 0;
        this.navigationState.isMoving = false;
        this.player.targetX = this.player.x;
        this.player.targetY = this.player.y;
        this.player.velocityX = 0;
        this.player.velocityY = 0;
        this.player.interactTarget = null;
        
        if (this.currentDialogue) {
            this.closeDialogue();
        }
    }
    
    handleKeyPress(e) {
        switch(e.key.toLowerCase()) {
            case 'i':
                this.toggleInventory();
                break;
            case 'q':
                this.toggleQuestLog();
                break;
            case 'e':
                // E key to interact with nearby NPCs
                if (!this.inCombat && !this.currentDialogue) {
                    this.interactWithNearbyNPC();
                }
                break;
            case 's':
                // S key for statistics (only when not in movement)
                if (!this.inCombat && !this.currentDialogue && !this.navigationState.wasdMovement.s) {
                    e.preventDefault();
                }
                break;
            case 't':
                // T key for fast travel
                if (!this.inCombat && !this.currentDialogue) {
                    this.toggleFastTravel();
                }
                break;
            case 'escape':
                this.closeAllPanels();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
                this.useHotbarItem(parseInt(e.key) - 1);
                break;
        }
    }
    
    isWalkable(tileX, tileY) {
        if (tileX < 0 || tileX >= this.world.width || tileY < 0 || tileY >= this.world.height) {
            return false;
        }
        return WALKABLE.includes(this.world.map[tileY][tileX]);
    }
    
    interactWithNPC(npc) {
        if (npc.hostile) {
            this.combat.start(npc);
        } else if (npc.dialogue) {
            this.startDialogue(npc);
        }
    }
    
    interactWithNearbyNPC() {
        // Find the nearest NPC within interaction range
        let nearestNPC = null;
        let nearestDist = Infinity;
        const INTERACT_RANGE = TILE_SIZE * 2;
        
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
            if (dist < INTERACT_RANGE && dist < nearestDist) {
                nearestDist = dist;
                nearestNPC = npc;
            }
        }
        
        if (nearestNPC) {
            this.interactWithNPC(nearestNPC);
        }
    }
    
    startDialogue(npc) {
        if (!npc.dialogue || npc.dialogue.length === 0) return;
        
        this.currentDialogue = {
            npc,
            currentIndex: 0
        };
        
        this.showDialogue(npc.dialogue[0], npc.name);
    }
    
    showDialogue(dialogueNode, speakerName) {
        const box = document.getElementById('dialogue-box');
        const speaker = document.getElementById('dialogue-speaker');
        const text = document.getElementById('dialogue-text');
        const choices = document.getElementById('dialogue-choices');
        
        speaker.textContent = speakerName;
        text.textContent = dialogueNode.text;
        choices.innerHTML = '';
        
        if (dialogueNode.choices) {
            dialogueNode.choices.forEach((choice, idx) => {
                // Check conditions
                if (choice.condition) {
                    if (!this.checkCondition(choice.condition)) return;
                }
                
                const btn = document.createElement('button');
                btn.className = 'dialogue-choice';
                btn.textContent = choice.text;
                btn.addEventListener('click', () => this.selectDialogueChoice(choice, idx));
                choices.appendChild(btn);
            });
        }
        
        if (dialogueNode.end || !dialogueNode.choices || choices.children.length === 0) {
            const btn = document.createElement('button');
            btn.className = 'dialogue-choice';
            btn.textContent = '[Continue]';
            btn.addEventListener('click', () => this.closeDialogue());
            choices.appendChild(btn);
        }
        
        box.style.display = 'block';
    }
    
    selectDialogueChoice(choice, idx) {
        // Execute action if present
        if (choice.action) {
            this.executeDialogueAction(choice);
        }
        
        // Move to next dialogue node
        if (choice.next !== undefined && this.currentDialogue) {
            const nextNode = this.currentDialogue.npc.dialogue[choice.next];
            if (nextNode) {
                this.showDialogue(nextNode, this.currentDialogue.npc.name);
                return;
            }
        }
        
        if (choice.end) {
            this.closeDialogue();
        }
    }
    
    executeDialogueAction(choice) {
        switch(choice.action) {
            case 'startMainQuest':
                this.quests.MAIN_QUEST.stages[0].completed = true;
                this.notify('Quest Started: The Dragon\'s Gold');
                break;
            case 'openShop':
                this.openShop(choice.shopType);
                this.closeDialogue();
                break;
            case 'openGambling':
                this.openGambling(choice.gamblingType);
                this.closeDialogue();
                break;
            case 'giveClue':
                this.giveClue(choice.clueId);
                break;
            case 'startCombat':
                this.closeDialogue();
                this.combat.start(this.currentDialogue.npc);
                break;
            case 'rest':
                if (this.player.gold >= choice.cost) {
                    this.player.gold -= choice.cost;
                    this.player.health = this.player.maxHealth;
                    this.updateHUD();
                    this.notify('Health fully restored!');
                } else {
                    this.notify('Not enough gold!');
                }
                break;
            case 'buyDrink':
                if (this.player.gold >= choice.cost) {
                    this.player.gold -= choice.cost;
                    this.player.health = Math.min(this.player.health + 20, this.player.maxHealth);
                    this.updateHUD();
                    this.notify('+20 Health');
                } else {
                    this.notify('Not enough gold!');
                }
                break;
            case 'recruitAlly':
                this.recruitAlly(choice.allyType, this.currentDialogue.npc);
                break;
            case 'giveBlessing':
                this.player.attack += 5;
                this.player.defense += 5;
                this.notify('Received Ghost King\'s Blessing! +5 Attack, +5 Defense');
                this.gameFlags.hasBlessing = true;
                break;
            case 'startDragonFight':
                this.closeDialogue();
                setTimeout(() => this.combat.start(this.currentDialogue.npc), 100);
                break;
            case 'startBountyQuest':
                this.quests.SHERIFF_BOUNTY.stages[0].completed = true;
                this.notify('Quest Started: Wanted - Dead or Alive');
                break;
            case 'startGhostQuest':
                this.quests.GHOST_MYSTERY.stages[0].completed = true;
                this.notify('Quest Started: The Castle Ghost');
                break;
            case 'startWolfQuest':
                this.quests.WOLF_HUNT.stages[0].completed = true;
                this.notify('Quest Started: Wolf Problem');
                break;
            case 'startHeirloomQuest':
                this.quests.LOST_HEIRLOOM.stages[0].completed = true;
                this.notify('Quest Started: The Lost Heirloom');
                break;
            case 'startMineQuest':
                this.quests.GOLD_MINE.stages[0].completed = true;
                this.notify('Quest Started: Gold Rush');
                break;
            case 'startPrinceQuest':
                this.quests.RESCUE_PRINCE.stages[0].completed = true;
                this.notify('Quest Started: The Lost Prince');
                break;
            case 'startEscortQuest':
                this.quests.ESCORT_MISSION.stages[0].completed = true;
                this.notify('Quest Started: Swamp Rescue');
                break;
            case 'paySecret':
                if (this.player.gold >= choice.cost) {
                    this.player.gold -= choice.cost;
                    this.updateHUD();
                    this.notify('Paid 100 gold for information.');
                } else {
                    this.notify('Not enough gold!');
                }
                break;
            case 'pirateInfo':
                if (this.player.gold >= choice.cost) {
                    this.player.gold -= choice.cost;
                    this.updateHUD();
                    this.notify('The pirate tells you about the mountain pass entrance.');
                }
                break;
            case 'buyFireResist':
                if (this.player.gold >= choice.cost) {
                    this.player.gold -= choice.cost;
                    this.player.inventory.push({ item: ITEMS.FIRE_RESIST_POTION, count: 3 });
                    this.updateHUD();
                    this.notify('Acquired Fire Resistance Potions!');
                    this.gameFlags.hasFireResist = true;
                } else {
                    this.notify('Not enough gold!');
                }
                break;
        }
    }
    
    checkCondition(condition) {
        switch(condition) {
            case 'hasAllClues':
                return this.cluesFound.length >= 5;
            case 'hasMysticAmulet':
                return this.player.inventory.some(i => i.item && i.item.name === 'Mystic Amulet');
            default:
                return this.gameFlags[condition];
        }
    }
    
    closeDialogue() {
        document.getElementById('dialogue-box').style.display = 'none';
        this.currentDialogue = null;
    }
    
    giveClue(clueId) {
        if (this.cluesFound.includes(clueId)) return;
        
        const clue = CLUES.find(c => c.id === clueId);
        if (clue) {
            this.cluesFound.push(clueId);
            this.notify('New Clue Found!');
            
            // Update main quest
            const clueStage = this.quests.MAIN_QUEST.stages[1];
            clueStage.count = this.cluesFound.length;
            if (clueStage.count >= clueStage.required) {
                clueStage.completed = true;
                this.notify('All clues gathered! Seek the mountain pass.');
            }
        }
    }
    
    recruitAlly(allyType, npc) {
        const ally = {
            type: allyType,
            name: npc.name,
            sprite: npc.type.sprite,
            health: 80,
            maxHealth: 80,
            attack: 12,
            defense: 8
        };
        
        this.player.allies.push(ally);
        npc.alive = false; // Remove from world
        this.notify(`${npc.name} has joined your party!`);
        this.updateAllyIndicator();
    }
    
    updateAllyIndicator() {
        const container = document.getElementById('ally-indicator');
        container.innerHTML = '';
        
        this.player.allies.forEach(ally => {
            const portrait = document.createElement('div');
            portrait.className = 'ally-portrait';
            portrait.innerHTML = ally.sprite;
            portrait.title = ally.name;
            container.appendChild(portrait);
        });
    }
    
    openShop(shopType) {
        const shopUI = document.getElementById('shop-ui');
        const shopItems = document.getElementById('shop-items');
        const shopTitle = document.getElementById('shop-title');
        
        let items = [];
        
        switch(shopType) {
            case 'blacksmith':
                shopTitle.textContent = '⚒️ Blacksmith';
                items = [ITEMS.IRON_SWORD, ITEMS.STEEL_SWORD, ITEMS.BATTLE_AXE, ITEMS.CHAINMAIL, ITEMS.PLATE_ARMOR];
                break;
            case 'merchant':
                shopTitle.textContent = '🏪 General Store';
                items = [ITEMS.HEALTH_POTION, ITEMS.LARGE_POTION, ITEMS.STRENGTH_ELIXIR, ITEMS.LEATHER_ARMOR, ITEMS.ANTIDOTE];
                break;
            case 'western':
                shopTitle.textContent = '🤠 Western Trader';
                items = [ITEMS.PISTOL, ITEMS.CROSSBOW, ITEMS.HEALTH_POTION, ITEMS.LARGE_POTION];
                break;
            case 'smuggler':
                shopTitle.textContent = '🏴‍☠️ Smuggler\'s Goods';
                items = [ITEMS.CUTLASS, ITEMS.DAGGER, ITEMS.FIRE_CLOAK, ITEMS.ATTACK_BOOST, ITEMS.LUCKY_CHARM];
                break;
            case 'royal':
                shopTitle.textContent = '👑 Royal Armorer';
                items = [ITEMS.ROYAL_SWORD, ITEMS.RAPIER, ITEMS.KNIGHT_ARMOR, ITEMS.ROYAL_ARMOR, ITEMS.RING_OF_PROTECTION];
                break;
            case 'alchemist':
                shopTitle.textContent = '🧪 Alchemist';
                items = [ITEMS.MEGA_POTION, ITEMS.FIRE_RESIST_POTION, ITEMS.ATTACK_BOOST, ITEMS.DEFENSE_BOOST, ITEMS.ANTIDOTE];
                break;
        }
        
        shopItems.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'shop-item';
            div.innerHTML = `
                <div class="shop-item-info">
                    <span class="shop-item-icon">${item.icon}</span>
                    <div>
                        <div>${item.name}</div>
                        <div style="font-size: 12px; color: #888;">
                            ${item.attack ? `+${item.attack} ATK` : ''}
                            ${item.defense ? `+${item.defense} DEF` : ''}
                            ${item.heal ? `Heals ${item.heal} HP` : ''}
                        </div>
                    </div>
                </div>
                <button class="buy-btn" ${this.player.gold < item.price ? 'disabled' : ''} 
                    onclick="game.buyItem('${item.name}')">
                    Buy (${item.price}g)
                </button>
            `;
            shopItems.appendChild(div);
        });
        
        shopUI.style.display = 'block';
    }
    
    buyItem(itemName) {
        const item = Object.values(ITEMS).find(i => i.name === itemName);
        if (!item || this.player.gold < item.price) return;
        
        this.player.gold -= item.price;
        this.itemsBought++;
        
        // Add to inventory
        if (item.stackable) {
            const existing = this.player.inventory.find(i => i.item && i.item.name === item.name);
            if (existing) {
                existing.count = (existing.count || 1) + 1;
            } else {
                this.player.inventory.push({ item, count: 1 });
            }
        } else {
            this.player.inventory.push({ item });
        }
        
        this.notify(`Purchased ${item.name}!`);
        this.updateHUD();
        
        // Refresh shop
        const shopType = document.getElementById('shop-title').textContent.includes('Blacksmith') ? 'blacksmith' :
                        document.getElementById('shop-title').textContent.includes('Western') ? 'western' : 'merchant';
        this.openShop(shopType);
    }
    
    closeShop() {
        document.getElementById('shop-ui').style.display = 'none';
    }
    
    openGambling(type) {
        document.getElementById('gambling-ui').style.display = 'block';
        this.gambling.init(type);
    }
    
    closeGambling() {
        document.getElementById('gambling-ui').style.display = 'none';
    }
    
    toggleInventory() {
        const panel = document.getElementById('inventory-panel');
        const isVisible = panel.style.display === 'block';
        
        if (!isVisible) {
            this.updateInventoryDisplay();
            soundSystem.playMenuOpen();
        } else {
            soundSystem.playMenuClose();
        }
        
        panel.style.display = isVisible ? 'none' : 'block';
    }
    
    updateInventoryDisplay() {
        const grid = document.getElementById('inventory-grid');
        const equipped = document.getElementById('equipped-items');
        
        grid.innerHTML = '';
        
        // Create 16 inventory slots
        for (let i = 0; i < 16; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            
            if (this.player.inventory[i]) {
                const invItem = this.player.inventory[i];
                slot.innerHTML = invItem.item.icon;
                if (invItem.count && invItem.count > 1) {
                    slot.innerHTML += `<span class="item-count">${invItem.count}</span>`;
                }
                slot.title = invItem.item.name;
                slot.addEventListener('click', () => this.useInventoryItem(i));
            }
            
            grid.appendChild(slot);
        }
        
        // Equipment display
        equipped.innerHTML = '';
        const slots = ['weapon', 'armor', 'accessory'];
        const slotIcons = { weapon: '⚔️', armor: '🛡️', accessory: '💍' };
        
        slots.forEach(slot => {
            const div = document.createElement('div');
            div.className = 'equipment-slot';
            const item = this.player.equipment[slot];
            div.innerHTML = `
                <span>${slotIcons[slot]}</span>
                <span>${item ? item.name : 'Empty'}</span>
            `;
            equipped.appendChild(div);
        });
        
        // Update stats display
        document.getElementById('stat-attack').textContent = this.player.attack;
        document.getElementById('stat-defense').textContent = this.player.defense;
        document.getElementById('stat-speed').textContent = this.player.speed;
    }
    
    useInventoryItem(index) {
        const invItem = this.player.inventory[index];
        if (!invItem) return;
        
        const item = invItem.item;
        
        if (item.type === 'weapon') {
            // Unequip current weapon
            if (this.player.equipment.weapon) {
                this.player.attack -= this.player.equipment.weapon.attack;
            }
            // Equip new weapon
            this.player.equipment.weapon = item;
            this.player.attack += item.attack;
            soundSystem.playItemEquip();
            this.notify(`Equipped ${item.name}`);
        } else if (item.type === 'armor') {
            if (this.player.equipment.armor) {
                this.player.defense -= this.player.equipment.armor.defense;
            }
            this.player.equipment.armor = item;
            this.player.defense += item.defense;
            soundSystem.playItemEquip();
            this.notify(`Equipped ${item.name}`);
        } else if (item.type === 'consumable') {
            if (item.heal) {
                this.player.health = Math.min(this.player.health + item.heal, this.player.maxHealth);
                soundSystem.playPotionDrink();
                soundSystem.playHealChime();
                this.notify(`+${item.heal} Health`);
            }
            
            // Remove consumable
            if (invItem.count && invItem.count > 1) {
                invItem.count--;
            } else {
                this.player.inventory.splice(index, 1);
            }
        }
        
        this.updateHUD();
        this.updateInventoryDisplay();
    }
    
    toggleQuestLog() {
        const panel = document.getElementById('quest-log');
        const isVisible = panel.style.display === 'block';
        
        if (!isVisible) {
            this.updateQuestDisplay();
            soundSystem.playMenuOpen();
        } else {
            soundSystem.playMenuClose();
        }
        
        panel.style.display = isVisible ? 'none' : 'block';
    }
    
    toggleSoundPanel() {
        const panel = document.getElementById('sound-panel');
        const isVisible = panel.style.display === 'block';
        
        if (!isVisible) {
            soundSystem.playMenuOpen();
        } else {
            soundSystem.playMenuClose();
        }
        
        panel.style.display = isVisible ? 'none' : 'block';
    }
    
    setMasterVolume(value) {
        soundSystem.setMasterVolume(value / 100);
        document.getElementById('master-vol-display').textContent = value + '%';
        soundSystem.playClick();
    }
    
    setMusicVolume(value) {
        soundSystem.setMusicVolume(value / 100);
        document.getElementById('music-vol-display').textContent = value + '%';
    }
    
    setSFXVolume(value) {
        soundSystem.setSFXVolume(value / 100);
        document.getElementById('sfx-vol-display').textContent = value + '%';
    }
    
    toggleMute() {
        const isMuted = soundSystem.toggleMute();
        const btn = document.getElementById('mute-btn');
        const toggleBtn = document.getElementById('sound-toggle-btn');
        
        if (isMuted) {
            btn.textContent = '🔇 Sound OFF';
            btn.classList.add('muted');
            if (toggleBtn) toggleBtn.textContent = '🔇';
        } else {
            btn.textContent = '🔊 Sound ON';
            btn.classList.remove('muted');
            if (toggleBtn) toggleBtn.textContent = '🔊';
            soundSystem.playClick();
        }
    }
    
    updateQuestDisplay() {
        const questList = document.getElementById('quest-list');
        const clueList = document.getElementById('clue-list');
        
        questList.innerHTML = '';
        
        Object.values(this.quests).forEach(quest => {
            const div = document.createElement('div');
            const isMain = quest.id === 'main';
            const isCompleted = quest.stages.every(s => s.completed);
            
            div.className = `quest-item ${isMain ? 'main-quest' : 'side-quest'} ${isCompleted ? 'completed' : ''}`;
            
            const currentStage = quest.stages.find(s => !s.completed) || quest.stages[quest.stages.length - 1];
            let stageText = currentStage.description;
            if (currentStage.count !== undefined) {
                stageText = stageText.replace(/\d+\/\d+/, `${currentStage.count}/${currentStage.required}`);
            }
            
            div.innerHTML = `
                <div class="quest-title">${isMain ? '⭐' : '📌'} ${quest.title}</div>
                <div class="quest-desc">${stageText}</div>
            `;
            
            questList.appendChild(div);
        });
        
        clueList.innerHTML = '';
        this.cluesFound.forEach(clueId => {
            const clue = CLUES.find(c => c.id === clueId);
            if (clue) {
                const div = document.createElement('div');
                div.className = 'clue-item';
                div.textContent = `"${clue.text}"`;
                clueList.appendChild(div);
            }
        });
        
        if (this.cluesFound.length === 0) {
            clueList.innerHTML = '<p style="color: #666; font-size: 12px;">No clues found yet...</p>';
        }
    }
    
    useHotbarItem(slot) {
        switch(slot) {
            case 0: // Weapon - show attack animation
                this.notify('Ready to fight!');
                break;
            case 1: // Shield - toggle defend
                this.notify('Defensive stance!');
                break;
            case 2: // Potion - use health potion
                const potionIndex = this.player.inventory.findIndex(i => 
                    i.item && i.item.type === 'consumable' && i.item.heal);
                if (potionIndex >= 0) {
                    this.useInventoryItem(potionIndex);
                } else {
                    this.notify('No potions!');
                }
                break;
            case 3: // Map - show quest log
                this.toggleQuestLog();
                break;
        }
    }
    
    closeAllPanels() {
        document.getElementById('inventory-panel').style.display = 'none';
        document.getElementById('quest-log').style.display = 'none';
        document.getElementById('shop-ui').style.display = 'none';
        document.getElementById('gambling-ui').style.display = 'none';
        document.getElementById('fast-travel-panel').style.display = 'none';
        document.getElementById('stats-panel').style.display = 'none';
        this.closeDialogue();
    }
    
    // ==================== FAST TRAVEL SYSTEM ====================
    
    toggleFastTravel() {
        const panel = document.getElementById('fast-travel-panel');
        const isVisible = panel.style.display === 'block';
        
        if (!isVisible) {
            this.updateFastTravelDisplay();
        }
        
        panel.style.display = isVisible ? 'none' : 'block';
    }
    
    closeFastTravel() {
        document.getElementById('fast-travel-panel').style.display = 'none';
    }
    
    updateFastTravelDisplay() {
        const container = document.getElementById('fast-travel-locations');
        const costInfo = document.getElementById('fast-travel-cost-info');
        const cooldownInfo = document.getElementById('fast-travel-cooldown');
        
        // Update cost/cooldown info
        if (this.fastTravelCooldown > 0) {
            costInfo.style.display = 'none';
            cooldownInfo.style.display = 'inline';
            cooldownInfo.textContent = `Cooldown: ${Math.ceil(this.fastTravelCooldown)}s`;
        } else {
            costInfo.style.display = 'inline';
            cooldownInfo.style.display = 'none';
        }
        
        container.innerHTML = '';
        
        FAST_TRAVEL_LOCATIONS.forEach(loc => {
            const isDiscovered = this.discoveredLocations.has(loc.region);
            const canAfford = this.player.gold >= 10;
            const canTravel = isDiscovered && (canAfford || this.fastTravelCooldown <= 0);
            const isCurrentLocation = this.isPlayerAtLocation(loc);
            
            const div = document.createElement('div');
            div.className = `fast-travel-location ${(!isDiscovered || isCurrentLocation) ? 'disabled' : ''}`;
            
            div.innerHTML = `
                <div class="location-info">
                    <span class="location-icon">${isDiscovered ? loc.icon : '❓'}</span>
                    <div>
                        <div class="location-name">${isDiscovered ? loc.name : 'Undiscovered'}</div>
                        ${!isDiscovered ? '<div class="location-undiscovered">Explore to discover</div>' : ''}
                        ${isCurrentLocation ? '<div class="location-undiscovered">You are here</div>' : ''}
                    </div>
                </div>
                ${isDiscovered && !isCurrentLocation ? `
                    <button class="travel-btn" ${!canAfford && this.fastTravelCooldown > 0 ? 'disabled' : ''}>
                        ${this.fastTravelCooldown > 0 ? 'Free' : '10 gold'}
                    </button>
                ` : ''}
            `;
            
            if (isDiscovered && !isCurrentLocation) {
                div.addEventListener('click', () => this.fastTravelTo(loc));
            }
            
            container.appendChild(div);
        });
    }
    
    isPlayerAtLocation(loc) {
        const playerTileX = Math.floor(this.player.x / TILE_SIZE);
        const playerTileY = Math.floor(this.player.y / TILE_SIZE);
        const dist = Math.hypot(playerTileX - loc.x, playerTileY - loc.y);
        return dist < 15;
    }
    
    fastTravelTo(location) {
        const canAfford = this.player.gold >= 10;
        const freeTravelAvailable = this.fastTravelCooldown <= 0;
        
        if (!canAfford && !freeTravelAvailable) {
            this.notify('Not enough gold and cooldown not ready!');
            return;
        }
        
        // Deduct cost or use cooldown
        if (freeTravelAvailable) {
            this.fastTravelCooldown = 60; // 60 second cooldown
        } else {
            this.player.gold -= 10;
        }
        
        this.closeFastTravel();
        
        // Show teleport effect
        const overlay = document.getElementById('teleport-overlay');
        overlay.classList.add('active');
        
        setTimeout(() => {
            // Teleport player
            this.player.x = location.x * TILE_SIZE + TILE_SIZE / 2;
            this.player.y = location.y * TILE_SIZE + TILE_SIZE / 2;
            this.player.targetX = this.player.x;
            this.player.targetY = this.player.y;
            this.player.velocityX = 0;
            this.player.velocityY = 0;
            this.navigationState.path = [];
            this.navigationState.isMoving = false;
            
            // Update camera
            this.camera.x = this.player.x - CANVAS_WIDTH / 2;
            this.camera.y = this.player.y - CANVAS_HEIGHT / 2;
            
            this.updateHUD();
            
            // Fade out
            overlay.classList.add('fade-out');
            
            setTimeout(() => {
                overlay.classList.remove('active', 'fade-out');
                this.notify(`Arrived at ${location.name}!`);
                this.particles.emit(this.player.x, this.player.y, 'magic', 25);
            }, 400);
        }, 600);
    }
    
    // ==================== STATISTICS PANEL ====================
    
    toggleStats() {
        const panel = document.getElementById('stats-panel');
        const isVisible = panel.style.display === 'block';
        
        if (!isVisible) {
            this.updateStatsDisplay();
        }
        
        panel.style.display = isVisible ? 'none' : 'block';
    }
    
    closeStats() {
        document.getElementById('stats-panel').style.display = 'none';
    }
    
    updateStatsDisplay() {
        // Time played
        const hours = Math.floor(this.playTime / 3600);
        const minutes = Math.floor((this.playTime % 3600) / 60);
        const seconds = Math.floor(this.playTime % 60);
        document.getElementById('stat-time-played').textContent = 
            `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Current day
        document.getElementById('stat-current-day').textContent = `Day ${this.dayCount}`;
        
        // Distance
        document.getElementById('stat-distance').textContent = `${Math.floor(this.distanceTraveled)} tiles`;
        
        // Combat stats
        document.getElementById('stat-kills').textContent = this.killCount;
        document.getElementById('stat-level').textContent = this.player.level;
        document.getElementById('stat-total-xp').textContent = this.totalXPGained;
        
        // Economy stats
        document.getElementById('stat-current-gold').textContent = this.player.gold;
        document.getElementById('stat-total-gold').textContent = this.totalGoldEarned;
        document.getElementById('stat-items-bought').textContent = this.itemsBought;
        
        // Exploration stats
        document.getElementById('stat-regions').textContent = `${this.discoveredLocations.size} / 8`;
        document.getElementById('stat-clues').textContent = `${this.cluesFound.length} / 6`;
        
        // Count completed quests
        let completedQuests = 0;
        Object.values(this.quests).forEach(quest => {
            if (quest.stages.every(s => s.completed)) completedQuests++;
        });
        document.getElementById('stat-quests').textContent = completedQuests;
        document.getElementById('stat-chests').textContent = this.chestsOpened;
        
        // Achievements
        this.updateAchievementDisplay();
    }
    
    updateAchievementDisplay() {
        const grid = document.getElementById('achievement-grid');
        grid.innerHTML = '';
        
        ACHIEVEMENTS.forEach(achievement => {
            const isUnlocked = this.achievements.unlocked.has(achievement.id);
            const div = document.createElement('div');
            div.className = `achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`;
            div.innerHTML = `
                <div class="achievement-name">${isUnlocked ? '🏆' : '🔒'} ${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            `;
            grid.appendChild(div);
        });
    }
    
    // ==================== TIME DISPLAY FORMATTING ====================
    
    formatTimeDisplay() {
        const hour = Math.floor(this.timeOfDay);
        const minute = Math.floor((this.timeOfDay % 1) * 60);
        
        // Convert to 12-hour format
        let displayHour = hour % 12;
        if (displayHour === 0) displayHour = 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        
        const timeString = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        const dayString = `Day ${this.dayCount}`;
        
        // Determine time icon
        let icon = '☀️';
        if (this.timeOfDay >= 6 && this.timeOfDay < 8) {
            icon = '🌅'; // Sunrise
        } else if (this.timeOfDay >= 8 && this.timeOfDay < 18) {
            icon = '☀️'; // Day
        } else if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
            icon = '🌇'; // Sunset
        } else {
            icon = '🌙'; // Night
        }
        
        document.getElementById('time-icon').textContent = icon;
        document.getElementById('time-text').textContent = `${dayString}, ${timeString}`;
    }
    
    // ==================== INVENTORY ENHANCEMENTS ====================
    
    getItemRarity(item) {
        return item.rarity || RARITY.COMMON;
    }
    
    sortInventory(sortMode) {
        this.inventorySortMode = sortMode;
        
        // Update button styles
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortMode);
        });
        
        // Sort inventory
        this.player.inventory.sort((a, b) => {
            const itemA = a.item;
            const itemB = b.item;
            
            if (!itemA || !itemB) return 0;
            
            switch (sortMode) {
                case 'type':
                    return (itemA.type || '').localeCompare(itemB.type || '');
                case 'rarity':
                    const rarityA = this.getItemRarity(itemA).order || 0;
                    const rarityB = this.getItemRarity(itemB).order || 0;
                    return rarityB - rarityA;
                case 'value':
                    return (itemB.price || 0) - (itemA.price || 0);
                case 'name':
                    return (itemA.name || '').localeCompare(itemB.name || '');
                default:
                    return 0;
            }
        });
        
        this.updateInventoryDisplay();
    }
    
    showItemTooltip(item, event, slotIndex) {
        const tooltip = document.getElementById('item-tooltip');
        const rarity = this.getItemRarity(item);
        
        // Set tooltip content
        tooltip.querySelector('.tooltip-name').textContent = item.name;
        tooltip.querySelector('.tooltip-name').className = `tooltip-name ${rarity.name}`;
        
        tooltip.querySelector('.tooltip-type').textContent = item.type.toUpperCase();
        
        // Stats
        let statsHtml = '';
        if (item.attack) statsHtml += `<div class="tooltip-stat">⚔️ +${item.attack} Attack</div>`;
        if (item.defense) statsHtml += `<div class="tooltip-stat">🛡️ +${item.defense} Defense</div>`;
        if (item.heal) statsHtml += `<div class="tooltip-stat">❤️ Restores ${item.heal} HP</div>`;
        if (item.tempAttack) statsHtml += `<div class="tooltip-stat">⚡ +${item.tempAttack} Temp Attack</div>`;
        if (item.tempDefense) statsHtml += `<div class="tooltip-stat">⚡ +${item.tempDefense} Temp Defense</div>`;
        tooltip.querySelector('.tooltip-stats').innerHTML = statsHtml;
        
        // Compare with equipped item
        let compareHtml = '';
        if (item.type === 'weapon' && this.player.equipment.weapon) {
            const diff = item.attack - this.player.equipment.weapon.attack;
            if (diff !== 0) {
                compareHtml = `<div class="${diff > 0 ? 'compare-better' : 'compare-worse'}">
                    vs Equipped: ${diff > 0 ? '+' : ''}${diff} Attack
                </div>`;
            }
        } else if (item.type === 'armor' && this.player.equipment.armor) {
            const diff = item.defense - this.player.equipment.armor.defense;
            if (diff !== 0) {
                compareHtml = `<div class="${diff > 0 ? 'compare-better' : 'compare-worse'}">
                    vs Equipped: ${diff > 0 ? '+' : ''}${diff} Defense
                </div>`;
            }
        }
        tooltip.querySelector('.tooltip-compare').innerHTML = compareHtml;
        
        // Description
        tooltip.querySelector('.tooltip-description').textContent = item.description || '';
        
        // Price
        if (item.price > 0) {
            tooltip.querySelector('.tooltip-price').textContent = `💰 Value: ${item.price} gold`;
        } else {
            tooltip.querySelector('.tooltip-price').textContent = '';
        }
        
        // Position tooltip
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top}px`;
        
        // Ensure tooltip stays in viewport
        if (rect.right + 260 > window.innerWidth) {
            tooltip.style.left = `${rect.left - 260}px`;
        }
        
        tooltip.style.display = 'block';
    }
    
    hideItemTooltip() {
        document.getElementById('item-tooltip').style.display = 'none';
    }
    
    notify(message, type = 'default') {
        const notification = document.getElementById('notification');
        
        // Play notification sound
        soundSystem.playNotification();
        
        // Style based on notification type
        if (type === 'save') {
            const timestamp = new Date().toLocaleTimeString();
            notification.innerHTML = `💾 <strong>Game Saved!</strong> <span style="opacity: 0.7; font-size: 12px;">${timestamp}</span>`;
            notification.style.background = 'linear-gradient(180deg, rgba(50, 100, 50, 0.98) 0%, rgba(35, 75, 35, 0.98) 100%)';
            notification.style.borderColor = '#6ab06a';
        } else if (type === 'quest') {
            notification.innerHTML = `📜 ${message}`;
            notification.style.background = 'linear-gradient(180deg, rgba(100, 80, 50, 0.98) 0%, rgba(75, 60, 35, 0.98) 100%)';
            notification.style.borderColor = '#c9a055';
            soundSystem.playQuestComplete();
        } else if (type === 'combat') {
            notification.innerHTML = `⚔️ ${message}`;
            notification.style.background = 'linear-gradient(180deg, rgba(100, 50, 50, 0.98) 0%, rgba(75, 35, 35, 0.98) 100%)';
            notification.style.borderColor = '#c96060';
        } else {
            notification.textContent = message;
            notification.style.background = 'linear-gradient(180deg, rgba(50, 50, 100, 0.98) 0%, rgba(35, 35, 75, 0.98) 100%)';
            notification.style.borderColor = '#8a8acc';
        }
        
        notification.style.display = 'block';
        notification.style.animation = 'none';
        notification.offsetHeight;
        notification.style.animation = 'notificationBounce 3s ease-in-out';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    updateHUD() {
        document.getElementById('health-text').textContent = `${Math.floor(this.player.health)}/${this.player.maxHealth}`;
        document.getElementById('health-fill').style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
        document.getElementById('level-text').textContent = this.player.level;
        document.getElementById('xp-fill').style.width = `${(this.player.xp / this.player.xpToLevel) * 100}%`;
        document.getElementById('gold-text').textContent = this.player.gold;
        
        // Update time display
        this.formatTimeDisplay();
    }
    
    gainXP(amount) {
        this.player.xp += amount;
        
        while (this.player.xp >= this.player.xpToLevel) {
            this.player.xp -= this.player.xpToLevel;
            this.player.level++;
            this.player.xpToLevel = Math.floor(this.player.xpToLevel * 1.5);
            this.player.maxHealth += 10;
            this.player.health = this.player.maxHealth;
            this.player.baseAttack += 2;
            this.player.baseDefense += 1;
            this.player.attack += 2;
            this.player.defense += 1;
            
            // Level up particle burst!
            this.particles.emit(this.player.x, this.player.y - 20, 'levelup', 30);
            this.particles.emit(this.player.x, this.player.y, 'magic', 20);
            
            // Play level up sound
            soundSystem.playLevelUp();
            
            this.notify(`Level Up! Now level ${this.player.level}!`);
        }
        
        this.updateHUD();
    }
    
    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.updateHUD();
        
        // Start background music and ambient sounds
        soundSystem.startMusic('adventurous');
        soundSystem.startAmbient('default');
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    gameLoop(currentTime) {
        if (!this.running) return;
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    update(dt) {
        // Handle WASD keyboard movement
        const wasd = this.navigationState.wasdMovement;
        let wasdActive = wasd.w || wasd.a || wasd.s || wasd.d;
        
        if (wasdActive && !this.inCombat && !this.currentDialogue) {
            // Cancel pathfinding when using WASD
            this.navigationState.path = [];
            this.navigationState.isMoving = false;
            this.player.interactTarget = null;
            
            // Calculate WASD direction
            let dirX = 0, dirY = 0;
            if (wasd.w) dirY -= 1;
            if (wasd.s) dirY += 1;
            if (wasd.a) dirX -= 1;
            if (wasd.d) dirX += 1;
            
            // Normalize diagonal movement
            if (dirX !== 0 && dirY !== 0) {
                dirX *= 0.707;
                dirY *= 0.707;
            }
            
            // Apply acceleration
            this.player.velocityX += dirX * this.player.acceleration * 60 * dt;
            this.player.velocityY += dirY * this.player.acceleration * 60 * dt;
            
            // Clamp to max speed
            const speed = Math.hypot(this.player.velocityX, this.player.velocityY);
            if (speed > this.player.maxSpeed) {
                this.player.velocityX = (this.player.velocityX / speed) * this.player.maxSpeed;
                this.player.velocityY = (this.player.velocityY / speed) * this.player.maxSpeed;
            }
        }
        
        // Handle click-and-hold continuous movement
        if (this.navigationState.mouseDown && !wasdActive && !this.inCombat && !this.currentDialogue) {
            const targetX = this.navigationState.mouseX + this.camera.x;
            const targetY = this.navigationState.mouseY + this.camera.y;
            const tileX = Math.floor(targetX / TILE_SIZE);
            const tileY = Math.floor(targetY / TILE_SIZE);
            
            if (this.isWalkable(tileX, tileY)) {
                this.player.targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
                this.player.targetY = tileY * TILE_SIZE + TILE_SIZE / 2;
                this.navigationState.path = [];
                this.navigationState.isMoving = true;
            }
        }
        
        // Handle pathfinding movement
        if (this.navigationState.path.length > 0 && this.navigationState.pathIndex < this.navigationState.path.length) {
            const currentTarget = this.navigationState.path[this.navigationState.pathIndex];
            this.player.targetX = currentTarget.x * TILE_SIZE + TILE_SIZE / 2;
            this.player.targetY = currentTarget.y * TILE_SIZE + TILE_SIZE / 2;
            
            const distToWaypoint = Math.hypot(
                this.player.x - this.player.targetX,
                this.player.y - this.player.targetY
            );
            
            if (distToWaypoint < TILE_SIZE / 2) {
                this.navigationState.pathIndex++;
                if (this.navigationState.pathIndex >= this.navigationState.path.length) {
                    this.navigationState.path = [];
                    this.navigationState.isMoving = false;
                }
            }
        }
        
        // Movement with acceleration/deceleration
        const dx = this.player.targetX - this.player.x;
        const dy = this.player.targetY - this.player.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 5 && !wasdActive) {
            // Calculate desired direction
            const dirX = dx / dist;
            const dirY = dy / dist;
            
            // Apply acceleration towards target
            this.player.velocityX += dirX * this.player.acceleration * 60 * dt;
            this.player.velocityY += dirY * this.player.acceleration * 60 * dt;
            
            // Clamp to max speed
            const speed = Math.hypot(this.player.velocityX, this.player.velocityY);
            if (speed > this.player.maxSpeed) {
                this.player.velocityX = (this.player.velocityX / speed) * this.player.maxSpeed;
                this.player.velocityY = (this.player.velocityY / speed) * this.player.maxSpeed;
            }
            
            // Decelerate when approaching target
            if (dist < 100) {
                const slowFactor = dist / 100;
                const targetSpeed = this.player.maxSpeed * slowFactor;
                if (speed > targetSpeed) {
                    this.player.velocityX *= 0.95;
                    this.player.velocityY *= 0.95;
                }
            }
        } else if (!wasdActive) {
            // Decelerate when not moving
            this.player.velocityX *= (1 - this.player.deceleration);
            this.player.velocityY *= (1 - this.player.deceleration);
            
            // Stop completely when slow enough
            if (Math.abs(this.player.velocityX) < 0.01) this.player.velocityX = 0;
            if (Math.abs(this.player.velocityY) < 0.01) this.player.velocityY = 0;
            
            // Interact with target when reached
            if (dist <= 5 && this.player.interactTarget) {
                this.interactWithNPC(this.player.interactTarget);
                this.player.interactTarget = null;
            }
        }
        
        // Apply velocity with improved collision detection
        const newX = this.player.x + this.player.velocityX;
        const newY = this.player.y + this.player.velocityY;
        
        // Check multiple points for better collision
        const halfSize = TILE_SIZE / 4;
        const checkPoints = [
            { x: newX, y: newY },
            { x: newX - halfSize, y: newY - halfSize },
            { x: newX + halfSize, y: newY - halfSize },
            { x: newX - halfSize, y: newY + halfSize },
            { x: newX + halfSize, y: newY + halfSize }
        ];
        
        let canMoveX = true, canMoveY = true;
        
        // Check X movement
        for (const point of checkPoints) {
            const tileX = Math.floor((this.player.x + this.player.velocityX + (point.x - newX)) / TILE_SIZE);
            const tileY = Math.floor((this.player.y + (point.y - newY)) / TILE_SIZE);
            if (!this.isWalkable(tileX, tileY)) {
                canMoveX = false;
                break;
            }
        }
        
        // Check Y movement
        for (const point of checkPoints) {
            const tileX = Math.floor((this.player.x + (point.x - newX)) / TILE_SIZE);
            const tileY = Math.floor((this.player.y + this.player.velocityY + (point.y - newY)) / TILE_SIZE);
            if (!this.isWalkable(tileX, tileY)) {
                canMoveY = false;
                break;
            }
        }
        
        // Apply movement with edge sliding
        if (canMoveX) {
            this.player.x += this.player.velocityX;
        } else {
            this.player.velocityX = 0;
            // Try to slide along edges
            if (this.player.velocityX !== 0) {
                const slideDir = this.player.velocityX > 0 ? 1 : -1;
                for (let offset = 1; offset <= 3; offset++) {
                    const testX = this.player.x + slideDir * offset;
                    const tileX = Math.floor(testX / TILE_SIZE);
                    const tileY = Math.floor(this.player.y / TILE_SIZE);
                    if (this.isWalkable(tileX, tileY)) {
                        this.player.x = testX;
                        break;
                    }
                }
            }
        }
        
        if (canMoveY) {
            this.player.y += this.player.velocityY;
        } else {
            this.player.velocityY = 0;
            // Try to slide along edges
            if (this.player.velocityY !== 0) {
                const slideDir = this.player.velocityY > 0 ? 1 : -1;
                for (let offset = 1; offset <= 3; offset++) {
                    const testY = this.player.y + slideDir * offset;
                    const tileX = Math.floor(this.player.x / TILE_SIZE);
                    const tileY = Math.floor(testY / TILE_SIZE);
                    if (this.isWalkable(tileX, tileY)) {
                        this.player.y = testY;
                        break;
                    }
                }
            }
        }
        
        // Smooth camera following with dynamic lookahead
        const lookAheadAmount = 50;
        const velocityInfluence = 0.3;
        const lookAheadX = this.player.velocityX * lookAheadAmount * velocityInfluence;
        const lookAheadY = this.player.velocityY * lookAheadAmount * velocityInfluence;
        
        this.targetCamera.x = this.player.x - CANVAS_WIDTH / 2 + lookAheadX;
        this.targetCamera.y = this.player.y - CANVAS_HEIGHT / 2 + lookAheadY;
        
        // Clamp camera to world bounds
        this.targetCamera.x = Math.max(0, Math.min(this.targetCamera.x, this.world.width * TILE_SIZE - CANVAS_WIDTH));
        this.targetCamera.y = Math.max(0, Math.min(this.targetCamera.y, this.world.height * TILE_SIZE - CANVAS_HEIGHT));
        
        // Smoother camera interpolation with damping
        const cameraSpeed = 0.12;
        const cameraDist = Math.hypot(this.targetCamera.x - this.camera.x, this.targetCamera.y - this.camera.y);
        const dynamicSpeed = Math.min(cameraSpeed, cameraDist * 0.01 + 0.05);
        
        this.camera.x += (this.targetCamera.x - this.camera.x) * dynamicSpeed;
        this.camera.y += (this.targetCamera.y - this.camera.y) * dynamicSpeed;
        
        // Check for hostile NPCs in range
        for (const npc of this.npcs) {
            if (!npc.alive || !npc.hostile) continue;
            
            const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
            if (dist < TILE_SIZE * 2 && !this.inCombat) {
                this.combat.start(npc);
                break;
            }
        }
        
        // Check for treasure chests
        for (const chest of this.treasureChests) {
            if (chest.opened) continue;
            const dist = Math.hypot(this.player.x - chest.x, this.player.y - chest.y);
            if (dist < TILE_SIZE) {
                this.openTreasureChest(chest);
            }
        }
        
        // Track distance traveled
        const movedDist = Math.hypot(
            this.player.x - this.lastPosition.x,
            this.player.y - this.lastPosition.y
        );
        this.distanceTraveled += movedDist;
        this.lastPosition = { x: this.player.x, y: this.player.y };
        
        // Random events
        this.eventCooldown -= dt;
        if (this.eventCooldown <= 0 && !this.inCombat && !this.currentDialogue) {
            this.checkRandomEvents();
            this.eventCooldown = 5; // Minimum 5 seconds between event checks
        }
        
        // Day/night cycle (1 game minute = 1 real second)
        if (this.dayNightCycle) {
            this.timeOfDay += dt / 60; // 24 game hours = 24 real minutes
            if (this.timeOfDay >= 24) {
                this.timeOfDay = 0;
                this.dayCount++;
            }
        }
        
        // Track play time
        this.playTime += dt;
        
        // Fast travel cooldown
        if (this.fastTravelCooldown > 0) {
            this.fastTravelCooldown = Math.max(0, this.fastTravelCooldown - dt);
        }
        
        // Discover locations
        this.checkLocationDiscovery();
        
        // Sound updates - footsteps and ambient
        if (!this.inCombat) {
            const tileX = Math.floor(this.player.x / TILE_SIZE);
            const tileY = Math.floor(this.player.y / TILE_SIZE);
            const currentTile = this.world.map[tileY] ? this.world.map[tileY][tileX] : TILES.GRASS;
            
            // Update footsteps based on movement
            soundSystem.updateFootsteps(
                { x: this.player.velocityX, y: this.player.velocityY },
                currentTile,
                dt
            );
            
            // Update ambient sounds based on region (check every few seconds)
            if (!this.lastAmbientCheck || this.playTime - this.lastAmbientCheck > 3) {
                this.lastAmbientCheck = this.playTime;
                const newAmbient = soundSystem.getAmbientForRegion(tileX, tileY);
                if (newAmbient !== soundSystem.currentAmbient) {
                    soundSystem.startAmbient(newAmbient);
                }
                
                // Update music based on region
                const newMood = soundSystem.getMusicMoodForRegion(tileX, tileY);
                if (newMood !== soundSystem.currentMusic) {
                    soundSystem.startMusic(newMood);
                }
            }
        }
    }
    
    openTreasureChest(chest) {
        chest.opened = true;
        chest.sprite = '📭';
        this.chestsOpened++;
        
        // Play chest opening sound
        soundSystem.playChestOpen();
        
        // Treasure particle burst!
        this.particles.emit(chest.x, chest.y - 10, 'treasure', 25);
        this.particles.emit(chest.x, chest.y, 'sparkle', 15);
        
        let message = 'You opened a treasure chest! ';
        
        if (chest.loot === 'gold') {
            this.player.gold += chest.amount;
            this.totalGoldEarned += chest.amount;
            message += `Found ${chest.amount} gold!`;
            soundSystem.playGoldPickup();
        } else if (chest.loot === 'potion') {
            for (let i = 0; i < chest.amount; i++) {
                const existing = this.player.inventory.find(inv => inv.item && inv.item.name === 'Health Potion');
                if (existing) {
                    existing.count = (existing.count || 1) + 1;
                } else {
                    this.player.inventory.push({ item: ITEMS.HEALTH_POTION, count: 1 });
                }
            }
            message += `Found ${chest.amount} Health Potion${chest.amount > 1 ? 's' : ''}!`;
            this.particles.emit(chest.x, chest.y, 'heal', 10);
        } else if (chest.loot === 'weapon' || chest.loot === 'armor') {
            this.player.inventory.push({ item: chest.item });
            message += `Found ${chest.item.name}!`;
            this.particles.emit(chest.x, chest.y, 'magic', 15);
            soundSystem.playItemEquip();
        }
        
        this.notify(message);
        this.updateHUD();
    }
    
    checkRandomEvents() {
        if (this.inCombat) return;
        
        for (const event of RANDOM_EVENTS) {
            if (this.player.level < event.minLevel) continue;
            if (Math.random() < event.chance) {
                event.action(this);
                break;
            }
        }
    }
    
    checkLocationDiscovery() {
        const tileX = Math.floor(this.player.x / TILE_SIZE);
        const tileY = Math.floor(this.player.y / TILE_SIZE);
        
        const locations = [
            { name: 'Starting Village', x: 50, y: 75, range: 10 },
            { name: 'Dark Forest', x: 100, y: 75, range: 15 },
            { name: 'Pirate Cove', x: 150, y: 90, range: 12 },
            { name: 'Western Town', x: 80, y: 40, range: 10 },
            { name: 'Medieval Castle', x: 30, y: 50, range: 10 },
            { name: 'Mystic Swamp', x: 120, y: 100, range: 12 },
            { name: 'Mountain Pass', x: 100, y: 20, range: 10 },
            { name: 'Dragon\'s Lair', x: 180, y: 12, range: 10 }
        ];
        
        for (const loc of locations) {
            if (!this.discoveredLocations.has(loc.name)) {
                const dist = Math.hypot(tileX - loc.x, tileY - loc.y);
                if (dist < loc.range) {
                    this.discoveredLocations.add(loc.name);
                    this.notify(`Discovered: ${loc.name}!`);
                    this.gainXP(25);
                }
            }
        }
    }
    
    render() {
        const time = performance.now();
        
        // Fill entire canvas with dark background first
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Calculate visible tile range
        const startTileX = Math.floor(this.camera.x / TILE_SIZE);
        const startTileY = Math.floor(this.camera.y / TILE_SIZE);
        const endTileX = Math.ceil((this.camera.x + CANVAS_WIDTH) / TILE_SIZE);
        const endTileY = Math.ceil((this.camera.y + CANVAS_HEIGHT) / TILE_SIZE);
        
        // Render tiles with enhanced textures
        for (let y = startTileY; y <= endTileY && y < this.world.height; y++) {
            for (let x = startTileX; x <= endTileX && x < this.world.width; x++) {
                if (y < 0 || x < 0) continue;
                
                const tile = this.world.map[y][x];
                const screenX = x * TILE_SIZE - this.camera.x;
                const screenY = y * TILE_SIZE - this.camera.y;
                
                this.ctx.fillStyle = TILE_COLORS[tile];
                this.ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1);
                
                // Enhanced tile textures
                if (tile === TILES.GRASS) {
                    const hash = (x * 31 + y * 17) % 100;
                    if (hash < 30) {
                        this.ctx.fillStyle = 'rgba(0, 60, 0, 0.25)';
                        this.ctx.fillRect(screenX + (hash % 20) + 5, screenY + (hash % 15) + 5, 4, 4);
                    }
                    if (hash > 70) {
                        this.ctx.fillStyle = 'rgba(100, 180, 100, 0.2)';
                        this.ctx.fillRect(screenX + (hash % 25) + 10, screenY + (hash % 20) + 8, 3, 3);
                    }
                    if (hash > 85) {
                        this.ctx.fillStyle = 'rgba(255, 255, 100, 0.15)';
                        this.ctx.beginPath();
                        this.ctx.arc(screenX + 24, screenY + 24, 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                } else if (tile === TILES.WATER) {
                    const wave1 = Math.sin((x * 0.8 + y * 0.5 + time / 400) * 0.8) * 8;
                    const wave2 = Math.sin((x * 0.5 + y * 0.8 + time / 600) * 0.6) * 5;
                    this.ctx.fillStyle = 'rgba(80, 140, 255, 0.35)';
                    this.ctx.fillRect(screenX + wave1 + 5, screenY + 15, 25, 4);
                    this.ctx.fillStyle = 'rgba(150, 200, 255, 0.25)';
                    this.ctx.fillRect(screenX + wave2 + 18, screenY + 32, 20, 3);
                    const shimmer = Math.sin(time / 300 + x + y) * 0.3 + 0.2;
                    if (shimmer > 0.3) {
                        this.ctx.fillStyle = `rgba(255, 255, 255, ${shimmer * 0.3})`;
                        this.ctx.fillRect(screenX + ((x * 13 + y * 7) % 30) + 8, screenY + ((x * 7 + y * 11) % 25) + 10, 3, 2);
                    }
                } else if (tile === TILES.SAND) {
                    const hash = (x * 23 + y * 31) % 100;
                    if (hash < 40) {
                        this.ctx.fillStyle = 'rgba(180, 150, 100, 0.2)';
                        this.ctx.fillRect(screenX + (hash % 30) + 5, screenY + (hash % 25) + 5, 3, 3);
                    }
                    if (hash > 60) {
                        this.ctx.fillStyle = 'rgba(255, 240, 200, 0.15)';
                        this.ctx.fillRect(screenX + (hash % 20) + 15, screenY + (hash % 18) + 12, 2, 2);
                    }
                } else if (tile === TILES.SNOW) {
                    const sparkle = Math.sin(time / 200 + x * 3 + y * 2) * 0.5 + 0.5;
                    if (sparkle > 0.7) {
                        this.ctx.fillStyle = `rgba(255, 255, 255, ${sparkle * 0.6})`;
                        this.ctx.beginPath();
                        this.ctx.arc(screenX + ((x * 17 + y * 13) % 35) + 8, screenY + ((x * 11 + y * 19) % 30) + 8, 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    const hash = (x * 29 + y * 37) % 100;
                    if (hash < 25) {
                        this.ctx.fillStyle = 'rgba(200, 210, 230, 0.25)';
                        this.ctx.fillRect(screenX + (hash % 25) + 10, screenY + (hash % 20) + 10, 4, 4);
                    }
                } else if (tile === TILES.LAVA) {
                    const glow = Math.sin(time / 150 + x * 2 + y) * 0.4 + 0.6;
                    this.ctx.fillStyle = `rgba(255, 150, 0, ${glow * 0.4})`;
                    this.ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1);
                    const bubble = Math.sin(time / 100 + x * 5 + y * 3);
                    if (bubble > 0.8) {
                        this.ctx.fillStyle = 'rgba(255, 200, 50, 0.7)';
                        this.ctx.beginPath();
                        this.ctx.arc(screenX + ((x * 13 + y * 17) % 30) + 10, screenY + ((x * 7 + y * 11) % 25) + 10, 4 + bubble * 3, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                } else if (tile === TILES.STONE) {
                    const hash = (x * 41 + y * 47) % 100;
                    if (hash < 35) {
                        this.ctx.fillStyle = 'rgba(80, 80, 90, 0.3)';
                        this.ctx.fillRect(screenX + (hash % 25) + 8, screenY + (hash % 20) + 8, 6, 4);
                    }
                    if (hash > 65) {
                        this.ctx.fillStyle = 'rgba(120, 120, 130, 0.2)';
                        this.ctx.fillRect(screenX + (hash % 18) + 18, screenY + (hash % 22) + 15, 5, 5);
                    }
                } else if (tile === TILES.DIRT) {
                    const hash = (x * 37 + y * 43) % 100;
                    if (hash < 30) {
                        this.ctx.fillStyle = 'rgba(100, 70, 50, 0.25)';
                        this.ctx.fillRect(screenX + (hash % 28) + 6, screenY + (hash % 24) + 6, 4, 3);
                    }
                }
            }
        }
        
        // Render path preview (when hovering)
        if (this.navigationState.showPathPreview && this.navigationState.previewPath.length > 1) {
            this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 8]);
            this.ctx.beginPath();
            
            const firstNode = this.navigationState.previewPath[0];
            this.ctx.moveTo(
                firstNode.x * TILE_SIZE + TILE_SIZE / 2 - this.camera.x,
                firstNode.y * TILE_SIZE + TILE_SIZE / 2 - this.camera.y
            );
            
            for (let i = 1; i < this.navigationState.previewPath.length; i++) {
                const node = this.navigationState.previewPath[i];
                this.ctx.lineTo(
                    node.x * TILE_SIZE + TILE_SIZE / 2 - this.camera.x,
                    node.y * TILE_SIZE + TILE_SIZE / 2 - this.camera.y
                );
            }
            
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw destination marker
            const lastNode = this.navigationState.previewPath[this.navigationState.previewPath.length - 1];
            const destX = lastNode.x * TILE_SIZE + TILE_SIZE / 2 - this.camera.x;
            const destY = lastNode.y * TILE_SIZE + TILE_SIZE / 2 - this.camera.y;
            
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.arc(destX, destY, 8 + Math.sin(time / 200) * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Render active path (when moving via pathfinding)
        if (this.navigationState.path.length > this.navigationState.pathIndex) {
            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            
            this.ctx.moveTo(this.player.x - this.camera.x, this.player.y - this.camera.y);
            
            for (let i = this.navigationState.pathIndex; i < this.navigationState.path.length; i++) {
                const node = this.navigationState.path[i];
                this.ctx.lineTo(
                    node.x * TILE_SIZE + TILE_SIZE / 2 - this.camera.x,
                    node.y * TILE_SIZE + TILE_SIZE / 2 - this.camera.y
                );
            }
            
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw current waypoint
            if (this.navigationState.pathIndex < this.navigationState.path.length) {
                const current = this.navigationState.path[this.navigationState.pathIndex];
                this.ctx.fillStyle = 'rgba(255, 255, 100, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(
                    current.x * TILE_SIZE + TILE_SIZE / 2 - this.camera.x,
                    current.y * TILE_SIZE + TILE_SIZE / 2 - this.camera.y,
                    6, 0, Math.PI * 2
                );
                this.ctx.fill();
            }
        }
        
        // Render decorations with shadow
        for (const deco of this.decorations) {
            const screenX = deco.x - this.camera.x;
            const screenY = deco.y - this.camera.y;
            
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH + TILE_SIZE &&
                screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT + TILE_SIZE) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                this.ctx.beginPath();
                this.ctx.ellipse(screenX, screenY + 12, 12, 6, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.font = '32px Arial';
                this.ctx.fillText(deco.sprite, screenX, screenY);
            }
        }
        
        // Render NPCs with enhanced visuals
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            
            const screenX = npc.x - this.camera.x;
            const screenY = npc.y - this.camera.y;
            
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH + TILE_SIZE &&
                screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT + TILE_SIZE) {
                
                const dist = Math.hypot(npc.x - this.player.x, npc.y - this.player.y);
                const isNearby = dist < 120;
                const isHovered = this.hoveredNPC === npc;
                
                // NPC shadow
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                this.ctx.beginPath();
                this.ctx.ellipse(screenX, screenY + 15, 16, 9, 0, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Interaction glow for nearby friendly NPCs
                if (isNearby && !npc.hostile) {
                    const pulse = Math.sin(time / 300) * 0.2 + 0.4;
                    this.ctx.save();
                    this.ctx.shadowColor = '#44ff88';
                    this.ctx.shadowBlur = 15 + Math.sin(time / 200) * 5;
                    this.ctx.fillStyle = `rgba(68, 255, 136, ${pulse * 0.3})`;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY - 5, 25, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.restore();
                }
                
                // Hostile indicator
                if (npc.hostile && isNearby) {
                    const pulse = Math.sin(time / 200) * 0.3 + 0.5;
                    this.ctx.save();
                    this.ctx.shadowColor = '#ff4444';
                    this.ctx.shadowBlur = 12;
                    this.ctx.strokeStyle = `rgba(255, 68, 68, ${pulse})`;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY - 5, 28, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
                
                // NPC sprite with hover effect
                this.ctx.font = isHovered ? '40px Arial' : '36px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(npc.type.sprite, screenX, screenY);
                
                // Enemy Level Display - color coded based on difficulty relative to player
                if (npc.hostile && npc.level) {
                    const levelDiff = npc.level - this.player.level;
                    let levelColor;
                    if (levelDiff <= -3) {
                        levelColor = '#44ff44'; // Green - Easy
                    } else if (levelDiff <= 0) {
                        levelColor = '#ffff44'; // Yellow - Normal
                    } else if (levelDiff <= 2) {
                        levelColor = '#ff6644'; // Red - Hard
                    } else {
                        levelColor = '#cc44ff'; // Purple - Dangerous
                    }
                    
                    // Level badge above NPC
                    const levelText = `Lv.${npc.level}`;
                    this.ctx.font = 'bold 11px Arial';
                    const levelWidth = this.ctx.measureText(levelText).width;
                    
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.fillRect(screenX - levelWidth / 2 - 4, screenY - 55, levelWidth + 8, 14);
                    this.ctx.fillStyle = levelColor;
                    this.ctx.fillText(levelText, screenX, screenY - 44);
                }
                
                // NPC name with background
                this.ctx.font = '12px Arial';
                const nameWidth = this.ctx.measureText(npc.name).width;
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(screenX - nameWidth / 2 - 4, screenY - 37, nameWidth + 8, 16);
                this.ctx.fillStyle = npc.hostile ? '#ff6666' : (npc.type.name === 'Shopkeeper' ? '#ffcc44' : '#ffffff');
                this.ctx.fillText(npc.name, screenX, screenY - 25);
                
                // Health bar for all NPCs when damaged
                if (npc.health < npc.maxHealth) {
                    const barWidth = 44;
                    const healthPercent = npc.health / npc.maxHealth;
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    this.ctx.fillRect(screenX - barWidth / 2 - 2, screenY - 52, barWidth + 4, 10);
                    this.ctx.fillStyle = '#222';
                    this.ctx.fillRect(screenX - barWidth / 2, screenY - 50, barWidth, 6);
                    const healthColor = healthPercent > 0.5 ? '#44cc44' : (healthPercent > 0.25 ? '#cccc44' : '#cc4444');
                    this.ctx.fillStyle = healthColor;
                    this.ctx.fillRect(screenX - barWidth / 2, screenY - 50, barWidth * healthPercent, 6);
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(screenX - barWidth / 2, screenY - 50, barWidth, 6);
                }
                
                // Interaction hint for nearby friendly NPCs
                if (isNearby && !npc.hostile) {
                    const bobOffset = Math.sin(time / 250) * 3;
                    this.ctx.font = '14px Arial';
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    this.ctx.fillText('💬', screenX + 25, screenY - 15 + bobOffset);
                    
                    // Show "Press E to interact" prompt when very close
                    const playerDist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
                    if (playerDist < TILE_SIZE * 2) {
                        this.ctx.font = 'bold 11px Arial';
                        const promptText = 'Press E to talk';
                        const promptWidth = this.ctx.measureText(promptText).width;
                        
                        // Background for prompt
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                        this.ctx.fillRect(screenX - promptWidth / 2 - 6, screenY + 18, promptWidth + 12, 18);
                        this.ctx.strokeStyle = 'rgba(68, 255, 136, 0.6)';
                        this.ctx.lineWidth = 1;
                        this.ctx.strokeRect(screenX - promptWidth / 2 - 6, screenY + 18, promptWidth + 12, 18);
                        
                        // Prompt text
                        this.ctx.fillStyle = '#88ffaa';
                        this.ctx.fillText(promptText, screenX, screenY + 31);
                    }
                }
                
                // Hover highlight glow effect for interactable NPCs
                if (isHovered) {
                    this.ctx.save();
                    this.ctx.shadowColor = npc.hostile ? '#ff4444' : '#44ff88';
                    this.ctx.shadowBlur = 20;
                    this.ctx.strokeStyle = npc.hostile ? 'rgba(255, 68, 68, 0.6)' : 'rgba(68, 255, 136, 0.6)';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY - 5, 30, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            }
        }
        
        // Render treasure chests with enhanced effects
        for (const chest of this.treasureChests) {
            const screenX = chest.x - this.camera.x;
            const screenY = chest.y - this.camera.y;
            
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH + TILE_SIZE &&
                screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT + TILE_SIZE) {
                
                // Chest shadow
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                this.ctx.beginPath();
                this.ctx.ellipse(screenX, screenY + 10, 14, 7, 0, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Chest glow for unopened
                if (!chest.opened) {
                    const glow = Math.sin(time / 300) * 0.3 + 0.5;
                    this.ctx.save();
                    this.ctx.shadowColor = '#ffd700';
                    this.ctx.shadowBlur = 15 + Math.sin(time / 200) * 8;
                    this.ctx.fillStyle = `rgba(255, 215, 0, ${glow * 0.2})`;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY, 22, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.restore();
                }
                
                this.ctx.font = '28px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(chest.sprite, screenX, screenY);
                
                // Enhanced sparkle effect for unopened chests
                if (!chest.opened) {
                    const sparkle1 = Math.sin(time / 200) * 5;
                    const sparkle2 = Math.cos(time / 250) * 4;
                    this.ctx.fillText('✨', screenX + sparkle1, screenY - 18);
                    this.ctx.font = '16px Arial';
                    this.ctx.fillText('✨', screenX - 15 + sparkle2, screenY - 8);
                    this.ctx.fillText('✨', screenX + 15 - sparkle2, screenY - 5);
                }
            }
        }
        
        // Render player with enhanced visuals
        const playerScreenX = this.player.x - this.camera.x;
        const playerScreenY = this.player.y - this.camera.y;
        
        // Player shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        this.ctx.beginPath();
        this.ctx.ellipse(playerScreenX, playerScreenY + 18, 20, 11, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Player glow based on health
        const healthPercent = this.player.health / this.player.maxHealth;
        if (healthPercent < 0.3) {
            const pulse = Math.sin(time / 150) * 0.3 + 0.5;
            this.ctx.save();
            this.ctx.shadowColor = '#ff4444';
            this.ctx.shadowBlur = 20;
            this.ctx.fillStyle = `rgba(255, 68, 68, ${pulse * 0.15})`;
            this.ctx.beginPath();
            this.ctx.arc(playerScreenX, playerScreenY, 30, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
        
        // Player sprite
        this.ctx.font = '42px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.player.sprite, playerScreenX, playerScreenY);
        
        // Movement indicator with enhanced visuals
        if (Math.hypot(this.player.targetX - this.player.x, this.player.targetY - this.player.y) > 10) {
            const targetScreenX = this.player.targetX - this.camera.x;
            const targetScreenY = this.player.targetY - this.camera.y;
            
            // Animated dashed line
            const dashOffset = (time / 50) % 20;
            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.4)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 8]);
            this.ctx.lineDashOffset = -dashOffset;
            this.ctx.beginPath();
            this.ctx.moveTo(playerScreenX, playerScreenY);
            this.ctx.lineTo(targetScreenX, targetScreenY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.lineDashOffset = 0;
            
            // Pulsing target marker
            const pulse = Math.sin(time / 200) * 3 + 12;
            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.7)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(targetScreenX, targetScreenY, pulse, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Inner marker
            this.ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(targetScreenX, targetScreenY, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Render quest markers on screen
        this.renderQuestMarkers(time);
        
        // Update and render particles
        this.particles.update();
        this.particles.render(this.ctx, this.camera.x, this.camera.y);
        
        // Determine current region for ambient particles
        const tileX = Math.floor(this.player.x / TILE_SIZE);
        const tileY = Math.floor(this.player.y / TILE_SIZE);
        let currentRegion = 'default';
        if (tileY < 20) currentRegion = 'snow';
        else if (tileX > 165 && tileY < 25) currentRegion = 'lava';
        else if (tileX > 90 && tileX < 115 && tileY > 65 && tileY < 85) currentRegion = 'forest';
        else if (tileX > 110 && tileX < 135 && tileY > 95) currentRegion = 'swamp';
        
        // Update ambient particles
        this.particles.updateAmbientParticles(this.camera.x, this.camera.y, currentRegion, this.weather, this.timeOfDay);
        for (const p of this.particles.ambientParticles) {
            if (p.startX === undefined) {
                p.startX = this.camera.x;
                p.startY = this.camera.y;
            }
        }
        this.particles.renderAmbient(this.ctx, this.camera.x, this.camera.y, this.weather);
        
        // Enhanced day/night cycle overlay
        if (this.dayNightCycle) {
            let alpha = 0;
            let overlayColor = '';
            
            if (this.timeOfDay >= 20 || this.timeOfDay < 6) {
                // Night time - deep blue overlay with stars
                const nightHour = this.timeOfDay >= 20 ? this.timeOfDay - 20 : this.timeOfDay + 4;
                alpha = Math.min(0.55, nightHour < 5 ? 0.55 : (10 - nightHour) / 10);
                
                // Create gradient for night
                const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
                gradient.addColorStop(0, `rgba(10, 10, 40, ${alpha})`);
                gradient.addColorStop(1, `rgba(20, 25, 60, ${alpha * 0.8})`);
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                
                // Stars at night
                if (alpha > 0.3) {
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${(alpha - 0.2) * 0.8})`;
                    for (let i = 0; i < 30; i++) {
                        const starX = ((i * 47 + 13) % CANVAS_WIDTH);
                        const starY = ((i * 31 + 7) % (CANVAS_HEIGHT * 0.4));
                        const twinkle = Math.sin(time / 500 + i) * 0.5 + 0.5;
                        this.ctx.globalAlpha = twinkle * (alpha - 0.2);
                        this.ctx.beginPath();
                        this.ctx.arc(starX, starY, 1 + (i % 2), 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.globalAlpha = 1;
                }
            } else if (this.timeOfDay >= 6 && this.timeOfDay < 8) {
                // Dawn - warm orange/pink gradient
                alpha = (8 - this.timeOfDay) / 4 * 0.35;
                const gradient = this.ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                gradient.addColorStop(0, `rgba(255, 180, 120, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(255, 150, 100, ${alpha * 0.7})`);
                gradient.addColorStop(1, `rgba(255, 200, 150, ${alpha * 0.5})`);
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            } else if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
                // Dusk - warm red/orange gradient
                alpha = (this.timeOfDay - 18) / 4 * 0.4;
                const gradient = this.ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                gradient.addColorStop(0, `rgba(255, 100, 50, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(255, 80, 60, ${alpha * 0.8})`);
                gradient.addColorStop(1, `rgba(200, 60, 80, ${alpha * 0.6})`);
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        }
        
        // Enhanced weather effects
        if (this.weather === 'foggy') {
            // Layered fog effect
            const fogGradient = this.ctx.createRadialGradient(
                CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 100,
                CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH
            );
            fogGradient.addColorStop(0, 'rgba(200, 200, 220, 0.15)');
            fogGradient.addColorStop(0.5, 'rgba(180, 180, 200, 0.25)');
            fogGradient.addColorStop(1, 'rgba(150, 150, 180, 0.35)');
            this.ctx.fillStyle = fogGradient;
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Drifting fog wisps
            for (let i = 0; i < 5; i++) {
                const wispX = ((time / 50 + i * 300) % (CANVAS_WIDTH + 200)) - 100;
                const wispY = 200 + i * 100 + Math.sin(time / 1000 + i) * 50;
                const gradient = this.ctx.createRadialGradient(wispX, wispY, 0, wispX, wispY, 150);
                gradient.addColorStop(0, 'rgba(200, 200, 220, 0.2)');
                gradient.addColorStop(1, 'rgba(200, 200, 220, 0)');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(wispX - 150, wispY - 150, 300, 300);
            }
        } else if (this.weather === 'rainy') {
            // Rain overlay tint
            this.ctx.fillStyle = 'rgba(100, 120, 150, 0.1)';
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Enhanced rain drops with varying lengths
            for (let i = 0; i < 150; i++) {
                const x = (i * 37 + (time / 10)) % CANVAS_WIDTH;
                const y = (i * 23 + (time / 3)) % CANVAS_HEIGHT;
                const length = 10 + (i % 8);
                const alpha = 0.3 + (i % 3) * 0.1;
                
                this.ctx.strokeStyle = `rgba(150, 180, 220, ${alpha})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + 3, y + length);
                this.ctx.stroke();
            }
            
            // Puddle reflections on ground
            for (let i = 0; i < 8; i++) {
                const px = ((i * 157 + 50) % CANVAS_WIDTH);
                const py = 500 + ((i * 73) % 150);
                const ripple = Math.sin(time / 200 + i * 2) * 2 + 10;
                this.ctx.strokeStyle = 'rgba(150, 180, 220, 0.15)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.ellipse(px, py, ripple, ripple * 0.4, 0, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        } else if (this.weather === 'stormy') {
            // Dark storm overlay
            this.ctx.fillStyle = 'rgba(40, 40, 60, 0.25)';
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Heavy rain
            for (let i = 0; i < 200; i++) {
                const x = (i * 31 + (time / 8)) % CANVAS_WIDTH;
                const y = (i * 19 + (time / 2.5)) % CANVAS_HEIGHT;
                const length = 15 + (i % 10);
                
                this.ctx.strokeStyle = `rgba(150, 170, 200, ${0.25 + (i % 4) * 0.08})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + 4, y + length);
                this.ctx.stroke();
            }
            
            // Lightning flash
            if (Math.random() < 0.008) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            } else if (Math.random() < 0.015) {
                // Distant lightning glow
                this.ctx.fillStyle = 'rgba(200, 200, 255, 0.2)';
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        }
        
        // Render minimap
        this.renderMinimap();
    }
    
    renderMinimap() {
        const mmCtx = this.minimapCtx;
        const time = performance.now();
        
        // Background with gradient
        const bgGradient = mmCtx.createLinearGradient(0, 0, 150, 150);
        bgGradient.addColorStop(0, 'rgba(20, 20, 40, 0.85)');
        bgGradient.addColorStop(1, 'rgba(10, 10, 30, 0.9)');
        mmCtx.fillStyle = bgGradient;
        mmCtx.fillRect(0, 0, 150, 150);
        
        // Draw simplified map
        const tileScale = 150 / this.world.width;
        const yScale = 150 / this.world.height;
        for (let y = 0; y < this.world.height; y += 3) {
            for (let x = 0; x < this.world.width; x += 3) {
                const tile = this.world.map[y][x];
                mmCtx.fillStyle = TILE_COLORS[tile];
                mmCtx.fillRect(x * tileScale / 3, y * yScale, tileScale, tileScale);
            }
        }
        
        // Location markers
        const locations = [
            { name: 'Village', x: 50, y: 75, icon: '🏘️', discovered: this.discoveredLocations.has('Starting Village') },
            { name: 'Forest', x: 100, y: 75, icon: '🌲', discovered: this.discoveredLocations.has('Dark Forest') },
            { name: 'Pirate', x: 150, y: 90, icon: '🏴‍☠️', discovered: this.discoveredLocations.has('Pirate Cove') },
            { name: 'Western', x: 80, y: 40, icon: '🤠', discovered: this.discoveredLocations.has('Western Town') },
            { name: 'Castle', x: 30, y: 50, icon: '🏰', discovered: this.discoveredLocations.has('Medieval Castle') },
            { name: 'Swamp', x: 120, y: 100, icon: '🐸', discovered: this.discoveredLocations.has('Mystic Swamp') },
            { name: 'Mountain', x: 100, y: 20, icon: '⛰️', discovered: this.discoveredLocations.has('Mountain Pass') },
            { name: 'Dragon', x: 180, y: 12, icon: '🐉', discovered: this.discoveredLocations.has("Dragon's Lair") }
        ];
        
        for (const loc of locations) {
            const locX = loc.x * tileScale / 3;
            const locY = loc.y * yScale;
            
            if (loc.discovered) {
                mmCtx.font = '10px Arial';
                mmCtx.textAlign = 'center';
                mmCtx.fillText(loc.icon, locX, locY + 4);
            } else {
                const pulse = Math.sin(time / 500 + loc.x) * 0.3 + 0.7;
                mmCtx.fillStyle = `rgba(100, 100, 100, ${pulse * 0.5})`;
                mmCtx.beginPath();
                mmCtx.arc(locX, locY, 3, 0, Math.PI * 2);
                mmCtx.fill();
            }
        }
        
        // Draw treasure chests on minimap
        for (const chest of this.treasureChests) {
            if (chest.opened) continue;
            const chestX = (chest.x / TILE_SIZE) * tileScale / 3;
            const chestY = (chest.y / TILE_SIZE) * yScale;
            const sparkle = Math.sin(time / 300 + chest.x) * 0.5 + 0.5;
            
            mmCtx.fillStyle = `rgba(255, 215, 0, ${0.4 + sparkle * 0.4})`;
            mmCtx.beginPath();
            mmCtx.arc(chestX, chestY, 2, 0, Math.PI * 2);
            mmCtx.fill();
        }
        
        // Draw NPCs as dots
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const npcMmX = (npc.x / TILE_SIZE) * tileScale / 3;
            const npcMmY = (npc.y / TILE_SIZE) * yScale;
            
            if (npc.hostile) {
                const pulse = Math.sin(time / 200 + npc.x) * 0.3 + 0.7;
                mmCtx.fillStyle = `rgba(255, 68, 68, ${pulse})`;
            } else {
                mmCtx.fillStyle = '#44ff88';
            }
            mmCtx.beginPath();
            mmCtx.arc(npcMmX, npcMmY, npc.hostile ? 2.5 : 2, 0, Math.PI * 2);
            mmCtx.fill();
        }
        
        // Draw player position with glow
        const playerMmX = (this.player.x / TILE_SIZE) * tileScale / 3;
        const playerMmY = (this.player.y / TILE_SIZE) * yScale;
        
        // Player glow
        const playerPulse = Math.sin(time / 300) * 2 + 6;
        mmCtx.save();
        mmCtx.shadowColor = '#ffff00';
        mmCtx.shadowBlur = 8;
        mmCtx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        mmCtx.beginPath();
        mmCtx.arc(playerMmX, playerMmY, playerPulse, 0, Math.PI * 2);
        mmCtx.fill();
        mmCtx.restore();
        
        // Player dot
        mmCtx.fillStyle = '#ffff00';
        mmCtx.beginPath();
        mmCtx.arc(playerMmX, playerMmY, 4, 0, Math.PI * 2);
        mmCtx.fill();
        
        // Direction indicator
        const angle = Math.atan2(this.player.targetY - this.player.y, this.player.targetX - this.player.x);
        mmCtx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        mmCtx.lineWidth = 2;
        mmCtx.beginPath();
        mmCtx.moveTo(playerMmX, playerMmY);
        mmCtx.lineTo(playerMmX + Math.cos(angle) * 8, playerMmY + Math.sin(angle) * 8);
        mmCtx.stroke();
        
        // Camera viewport indicator
        const viewX = (this.camera.x / TILE_SIZE) * tileScale / 3;
        const viewY = (this.camera.y / TILE_SIZE) * yScale;
        const viewW = (CANVAS_WIDTH / TILE_SIZE) * tileScale / 3;
        const viewH = (CANVAS_HEIGHT / TILE_SIZE) * yScale;
        
        mmCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        mmCtx.lineWidth = 1;
        mmCtx.strokeRect(viewX, viewY, viewW, viewH);
        
        // Minimap border
        mmCtx.strokeStyle = 'rgba(100, 100, 150, 0.6)';
        mmCtx.lineWidth = 2;
        mmCtx.strokeRect(1, 1, 148, 148);
        
        // Compass indicator
        mmCtx.font = '10px Arial';
        mmCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        mmCtx.textAlign = 'center';
        mmCtx.fillText('N', 75, 12);
        
        // Click-to-move hint
        mmCtx.font = '8px Arial';
        mmCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        mmCtx.textAlign = 'left';
        mmCtx.fillText('Click to move', 4, 145);
        
        // Draw quest markers on minimap
        const questTargets = this.getQuestObjectiveLocations();
        for (const target of questTargets) {
            const targetMmX = (target.x / TILE_SIZE) * tileScale / 3;
            const targetMmY = (target.y / TILE_SIZE) * yScale;
            const pulse = Math.sin(time / 300 + target.x) * 0.3 + 0.7;
            
            // Quest marker icon on minimap
            mmCtx.fillStyle = target.isMain ? `rgba(255, 204, 68, ${pulse})` : `rgba(68, 170, 255, ${pulse})`;
            mmCtx.beginPath();
            mmCtx.arc(targetMmX, targetMmY, 3.5, 0, Math.PI * 2);
            mmCtx.fill();
            mmCtx.strokeStyle = target.isMain ? '#ffcc44' : '#44aaff';
            mmCtx.lineWidth = 1;
            mmCtx.stroke();
        }
    }
    
    getQuestObjectiveLocations() {
        const objectives = [];
        
        // Define quest objective locations based on quest stages
        const questLocations = {
            'MAIN_QUEST': {
                0: { x: 25 * TILE_SIZE, y: 30 * TILE_SIZE, desc: 'Village Elder' },
                1: { x: 75 * TILE_SIZE, y: 55 * TILE_SIZE, desc: 'Gather clues' },
                2: { x: 140 * TILE_SIZE, y: 15 * TILE_SIZE, desc: 'Mountain Pass' },
                3: { x: 180 * TILE_SIZE, y: 12 * TILE_SIZE, desc: 'Dragon Lair' }
            },
            'PIRATE_SHIP': {
                0: { x: 60 * TILE_SIZE, y: 115 * TILE_SIZE, desc: 'Pirate Captain' }
            },
            'SHERIFF_BOUNTY': {
                0: { x: 155 * TILE_SIZE, y: 75 * TILE_SIZE, desc: 'Sheriff' },
                1: { x: 130 * TILE_SIZE, y: 55 * TILE_SIZE, desc: 'Bandits' }
            },
            'GHOST_MYSTERY': {
                0: { x: 75 * TILE_SIZE, y: 42 * TILE_SIZE, desc: 'Castle' },
                1: { x: 78 * TILE_SIZE, y: 38 * TILE_SIZE, desc: 'Ghost' }
            },
            'WOLF_HUNT': {
                1: { x: 95 * TILE_SIZE, y: 72 * TILE_SIZE, desc: 'Wolves' }
            },
            'GOLD_MINE': {
                0: { x: 160 * TILE_SIZE, y: 60 * TILE_SIZE, desc: 'Mine' },
                1: { x: 165 * TILE_SIZE, y: 58 * TILE_SIZE, desc: 'Rattlesnake Rogers' }
            }
        };
        
        // Find active quest objectives
        for (const [questKey, quest] of Object.entries(this.quests)) {
            const locations = questLocations[questKey];
            if (!locations) continue;
            
            const isMain = questKey === 'MAIN_QUEST';
            
            // Find first incomplete stage
            for (let i = 0; i < quest.stages.length; i++) {
                const stage = quest.stages[i];
                if (!stage.completed && locations[i]) {
                    objectives.push({
                        x: locations[i].x,
                        y: locations[i].y,
                        desc: locations[i].desc,
                        questTitle: quest.title,
                        isMain: isMain
                    });
                    break;
                }
            }
        }
        
        return objectives;
    }
    
    renderQuestMarkers(time) {
        const objectives = this.getQuestObjectiveLocations();
        if (objectives.length === 0) return;
        
        this.ctx.save();
        
        for (const objective of objectives) {
            const screenX = objective.x - this.camera.x;
            const screenY = objective.y - this.camera.y;
            const distance = Math.hypot(objective.x - this.player.x, objective.y - this.player.y);
            const distanceTiles = Math.round(distance / TILE_SIZE);
            
            // Determine if objective is on screen
            const onScreenX = screenX > 30 && screenX < CANVAS_WIDTH - 30;
            const onScreenY = screenY > 30 && screenY < CANVAS_HEIGHT - 30;
            const onScreen = onScreenX && onScreenY;
            
            // Color based on quest type (Gold for main, Blue for side)
            const markerColor = objective.isMain ? '#ffcc44' : '#44aaff';
            const markerColorRGB = objective.isMain ? '255, 204, 68' : '68, 170, 255';
            
            if (onScreen) {
                // Draw marker directly on objective
                const pulse = Math.sin(time / 250) * 5 + 25;
                const bobY = Math.sin(time / 400) * 5;
                
                // Glowing circle
                this.ctx.strokeStyle = markerColor;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY - 40 + bobY, pulse, 0, Math.PI * 2);
                this.ctx.stroke();
                
                // Quest marker icon (star for main, diamond for side)
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillStyle = markerColor;
                this.ctx.fillText(objective.isMain ? '⭐' : '◆', screenX, screenY - 35 + bobY);
                
                // Distance text
                this.ctx.font = '10px Arial';
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.fillText(`${distanceTiles}m`, screenX, screenY - 55 + bobY);
            } else {
                // Draw arrow pointing to off-screen objective
                const angle = Math.atan2(objective.y - this.player.y, objective.x - this.player.x);
                const edgeMargin = 50;
                
                // Calculate arrow position at screen edge
                let arrowX, arrowY;
                const playerScreenX = this.player.x - this.camera.x;
                const playerScreenY = this.player.y - this.camera.y;
                
                // Find intersection with screen edge
                const slopes = [
                    { edge: 'top', y: edgeMargin, x: playerScreenX + (edgeMargin - playerScreenY) / Math.tan(angle) },
                    { edge: 'bottom', y: CANVAS_HEIGHT - edgeMargin, x: playerScreenX + (CANVAS_HEIGHT - edgeMargin - playerScreenY) / Math.tan(angle) },
                    { edge: 'left', x: edgeMargin, y: playerScreenY + (edgeMargin - playerScreenX) * Math.tan(angle) },
                    { edge: 'right', x: CANVAS_WIDTH - edgeMargin, y: playerScreenY + (CANVAS_WIDTH - edgeMargin - playerScreenX) * Math.tan(angle) }
                ];
                
                // Find valid intersection point
                for (const s of slopes) {
                    if (s.x >= edgeMargin && s.x <= CANVAS_WIDTH - edgeMargin && 
                        s.y >= edgeMargin && s.y <= CANVAS_HEIGHT - edgeMargin) {
                        arrowX = s.x;
                        arrowY = s.y;
                        break;
                    }
                }
                
                if (arrowX === undefined) {
                    arrowX = Math.max(edgeMargin, Math.min(CANVAS_WIDTH - edgeMargin, screenX));
                    arrowY = Math.max(edgeMargin, Math.min(CANVAS_HEIGHT - edgeMargin, screenY));
                }
                
                // Draw pointing arrow
                const pulse = Math.sin(time / 200) * 3;
                
                this.ctx.save();
                this.ctx.translate(arrowX, arrowY);
                this.ctx.rotate(angle);
                
                // Arrow background glow
                this.ctx.shadowColor = markerColor;
                this.ctx.shadowBlur = 10;
                
                // Arrow shape
                this.ctx.fillStyle = markerColor;
                this.ctx.beginPath();
                this.ctx.moveTo(15 + pulse, 0);
                this.ctx.lineTo(-5, -10);
                this.ctx.lineTo(-5, 10);
                this.ctx.closePath();
                this.ctx.fill();
                
                this.ctx.restore();
                
                // Distance label near arrow
                this.ctx.font = 'bold 11px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(arrowX - 25, arrowY + 12, 50, 16);
                this.ctx.fillStyle = markerColor;
                this.ctx.fillText(`${distanceTiles}m`, arrowX, arrowY + 24);
            }
        }
        
        this.ctx.restore();
    }
}

// Combat System
class CombatSystem {
    constructor(game) {
        this.game = game;
        this.enemy = null;
        this.playerTurn = true;
        this.defending = false;
        this.combatLog = [];
        this.turnNumber = 0;
    }
    
    start(npc) {
        this.enemy = npc;
        this.game.inCombat = true;
        this.playerTurn = true;
        this.defending = false;
        this.combatLog = [];
        this.turnNumber = 1;
        
        // Start combat music
        soundSystem.startCombatMusic();
        
        document.getElementById('combat-ui').style.display = 'block';
        document.getElementById('enemy-name').textContent = npc.name;
        document.getElementById('enemy-sprite').textContent = npc.type.sprite;
        
        this.updateCombatUI();
        this.log(`Battle started against ${npc.name}!`, 'info');
        this.log(`--- Turn ${this.turnNumber} ---`, 'turn-start');
    }
    
    playerAction(action) {
        if (!this.playerTurn) return;
        
        switch(action) {
            case 'attack':
                soundSystem.playSwordSwing();
                this.attack(this.game.player, this.enemy, false);
                break;
            case 'heavy':
                soundSystem.playHeavyAttack();
                this.attack(this.game.player, this.enemy, true);
                break;
            case 'defend':
                this.defending = true;
                soundSystem.playShieldBlock();
                this.log('You take a defensive stance!', 'buff');
                break;
            case 'heal':
                const healAmount = 30;
                this.game.player.health = Math.min(
                    this.game.player.health + healAmount,
                    this.game.player.maxHealth
                );
                this.game.particles.emit(this.game.player.x, this.game.player.y - 10, 'heal', 20);
                soundSystem.playHealChime();
                this.log(`You heal for ${healAmount} HP!`, 'heal');
                break;
            case 'flee':
                soundSystem.playFleeWhoosh();
                if (Math.random() < 0.5) {
                    this.log('You escaped!', 'info');
                    soundSystem.stopCombatMusic();
                    this.endCombat(false);
                    return;
                } else {
                    this.log('Failed to escape!', 'info');
                }
                break;
        }
        
        this.updateCombatUI();
        
        if (this.enemy.health <= 0) {
            this.victory();
            return;
        }
        
        // Enemy turn
        this.playerTurn = false;
        setTimeout(() => this.enemyTurn(), 1000);
    }
    
    attack(attacker, defender, isHeavy) {
        let damage = attacker.attack;
        
        if (isHeavy) {
            damage *= 1.5;
            if (Math.random() < 0.3) {
                this.log('Heavy attack missed!', 'info');
                return;
            }
        }
        
        // Apply defense
        const defenseReduction = defender === this.enemy ? 
            defender.defense : 
            (this.defending ? defender.defense * 2 : defender.defense);
        
        damage = Math.max(1, damage - defenseReduction / 2);
        damage = Math.floor(damage * (0.8 + Math.random() * 0.4));
        
        // Critical hit
        const isCritical = Math.random() < 0.1;
        if (isCritical) {
            damage *= 2;
            this.log('CRITICAL HIT!', 'critical');
        }
        
        defender.health -= damage;
        
        // Play hit impact sound
        soundSystem.playHitImpact();
        
        // Combat hit particles
        const targetX = defender === this.game.player ? this.game.player.x : this.enemy.x;
        const targetY = defender === this.game.player ? this.game.player.y : this.enemy.y;
        this.game.particles.emit(targetX, targetY - 10, 'combat_hit', isCritical ? 20 : 12);
        if (isHeavy) {
            this.game.particles.emit(targetX, targetY, 'fire', 8);
        }
        
        const attackerName = attacker === this.game.player ? 'You' : attacker.name;
        const defenderName = defender === this.game.player ? 'you' : defender.name;
        this.log(`${attackerName} ${isHeavy ? 'heavily strike' : 'attack'} ${defenderName} for ${Math.floor(damage)} damage!`, 'damage');
        
        this.defending = false;
    }
    
    enemyTurn() {
        if (this.enemy.health <= 0) return;
        
        // Simple AI
        const action = Math.random();
        
        if (action < 0.7) {
            this.attack(this.enemy, this.game.player, false);
        } else if (action < 0.9) {
            this.attack(this.enemy, this.game.player, true);
        } else {
            this.log(`${this.enemy.name} prepares to attack...`, 'buff');
        }
        
        this.updateCombatUI();
        this.game.updateHUD();
        
        if (this.game.player.health <= 0) {
            this.defeat();
            return;
        }
        
        // Increment turn number and log new turn
        this.turnNumber++;
        this.log(`--- Turn ${this.turnNumber} ---`, 'turn-start');
        
        this.playerTurn = true;
    }
    
    victory() {
        const xpGain = this.enemy.level * 25;
        const goldGain = this.enemy.level * 10 + Math.floor(Math.random() * 20);
        
        // Play victory sounds
        soundSystem.stopCombatMusic();
        soundSystem.playVictoryJingle();
        soundSystem.playGoldPickup();
        
        // Enemy death particles
        this.game.particles.emit(this.enemy.x, this.enemy.y, 'death', 25);
        this.game.particles.emit(this.enemy.x, this.enemy.y - 10, 'treasure', 15);
        
        this.log(`Victory! Gained ${xpGain} XP and ${goldGain} gold!`, 'heal');
        
        this.game.gainXP(xpGain);
        this.game.totalXPGained += xpGain;
        this.game.player.gold += goldGain;
        this.game.totalGoldEarned += goldGain;
        this.game.killCount++;
        
        // Notify spawner if this was a spawned enemy
        if (this.enemy.isSpawned && this.game.spawner) {
            this.game.spawner.onEnemyKilled();
        }
        
        // Random item drop
        if (Math.random() < 0.2) {
            const dropChance = Math.random();
            if (dropChance < 0.7) {
                const existing = this.game.player.inventory.find(i => i.item && i.item.name === 'Health Potion');
                if (existing) {
                    existing.count = (existing.count || 1) + 1;
                } else {
                    this.game.player.inventory.push({ item: ITEMS.HEALTH_POTION, count: 1 });
                }
                this.log('Enemy dropped a Health Potion!');
            } else {
                const bonusGold = Math.floor(Math.random() * 30) + 10;
                this.game.player.gold += bonusGold;
                this.log(`Enemy dropped ${bonusGold} extra gold!`);
            }
        }
        
        // Check for bounty targets
        if (this.enemy.bountyTarget) {
            const stage = this.game.quests.SHERIFF_BOUNTY.stages[1];
            stage.count = (stage.count || 0) + 1;
            if (stage.count >= stage.required) {
                stage.completed = true;
                this.game.notify('Return to the Sheriff for your reward!');
            }
        }
        
        // Check for farm wolves
        if (this.enemy.farmWolf && this.game.quests.WOLF_HUNT.stages[0].completed) {
            const stage = this.game.quests.WOLF_HUNT.stages[1];
            stage.count = (stage.count || 0) + 1;
            if (stage.count >= stage.required) {
                stage.completed = true;
                this.game.notify('All wolves eliminated! Return to the farmer.');
            }
        }
        
        // Check for mine bandits
        if (this.enemy.mineBoss) {
            this.game.quests.GOLD_MINE.stages[1].completed = true;
            this.game.player.gold += 500;
            this.game.notify('Rattlesnake Rogers defeated! +500 gold from the mine!');
            this.game.quests.GOLD_MINE.stages[2].completed = true;
        }
        
        // Drop heirloom sword from specific bandits
        if (this.enemy.name && this.enemy.name.includes('Canyon') && !this.game.gameFlags.foundHeirloom) {
            if (Math.random() < 0.5) {
                this.game.player.inventory.push({ item: ITEMS.HEIRLOOM_SWORD });
                this.game.gameFlags.foundHeirloom = true;
                this.game.quests.LOST_HEIRLOOM.stages[1].completed = true;
                this.game.notify('Found the Ruby Heirloom Sword!');
            }
        }
        
        // Check for dragon
        if (this.enemy.boss && this.enemy.type === NPC_TYPES.DRAGON) {
            setTimeout(() => this.dragonVictory(), 2000);
        }
        
        this.enemy.alive = false;
        
        setTimeout(() => {
            this.endCombat(true);
            this.game.updateHUD();
        }, 2000);
    }
    
    dragonVictory() {
        this.game.quests.MAIN_QUEST.stages[3].completed = true;
        this.game.quests.MAIN_QUEST.stages[4].completed = true;
        this.game.player.gold += 10000;
        
        alert('🎉 CONGRATULATIONS! 🎉\n\n' +
              'You have slain the mighty dragon Infernus!\n\n' +
              'The treasure is yours - 10,000 gold pieces!\n\n' +
              'You are now a legend throughout the land!\n\n' +
              'THE END - Thanks for playing!');
    }
    
    defeat() {
        this.log('You have been defeated...');
        
        // Play defeat sounds
        soundSystem.stopCombatMusic();
        soundSystem.playDefeatJingle();
        
        setTimeout(() => {
            alert('You have fallen in battle!\n\nBut your journey is not over...\n\nYou wake up at the village, weakened but alive.');
            
            this.game.player.health = this.game.player.maxHealth / 2;
            this.game.player.x = 50 * TILE_SIZE;
            this.game.player.y = 75 * TILE_SIZE;
            this.game.player.targetX = this.game.player.x;
            this.game.player.targetY = this.game.player.y;
            this.game.player.gold = Math.floor(this.game.player.gold / 2);
            
            this.endCombat(false);
            this.game.updateHUD();
        }, 1500);
    }
    
    endCombat(victory) {
        document.getElementById('combat-ui').style.display = 'none';
        this.game.inCombat = false;
        this.enemy = null;
    }
    
    log(message, type = 'info') {
        const entry = {
            turn: this.turnNumber,
            message: message,
            type: type
        };
        this.combatLog.push(entry);
        this.updateCombatLog();
    }
    
    updateCombatLog() {
        const logDiv = document.getElementById('combat-log');
        const visibleEntries = this.combatLog.slice(-10);
        
        logDiv.innerHTML = visibleEntries.map(entry => {
            let cssClass = 'combat-log-entry';
            
            // Add type-based styling
            if (entry.type === 'turn-start') {
                cssClass += ' turn-start';
            } else if (entry.type === 'damage' || entry.message.includes('damage')) {
                cssClass += ' damage';
            } else if (entry.type === 'heal' || entry.message.includes('heal') || entry.message.includes('HP')) {
                cssClass += ' heal';
            } else if (entry.type === 'buff' || entry.message.includes('stance') || entry.message.includes('boost')) {
                cssClass += ' buff';
            } else if (entry.type === 'critical' || entry.message.includes('CRITICAL')) {
                cssClass += ' critical';
            } else {
                cssClass += ' info';
            }
            
            // Format the message
            let displayMsg = entry.message;
            if (entry.type !== 'turn-start' && entry.turn > 0) {
                displayMsg = `<span class="turn-number">T${entry.turn}</span>${entry.message}`;
            }
            
            return `<div class="${cssClass}">${displayMsg}</div>`;
        }).join('');
        
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    
    updateCombatUI() {
        document.getElementById('player-combat-health').style.width = 
            `${(this.game.player.health / this.game.player.maxHealth) * 100}%`;
        document.getElementById('enemy-combat-health').style.width = 
            `${(this.enemy.health / this.enemy.maxHealth) * 100}%`;
    }
}

// Gambling System
class GamblingSystem {
    constructor(game) {
        this.game = game;
        this.type = null;
        this.playerHand = [];
        this.opponentHand = [];
        this.bet = 10;
        this.gameState = 'waiting';
    }
    
    init(type) {
        this.type = type;
        this.bet = 10;
        this.gameState = 'waiting';
        this.playerHand = [];
        this.opponentHand = [];
        document.getElementById('current-bet').textContent = this.bet;
        document.getElementById('gambling-result').textContent = '';
        document.getElementById('card-hand').innerHTML = '';
        document.getElementById('opponent-cards').innerHTML = '';
    }
    
    deal() {
        if (this.game.player.gold < this.bet) {
            this.game.notify('Not enough gold!');
            return;
        }
        
        this.game.player.gold -= this.bet;
        this.game.updateHUD();
        this.gameState = 'playing';
        
        // Deal 5 cards to each player
        this.playerHand = this.dealCards(5);
        this.opponentHand = this.dealCards(5);
        
        this.renderHands();
    }
    
    dealCards(count) {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const cards = [];
        
        for (let i = 0; i < count; i++) {
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const value = values[Math.floor(Math.random() * values.length)];
            const numValue = values.indexOf(value) + 2;
            cards.push({ suit, value, numValue, isRed: suit === '♥' || suit === '♦' });
        }
        
        return cards;
    }
    
    renderHands() {
        const playerContainer = document.getElementById('card-hand');
        const opponentContainer = document.getElementById('opponent-cards');
        
        playerContainer.innerHTML = '';
        opponentContainer.innerHTML = '';
        
        this.playerHand.forEach(card => {
            const div = document.createElement('div');
            div.className = `playing-card ${card.isRed ? 'red' : ''}`;
            div.innerHTML = `<div>${card.value}</div><div>${card.suit}</div>`;
            playerContainer.appendChild(div);
        });
        
        this.opponentHand.forEach((card, i) => {
            const div = document.createElement('div');
            div.className = 'playing-card face-down';
            div.innerHTML = `<div>?</div><div>?</div>`;
            opponentContainer.appendChild(div);
        });
        
        // Show result after delay
        setTimeout(() => this.showResult(), 1500);
    }
    
    showResult() {
        // Reveal opponent cards
        const opponentContainer = document.getElementById('opponent-cards');
        opponentContainer.innerHTML = '';
        
        this.opponentHand.forEach(card => {
            const div = document.createElement('div');
            div.className = `playing-card ${card.isRed ? 'red' : ''}`;
            div.innerHTML = `<div>${card.value}</div><div>${card.suit}</div>`;
            opponentContainer.appendChild(div);
        });
        
        // Calculate scores (simplified - highest card wins)
        const playerScore = this.calculateHandValue(this.playerHand);
        const opponentScore = this.calculateHandValue(this.opponentHand);
        
        const resultDiv = document.getElementById('gambling-result');
        
        if (playerScore > opponentScore) {
            const winnings = this.bet * 2;
            this.game.player.gold += winnings;
            resultDiv.innerHTML = `<span style="color: #44ff44;">YOU WIN! +${winnings} gold!</span>`;
            this.game.gameFlags.wonGambling = true;
            
            // Special pirate victory
            if (this.type === 'pirate') {
                this.game.notify('You won the ship deed!');
                this.game.player.inventory.push({ item: ITEMS.SHIP_DEED });
                this.game.giveClue('clue2');
                this.game.quests.PIRATE_SHIP.stages[1].completed = true;
            }
        } else if (playerScore < opponentScore) {
            resultDiv.innerHTML = `<span style="color: #ff4444;">YOU LOSE! -${this.bet} gold</span>`;
        } else {
            this.game.player.gold += this.bet;
            resultDiv.innerHTML = `<span style="color: #ffff44;">TIE! Bet returned.</span>`;
        }
        
        this.game.updateHUD();
        this.gameState = 'finished';
    }
    
    calculateHandValue(hand) {
        // Check for pairs, straights, etc. (simplified)
        const values = hand.map(c => c.numValue).sort((a, b) => b - a);
        
        // Count pairs
        const counts = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);
        
        let score = Math.max(...values);
        
        // Pair bonus
        Object.values(counts).forEach(count => {
            if (count === 2) score += 20;
            if (count === 3) score += 50;
            if (count === 4) score += 100;
        });
        
        // Flush bonus (all same suit)
        if (hand.every(c => c.suit === hand[0].suit)) {
            score += 30;
        }
        
        return score;
    }
    
    raise() {
        if (this.gameState !== 'waiting') return;
        if (this.game.player.gold < this.bet * 2) {
            this.game.notify('Not enough gold to raise!');
            return;
        }
        this.bet *= 2;
        document.getElementById('current-bet').textContent = this.bet;
    }
    
    fold() {
        this.game.closeGambling();
    }
}

// Save/Load System
class SaveSystem {
    static save(game) {
        const saveData = {
            version: '1.1',
            timestamp: Date.now(),
            playTime: game.playTime,
            player: {
                x: game.player.x,
                y: game.player.y,
                health: game.player.health,
                maxHealth: game.player.maxHealth,
                level: game.player.level,
                xp: game.player.xp,
                xpToLevel: game.player.xpToLevel,
                gold: game.player.gold,
                attack: game.player.attack,
                defense: game.player.defense,
                baseAttack: game.player.baseAttack,
                baseDefense: game.player.baseDefense,
                inventory: game.player.inventory,
                equipment: game.player.equipment,
                allies: game.player.allies,
                reputation: game.player.reputation
            },
            quests: game.quests,
            cluesFound: game.cluesFound,
            gameFlags: game.gameFlags,
            discoveredLocations: Array.from(game.discoveredLocations),
            killCount: game.killCount,
            distanceTraveled: game.distanceTraveled,
            deadNPCs: game.npcs.filter(n => !n.alive).map(n => n.name),
            openedChests: game.treasureChests.filter(c => c.opened).map((c, i) => i),
            // QoL tracking data
            dayCount: game.dayCount,
            timeOfDay: game.timeOfDay,
            totalGoldEarned: game.totalGoldEarned,
            totalXPGained: game.totalXPGained,
            itemsBought: game.itemsBought,
            chestsOpened: game.chestsOpened
        };
        
        try {
            localStorage.setItem('dragonQuestSave', JSON.stringify(saveData));
            game.notify('Game Saved!', 'save');
            return true;
        } catch (e) {
            game.notify('Failed to save game!');
            return false;
        }
    }
    
    static load(game) {
        try {
            const saveData = JSON.parse(localStorage.getItem('dragonQuestSave'));
            if (!saveData) {
                game.notify('No save file found!');
                return false;
            }
            
            // Restore player state
            Object.assign(game.player, saveData.player);
            game.player.targetX = game.player.x;
            game.player.targetY = game.player.y;
            
            // Restore game state
            game.quests = saveData.quests;
            game.cluesFound = saveData.cluesFound;
            game.gameFlags = saveData.gameFlags;
            game.discoveredLocations = new Set(saveData.discoveredLocations);
            game.killCount = saveData.killCount;
            game.distanceTraveled = saveData.distanceTraveled;
            game.playTime = saveData.playTime;
            
            // Restore QoL tracking data (with defaults for old saves)
            game.dayCount = saveData.dayCount || 1;
            game.timeOfDay = saveData.timeOfDay || 8;
            game.totalGoldEarned = saveData.totalGoldEarned || game.player.gold;
            game.totalXPGained = saveData.totalXPGained || 0;
            game.itemsBought = saveData.itemsBought || 0;
            game.chestsOpened = saveData.chestsOpened || 0;
            
            // Mark dead NPCs
            saveData.deadNPCs.forEach(name => {
                const npc = game.npcs.find(n => n.name === name);
                if (npc) npc.alive = false;
            });
            
            // Mark opened chests
            saveData.openedChests.forEach(i => {
                if (game.treasureChests[i]) {
                    game.treasureChests[i].opened = true;
                    game.treasureChests[i].sprite = '📭';
                }
            });
            
            game.updateHUD();
            game.notify('Game loaded!');
            return true;
        } catch (e) {
            game.notify('Failed to load game!');
            return false;
        }
    }
    
    static hasSave() {
        return localStorage.getItem('dragonQuestSave') !== null;
    }
    
    static deleteSave() {
        localStorage.removeItem('dragonQuestSave');
    }
}

// Additional random enemy spawning for longer gameplay
class EnemySpawner {
    constructor(game) {
        this.game = game;
        this.spawnTimer = 0;
        this.maxRandomEnemies = 20;
        this.currentRandomEnemies = 0;
    }
    
    update(dt) {
        this.spawnTimer += dt;
        
        // Spawn enemies periodically based on player level
        if (this.spawnTimer > 30 && this.currentRandomEnemies < this.maxRandomEnemies) {
            this.spawnTimer = 0;
            this.trySpawnEnemy();
        }
    }
    
    trySpawnEnemy() {
        const playerTileX = Math.floor(this.game.player.x / TILE_SIZE);
        const playerTileY = Math.floor(this.game.player.y / TILE_SIZE);
        
        // Spawn enemy somewhere off-screen but nearby
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 10;
        const spawnX = Math.floor(playerTileX + Math.cos(angle) * distance);
        const spawnY = Math.floor(playerTileY + Math.sin(angle) * distance);
        
        if (!this.game.isWalkable(spawnX, spawnY)) return;
        
        // Determine enemy type based on region
        const enemyTypes = this.getEnemyTypesForLocation(spawnX, spawnY);
        if (enemyTypes.length === 0) return;
        
        const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const level = Math.max(1, this.game.player.level + Math.floor(Math.random() * 3) - 1);
        
        const enemy = {
            x: spawnX * TILE_SIZE + TILE_SIZE / 2,
            y: spawnY * TILE_SIZE + TILE_SIZE / 2,
            type: enemyType.type,
            name: enemyType.name + ' ' + generateName().split(' ')[0],
            hostile: true,
            alive: true,
            health: level * 18 + 25,
            maxHealth: level * 18 + 25,
            attack: level * 3 + 4,
            defense: level * 1.5,
            level: level,
            isSpawned: true
        };
        
        this.game.npcs.push(enemy);
        this.currentRandomEnemies++;
    }
    
    getEnemyTypesForLocation(x, y) {
        const types = [];
        
        // Forest area
        if (x > 80 && x < 120 && y > 60 && y < 90) {
            types.push({ type: NPC_TYPES.BEAST, name: 'Wild' });
            types.push({ type: NPC_TYPES.MONSTER, name: 'Forest' });
        }
        // Western area
        else if (x > 60 && x < 100 && y > 30 && y < 50) {
            types.push({ type: NPC_TYPES.BANDIT, name: 'Outlaw' });
        }
        // Swamp area
        else if (x > 110 && x < 140 && y > 90 && y < 120) {
            types.push({ type: NPC_TYPES.MONSTER, name: 'Swamp' });
            types.push({ type: NPC_TYPES.BEAST, name: 'Marsh' });
        }
        // Mountain area
        else if (y < 30) {
            types.push({ type: NPC_TYPES.MONSTER, name: 'Mountain' });
        }
        // Default roaming enemies
        else if (Math.random() < 0.3) {
            types.push({ type: NPC_TYPES.BANDIT, name: 'Wandering' });
        }
        
        return types;
    }
    
    onEnemyKilled() {
        this.currentRandomEnemies = Math.max(0, this.currentRandomEnemies - 1);
    }
}

// Achievement System
const ACHIEVEMENTS = [
    { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first enemy', check: (g) => g.killCount >= 1 },
    { id: 'slayer', name: 'Monster Slayer', desc: 'Defeat 10 enemies', check: (g) => g.killCount >= 10 },
    { id: 'champion', name: 'Champion', desc: 'Defeat 50 enemies', check: (g) => g.killCount >= 50 },
    { id: 'rich', name: 'Getting Rich', desc: 'Accumulate 500 gold', check: (g) => g.player.gold >= 500 },
    { id: 'wealthy', name: 'Wealthy', desc: 'Accumulate 2000 gold', check: (g) => g.player.gold >= 2000 },
    { id: 'explorer', name: 'Explorer', desc: 'Discover 5 locations', check: (g) => g.discoveredLocations.size >= 5 },
    { id: 'world_traveler', name: 'World Traveler', desc: 'Discover all locations', check: (g) => g.discoveredLocations.size >= 8 },
    { id: 'clue_hunter', name: 'Clue Hunter', desc: 'Find all 5 clues', check: (g) => g.cluesFound.length >= 5 },
    { id: 'level_5', name: 'Seasoned Adventurer', desc: 'Reach level 5', check: (g) => g.player.level >= 5 },
    { id: 'level_10', name: 'Veteran', desc: 'Reach level 10', check: (g) => g.player.level >= 10 },
    { id: 'dragon_slayer', name: 'Dragon Slayer', desc: 'Defeat the dragon', check: (g) => g.quests.MAIN_QUEST.stages[3].completed },
    { id: 'card_shark', name: 'Card Shark', desc: 'Win at gambling', check: (g) => g.gameFlags.wonGambling },
    { id: 'leader', name: 'Leader', desc: 'Recruit an ally', check: (g) => g.player.allies.length >= 1 }
];

class AchievementSystem {
    constructor(game) {
        this.game = game;
        this.unlocked = new Set();
    }
    
    check() {
        for (const achievement of ACHIEVEMENTS) {
            if (this.unlocked.has(achievement.id)) continue;
            
            if (achievement.check(this.game)) {
                this.unlocked.add(achievement.id);
                this.game.notify(`🏆 Achievement: ${achievement.name}!`);
            }
        }
    }
}

// Sound System - Procedural Audio with Web Audio API
class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        
        this.masterVolume = 0.7;
        this.musicVolume = 0.4;
        this.sfxVolume = 0.7;
        this.muted = false;
        
        this.currentMusic = null;
        this.currentAmbient = null;
        this.musicOscillators = [];
        this.ambientNodes = [];
        
        this.footstepTimer = 0;
        this.lastTerrain = null;
        
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.masterVolume;
            
            this.musicGain = this.audioContext.createGain();
            this.musicGain.connect(this.masterGain);
            this.musicGain.gain.value = this.musicVolume;
            
            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.connect(this.masterGain);
            this.sfxGain.gain.value = this.sfxVolume;
            
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }
    
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    setMasterVolume(value) {
        this.masterVolume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, this.audioContext.currentTime, 0.1);
        }
    }
    
    setMusicVolume(value) {
        this.musicVolume = Math.max(0, Math.min(1, value));
        if (this.musicGain) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume, this.audioContext.currentTime, 0.1);
        }
    }
    
    setSFXVolume(value) {
        this.sfxVolume = Math.max(0, Math.min(1, value));
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.audioContext.currentTime, 0.1);
        }
    }
    
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, this.audioContext.currentTime, 0.1);
        }
        return this.muted;
    }
    
    createNoise(duration, type = 'white') {
        if (!this.audioContext) return null;
        
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            if (type === 'white') {
                data[i] = white;
            } else if (type === 'pink') {
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
            } else if (type === 'brown') {
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 10;
            }
        }
        
        return buffer;
    }
    
    // UI Sounds
    playClick() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.05);
    }
    
    playMenuOpen() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const notes = [400, 600, 800];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.03;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);
            
            osc.start(startTime);
            osc.stop(startTime + 0.12);
        });
    }
    
    playMenuClose() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const notes = [800, 600, 400];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.03;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);
            
            osc.start(startTime);
            osc.stop(startTime + 0.08);
        });
    }
    
    playNotification() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const osc = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.type = 'sine';
        osc2.type = 'sine';
        osc.frequency.value = 880;
        osc2.frequency.value = 1320;
        
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        osc.start();
        osc2.start();
        osc.stop(this.audioContext.currentTime + 0.3);
        osc2.stop(this.audioContext.currentTime + 0.3);
    }
    
    // Combat Sounds
    playSwordSwing() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const noiseBuffer = this.createNoise(0.15, 'white');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(8000, this.audioContext.currentTime + 0.1);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start();
        noise.stop(this.audioContext.currentTime + 0.15);
    }
    
    playHitImpact() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const osc = this.audioContext.createOscillator();
        const noiseBuffer = this.createNoise(0.1, 'brown');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const oscGain = this.audioContext.createGain();
        const noiseGain = this.audioContext.createGain();
        
        osc.connect(oscGain);
        noise.connect(noiseGain);
        oscGain.connect(this.sfxGain);
        noiseGain.connect(this.sfxGain);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);
        
        oscGain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        noiseGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
        
        osc.start();
        noise.start();
        osc.stop(this.audioContext.currentTime + 0.1);
        noise.stop(this.audioContext.currentTime + 0.1);
    }
    
    playShieldBlock() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const osc = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.type = 'square';
        osc2.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.15);
        osc2.frequency.setValueAtTime(350, this.audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        osc.start();
        osc2.start();
        osc.stop(this.audioContext.currentTime + 0.15);
        osc2.stop(this.audioContext.currentTime + 0.15);
    }
    
    playHealChime() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
            
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        });
    }
    
    playFleeWhoosh() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const noiseBuffer = this.createNoise(0.4, 'pink');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, this.audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(2000, this.audioContext.currentTime + 0.2);
        filter.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.4);
        filter.Q.value = 2;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start();
        noise.stop(this.audioContext.currentTime + 0.4);
    }
    
    playHeavyAttack() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        this.playSwordSwing();
        
        setTimeout(() => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, this.audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.2);
            
            gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            osc.start();
            osc.stop(this.audioContext.currentTime + 0.2);
        }, 50);
    }
    
    // Movement Sounds - Footsteps based on terrain
    playFootstep(terrainType) {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const params = {
            [TILES.GRASS]: { freq: 200, noise: 'brown', duration: 0.08, volume: 0.15 },
            [TILES.STONE]: { freq: 400, noise: 'white', duration: 0.05, volume: 0.25 },
            [TILES.SAND]: { freq: 150, noise: 'pink', duration: 0.12, volume: 0.12 },
            [TILES.WOOD]: { freq: 300, noise: 'brown', duration: 0.06, volume: 0.2 },
            [TILES.DIRT]: { freq: 180, noise: 'brown', duration: 0.1, volume: 0.15 },
            [TILES.SNOW]: { freq: 100, noise: 'white', duration: 0.1, volume: 0.1 },
            [TILES.BRIDGE]: { freq: 350, noise: 'brown', duration: 0.06, volume: 0.22 },
            [TILES.DOCK]: { freq: 320, noise: 'brown', duration: 0.07, volume: 0.2 }
        };
        
        const p = params[terrainType] || params[TILES.GRASS];
        
        const noiseBuffer = this.createNoise(p.duration, p.noise);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = p.freq + Math.random() * 100;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(p.volume, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + p.duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start();
        noise.stop(this.audioContext.currentTime + p.duration);
    }
    
    playWaterSplash() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const noiseBuffer = this.createNoise(0.2, 'white');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 1;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start();
        noise.stop(this.audioContext.currentTime + 0.2);
    }
    
    // Interaction Sounds
    playChestOpen() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        // Creak sound
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, this.audioContext.currentTime);
        osc.frequency.linearRampToValueAtTime(150, this.audioContext.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
        
        // Jingle
        setTimeout(() => {
            const notes = [784, 988, 1175, 1568];
            notes.forEach((freq, i) => {
                const jingleOsc = this.audioContext.createOscillator();
                const jingleGain = this.audioContext.createGain();
                
                jingleOsc.connect(jingleGain);
                jingleGain.connect(this.sfxGain);
                
                jingleOsc.type = 'sine';
                jingleOsc.frequency.value = freq;
                
                const startTime = this.audioContext.currentTime + i * 0.06;
                jingleGain.gain.setValueAtTime(0.2, startTime);
                jingleGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
                
                jingleOsc.start(startTime);
                jingleOsc.stop(startTime + 0.2);
            });
        }, 200);
    }
    
    playGoldPickup() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = 2000 + Math.random() * 1000;
            
            const startTime = this.audioContext.currentTime + i * 0.04;
            gain.gain.setValueAtTime(0.12, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.06);
            
            osc.start(startTime);
            osc.stop(startTime + 0.06);
        }
    }
    
    playItemEquip() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const osc = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.type = 'triangle';
        osc2.type = 'sine';
        osc.frequency.value = 440;
        osc2.frequency.value = 660;
        
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        osc.start();
        osc2.start();
        osc.stop(this.audioContext.currentTime + 0.15);
        osc2.stop(this.audioContext.currentTime + 0.15);
    }
    
    playPotionDrink() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const noiseBuffer = this.createNoise(0.3, 'pink');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, this.audioContext.currentTime);
        filter.frequency.linearRampToValueAtTime(600, this.audioContext.currentTime + 0.3);
        filter.Q.value = 3;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start();
        noise.stop(this.audioContext.currentTime + 0.3);
    }
    
    // Ambient Sounds
    startAmbient(region) {
        this.stopAmbient();
        if (!this.initialized || this.muted) return;
        this.resume();
        
        this.currentAmbient = region;
        
        switch (region) {
            case 'forest':
                this.startForestAmbient();
                break;
            case 'water':
            case 'pirate':
                this.startWaterAmbient();
                break;
            case 'lava':
            case 'dragon':
                this.startFireAmbient();
                break;
            case 'wind':
            case 'mountain':
                this.startWindAmbient();
                break;
            default:
                this.startDefaultAmbient();
        }
    }
    
    startForestAmbient() {
        const createBirdChirp = () => {
            if (!this.initialized || this.muted || this.currentAmbient !== 'forest') return;
            
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.musicGain);
            
            osc.type = 'sine';
            const baseFreq = 2000 + Math.random() * 2000;
            osc.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
            osc.frequency.linearRampToValueAtTime(baseFreq * 1.2, this.audioContext.currentTime + 0.05);
            osc.frequency.linearRampToValueAtTime(baseFreq * 0.9, this.audioContext.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            osc.start();
            osc.stop(this.audioContext.currentTime + 0.1);
            
            setTimeout(createBirdChirp, 2000 + Math.random() * 5000);
        };
        
        setTimeout(createBirdChirp, 1000);
    }
    
    startWaterAmbient() {
        const noiseBuffer = this.createNoise(4, 'pink');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.08;
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        this.ambientNodes.push(noise, gain);
        noise.start();
    }
    
    startFireAmbient() {
        const noiseBuffer = this.createNoise(4, 'brown');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 200;
        filter.Q.value = 0.5;
        
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.12;
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        this.ambientNodes.push(noise, gain);
        noise.start();
        
        // Crackle sounds
        const createCrackle = () => {
            if (!this.initialized || this.muted || this.currentAmbient !== 'lava' && this.currentAmbient !== 'dragon') return;
            
            const crackleNoise = this.createNoise(0.05, 'white');
            const crackle = this.audioContext.createBufferSource();
            crackle.buffer = crackleNoise;
            
            const crackleGain = this.audioContext.createGain();
            crackleGain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
            crackleGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
            
            crackle.connect(crackleGain);
            crackleGain.connect(this.musicGain);
            
            crackle.start();
            crackle.stop(this.audioContext.currentTime + 0.05);
            
            setTimeout(createCrackle, 100 + Math.random() * 300);
        };
        
        setTimeout(createCrackle, 500);
    }
    
    startWindAmbient() {
        const noiseBuffer = this.createNoise(4, 'pink');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 300;
        filter.Q.value = 1;
        
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        lfo.frequency.value = 0.2;
        lfoGain.gain.value = 100;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.1;
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        this.ambientNodes.push(noise, lfo, gain);
        noise.start();
        lfo.start();
    }
    
    startDefaultAmbient() {
        // Light wind
        const noiseBuffer = this.createNoise(4, 'pink');
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.03;
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        this.ambientNodes.push(noise, gain);
        noise.start();
    }
    
    stopAmbient() {
        this.ambientNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch (e) {}
        });
        this.ambientNodes = [];
        this.currentAmbient = null;
    }
    
    // Background Music - Procedural Generation
    startMusic(mood) {
        this.stopMusic();
        if (!this.initialized || this.muted) return;
        this.resume();
        
        this.currentMusic = mood;
        
        const scales = {
            adventurous: [261, 293, 329, 349, 392, 440, 493],
            mysterious: [261, 293, 311, 349, 392, 415, 466],
            dangerous: [261, 277, 311, 329, 370, 392, 466],
            victory: [523, 587, 659, 698, 784, 880, 988],
            peaceful: [261, 329, 392, 440, 523, 587, 659]
        };
        
        const scale = scales[mood] || scales.peaceful;
        const tempo = mood === 'dangerous' ? 180 : mood === 'victory' ? 140 : 100;
        
        this.playMusicLoop(scale, tempo, mood);
    }
    
    playMusicLoop(scale, tempo, mood) {
        if (!this.initialized || this.muted || this.currentMusic !== mood) return;
        
        const beatDuration = 60 / tempo;
        const measureLength = 4;
        
        for (let beat = 0; beat < measureLength; beat++) {
            const startTime = this.audioContext.currentTime + beat * beatDuration;
            
            // Bass note on beats 1 and 3
            if (beat % 2 === 0) {
                const bassOsc = this.audioContext.createOscillator();
                const bassGain = this.audioContext.createGain();
                
                bassOsc.connect(bassGain);
                bassGain.connect(this.musicGain);
                
                bassOsc.type = 'sine';
                bassOsc.frequency.value = scale[0] / 2;
                
                bassGain.gain.setValueAtTime(0.12, startTime);
                bassGain.gain.exponentialRampToValueAtTime(0.01, startTime + beatDuration * 0.9);
                
                bassOsc.start(startTime);
                bassOsc.stop(startTime + beatDuration);
                this.musicOscillators.push(bassOsc);
            }
            
            // Melody note
            const noteIndex = Math.floor(Math.random() * scale.length);
            const melodyOsc = this.audioContext.createOscillator();
            const melodyGain = this.audioContext.createGain();
            
            melodyOsc.connect(melodyGain);
            melodyGain.connect(this.musicGain);
            
            melodyOsc.type = mood === 'mysterious' ? 'triangle' : 'sine';
            melodyOsc.frequency.value = scale[noteIndex];
            
            melodyGain.gain.setValueAtTime(0.08, startTime);
            melodyGain.gain.exponentialRampToValueAtTime(0.01, startTime + beatDuration * 0.8);
            
            melodyOsc.start(startTime);
            melodyOsc.stop(startTime + beatDuration);
            this.musicOscillators.push(melodyOsc);
            
            // Harmony on some beats
            if (Math.random() < 0.4) {
                const harmonyIndex = (noteIndex + 2) % scale.length;
                const harmonyOsc = this.audioContext.createOscillator();
                const harmonyGain = this.audioContext.createGain();
                
                harmonyOsc.connect(harmonyGain);
                harmonyGain.connect(this.musicGain);
                
                harmonyOsc.type = 'sine';
                harmonyOsc.frequency.value = scale[harmonyIndex];
                
                harmonyGain.gain.setValueAtTime(0.04, startTime);
                harmonyGain.gain.exponentialRampToValueAtTime(0.01, startTime + beatDuration * 0.6);
                
                harmonyOsc.start(startTime);
                harmonyOsc.stop(startTime + beatDuration);
                this.musicOscillators.push(harmonyOsc);
            }
        }
        
        setTimeout(() => this.playMusicLoop(scale, tempo, mood), measureLength * beatDuration * 1000);
    }
    
    stopMusic() {
        this.musicOscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {}
        });
        this.musicOscillators = [];
        this.currentMusic = null;
    }
    
    // Combat Music
    startCombatMusic() {
        this.stopMusic();
        if (!this.initialized || this.muted) return;
        this.startMusic('dangerous');
    }
    
    stopCombatMusic() {
        this.stopMusic();
    }
    
    // Victory/Defeat Jingles
    playVictoryJingle() {
        if (!this.initialized || this.muted) return;
        this.resume();
        this.stopMusic();
        
        const notes = [523, 659, 784, 1047, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.15;
            const duration = i === notes.length - 1 ? 0.5 : 0.15;
            
            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }
    
    playDefeatJingle() {
        if (!this.initialized || this.muted) return;
        this.resume();
        this.stopMusic();
        
        const notes = [392, 349, 311, 261];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.25;
            const duration = i === notes.length - 1 ? 0.6 : 0.25;
            
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }
    
    playLevelUp() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const notes = [523, 659, 784, 1047, 1319];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            osc2.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc2.type = 'triangle';
            osc.frequency.value = freq;
            osc2.frequency.value = freq * 2;
            
            const startTime = this.audioContext.currentTime + i * 0.1;
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            
            osc.start(startTime);
            osc2.start(startTime);
            osc.stop(startTime + 0.3);
            osc2.stop(startTime + 0.3);
        });
    }
    
    playQuestComplete() {
        if (!this.initialized || this.muted) return;
        this.resume();
        
        const notes = [392, 523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.12;
            gain.gain.setValueAtTime(0.18, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
            
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        });
    }
    
    // Update method called each frame for footsteps
    updateFootsteps(playerVelocity, terrainType, dt) {
        if (!this.initialized || this.muted) return;
        
        const speed = Math.hypot(playerVelocity.x, playerVelocity.y);
        if (speed < 0.5) {
            this.footstepTimer = 0;
            return;
        }
        
        this.footstepTimer += dt;
        const footstepInterval = 0.25 - (speed * 0.001);
        
        if (this.footstepTimer >= Math.max(0.15, footstepInterval)) {
            this.footstepTimer = 0;
            this.playFootstep(terrainType);
        }
    }
    
    // Get current region for ambient sounds
    getAmbientForRegion(tileX, tileY) {
        if (tileY < 20) return 'wind';
        if (tileX > 165 && tileY < 25) return 'lava';
        if (tileX > 90 && tileX < 115 && tileY > 65 && tileY < 85) return 'forest';
        if (tileX > 110 && tileX < 135 && tileY > 95) return 'water';
        if (tileX > 140 && tileX < 170 && tileY > 85 && tileY < 105) return 'water';
        return 'default';
    }
    
    // Get music mood for region
    getMusicMoodForRegion(tileX, tileY) {
        if (tileY < 20) return 'mysterious';
        if (tileX > 165 && tileY < 25) return 'dangerous';
        if (tileX > 110 && tileX < 135 && tileY > 95) return 'mysterious';
        if (tileX > 90 && tileX < 115 && tileY > 65 && tileY < 85) return 'peaceful';
        return 'adventurous';
    }
}

// Global sound system instance
const soundSystem = new SoundSystem();

// Initialize game
const game = new Game();

// Add spawner and achievements to game
game.spawner = new EnemySpawner(game);
game.achievements = new AchievementSystem(game);

// Override update to include new systems
const originalUpdate = game.update.bind(game);
game.update = function(dt) {
    originalUpdate(dt);
    this.spawner.update(dt);
    this.achievements.check();
};

// Add keyboard shortcuts for save/load
document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        SaveSystem.save(game);
    } else if (e.key === 'F9') {
        e.preventDefault();
        SaveSystem.load(game);
    }
});

// Check for existing save on load
if (SaveSystem.hasSave()) {
    const loadPrompt = document.createElement('div');
    loadPrompt.style.cssText = 'position:absolute;top:60%;left:50%;transform:translate(-50%,-50%);color:white;text-align:center;';
    loadPrompt.innerHTML = '<p>Save file found!</p><button id="load-save-btn" style="margin:10px;padding:10px 20px;cursor:pointer;">Load Game</button><button id="new-game-btn" style="margin:10px;padding:10px 20px;cursor:pointer;">New Game</button>';
    document.getElementById('loading-screen').appendChild(loadPrompt);
    
    document.getElementById('load-save-btn').addEventListener('click', () => {
        document.getElementById('loading-screen').style.display = 'none';
        game.start();
        SaveSystem.load(game);
    });
    
    document.getElementById('new-game-btn').addEventListener('click', () => {
        SaveSystem.deleteSave();
        loadPrompt.remove();
    });
}
