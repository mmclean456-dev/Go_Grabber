# Quest of the Dragon's Gold

A cross-genre point-and-click adventure game featuring knights, pirates, cowboys, and medieval fantasy elements. Built with vanilla HTML5 Canvas and JavaScript.

## How to Play

1. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari)
2. Click "Begin Your Quest" to start (or load a previous save)
3. **Left-click** anywhere on the map to move your knight
4. **Left-click** on NPCs to interact with them
5. Explore the world, gather clues, fight enemies, and defeat the dragon!

## Controls

| Key | Action |
|-----|--------|
| **Left Click** | Move to location / Interact with NPC |
| **Right Click** | Cancel / Close dialogue |
| **I** | Open/Close Inventory |
| **Q** | Open/Close Quest Log |
| **ESC** | Close all panels |
| **F5** | Quick Save |
| **F9** | Quick Load |
| **1-4** | Use hotbar items |

## Game Features

### Core Gameplay
- **Point-and-click movement** in a large scrolling 2D world (200x150 tiles)
- **Turn-based combat** with attack, heavy strike, defend, heal, and flee options
- **Equipment system** with weapons, armor, and accessories
- **Inventory management** with consumables and key items
- **Gold economy** with multiple shops offering different goods
- **Ally recruitment** - build a party to help in combat

### Main Quest: The Dragon's Gold
Your goal is to find the Dragon's Lair, defeat the ancient dragon Infernus, and claim the legendary treasure. To find the lair, you must:

1. **Gather 5 clues** scattered across the world
2. **Find the Mountain Pass** guide who will reveal the path
3. **Prepare for battle** with gear, potions, and allies
4. **Defeat the Dragon** and claim your reward!

### Regions to Explore

| Region | Description | Notable NPCs |
|--------|-------------|--------------|
| **Starting Village** | Your journey begins here | Elder Thomas, Blacksmith Aldric, Martha the Innkeeper |
| **Dark Forest** | Dangerous woods with beasts | Merlin the Wise, Forest creatures |
| **Pirate Cove** | Home of sea dogs and rogues | Captain Blackbeard, One-Eyed Jack, Smuggler |
| **Western Town** | Cowboys and outlaws | Sheriff John, Dusty Dan, Prospector Pete |
| **Medieval Castle** | Ancient fortress with secrets | Sir Galahad, Ghost King, Royal Armorer |
| **Mystic Swamp** | Treacherous marshlands | Swamp Witch, Hermit Alchemist |
| **Mountain Pass** | Gateway to the dragon | Mountain Hermit, The Guide |
| **Dragon's Lair** | Final destination | Infernus the Ancient |

### Side Quests

- **Wolf Problem**: Clear wolves from the farmer's land
- **Wanted: Dead or Alive**: Help the Sheriff capture bandits
- **A Ship of Your Own**: Win Captain Blackbeard's ship in cards
- **The Castle Ghost**: Uncover the Ghost King's secrets
- **The Lost Heirloom**: Recover a knight's stolen family sword
- **Gold Rush**: Clear bandits from the gold mine
- **The Lost Prince**: Rescue the prince from the dragon
- **Swamp Rescue**: Escort a lost traveler to safety

### Side Activities

- **Gambling**: Play poker in taverns and saloons across the world
- **Treasure Hunting**: Find hidden treasure chests (19+ scattered across the map)
- **Shopping**: Visit different merchants for unique items
- **Exploration**: Discover all 8 locations for XP bonuses

### Combat System

Turn-based combat with these actions:
- **Attack**: Standard damage based on your attack stat
- **Heavy Strike**: 1.5x damage but 30% miss chance
- **Defend**: Double your defense for this turn
- **Heal**: Restore 30 HP
- **Flee**: 50% chance to escape combat

Combat rewards:
- XP based on enemy level
- Gold drops
- Random item drops (potions, extra gold)

### Replayability Features

- **Procedural World Generation**: Terrain varies each playthrough
- **Random Events**: 8 different random encounters while exploring
- **Day/Night Cycle**: Visual changes based on time of day
- **Weather System**: Sunny, foggy, rainy, or stormy weather
- **Enemy Spawning**: New enemies spawn as you explore
- **Achievement System**: 13 achievements to unlock

### Achievements

- First Blood: Defeat your first enemy
- Monster Slayer: Defeat 10 enemies
- Champion: Defeat 50 enemies
- Getting Rich: Accumulate 500 gold
- Wealthy: Accumulate 2000 gold
- Explorer: Discover 5 locations
- World Traveler: Discover all locations
- Clue Hunter: Find all 5 clues
- Seasoned Adventurer: Reach level 5
- Veteran: Reach level 10
- Dragon Slayer: Defeat the dragon
- Card Shark: Win at gambling
- Leader: Recruit an ally

## Tips for Success

1. **Talk to everyone** - NPCs give valuable information and quests
2. **Save often** (F5) - Combat can be deadly!
3. **Gather clues first** - You can't reach the dragon without them
4. **Level up** before facing tough enemies - grind in the forest first
5. **Buy potions** - Health potions are essential for survival
6. **Recruit allies** - Sir Roderick and Merlin can join you
7. **Get fire resistance** - The Alchemist sells potions that help against the dragon
8. **Check treasure chests** - They contain valuable loot
9. **Complete side quests** - They give gold, XP, and useful items
10. **The dragon is level 20** - Make sure you're ready!

## Estimated Playtime

A complete playthrough exploring all content takes approximately **8-12 hours**:
- Main quest: 3-4 hours
- Side quests: 3-4 hours
- Exploration and combat: 2-4 hours

## Technical Details

- **Engine**: Vanilla HTML5 Canvas + JavaScript
- **No dependencies**: Runs in any modern browser
- **Save system**: Uses localStorage for save/load
- **World size**: 200x150 tiles (procedurally generated)
- **60 FPS** game loop with smooth camera following

## File Structure

```
game/
├── index.html      # Main HTML file with UI and styles
├── js/
│   └── game.js     # Complete game engine and content
└── README.md       # This file
```

## Browser Compatibility

Tested and works in:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## Credits

Created as a cross-genre adventure combining:
- Medieval fantasy (knights, castles, dragons)
- Pirate adventure (ships, treasure, card games)
- Western frontier (cowboys, saloons, bounties)
- RPG mechanics (leveling, equipment, quests)

---

**Good luck, brave knight! May you claim the Dragon's Gold!** ⚔️🐉💰
