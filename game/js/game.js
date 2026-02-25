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
    
    // Noise-based terrain generation
    for (let y = 0; y < worldHeight; y++) {
        map[y] = [];
        for (let x = 0; x < worldWidth; x++) {
            const noise1 = Math.sin(x * 0.05) * Math.cos(y * 0.05);
            const noise2 = Math.sin(x * 0.1 + 100) * Math.cos(y * 0.08);
            const combined = (noise1 + noise2) / 2;
            
            if (combined < -0.3) {
                map[y][x] = TILES.WATER;
            } else if (combined < -0.1) {
                map[y][x] = TILES.SAND;
            } else if (combined < 0.5) {
                map[y][x] = TILES.GRASS;
            } else if (combined < 0.7) {
                map[y][x] = TILES.DIRT;
            } else {
                map[y][x] = TILES.STONE;
            }
            
            // Snow in northern areas
            if (y < 20 && map[y][x] !== TILES.WATER) {
                map[y][x] = TILES.SNOW;
            }
            
            // Dragon lair area (northeast)
            if (x > 170 && y < 30) {
                if (Math.random() < 0.3) map[y][x] = TILES.LAVA;
                else if (map[y][x] !== TILES.WATER) map[y][x] = TILES.STONE;
            }
        }
    }
    
    // Create the starting village area FIRST (before paths)
    createVillage(map, 50, 75);
    
    // Create the medieval castle area
    createCastleArea(map, 30, 50);
    
    // Create the western town area
    createTownArea(map, 80, 42);
    
    // Create the pirate cove area
    createPirateCove(map, 150, 92);
    
    // Create paths between regions
    createPath(map, 58, 75, 100, 75); // Village east exit to forest
    createPath(map, 100, 75, 150, 90); // Forest to pirate cove
    createPath(map, 42, 75, 30, 50); // Village west exit to medieval castle
    createPath(map, 100, 75, 80, 42); // To western town
    createPath(map, 80, 42, 100, 20); // To mountain pass
    createPath(map, 100, 20, 175, 15); // To dragon lair
    createPath(map, 100, 75, 120, 100); // To mystic swamp
    
    return { map, width: worldWidth, height: worldHeight };
}

// Create a proper village layout
function createVillage(map, centerX, centerY) {
    // Create a large grass area for the village (18x14 tiles)
    for (let dy = -7; dy <= 7; dy++) {
        for (let dx = -9; dx <= 9; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                map[y][x] = TILES.GRASS;
            }
        }
    }
    
    // Create village square in the center (dirt area)
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                map[y][x] = TILES.DIRT;
            }
        }
    }
    
    // Main road running east-west through village
    for (let dx = -9; dx <= 9; dx++) {
        const x = centerX + dx;
        if (x >= 0 && x < map[0].length) {
            map[centerY][x] = TILES.DIRT;
            map[centerY - 1][x] = TILES.DIRT;
        }
    }
    
    // North-south road through village
    for (let dy = -6; dy <= 6; dy++) {
        const y = centerY + dy;
        if (y >= 0 && y < map.length) {
            map[y][centerX][0] = TILES.DIRT;
            map[y][centerX] = TILES.DIRT;
        }
    }
    
    // Paths to building locations
    // Path to inn (northeast)
    for (let i = 0; i < 4; i++) {
        map[centerY - 2 - i][centerX + 2] = TILES.DIRT;
    }
    // Path to blacksmith (southeast)  
    for (let i = 0; i < 3; i++) {
        map[centerY + 2 + i][centerX + 3] = TILES.DIRT;
    }
    // Path to tavern (southwest)
    for (let i = 0; i < 3; i++) {
        map[centerY + 2 + i][centerX - 3] = TILES.DIRT;
    }
    // Path to merchant (northwest)
    for (let i = 0; i < 3; i++) {
        map[centerY - 2 - i][centerX - 4] = TILES.DIRT;
    }
}

// Create castle area
function createCastleArea(map, centerX, centerY) {
    // Create grass area around castle
    for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                map[y][x] = TILES.GRASS;
            }
        }
    }
    // Castle courtyard (stone)
    for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                map[y][x] = TILES.STONE;
            }
        }
    }
}

