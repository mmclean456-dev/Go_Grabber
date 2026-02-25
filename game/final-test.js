const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function finalTest() {
    console.log('🎮 FINAL INTEGRATION TEST - Quest of the Dragon\'s Gold\n');
    console.log('='.repeat(60) + '\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    
    const filePath = `file://${path.resolve(__dirname, 'index.html')}`;
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    
    fs.mkdirSync('final-screenshots', { recursive: true });
    
    // Test 1: Title Screen
    console.log('📸 1. Title Screen');
    await page.screenshot({ path: 'final-screenshots/01-title.png' });
    
    // Start game
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 2: Game World with all new UI
    console.log('📸 2. Game World (with new HUD features)');
    let canvas = await page.evaluate(() => game.canvas.toDataURL('image/png'));
    fs.writeFileSync('final-screenshots/02-world.png', Buffer.from(canvas.replace(/^data:image\/png;base64,/, ''), 'base64'));
    
    // Test 3: Sound settings
    console.log('📸 3. Sound Settings Panel');
    await page.evaluate(() => {
        const soundBtn = document.querySelector('[onclick*="toggleSoundPanel"]') || document.querySelector('[onclick*="soundPanel"]');
        if (soundBtn) soundBtn.click();
        else if (game.soundSystem) game.soundSystem.togglePanel();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/03-sound-settings.png' });
    
    // Close sound panel
    await page.evaluate(() => {
        const panel = document.getElementById('sound-panel');
        if (panel) panel.style.display = 'none';
    });
    
    // Test 4: Inventory with tooltips
    console.log('📸 4. Inventory with Tooltips');
    await page.evaluate(() => game.toggleInventory());
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/04-inventory.png' });
    await page.evaluate(() => game.toggleInventory());
    
    // Test 5: Statistics Screen
    console.log('📸 5. Statistics Screen');
    await page.evaluate(() => {
        if (typeof game.toggleStats === 'function') game.toggleStats();
        else if (document.getElementById('stats-panel')) {
            document.getElementById('stats-panel').style.display = 'block';
        }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/05-stats.png' });
    await page.evaluate(() => {
        const panel = document.getElementById('stats-panel');
        if (panel) panel.style.display = 'none';
    });
    
    // Test 6: Fast Travel
    console.log('📸 6. Fast Travel Menu');
    await page.evaluate(() => {
        if (typeof game.toggleFastTravel === 'function') game.toggleFastTravel();
        else if (document.getElementById('fast-travel-panel')) {
            document.getElementById('fast-travel-panel').style.display = 'block';
        }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/06-fast-travel.png' });
    await page.evaluate(() => {
        const panel = document.getElementById('fast-travel-panel');
        if (panel) panel.style.display = 'none';
    });
    
    // Test 7: Quest Log
    console.log('📸 7. Quest Log');
    await page.evaluate(() => game.toggleQuestLog());
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/07-quests.png' });
    await page.evaluate(() => game.toggleQuestLog());
    
    // Test 8: NPC Interaction (test improved hitboxes)
    console.log('📸 8. NPC Interaction (with E prompt)');
    await page.evaluate(() => {
        const elder = game.npcs.find(n => n.name === 'Elder Thomas');
        if (elder) {
            game.player.x = elder.x - 60;
            game.player.y = elder.y;
            game.player.targetX = game.player.x;
            game.player.targetY = game.player.y;
        }
    });
    await new Promise(r => setTimeout(r, 1000));
    canvas = await page.evaluate(() => game.canvas.toDataURL('image/png'));
    fs.writeFileSync('final-screenshots/08-npc-interaction.png', Buffer.from(canvas.replace(/^data:image\/png;base64,/, ''), 'base64'));
    
    // Test 9: Combat (show enemy level display)
    console.log('📸 9. Combat UI (with turn numbers)');
    await page.evaluate(() => {
        const enemy = game.npcs.find(n => n.hostile && n.alive);
        if (enemy) {
            game.combat.start(enemy);
        }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/09-combat.png' });
    
    // Do a combat action
    await page.evaluate(() => {
        if (game.inCombat) game.combat.playerAction('attack');
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'final-screenshots/10-combat-log.png' });
    
    // End combat
    await page.evaluate(() => {
        if (game.inCombat) game.combat.playerAction('flee');
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Test 10: Shop
    console.log('📸 10. Shop Interface');
    await page.evaluate(() => game.openShop('blacksmith'));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/11-shop.png' });
    await page.evaluate(() => game.closeShop());
    
    // Test 11: Gambling
    console.log('📸 11. Gambling Card Game');
    await page.evaluate(() => game.openGambling('saloon'));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'final-screenshots/12-gambling.png' });
    await page.evaluate(() => game.closeGambling());
    
    // Final state
    console.log('\n' + '='.repeat(60));
    const finalState = await page.evaluate(() => ({
        running: game.running,
        player: {
            level: game.player.level,
            health: game.player.health,
            gold: game.player.gold
        },
        features: {
            soundSystem: typeof game.soundSystem !== 'undefined',
            fastTravel: typeof game.toggleFastTravel === 'function' || !!document.getElementById('fast-travel-panel'),
            statsPanel: !!document.getElementById('stats-panel'),
            questMarkers: typeof game.updateQuestMarkers === 'function'
        },
        content: {
            npcs: game.npcs.length,
            quests: Object.keys(game.quests).length,
            regions: game.discoveredLocations.size
        }
    }));
    
    console.log('\n📊 FINAL GAME STATE:');
    console.log(JSON.stringify(finalState, null, 2));
    
    console.log('\n✅ FINAL TEST COMPLETE - 12 screenshots captured');
    console.log('📁 Screenshots saved to: final-screenshots/');
    
    await browser.close();
}

finalTest().catch(console.error);
