// Quest of the Dragon's Gold - Main Game Engine
// A Cross-Genre Point-and-Click Adventure

const TILE_SIZE = 48;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

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
    
    // Create paths between regions
    createPath(map, 50, 75, 100, 75); // Starting village to forest
    createPath(map, 100, 75, 150, 90); // Forest to pirate cove
    createPath(map, 50, 75, 30, 50); // To medieval castle
    createPath(map, 100, 75, 80, 40); // To western town
    createPath(map, 80, 40, 100, 20); // To mountain pass
    createPath(map, 100, 20, 175, 15); // To dragon lair
    createPath(map, 100, 75, 120, 100); // To mystic swamp
    
    return { map, width: worldWidth, height: worldHeight };
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
    MYSTIC_AMULET: { name: 'Mystic Amulet', type: 'accessory', icon: '📿', special: 'reveal_clues' }
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
        
        this.combat = new CombatSystem(this);
        this.gambling = new GamblingSystem(this);
        
        this.init();
    }
    
    init() {
        this.generateNPCs();
        this.generateDecorations();
        this.setupEventListeners();
        
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('loading-screen').style.display = 'none';
            this.start();
        });
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
                items = [ITEMS.IRON_SWORD, ITEMS.STEEL_SWORD, ITEMS.CHAINMAIL, ITEMS.PLATE_ARMOR];
                break;
            case 'merchant':
                shopTitle.textContent = '🏪 General Store';
                items = [ITEMS.HEALTH_POTION, ITEMS.LARGE_POTION, ITEMS.STRENGTH_ELIXIR, ITEMS.LEATHER_ARMOR];
                break;
            case 'western':
                shopTitle.textContent = '🤠 Western Trader';
                items = [ITEMS.PISTOL, ITEMS.HEALTH_POTION, ITEMS.LARGE_POTION];
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
        
        // Render minimap
        this.renderMinimap();
    }
    
    renderMinimap() {
        const mmCtx = this.minimapCtx;
        const scale = 150 / (this.world.width * TILE_SIZE);
        
        mmCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        mmCtx.fillRect(0, 0, 150, 150);
        
        // Draw simplified map
        const tileScale = 150 / this.world.width;
        for (let y = 0; y < this.world.height; y += 3) {
            for (let x = 0; x < this.world.width; x += 3) {
                const tile = this.world.map[y][x];
                mmCtx.fillStyle = TILE_COLORS[tile];
                mmCtx.fillRect(x * tileScale / 3, y * tileScale / 3 * (150 / this.world.height), 
                              tileScale, tileScale);
            }
        }
        
        // Draw player position
        const playerMmX = (this.player.x / TILE_SIZE) * tileScale / 3;
        const playerMmY = (this.player.y / TILE_SIZE) * tileScale / 3 * (150 / this.world.height);
        
        mmCtx.fillStyle = '#ffff00';
        mmCtx.beginPath();
        mmCtx.arc(playerMmX, playerMmY, 4, 0, Math.PI * 2);
        mmCtx.fill();
        
        // Draw NPCs as dots
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const npcMmX = (npc.x / TILE_SIZE) * tileScale / 3;
            const npcMmY = (npc.y / TILE_SIZE) * tileScale / 3 * (150 / this.world.height);
            
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
        
        // Check for bounty targets
        if (this.enemy.bountyTarget) {
            const stage = this.game.quests.SHERIFF_BOUNTY.stages[1];
            stage.count = (stage.count || 0) + 1;
            if (stage.count >= stage.required) {
                stage.completed = true;
                this.game.notify('Return to the Sheriff for your reward!');
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

// Initialize game
const game = new Game();