// Create western town area
function createTownArea(map, centerX, centerY) {
    // Create dirt/sand area for western town
    for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                map[y][x] = TILES.SAND;
            }
        }
    }
    // Main street
    for (let dx = -6; dx <= 6; dx++) {
        const x = centerX + dx;
        if (x >= 0 && x < map[0].length) {
            map[centerY][x] = TILES.DIRT;
        }
    }
}

// Create pirate cove area
function createPirateCove(map, centerX, centerY) {
    // Create sand beach area
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                map[y][x] = TILES.SAND;
            }
        }
    }
    // Dock area
    for (let dx = 0; dx <= 4; dx++) {
        const x = centerX + dx;
        if (x >= 0 && x < map[0].length) {
            map[centerY][x] = TILES.DOCK;
            map[centerY - 1][x] = TILES.DOCK;
        }
    }
}

function createPath(map, x1, y1, x2, y2) {
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
        if (map[y] && map[y][x] !== undefined) {
            if (map[y][x] === TILES.WATER) {
                map[y][x] = TILES.BRIDGE;
            } else {
                map[y][x] = TILES.DIRT;
            }
            // Widen path
            if (map[y-1] && map[y-1][x] === TILES.WATER) map[y-1][x] = TILES.BRIDGE;
            if (map[y+1] && map[y+1][x] === TILES.WATER) map[y+1][x] = TILES.BRIDGE;
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

// Item definitions
const ITEMS = {
    // Weapons
    RUSTY_SWORD: { name: 'Rusty Sword', type: 'weapon', icon: '🗡️', attack: 5, price: 20 },
    IRON_SWORD: { name: 'Iron Sword', type: 'weapon', icon: '⚔️', attack: 12, price: 80 },
    STEEL_SWORD: { name: 'Steel Sword', type: 'weapon', icon: '🔪', attack: 20, price: 200 },
    LEGENDARY_BLADE: { name: 'Legendary Blade', type: 'weapon', icon: '✨', attack: 35, price: 500 },
    PISTOL: { name: 'Six Shooter', type: 'weapon', icon: '🔫', attack: 18, price: 150 },
    CUTLASS: { name: 'Pirate Cutlass', type: 'weapon', icon: '🏴‍☠️', attack: 15, price: 120 },
    
    // Armor
    LEATHER_ARMOR: { name: 'Leather Armor', type: 'armor', icon: '🥋', defense: 5, price: 50 },
    CHAINMAIL: { name: 'Chainmail', type: 'armor', icon: '⛓️', defense: 12, price: 150 },
    PLATE_ARMOR: { name: 'Plate Armor', type: 'armor', icon: '🛡️', defense: 25, price: 400 },
    DRAGON_SCALE: { name: 'Dragon Scale Armor', type: 'armor', icon: '🐲', defense: 40, price: 1000 },
    
    // Consumables
    HEALTH_POTION: { name: 'Health Potion', type: 'consumable', icon: '🧪', heal: 30, price: 25, stackable: true },
    LARGE_POTION: { name: 'Large Health Potion', type: 'consumable', icon: '⚗️', heal: 75, price: 60, stackable: true },
    STRENGTH_ELIXIR: { name: 'Strength Elixir', type: 'consumable', icon: '💪', tempAttack: 10, duration: 3, price: 40, stackable: true },
    
    // Special items
    SHIP_DEED: { name: 'Ship Deed', type: 'key', icon: '🚢', description: 'Proof of ship ownership' },
    DRAGON_MAP: { name: 'Dragon Map', type: 'key', icon: '🗺️', description: 'Shows path to dragon lair' },
    CASTLE_KEY: { name: 'Castle Key', type: 'key', icon: '🔑', description: 'Opens the castle gate' },
    MYSTIC_AMULET: { name: 'Mystic Amulet', type: 'accessory', icon: '📿', special: 'reveal_clues' },
    
    // Additional weapons
    DAGGER: { name: 'Dagger', type: 'weapon', icon: '🗡️', attack: 8, price: 40 },
    RAPIER: { name: 'Rapier', type: 'weapon', icon: '🤺', attack: 14, price: 100 },
    BATTLE_AXE: { name: 'Battle Axe', type: 'weapon', icon: '🪓', attack: 22, price: 220 },
    CROSSBOW: { name: 'Crossbow', type: 'weapon', icon: '🏹', attack: 16, price: 130 },
    ROYAL_SWORD: { name: 'Royal Sword', type: 'weapon', icon: '👑', attack: 28, price: 350 },
    DRAGON_SLAYER: { name: 'Dragon Slayer', type: 'weapon', icon: '🐲', attack: 45, price: 800, special: 'dragon_bonus' },
    HEIRLOOM_SWORD: { name: 'Ruby Heirloom Sword', type: 'weapon', icon: '💎', attack: 25, price: 0 },
    
    // Additional armor
    KNIGHT_ARMOR: { name: 'Knight Armor', type: 'armor', icon: '⚔️', defense: 18, price: 280 },
    ROYAL_ARMOR: { name: 'Royal Plate', type: 'armor', icon: '👑', defense: 32, price: 550 },
    FIRE_CLOAK: { name: 'Fire Resistant Cloak', type: 'armor', icon: '🔥', defense: 15, price: 300, special: 'fire_resist' },
    
    // Additional consumables
    ANTIDOTE: { name: 'Antidote', type: 'consumable', icon: '🧴', cure: 'poison', price: 30, stackable: true },
    FIRE_RESIST_POTION: { name: 'Fire Resistance Potion', type: 'consumable', icon: '🔥', special: 'fire_resist', duration: 5, price: 150, stackable: true },
    MEGA_POTION: { name: 'Mega Health Potion', type: 'consumable', icon: '💉', heal: 150, price: 120, stackable: true },
    ATTACK_BOOST: { name: 'Attack Boost', type: 'consumable', icon: '⚡', tempAttack: 15, duration: 5, price: 80, stackable: true },
    DEFENSE_BOOST: { name: 'Defense Boost', type: 'consumable', icon: '🛡️', tempDefense: 15, duration: 5, price: 80, stackable: true },
    
    // Accessories
    RING_OF_STRENGTH: { name: 'Ring of Strength', type: 'accessory', icon: '💪', attack: 5, price: 200 },
    RING_OF_PROTECTION: { name: 'Ring of Protection', type: 'accessory', icon: '🛡️', defense: 5, price: 200 },
    LUCKY_CHARM: { name: 'Lucky Charm', type: 'accessory', icon: '🍀', special: 'luck', price: 150 },
    GOLD_RING: { name: 'Gold Ring', type: 'accessory', icon: '💍', price: 100, sellOnly: true }
};

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

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        this.world = generateWorld();
        this.camera = { x: 0, y: 0 };
        this.targetCamera = { x: 0, y: 0 };
        
        this.player = {
            x: 50 * TILE_SIZE,
            y: 75 * TILE_SIZE,
            targetX: 50 * TILE_SIZE,
            targetY: 75 * TILE_SIZE,
            speed: 4,
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
        this.timeOfDay = 0; // 0-24 hours
        this.dayNightCycle = true;
        this.eventCooldown = 0;
        this.treasureChests = [];
        this.discoveredLocations = new Set();
        this.playTime = 0;
        this.killCount = 0;
        this.distanceTraveled = 0;
        this.lastPosition = { x: 0, y: 0 };
        
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
        // Starting Village NPCs - positioned within the village layout
        // Village center is at (50, 75)
        this.addNPC(50, 75, NPC_TYPES.VILLAGER, 'Elder Thomas', [
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
        
        this.addNPC(53, 78, NPC_TYPES.BLACKSMITH, 'Forge Master Aldric', [
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
        
        this.addNPC(46, 72, NPC_TYPES.MERCHANT, 'Traveling Merchant', [
            { text: "Potions, elixirs, rare goods! Everything an adventurer needs!", choices: [
                { text: "Let me see what you have. [Shop]", action: 'openShop', shopType: 'merchant' },
                { text: "Maybe later.", end: true }
            ]}
        ], { shop: 'merchant' });
        
        this.addNPC(52, 70, NPC_TYPES.INNKEEPER, 'Martha the Innkeeper', [
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
        this.addNPC(55, 74, NPC_TYPES.VILLAGER, 'Worried Farmer', [
            { text: "My farm to the east is overrun by wolves! Please, brave knight, help me!", choices: [
                { text: "I'll clear out the wolves.", action: 'startWolfQuest', next: 1 },
                { text: "I'm busy with other matters.", end: true }
            ]},
            { text: "Thank you! There should be about 5 of them. Return to me when they're dealt with.", end: true }
        ], { questGiver: true });
        
        // Add more wolves for the quest - east of village in farmland
        for (let i = 0; i < 5; i++) {
            this.addNPC(65 + Math.floor(seededRandom() * 8), 73 + Math.floor(seededRandom() * 6), 
                NPC_TYPES.BEAST, 'Farm Wolf', null, { hostile: true, level: 2, farmWolf: true });
        }
        
        // Tavern in village
        this.addNPC(47, 78, NPC_TYPES.BARTENDER, 'Village Barkeep', [
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
        
        // Village buildings - create a proper village layout
        // Village center is at (50, 75)
        // Elder's house (center of village)
        this.decorations.push({ x: 50 * TILE_SIZE, y: 74 * TILE_SIZE, sprite: '🏛️' });
        // Inn (northeast area)
        this.decorations.push({ x: 52 * TILE_SIZE, y: 69 * TILE_SIZE, sprite: '🏨' });
        // Blacksmith (southeast area)
        this.decorations.push({ x: 53 * TILE_SIZE, y: 77 * TILE_SIZE, sprite: '⚒️' });
        // Tavern (southwest area)
        this.decorations.push({ x: 47 * TILE_SIZE, y: 77 * TILE_SIZE, sprite: '🍺' });
        // Merchant stall (northwest area)
        this.decorations.push({ x: 46 * TILE_SIZE, y: 71 * TILE_SIZE, sprite: '🏪' });
        // Farmer's house (east side)
        this.decorations.push({ x: 56 * TILE_SIZE, y: 74 * TILE_SIZE, sprite: '🏠' });
        // Additional village houses
        this.decorations.push({ x: 44 * TILE_SIZE, y: 74 * TILE_SIZE, sprite: '🏠' });
        this.decorations.push({ x: 48 * TILE_SIZE, y: 70 * TILE_SIZE, sprite: '🏠' });
        this.decorations.push({ x: 54 * TILE_SIZE, y: 72 * TILE_SIZE, sprite: '🏠' });
        // Well in the village square
        this.decorations.push({ x: 50 * TILE_SIZE, y: 76 * TILE_SIZE, sprite: '⛲' });
        // Trees around village perimeter
        this.decorations.push({ x: 42 * TILE_SIZE, y: 69 * TILE_SIZE, sprite: '🌳' });
        this.decorations.push({ x: 58 * TILE_SIZE, y: 69 * TILE_SIZE, sprite: '🌳' });
        this.decorations.push({ x: 42 * TILE_SIZE, y: 80 * TILE_SIZE, sprite: '🌳' });
        this.decorations.push({ x: 58 * TILE_SIZE, y: 80 * TILE_SIZE, sprite: '🌳' });
        // Signpost at village entrance (east)
        this.decorations.push({ x: 58 * TILE_SIZE, y: 75 * TILE_SIZE, sprite: '🪧' });
        // Signpost at village entrance (west) 
        this.decorations.push({ x: 42 * TILE_SIZE, y: 75 * TILE_SIZE, sprite: '🪧' });
        
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
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
        
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    handleClick(e) {
        if (this.inCombat || this.currentDialogue) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.camera.x;
        const clickY = e.clientY - rect.top + this.camera.y;
        
        // Check if clicking on NPC
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const dist = Math.hypot(clickX - npc.x, clickY - npc.y);
            if (dist < TILE_SIZE) {
                const playerDist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
                if (playerDist < TILE_SIZE * 3) {
                    this.interactWithNPC(npc);
                    return;
                } else {
                    // Move towards NPC first
                    this.player.targetX = npc.x;
                    this.player.targetY = npc.y - TILE_SIZE;
                    this.player.interactTarget = npc;
                    return;
                }
            }
        }
        
        // Point and click movement
        const tileX = Math.floor(clickX / TILE_SIZE);
        const tileY = Math.floor(clickY / TILE_SIZE);
        
        if (this.isWalkable(tileX, tileY)) {
            this.player.targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
            this.player.targetY = tileY * TILE_SIZE + TILE_SIZE / 2;
            this.player.interactTarget = null;
        }
    }
    
    handleRightClick(e) {
        // Right click for info/cancel
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
            this.notify(`Equipped ${item.name}`);
        } else if (item.type === 'armor') {
            if (this.player.equipment.armor) {
                this.player.defense -= this.player.equipment.armor.defense;
            }
            this.player.equipment.armor = item;
            this.player.defense += item.defense;
            this.notify(`Equipped ${item.name}`);
        } else if (item.type === 'consumable') {
            if (item.heal) {
                this.player.health = Math.min(this.player.health + item.heal, this.player.maxHealth);
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
        }
        
        panel.style.display = isVisible ? 'none' : 'block';
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
        this.closeDialogue();
    }
    
    notify(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.display = 'block';
        notification.style.animation = 'none';
        notification.offsetHeight; // Trigger reflow
        notification.style.animation = 'fadeInOut 3s ease-in-out';
        
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
            
            this.notify(`Level Up! Now level ${this.player.level}!`);
        }
        
        this.updateHUD();
    }
    
    start() {
        this.camera.x = this.player.x - CANVAS_WIDTH / 2;
        this.camera.y = this.player.y - CANVAS_HEIGHT / 2;
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.world.width * TILE_SIZE - CANVAS_WIDTH));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.world.height * TILE_SIZE - CANVAS_HEIGHT));
        this.targetCamera.x = this.camera.x;
        this.targetCamera.y = this.camera.y;

        this.running = true;
        this.lastTime = performance.now();
        this.updateHUD();
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
        // Smooth player movement towards target
        const dx = this.player.targetX - this.player.x;
        const dy = this.player.targetY - this.player.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 5) {
            const moveX = (dx / dist) * this.player.speed * 60 * dt;
            const moveY = (dy / dist) * this.player.speed * 60 * dt;
            
            // Check collision before moving
            const newX = this.player.x + moveX;
            const newY = this.player.y + moveY;
            const tileX = Math.floor(newX / TILE_SIZE);
            const tileY = Math.floor(newY / TILE_SIZE);
            
            if (this.isWalkable(tileX, tileY)) {
                this.player.x = newX;
                this.player.y = newY;
            } else {
                // Try to move around obstacle
                if (this.isWalkable(Math.floor((this.player.x + moveX) / TILE_SIZE), Math.floor(this.player.y / TILE_SIZE))) {
                    this.player.x += moveX;
                } else if (this.isWalkable(Math.floor(this.player.x / TILE_SIZE), Math.floor((this.player.y + moveY) / TILE_SIZE))) {
                    this.player.y += moveY;
                }
            }
        } else if (this.player.interactTarget) {
            this.interactWithNPC(this.player.interactTarget);
            this.player.interactTarget = null;
        }
        
        // Smooth camera following
        this.targetCamera.x = this.player.x - CANVAS_WIDTH / 2;
        this.targetCamera.y = this.player.y - CANVAS_HEIGHT / 2;
        
        // Clamp camera to world bounds
        this.targetCamera.x = Math.max(0, Math.min(this.targetCamera.x, this.world.width * TILE_SIZE - CANVAS_WIDTH));
        this.targetCamera.y = Math.max(0, Math.min(this.targetCamera.y, this.world.height * TILE_SIZE - CANVAS_HEIGHT));
        
        // Smooth camera interpolation
        this.camera.x += (this.targetCamera.x - this.camera.x) * 0.08;
        this.camera.y += (this.targetCamera.y - this.camera.y) * 0.08;
        
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
            if (this.timeOfDay >= 24) this.timeOfDay = 0;
        }
        
        // Track play time
        this.playTime += dt;
        
        // Discover locations
        this.checkLocationDiscovery();
    }
    
    openTreasureChest(chest) {
        chest.opened = true;
        chest.sprite = '📭';
        
        let message = 'You opened a treasure chest! ';
        
        if (chest.loot === 'gold') {
            this.player.gold += chest.amount;
            message += `Found ${chest.amount} gold!`;
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
        } else if (chest.loot === 'weapon' || chest.loot === 'armor') {
            this.player.inventory.push({ item: chest.item });
            message += `Found ${chest.item.name}!`;
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
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Calculate visible tile range
        const startTileX = Math.floor(this.camera.x / TILE_SIZE);
        const startTileY = Math.floor(this.camera.y / TILE_SIZE);
        const endTileX = Math.ceil((this.camera.x + CANVAS_WIDTH) / TILE_SIZE);
        const endTileY = Math.ceil((this.camera.y + CANVAS_HEIGHT) / TILE_SIZE);
        
        // Render tiles
        for (let y = startTileY; y <= endTileY && y < this.world.height; y++) {
            for (let x = startTileX; x <= endTileX && x < this.world.width; x++) {
                if (y < 0 || x < 0) continue;
                
                const tile = this.world.map[y][x];
                const screenX = x * TILE_SIZE - this.camera.x;
                const screenY = y * TILE_SIZE - this.camera.y;
                
                this.ctx.fillStyle = TILE_COLORS[tile];
                this.ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1);
                
                // Add texture
                if (tile === TILES.GRASS) {
                    this.ctx.fillStyle = 'rgba(0, 50, 0, 0.2)';
                    if ((x + y) % 3 === 0) {
                        this.ctx.fillRect(screenX + 10, screenY + 10, 5, 5);
                    }
                } else if (tile === TILES.WATER) {
                    this.ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
                    const waveOffset = Math.sin((x + y + performance.now() / 500) * 0.5) * 5;
                    this.ctx.fillRect(screenX + waveOffset, screenY + 20, 30, 3);
                }
            }
        }
        
        // Render decorations
        for (const deco of this.decorations) {
            const screenX = deco.x - this.camera.x;
            const screenY = deco.y - this.camera.y;
            
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH + TILE_SIZE &&
                screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT + TILE_SIZE) {
                this.ctx.font = '32px Arial';
                this.ctx.fillText(deco.sprite, screenX, screenY);
            }
        }
        
        // Render NPCs
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            
            const screenX = npc.x - this.camera.x;
            const screenY = npc.y - this.camera.y;
            
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH + TILE_SIZE &&
                screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT + TILE_SIZE) {
                
                // NPC shadow
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                this.ctx.beginPath();
                this.ctx.ellipse(screenX, screenY + 15, 15, 8, 0, 0, Math.PI * 2);
                this.ctx.fill();
                
                // NPC sprite
                this.ctx.font = '36px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(npc.type.sprite, screenX, screenY);
                
                // NPC name
                this.ctx.font = '12px Arial';
                this.ctx.fillStyle = npc.hostile ? '#ff6666' : '#ffffff';
                this.ctx.fillText(npc.name, screenX, screenY - 25);
                
                // Health bar for hostile NPCs
                if (npc.hostile && npc.health < npc.maxHealth) {
                    this.ctx.fillStyle = '#333';
                    this.ctx.fillRect(screenX - 20, screenY - 40, 40, 6);
                    this.ctx.fillStyle = '#ff4444';
                    this.ctx.fillRect(screenX - 20, screenY - 40, 40 * (npc.health / npc.maxHealth), 6);
                }
            }
        }
        
        // Render treasure chests
        for (const chest of this.treasureChests) {
            const screenX = chest.x - this.camera.x;
            const screenY = chest.y - this.camera.y;
            
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH + TILE_SIZE &&
                screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT + TILE_SIZE) {
                this.ctx.font = '28px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(chest.sprite, screenX, screenY);
                
                // Sparkle effect for unopened chests
                if (!chest.opened) {
                    const sparkleOffset = Math.sin(performance.now() / 200) * 3;
                    this.ctx.fillText('✨', screenX + sparkleOffset, screenY - 15);
                }
            }
        }
        
        // Render player
        const playerScreenX = this.player.x - this.camera.x;
        const playerScreenY = this.player.y - this.camera.y;
        
        // Player shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(playerScreenX, playerScreenY + 18, 18, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Player sprite
        this.ctx.font = '42px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.player.sprite, playerScreenX, playerScreenY);
        
        // Movement indicator
        if (Math.hypot(this.player.targetX - this.player.x, this.player.targetY - this.player.y) > 10) {
            const targetScreenX = this.player.targetX - this.camera.x;
            const targetScreenY = this.player.targetY - this.camera.y;
            
            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(playerScreenX, playerScreenY);
            this.ctx.lineTo(targetScreenX, targetScreenY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Target marker
            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(targetScreenX, targetScreenY, 10, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Day/night cycle overlay
        if (this.dayNightCycle) {
            let alpha = 0;
            if (this.timeOfDay >= 20 || this.timeOfDay < 6) {
                // Night time
                const nightHour = this.timeOfDay >= 20 ? this.timeOfDay - 20 : this.timeOfDay + 4;
                alpha = Math.min(0.5, nightHour < 5 ? 0.5 : (10 - nightHour) / 10);
                this.ctx.fillStyle = `rgba(20, 20, 60, ${alpha})`;
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            } else if (this.timeOfDay >= 6 && this.timeOfDay < 8) {
                // Dawn
                alpha = (8 - this.timeOfDay) / 4 * 0.3;
                this.ctx.fillStyle = `rgba(255, 150, 100, ${alpha})`;
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            } else if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
                // Dusk
                alpha = (this.timeOfDay - 18) / 4 * 0.3;
                this.ctx.fillStyle = `rgba(255, 100, 50, ${alpha})`;
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        }
        
        // Weather effects
        if (this.weather === 'foggy') {
            this.ctx.fillStyle = 'rgba(200, 200, 220, 0.3)';
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else if (this.weather === 'rainy') {
            this.ctx.strokeStyle = 'rgba(100, 150, 200, 0.4)';
            this.ctx.lineWidth = 1;
            for (let i = 0; i < 100; i++) {
                const x = (Math.random() * CANVAS_WIDTH);
                const y = (Math.random() * CANVAS_HEIGHT);
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + 5, y + 15);
                this.ctx.stroke();
            }
        } else if (this.weather === 'stormy') {
            this.ctx.fillStyle = 'rgba(50, 50, 80, 0.2)';
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            if (Math.random() < 0.01) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        }
        
        // Render minimap
        this.renderMinimap();
    }
    
    renderMinimap() {
        const mmCtx = this.minimapCtx;
        
        mmCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        mmCtx.fillRect(0, 0, 150, 150);
        
        // Calculate scale to fit entire world in 150x150 minimap
        const xScale = 150 / this.world.width;
        const yScale = 150 / this.world.height;
        
        // Draw simplified map (sample every 3rd tile for performance)
        for (let y = 0; y < this.world.height; y += 3) {
            for (let x = 0; x < this.world.width; x += 3) {
                const tile = this.world.map[y][x];
                mmCtx.fillStyle = TILE_COLORS[tile];
                mmCtx.fillRect(x * xScale, y * yScale, xScale * 3, yScale * 3);
            }
        }
        
        // Draw player position
        const playerMmX = (this.player.x / TILE_SIZE) * xScale;
        const playerMmY = (this.player.y / TILE_SIZE) * yScale;
        
        mmCtx.fillStyle = '#ffff00';
        mmCtx.beginPath();
        mmCtx.arc(playerMmX, playerMmY, 4, 0, Math.PI * 2);
        mmCtx.fill();
        
        // Draw NPCs as dots
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const npcMmX = (npc.x / TILE_SIZE) * xScale;
            const npcMmY = (npc.y / TILE_SIZE) * yScale;
            
            mmCtx.fillStyle = npc.hostile ? '#ff4444' : '#44ff44';
            mmCtx.beginPath();
            mmCtx.arc(npcMmX, npcMmY, 2, 0, Math.PI * 2);
            mmCtx.fill();
        }
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
    }
    
    start(npc) {
        this.enemy = npc;
        this.game.inCombat = true;
        this.playerTurn = true;
        this.defending = false;
        this.combatLog = [];
        
        document.getElementById('combat-ui').style.display = 'block';
        document.getElementById('enemy-name').textContent = npc.name;
        document.getElementById('enemy-sprite').textContent = npc.type.sprite;
        
        this.updateCombatUI();
        this.log(`Battle started against ${npc.name}!`);
    }
    
    playerAction(action) {
        if (!this.playerTurn) return;
        
        switch(action) {
            case 'attack':
                this.attack(this.game.player, this.enemy, false);
                break;
            case 'heavy':
                this.attack(this.game.player, this.enemy, true);
                break;
            case 'defend':
                this.defending = true;
                this.log('You take a defensive stance!');
                break;
            case 'heal':
                const healAmount = 30;
                this.game.player.health = Math.min(
                    this.game.player.health + healAmount,
                    this.game.player.maxHealth
                );
                this.log(`You heal for ${healAmount} HP!`);
                break;
            case 'flee':
                if (Math.random() < 0.5) {
                    this.log('You escaped!');
                    this.endCombat(false);
                    return;
                } else {
                    this.log('Failed to escape!');
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
                this.log('Heavy attack missed!');
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
        if (Math.random() < 0.1) {
            damage *= 2;
            this.log('CRITICAL HIT!');
        }
        
        defender.health -= damage;
        
        const attackerName = attacker === this.game.player ? 'You' : attacker.name;
        const defenderName = defender === this.game.player ? 'you' : defender.name;
        this.log(`${attackerName} ${isHeavy ? 'heavily strike' : 'attack'} ${defenderName} for ${Math.floor(damage)} damage!`);
        
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
            this.log(`${this.enemy.name} prepares to attack...`);
        }
        
        this.updateCombatUI();
        this.game.updateHUD();
        
        if (this.game.player.health <= 0) {
            this.defeat();
            return;
        }
        
        this.playerTurn = true;
    }
    
    victory() {
        const xpGain = this.enemy.level * 25;
        const goldGain = this.enemy.level * 10 + Math.floor(Math.random() * 20);
        
        this.log(`Victory! Gained ${xpGain} XP and ${goldGain} gold!`);
        
        this.game.gainXP(xpGain);
        this.game.player.gold += goldGain;
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
    
    log(message) {
        this.combatLog.push(message);
        const logDiv = document.getElementById('combat-log');
        logDiv.innerHTML = this.combatLog.slice(-5).join('<br>');
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
            version: '1.0',
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
            openedChests: game.treasureChests.filter(c => c.opened).map((c, i) => i)
        };
        
        try {
            localStorage.setItem('dragonQuestSave', JSON.stringify(saveData));
            game.notify('Game saved!');
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

            // Snap camera to restored player position
            game.camera.x = game.player.x - CANVAS_WIDTH / 2;
            game.camera.y = game.player.y - CANVAS_HEIGHT / 2;
            game.camera.x = Math.max(0, Math.min(game.camera.x, game.world.width * TILE_SIZE - CANVAS_WIDTH));
            game.camera.y = Math.max(0, Math.min(game.camera.y, game.world.height * TILE_SIZE - CANVAS_HEIGHT));
            game.targetCamera.x = game.camera.x;
            game.targetCamera.y = game.camera.y;
            
            // Restore game state
            game.quests = saveData.quests;
            game.cluesFound = saveData.cluesFound;
            game.gameFlags = saveData.gameFlags;
            game.discoveredLocations = new Set(saveData.discoveredLocations);
            game.killCount = saveData.killCount;
            game.distanceTraveled = saveData.distanceTraveled;
            game.playTime = saveData.playTime;
            
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
