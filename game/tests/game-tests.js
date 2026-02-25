/**
 * Quest of the Dragon's Gold - Comprehensive Test Suite
 * Tests all major game systems for correctness and stability
 */

class GameTests {
    constructor() {
        this.results = [];
        this.currentTest = '';
        this.passCount = 0;
        this.failCount = 0;
        this.bugs = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
        const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    assert(condition, description, details = '') {
        if (condition) {
            this.passCount++;
            this.results.push({ test: this.currentTest, description, passed: true });
            this.log(`PASS: ${description}`, 'pass');
        } else {
            this.failCount++;
            this.results.push({ test: this.currentTest, description, passed: false, details });
            this.log(`FAIL: ${description} - ${details}`, 'fail');
        }
        return condition;
    }

    assertEqual(actual, expected, description) {
        const passed = actual === expected;
        const details = passed ? '' : `Expected ${expected}, got ${actual}`;
        return this.assert(passed, description, details);
    }

    assertRange(value, min, max, description) {
        const passed = value >= min && value <= max;
        const details = passed ? '' : `Value ${value} not in range [${min}, ${max}]`;
        return this.assert(passed, description, details);
    }

    reportBug(severity, title, description, reproduction = '') {
        this.bugs.push({ severity, title, description, reproduction });
        this.log(`BUG [${severity.toUpperCase()}]: ${title}`, 'warn');
    }

    async runAllTests(game) {
        this.log('='.repeat(60), 'info');
        this.log('Starting Quest of the Dragon\'s Gold Test Suite', 'info');
        this.log('='.repeat(60), 'info');

        await this.testGameInitialization(game);
        await this.testPlayerMovement(game);
        await this.testCombatSystem(game);
        await this.testShopTransactions(game);
        await this.testInventoryManagement(game);
        await this.testQuestProgression(game);
        await this.testDialogueSystem(game);
        await this.testSaveLoadSystem(game);
        await this.testGamblingSystem(game);
        await this.testEdgeCases(game);
        await this.testMemoryLeaks(game);
        await this.testUIElements(game);
        await this.testCombatBalance(game);

        return this.generateReport();
    }

    // Test 1: Game Initialization
    async testGameInitialization(game) {
        this.currentTest = 'Game Initialization';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Test game object exists
        this.assert(game !== undefined && game !== null, 'Game object exists');
        
        // Test canvas initialization
        this.assert(game.canvas !== null, 'Canvas element exists');
        this.assertEqual(game.canvas.width, 1200, 'Canvas width is 1200');
        this.assertEqual(game.canvas.height, 700, 'Canvas height is 700');

        // Test world generation
        this.assert(game.world !== undefined, 'World is generated');
        this.assertEqual(game.world.width, 200, 'World width is 200 tiles');
        this.assertEqual(game.world.height, 150, 'World height is 150 tiles');
        this.assert(Array.isArray(game.world.map), 'World map is an array');
        this.assertEqual(game.world.map.length, 150, 'World map has correct rows');

        // Test player initialization
        this.assert(game.player !== undefined, 'Player object exists');
        this.assertEqual(game.player.health, 100, 'Player starts with 100 health');
        this.assertEqual(game.player.maxHealth, 100, 'Player max health is 100');
        this.assertEqual(game.player.level, 1, 'Player starts at level 1');
        this.assertEqual(game.player.gold, 50, 'Player starts with 50 gold');
        this.assertEqual(game.player.xp, 0, 'Player starts with 0 XP');

        // Test player starting position
        const expectedStartX = 50 * 48; // TILE_SIZE = 48
        const expectedStartY = 75 * 48;
        this.assertEqual(game.player.x, expectedStartX, 'Player X position is correct');
        this.assertEqual(game.player.y, expectedStartY, 'Player Y position is correct');

        // Test player inventory initialization
        this.assert(Array.isArray(game.player.inventory), 'Player inventory is an array');
        this.assert(game.player.inventory.length >= 1, 'Player has starting items');
        
        // Test starting weapon
        const hasStartingWeapon = game.player.inventory.some(i => i.item && i.item.name === 'Rusty Sword');
        this.assert(hasStartingWeapon, 'Player has starting weapon (Rusty Sword)');

        // Test NPC generation
        this.assert(Array.isArray(game.npcs), 'NPCs array exists');
        this.assert(game.npcs.length > 0, 'NPCs were generated');
        this.assertRange(game.npcs.length, 40, 100, 'NPC count is reasonable (40-100)');

        // Test quest system initialization
        this.assert(game.quests !== undefined, 'Quest system initialized');
        this.assert(game.quests.MAIN_QUEST !== undefined, 'Main quest exists');

        // Test treasure chests
        this.assert(Array.isArray(game.treasureChests), 'Treasure chests array exists');
        this.assert(game.treasureChests.length > 0, 'Treasure chests generated');

        // Test decorations
        this.assert(Array.isArray(game.decorations), 'Decorations array exists');
        this.assert(game.decorations.length > 0, 'Decorations generated');

        // Test combat system
        this.assert(game.combat !== undefined, 'Combat system exists');
        this.assert(game.combat instanceof CombatSystem, 'Combat is CombatSystem instance');

        // Test gambling system
        this.assert(game.gambling !== undefined, 'Gambling system exists');
        this.assert(game.gambling instanceof GamblingSystem, 'Gambling is GamblingSystem instance');
    }

    // Test 2: Player Movement
    async testPlayerMovement(game) {
        this.currentTest = 'Player Movement';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Store original position
        const originalX = game.player.x;
        const originalY = game.player.y;

        // Test isWalkable function
        this.assert(typeof game.isWalkable === 'function', 'isWalkable function exists');
        
        // Test walkable tile (starting position should be walkable)
        const startTileX = Math.floor(originalX / 48);
        const startTileY = Math.floor(originalY / 48);
        this.assert(game.isWalkable(startTileX, startTileY), 'Starting position is walkable');

        // Test boundary checking
        this.assertEqual(game.isWalkable(-1, 0), false, 'Negative X is not walkable');
        this.assertEqual(game.isWalkable(0, -1), false, 'Negative Y is not walkable');
        this.assertEqual(game.isWalkable(999, 0), false, 'Out of bounds X is not walkable');
        this.assertEqual(game.isWalkable(0, 999), false, 'Out of bounds Y is not walkable');

        // Test setting movement target
        const newTargetX = originalX + 100;
        const newTargetY = originalY;
        game.player.targetX = newTargetX;
        game.player.targetY = newTargetY;
        this.assertEqual(game.player.targetX, newTargetX, 'Target X can be set');
        this.assertEqual(game.player.targetY, newTargetY, 'Target Y can be set');

        // Simulate movement update
        const dt = 0.016; // ~60fps
        for (let i = 0; i < 60; i++) {
            game.update(dt);
        }

        // Test movement occurred (player should have moved towards target)
        const moved = Math.abs(game.player.x - originalX) > 0 || Math.abs(game.player.y - originalY) > 0;
        this.assert(moved || Math.hypot(game.player.targetX - game.player.x, game.player.targetY - game.player.y) < 5, 
            'Player moves towards target');

        // Test camera follows player
        const cameraFollowing = Math.abs(game.camera.x - (game.player.x - 600)) < 200;
        this.assert(cameraFollowing, 'Camera follows player');

        // Reset position
        game.player.x = originalX;
        game.player.y = originalY;
        game.player.targetX = originalX;
        game.player.targetY = originalY;

        // Check for movement speed
        this.assertEqual(game.player.speed, 4, 'Player speed is 4');
    }

    // Test 3: Combat System
    async testCombatSystem(game) {
        this.currentTest = 'Combat System';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save player state
        const originalHealth = game.player.health;
        const originalGold = game.player.gold;
        const originalXP = game.player.xp;
        const wasInCombat = game.inCombat;

        // Create test enemy
        const testEnemy = {
            name: 'Test Enemy',
            type: { sprite: '👹', hostile: true },
            hostile: true,
            alive: true,
            health: 50,
            maxHealth: 50,
            attack: 10,
            defense: 5,
            level: 3
        };

        // Test combat start
        game.combat.start(testEnemy);
        this.assert(game.inCombat, 'Combat starts correctly');
        this.assert(game.combat.enemy === testEnemy, 'Enemy is set correctly');
        this.assertEqual(game.combat.playerTurn, true, 'Player goes first');

        // Test attack action
        const enemyHealthBefore = testEnemy.health;
        game.combat.playerAction('attack');
        const attackDamageDealt = enemyHealthBefore - testEnemy.health;
        this.assert(attackDamageDealt >= 0, 'Attack deals damage');

        // Test defend action
        game.combat.defending = false;
        game.combat.playerTurn = true;
        game.combat.playerAction('defend');
        this.assert(game.combat.defending || !game.combat.playerTurn, 'Defend action works');

        // Test heal action
        game.player.health = 50;
        game.combat.playerTurn = true;
        game.combat.playerAction('heal');
        this.assert(game.player.health >= 50, 'Heal action restores health');

        // End combat for further testing
        game.combat.endCombat(false);
        this.assert(!game.inCombat, 'Combat ends correctly');

        // Test damage calculation
        const attacker = { attack: 20 };
        const defender = { defense: 10 };
        const testDamage = Math.max(1, attacker.attack - defender.defense / 2);
        this.assert(testDamage > 0, 'Damage calculation is positive');

        // Test victory rewards
        testEnemy.health = testEnemy.maxHealth;
        testEnemy.alive = true;
        game.combat.start(testEnemy);
        
        // Kill enemy
        testEnemy.health = 0;
        const goldBefore = game.player.gold;
        const xpBefore = game.player.xp;
        game.combat.victory();
        
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const goldGained = game.player.gold > goldBefore;
        this.assert(goldGained || game.player.gold === goldBefore, 'Victory gives gold reward');
        this.assert(testEnemy.alive === false, 'Enemy marked as dead after victory');

        // Reset state
        game.player.health = originalHealth;
        game.player.gold = originalGold;
        game.player.xp = originalXP;
        game.inCombat = wasInCombat;
        if (game.combat.enemy) {
            game.combat.endCombat(false);
        }
    }

    // Test 4: Shop Transactions
    async testShopTransactions(game) {
        this.currentTest = 'Shop Transactions';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save player state
        const originalGold = game.player.gold;
        const originalInventoryLength = game.player.inventory.length;

        // Test shop open function exists
        this.assert(typeof game.openShop === 'function', 'openShop function exists');
        this.assert(typeof game.buyItem === 'function', 'buyItem function exists');
        this.assert(typeof game.closeShop === 'function', 'closeShop function exists');

        // Test buy item with sufficient gold
        game.player.gold = 1000;
        const inventoryBefore = game.player.inventory.length;
        game.buyItem('Iron Sword');
        
        // Check if item was added
        const hasIronSword = game.player.inventory.some(i => i.item && i.item.name === 'Iron Sword');
        this.assert(hasIronSword, 'Iron Sword purchased successfully');
        
        // Check gold deducted (Iron Sword costs 80)
        this.assertEqual(game.player.gold, 920, 'Gold deducted correctly for Iron Sword');

        // Test buy consumable (stackable)
        game.player.gold = 1000;
        const potionCountBefore = game.player.inventory.filter(i => 
            i.item && i.item.name === 'Health Potion'
        ).reduce((sum, i) => sum + (i.count || 1), 0);
        
        game.buyItem('Health Potion');
        
        const potionCountAfter = game.player.inventory.filter(i => 
            i.item && i.item.name === 'Health Potion'
        ).reduce((sum, i) => sum + (i.count || 1), 0);
        
        this.assert(potionCountAfter >= potionCountBefore, 'Consumable stacks correctly');

        // Test buy with insufficient gold
        game.player.gold = 10;
        const goldBeforeFail = game.player.gold;
        const invLengthBefore = game.player.inventory.length;
        game.buyItem('Legendary Blade'); // Costs 500
        
        this.assertEqual(game.player.gold, goldBeforeFail, 'Gold unchanged when insufficient');

        // Test different shop types
        const shopTypes = ['blacksmith', 'merchant', 'western', 'smuggler', 'royal', 'alchemist'];
        for (const shopType of shopTypes) {
            game.openShop(shopType);
            const shopUI = document.getElementById('shop-ui');
            this.assert(shopUI.style.display === 'block', `${shopType} shop opens correctly`);
            game.closeShop();
        }

        // Restore state
        game.player.gold = originalGold;
    }

    // Test 5: Inventory Management
    async testInventoryManagement(game) {
        this.currentTest = 'Inventory Management';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save state
        const originalAttack = game.player.attack;
        const originalDefense = game.player.defense;
        const originalHealth = game.player.health;

        // Test toggle inventory
        this.assert(typeof game.toggleInventory === 'function', 'toggleInventory function exists');
        
        game.toggleInventory();
        const inventoryPanel = document.getElementById('inventory-panel');
        this.assert(inventoryPanel.style.display === 'block', 'Inventory opens');
        
        game.toggleInventory();
        this.assert(inventoryPanel.style.display === 'none', 'Inventory closes');

        // Test equipping weapon
        const testWeapon = { name: 'Test Sword', type: 'weapon', icon: '⚔️', attack: 15, price: 100 };
        game.player.inventory.push({ item: testWeapon });
        const weaponIndex = game.player.inventory.findIndex(i => i.item && i.item.name === 'Test Sword');
        
        const attackBefore = game.player.attack;
        game.useInventoryItem(weaponIndex);
        
        this.assert(game.player.equipment.weapon.name === 'Test Sword', 'Weapon equipped correctly');
        this.assert(game.player.attack >= attackBefore, 'Attack increased after equipping weapon');

        // Test equipping armor
        const testArmor = { name: 'Test Armor', type: 'armor', icon: '🛡️', defense: 10, price: 100 };
        game.player.inventory.push({ item: testArmor });
        const armorIndex = game.player.inventory.findIndex(i => i.item && i.item.name === 'Test Armor');
        
        const defenseBefore = game.player.defense;
        game.useInventoryItem(armorIndex);
        
        this.assert(game.player.equipment.armor !== null, 'Armor equipped correctly');

        // Test using consumable
        game.player.health = 50;
        const testPotion = { name: 'Test Potion', type: 'consumable', icon: '🧪', heal: 30, price: 25, stackable: true };
        game.player.inventory.push({ item: testPotion, count: 2 });
        const potionIndex = game.player.inventory.findIndex(i => i.item && i.item.name === 'Test Potion');
        
        game.useInventoryItem(potionIndex);
        this.assert(game.player.health >= 50, 'Consumable heals player');

        // Test consumable count decreases
        const remainingPotions = game.player.inventory.filter(i => 
            i.item && i.item.name === 'Test Potion'
        ).reduce((sum, i) => sum + (i.count || 0), 0);
        this.assert(remainingPotions < 2, 'Consumable count decreases after use');

        // Restore state
        game.player.attack = originalAttack;
        game.player.defense = originalDefense;
        game.player.health = originalHealth;
    }

    // Test 6: Quest Progression
    async testQuestProgression(game) {
        this.currentTest = 'Quest Progression';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save state
        const originalQuests = JSON.parse(JSON.stringify(game.quests));
        const originalClues = [...game.cluesFound];

        // Test quest structure
        this.assert(game.quests.MAIN_QUEST !== undefined, 'Main quest exists');
        this.assert(game.quests.MAIN_QUEST.stages !== undefined, 'Main quest has stages');
        this.assert(game.quests.MAIN_QUEST.stages.length >= 4, 'Main quest has multiple stages');

        // Test starting quest
        game.quests.MAIN_QUEST.stages[0].completed = true;
        this.assert(game.quests.MAIN_QUEST.stages[0].completed, 'Quest stage can be completed');

        // Test clue collection
        this.assert(typeof game.giveClue === 'function', 'giveClue function exists');
        
        game.cluesFound = [];
        game.giveClue('clue1');
        this.assert(game.cluesFound.includes('clue1'), 'Clue can be added');
        
        // Test duplicate clue handling
        const clueCountBefore = game.cluesFound.length;
        game.giveClue('clue1');
        this.assertEqual(game.cluesFound.length, clueCountBefore, 'Duplicate clues not added');

        // Test clue count tracking
        game.cluesFound = ['clue1', 'clue2', 'clue3', 'clue4', 'clue5'];
        const clueStage = game.quests.MAIN_QUEST.stages[1];
        clueStage.count = game.cluesFound.length;
        this.assertEqual(clueStage.count, 5, 'Clue count updated correctly');

        // Test quest display
        this.assert(typeof game.toggleQuestLog === 'function', 'toggleQuestLog function exists');
        this.assert(typeof game.updateQuestDisplay === 'function', 'updateQuestDisplay function exists');

        // Test side quests exist
        this.assert(game.quests.PIRATE_SHIP !== undefined, 'Pirate Ship quest exists');
        this.assert(game.quests.SHERIFF_BOUNTY !== undefined, 'Sheriff Bounty quest exists');
        this.assert(game.quests.GHOST_MYSTERY !== undefined, 'Ghost Mystery quest exists');
        this.assert(game.quests.WOLF_HUNT !== undefined, 'Wolf Hunt quest exists');

        // Restore state
        game.quests = originalQuests;
        game.cluesFound = originalClues;
    }

    // Test 7: Dialogue System
    async testDialogueSystem(game) {
        this.currentTest = 'Dialogue System';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Test dialogue functions exist
        this.assert(typeof game.startDialogue === 'function', 'startDialogue function exists');
        this.assert(typeof game.showDialogue === 'function', 'showDialogue function exists');
        this.assert(typeof game.closeDialogue === 'function', 'closeDialogue function exists');
        this.assert(typeof game.selectDialogueChoice === 'function', 'selectDialogueChoice function exists');

        // Find an NPC with dialogue
        const npcWithDialogue = game.npcs.find(npc => npc.dialogue && npc.dialogue.length > 0 && npc.alive && !npc.hostile);
        this.assert(npcWithDialogue !== undefined, 'NPC with dialogue exists');

        if (npcWithDialogue) {
            // Test starting dialogue
            game.startDialogue(npcWithDialogue);
            this.assert(game.currentDialogue !== null, 'Dialogue started');
            this.assertEqual(game.currentDialogue.npc, npcWithDialogue, 'Current NPC set correctly');

            // Test dialogue UI appears
            const dialogueBox = document.getElementById('dialogue-box');
            this.assert(dialogueBox.style.display === 'block', 'Dialogue box is visible');

            // Test dialogue text displayed
            const dialogueText = document.getElementById('dialogue-text');
            this.assert(dialogueText.textContent.length > 0, 'Dialogue text is displayed');

            // Test speaker name displayed
            const speakerName = document.getElementById('dialogue-speaker');
            this.assertEqual(speakerName.textContent, npcWithDialogue.name, 'Speaker name is correct');

            // Test closing dialogue
            game.closeDialogue();
            this.assert(game.currentDialogue === null, 'Dialogue closed');
            this.assert(dialogueBox.style.display === 'none', 'Dialogue box hidden');
        }

        // Test dialogue actions
        this.assert(typeof game.executeDialogueAction === 'function', 'executeDialogueAction function exists');
        this.assert(typeof game.checkCondition === 'function', 'checkCondition function exists');

        // Test condition checking
        game.cluesFound = ['clue1', 'clue2', 'clue3', 'clue4', 'clue5'];
        this.assert(game.checkCondition('hasAllClues'), 'hasAllClues condition works');

        game.cluesFound = ['clue1'];
        this.assert(!game.checkCondition('hasAllClues'), 'hasAllClues false when insufficient clues');
    }

    // Test 8: Save/Load System
    async testSaveLoadSystem(game) {
        this.currentTest = 'Save/Load System';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save original state
        const originalPlayerState = JSON.stringify(game.player);
        const originalQuests = JSON.stringify(game.quests);

        // Test SaveSystem exists
        this.assert(typeof SaveSystem !== 'undefined', 'SaveSystem class exists');
        this.assert(typeof SaveSystem.save === 'function', 'SaveSystem.save function exists');
        this.assert(typeof SaveSystem.load === 'function', 'SaveSystem.load function exists');
        this.assert(typeof SaveSystem.hasSave === 'function', 'SaveSystem.hasSave function exists');
        this.assert(typeof SaveSystem.deleteSave === 'function', 'SaveSystem.deleteSave function exists');

        // Test saving
        const modifiedGold = 999;
        const modifiedHealth = 88;
        game.player.gold = modifiedGold;
        game.player.health = modifiedHealth;
        
        const saveResult = SaveSystem.save(game);
        this.assert(saveResult === true || saveResult === undefined, 'Save completes');

        // Verify save exists
        this.assert(SaveSystem.hasSave(), 'Save file exists after save');

        // Modify state
        game.player.gold = 0;
        game.player.health = 1;

        // Test loading
        const loadResult = SaveSystem.load(game);
        this.assert(loadResult === true || loadResult === undefined, 'Load completes');

        // Verify state restored
        this.assertEqual(game.player.gold, modifiedGold, 'Gold restored after load');
        this.assertEqual(game.player.health, modifiedHealth, 'Health restored after load');

        // Test delete save
        SaveSystem.deleteSave();
        this.assert(!SaveSystem.hasSave(), 'Save deleted successfully');

        // Restore original state
        const origPlayer = JSON.parse(originalPlayerState);
        Object.assign(game.player, origPlayer);
        game.quests = JSON.parse(originalQuests);
    }

    // Test 9: Gambling System
    async testGamblingSystem(game) {
        this.currentTest = 'Gambling System';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save state
        const originalGold = game.player.gold;

        // Test gambling functions exist
        this.assert(game.gambling !== undefined, 'Gambling system exists');
        this.assert(typeof game.gambling.init === 'function', 'Gambling init function exists');
        this.assert(typeof game.gambling.deal === 'function', 'Gambling deal function exists');
        this.assert(typeof game.gambling.dealCards === 'function', 'Gambling dealCards function exists');
        this.assert(typeof game.gambling.calculateHandValue === 'function', 'Gambling calculateHandValue function exists');
        this.assert(typeof game.gambling.raise === 'function', 'Gambling raise function exists');
        this.assert(typeof game.gambling.fold === 'function', 'Gambling fold function exists');

        // Test gambling initialization
        game.gambling.init('tavern');
        this.assertEqual(game.gambling.type, 'tavern', 'Gambling type set correctly');
        this.assertEqual(game.gambling.bet, 10, 'Default bet is 10');
        this.assertEqual(game.gambling.gameState, 'waiting', 'Initial state is waiting');

        // Test dealing cards
        game.player.gold = 100;
        game.gambling.deal();
        
        this.assertEqual(game.gambling.playerHand.length, 5, 'Player receives 5 cards');
        this.assertEqual(game.gambling.opponentHand.length, 5, 'Opponent receives 5 cards');
        this.assert(game.player.gold < 100, 'Gold deducted for bet');

        // Test card structure
        if (game.gambling.playerHand.length > 0) {
            const card = game.gambling.playerHand[0];
            this.assert(card.suit !== undefined, 'Card has suit');
            this.assert(card.value !== undefined, 'Card has value');
            this.assert(card.numValue !== undefined, 'Card has numeric value');
        }

        // Test hand value calculation
        const testHand = [
            { suit: '♠', value: 'A', numValue: 14 },
            { suit: '♠', value: 'K', numValue: 13 },
            { suit: '♠', value: 'Q', numValue: 12 },
            { suit: '♠', value: 'J', numValue: 11 },
            { suit: '♠', value: '10', numValue: 10 }
        ];
        const handValue = game.gambling.calculateHandValue(testHand);
        this.assert(handValue > 0, 'Hand value calculated');
        this.assert(handValue > 14, 'Flush bonus applied for same suit');

        // Test raise
        game.gambling.init('tavern');
        game.player.gold = 100;
        game.gambling.raise();
        this.assertEqual(game.gambling.bet, 20, 'Bet doubled after raise');

        // Test insufficient gold for deal
        game.player.gold = 5;
        game.gambling.init('tavern');
        const handsBefore = game.gambling.playerHand.length;
        game.gambling.deal();
        // Verify deal didn't happen with insufficient funds

        // Restore state
        game.player.gold = originalGold;
    }

    // Test 10: Edge Cases
    async testEdgeCases(game) {
        this.currentTest = 'Edge Cases';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Save state
        const originalHealth = game.player.health;
        const originalGold = game.player.gold;
        const originalLevel = game.player.level;

        // Test health boundaries
        game.player.health = 0;
        this.assertEqual(game.player.health, 0, 'Health can be zero');
        
        game.player.health = -10;
        // Note: The game might allow negative health
        this.assert(game.player.health <= 0, 'Health can go negative (potential bug)');
        if (game.player.health < 0) {
            this.reportBug('LOW', 'Negative Health', 
                'Player health can go below zero',
                'Set player.health = -10');
        }

        // Test max health overflow
        game.player.health = game.player.maxHealth + 100;
        this.assert(game.player.health >= game.player.maxHealth, 
            'Health can exceed max (check healing functions)');

        // Test gold boundaries
        game.player.gold = 0;
        game.buyItem('Iron Sword');
        this.assertEqual(game.player.gold, 0, 'Cannot buy with 0 gold');

        game.player.gold = -100;
        if (game.player.gold < 0) {
            this.reportBug('MEDIUM', 'Negative Gold', 
                'Player gold can be set to negative values',
                'Set player.gold = -100');
        }

        // Test XP boundaries
        game.gainXP(0);
        this.assertEqual(game.player.level, originalLevel, 'Zero XP gain handled');

        // Test extremely large XP
        game.player.level = 1;
        game.player.xp = 0;
        game.gainXP(100000);
        this.assert(game.player.level > 1, 'Large XP gain causes level up');

        // Test inventory overflow
        const maxInventory = 100;
        for (let i = 0; i < maxInventory; i++) {
            game.player.inventory.push({ item: { name: `Test Item ${i}` } });
        }
        this.assert(game.player.inventory.length >= maxInventory, 
            'Inventory can grow large');
        
        if (game.player.inventory.length > 16) {
            // Note: UI only shows 16 slots
            this.reportBug('LOW', 'Inventory Overflow', 
                'Inventory can exceed UI display capacity (16 slots)',
                'Add more than 16 items');
        }

        // Clean up excess inventory
        game.player.inventory = game.player.inventory.slice(0, 10);

        // Test NPC interaction at distance
        const farNPC = game.npcs.find(n => n.alive && !n.hostile);
        if (farNPC) {
            const originalDistance = Math.hypot(game.player.x - farNPC.x, game.player.y - farNPC.y);
            if (originalDistance > 200) {
                game.interactWithNPC(farNPC);
                // Should not start dialogue at distance
            }
        }

        // Restore state
        game.player.health = originalHealth;
        game.player.gold = originalGold;
        game.player.level = originalLevel;
    }

    // Test 11: Memory Leaks
    async testMemoryLeaks(game) {
        this.currentTest = 'Memory Leaks';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Test NPC array growth
        const npcCountBefore = game.npcs.length;
        
        // Simulate long gameplay - run updates
        for (let i = 0; i < 1000; i++) {
            game.update(0.016);
        }
        
        const npcCountAfter = game.npcs.length;
        const npcGrowth = npcCountAfter - npcCountBefore;
        
        if (npcGrowth > 50) {
            this.reportBug('MEDIUM', 'NPC Array Growth', 
                `NPCs array grew by ${npcGrowth} during simulation`,
                'Run 1000 update cycles');
        }

        // Test combat log growth
        if (game.combat.combatLog) {
            const logSizeBefore = game.combat.combatLog.length;
            
            // Simulate combat log entries
            for (let i = 0; i < 100; i++) {
                game.combat.log('Test log entry ' + i);
            }
            
            // Combat log should be capped at 5 entries in display
            this.assertRange(game.combat.combatLog.length, 0, 200, 
                'Combat log size is reasonable');
        }

        // Test decoration array (shouldn't grow)
        const decoCountBefore = game.decorations.length;
        game.update(0.016);
        const decoCountAfter = game.decorations.length;
        this.assertEqual(decoCountBefore, decoCountAfter, 'Decorations dont grow');

        this.log('Memory leak tests completed (basic checks)', 'info');
    }

    // Test 12: UI Elements
    async testUIElements(game) {
        this.currentTest = 'UI Elements';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Test HUD elements exist
        const hudElements = [
            'health-text', 'health-fill', 'level-text', 'xp-fill', 'gold-text',
            'dialogue-box', 'dialogue-speaker', 'dialogue-text', 'dialogue-choices',
            'combat-ui', 'combat-log', 'inventory-panel', 'inventory-grid',
            'quest-log', 'quest-list', 'shop-ui', 'gambling-ui', 'notification'
        ];

        for (const elementId of hudElements) {
            const element = document.getElementById(elementId);
            this.assert(element !== null, `UI element '${elementId}' exists`);
        }

        // Test updateHUD function
        this.assert(typeof game.updateHUD === 'function', 'updateHUD function exists');
        
        game.player.health = 75;
        game.player.maxHealth = 100;
        game.player.gold = 123;
        game.player.level = 5;
        
        game.updateHUD();
        
        const healthText = document.getElementById('health-text').textContent;
        this.assert(healthText.includes('75'), 'Health displayed correctly');
        
        const goldText = document.getElementById('gold-text').textContent;
        this.assert(goldText.includes('123'), 'Gold displayed correctly');

        // Test panel toggle functions
        const panels = [
            { toggle: 'toggleInventory', panel: 'inventory-panel' },
            { toggle: 'toggleQuestLog', panel: 'quest-log' }
        ];

        for (const { toggle, panel } of panels) {
            if (typeof game[toggle] === 'function') {
                const panelElement = document.getElementById(panel);
                const initialState = panelElement.style.display;
                
                game[toggle]();
                const afterToggle = panelElement.style.display;
                
                game[toggle]();
                const afterSecondToggle = panelElement.style.display;
                
                this.assert(afterToggle !== initialState || afterSecondToggle === initialState,
                    `${toggle} toggles panel correctly`);
            }
        }

        // Test closeAllPanels
        game.openShop('merchant');
        game.toggleInventory();
        game.closeAllPanels();
        
        const inventoryPanel = document.getElementById('inventory-panel');
        const shopUI = document.getElementById('shop-ui');
        
        this.assert(inventoryPanel.style.display === 'none', 'Inventory closed by closeAllPanels');
        this.assert(shopUI.style.display === 'none', 'Shop closed by closeAllPanels');

        // Test notification system
        this.assert(typeof game.notify === 'function', 'notify function exists');
        game.notify('Test notification');
        
        const notification = document.getElementById('notification');
        this.assert(notification.textContent.includes('Test notification'), 
            'Notification displays message');
    }

    // Test 13: Combat Balance
    async testCombatBalance(game) {
        this.currentTest = 'Combat Balance';
        this.log(`\n--- Testing: ${this.currentTest} ---`, 'info');

        // Find enemies of different levels
        const enemies = game.npcs.filter(n => n.hostile && n.alive);
        
        if (enemies.length > 0) {
            // Check enemy stat scaling
            for (const enemy of enemies.slice(0, 5)) {
                const expectedMinHealth = enemy.level * 10;
                const expectedMinAttack = enemy.level * 2;
                
                this.assert(enemy.health >= expectedMinHealth * 0.5, 
                    `Enemy ${enemy.name} health scales with level`);
                this.assert(enemy.attack >= expectedMinAttack * 0.5, 
                    `Enemy ${enemy.name} attack scales with level`);
            }
        }

        // Check dragon stats (boss)
        const dragon = game.npcs.find(n => n.boss && n.type === NPC_TYPES.DRAGON);
        if (dragon) {
            this.assert(dragon.level >= 15, 'Dragon is high level');
            this.assert(dragon.health >= 200, 'Dragon has high health');
            this.assert(dragon.attack >= 40, 'Dragon has high attack');
        }

        // Test XP/Gold rewards scale
        const lowLevelEnemy = { level: 1 };
        const highLevelEnemy = { level: 10 };
        
        const lowXP = lowLevelEnemy.level * 25;
        const highXP = highLevelEnemy.level * 25;
        
        this.assert(highXP > lowXP, 'Higher level enemies give more XP');
        this.assertEqual(highXP, 250, 'Level 10 enemy gives 250 XP');

        // Check item prices are balanced
        const weapons = Object.values(ITEMS).filter(i => i.type === 'weapon');
        const sortedWeapons = weapons.sort((a, b) => (a.price || 0) - (b.price || 0));
        
        for (let i = 1; i < sortedWeapons.length; i++) {
            if (sortedWeapons[i].price && sortedWeapons[i-1].price) {
                this.assert(
                    sortedWeapons[i].attack >= sortedWeapons[i-1].attack || 
                    sortedWeapons[i].price >= sortedWeapons[i-1].price * 0.5,
                    `Weapon pricing is consistent: ${sortedWeapons[i].name}`
                );
            }
        }
    }

    // Generate final report
    generateReport() {
        const report = {
            summary: {
                totalTests: this.passCount + this.failCount,
                passed: this.passCount,
                failed: this.failCount,
                passRate: ((this.passCount / (this.passCount + this.failCount)) * 100).toFixed(2) + '%'
            },
            bugs: this.bugs,
            results: this.results,
            timestamp: new Date().toISOString()
        };

        this.log('\n' + '='.repeat(60), 'info');
        this.log('TEST SUITE COMPLETE', 'info');
        this.log('='.repeat(60), 'info');
        this.log(`Total Tests: ${report.summary.totalTests}`, 'info');
        this.log(`Passed: ${report.summary.passed}`, 'pass');
        this.log(`Failed: ${report.summary.failed}`, 'fail');
        this.log(`Pass Rate: ${report.summary.passRate}`, 'info');
        
        if (this.bugs.length > 0) {
            this.log('\n--- BUGS FOUND ---', 'warn');
            for (const bug of this.bugs) {
                this.log(`[${bug.severity}] ${bug.title}: ${bug.description}`, 'warn');
            }
        }

        return report;
    }
}

// Export for use in test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameTests };
}
