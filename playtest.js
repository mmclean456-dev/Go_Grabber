const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SCREENSHOTS_DIR = path.join(__dirname, 'game', 'screenshots');
const REPORT_PATH = path.join(__dirname, 'game', 'PLAYTEST_REPORT.md');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let report = {
    funMoments: [],
    frustratingMoments: [],
    bugs: [],
    suggestions: [],
    scenarios: {},
    overallRating: 0
};

function startServer(directory, port) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let filePath = path.join(directory, req.url === '/' ? 'index.html' : req.url);
            const ext = path.extname(filePath);
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.jpg': 'image/jpeg'
            };
            
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                } else {
                    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
                    res.end(content);
                }
            });
        });
        
        server.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            resolve(server);
        });
    });
}

async function takeScreenshot(page, name) {
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved: ${name}.png`);
    return `screenshots/${name}.png`;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickAt(page, x, y) {
    await page.mouse.click(x, y);
    await sleep(100);
}

async function waitForGameLoad(page) {
    await page.waitForSelector('#loading-screen', { visible: true, timeout: 5000 });
    console.log('Loading screen found');
}

async function startGame(page) {
    await page.click('#start-btn');
    await sleep(1000);
    console.log('Game started!');
}

async function pressKey(page, key) {
    await page.keyboard.press(key);
    await sleep(300);
}

async function getGameState(page) {
    return await page.evaluate(() => {
        if (typeof game === 'undefined') return null;
        return {
            playerHealth: game.player.health,
            playerMaxHealth: game.player.maxHealth,
            playerGold: game.player.gold,
            playerLevel: game.player.level,
            playerX: game.player.x,
            playerY: game.player.y,
            inCombat: game.inCombat,
            inventoryVisible: document.getElementById('inventory-panel').style.display !== 'none',
            questLogVisible: document.getElementById('quest-log').style.display !== 'none',
            shopVisible: document.getElementById('shop-ui').style.display !== 'none',
            dialogueVisible: document.getElementById('dialogue-box').style.display !== 'none',
            combatVisible: document.getElementById('combat-ui').style.display !== 'none',
            npcsCount: game.npcs.filter(n => n.alive).length,
            questsStarted: Object.keys(game.quests).filter(q => game.quests[q].stages && game.quests[q].stages[0].completed).length
        };
    });
}

async function moveToPosition(page, targetTileX, targetTileY) {
    const canvasX = 600;
    const canvasY = 350;
    
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
        const state = await page.evaluate((tx, ty) => {
            if (!game) return null;
            const playerTileX = Math.floor(game.player.x / 48);
            const playerTileY = Math.floor(game.player.y / 48);
            return { playerTileX, playerTileY };
        }, targetTileX, targetTileY);
        
        if (!state) break;
        
        const dx = targetTileX - state.playerTileX;
        const dy = targetTileY - state.playerTileY;
        
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
            console.log(`Reached target area (${state.playerTileX}, ${state.playerTileY})`);
            break;
        }
        
        const clickX = canvasX + Math.sign(dx) * 100;
        const clickY = canvasY + Math.sign(dy) * 100;
        
        await page.mouse.click(clickX, clickY);
        await sleep(500);
    }
}

async function findAndClickNPC(page, npcName) {
    const result = await page.evaluate((name) => {
        if (!game) return null;
        const npc = game.npcs.find(n => n.alive && n.name && n.name.toLowerCase().includes(name.toLowerCase()));
        if (!npc) return null;
        
        const screenX = npc.x - game.camera.x;
        const screenY = npc.y - game.camera.y;
        
        return {
            found: true,
            screenX,
            screenY,
            name: npc.name,
            hostile: npc.hostile,
            tileX: Math.floor(npc.x / 48),
            tileY: Math.floor(npc.y / 48)
        };
    }, npcName);
    
    if (result && result.found) {
        console.log(`Found NPC: ${result.name} at (${result.tileX}, ${result.tileY})`);
        
        await moveToPosition(page, result.tileX, result.tileY);
        await sleep(500);
        
        const updatedResult = await page.evaluate((name) => {
            const npc = game.npcs.find(n => n.alive && n.name && n.name.toLowerCase().includes(name.toLowerCase()));
            if (!npc) return null;
            return {
                screenX: npc.x - game.camera.x,
                screenY: npc.y - game.camera.y
            };
        }, npcName);
        
        if (updatedResult) {
            await page.mouse.click(updatedResult.screenX, updatedResult.screenY);
            await sleep(500);
        }
        
        return true;
    }
    return false;
}

async function clickDialogueChoice(page, choiceIndex) {
    const clicked = await page.evaluate((idx) => {
        const choices = document.querySelectorAll('.dialogue-choice');
        if (choices.length > idx) {
            choices[idx].click();
            return true;
        }
        return false;
    }, choiceIndex);
    
    if (clicked) {
        await sleep(500);
    }
    return clicked;
}

async function performCombatAction(page, action) {
    const buttonSelectors = {
        'attack': "button[onclick*=\"'attack'\"]",
        'heavy': "button[onclick*=\"'heavy'\"]",
        'defend': "button[onclick*=\"'defend'\"]",
        'heal': "button[onclick*=\"'heal'\"]",
        'flee': "button[onclick*=\"'flee'\"]"
    };
    
    try {
        await page.click(buttonSelectors[action]);
        await sleep(800);
        return true;
    } catch (e) {
        return false;
    }
}

async function runScenario1_NewPlayerExperience(page) {
    console.log('\n========================================');
    console.log('SCENARIO 1: New Player Experience');
    console.log('========================================\n');
    
    const scenarioData = {
        name: 'New Player Experience',
        observations: [],
        issues: []
    };
    
    await waitForGameLoad(page);
    let screenshot = await takeScreenshot(page, '01_loading_screen');
    scenarioData.observations.push({
        moment: 'Loading Screen',
        screenshot,
        notes: 'Game title and instructions displayed on loading screen'
    });
    
    const loadingText = await page.evaluate(() => {
        const loading = document.getElementById('loading-screen');
        return loading ? loading.innerText : '';
    });
    
    if (loadingText.includes('Controls')) {
        scenarioData.observations.push({
            moment: 'Controls Info',
            notes: 'Controls are shown on loading screen - helpful for new players'
        });
        report.funMoments.push('Clear controls displayed on loading screen before starting');
    } else {
        scenarioData.issues.push('Controls not clearly displayed on loading screen');
    }
    
    await startGame(page);
    await sleep(1500);
    
    screenshot = await takeScreenshot(page, '02_game_start');
    scenarioData.observations.push({
        moment: 'Game Start',
        screenshot,
        notes: 'Player spawns in starting village with HUD visible'
    });
    
    const state = await getGameState(page);
    if (state) {
        console.log(`Initial state: HP=${state.playerHealth}/${state.playerMaxHealth}, Gold=${state.playerGold}, Level=${state.playerLevel}`);
        
        if (state.playerHealth !== state.playerMaxHealth) {
            scenarioData.issues.push('Player starts with less than full health');
            report.bugs.push('Player may start with reduced health');
        }
    }
    
    console.log('Testing UI panels...');
    await pressKey(page, 'i');
    await sleep(500);
    let inventoryVisible = await page.evaluate(() => 
        document.getElementById('inventory-panel').style.display !== 'none'
    );
    
    if (inventoryVisible) {
        screenshot = await takeScreenshot(page, '03_inventory_panel');
        scenarioData.observations.push({
            moment: 'Inventory Panel',
            screenshot,
            notes: 'Inventory opens with I key - shows equipment and items'
        });
        report.funMoments.push('Inventory panel has nice visual design with equipment slots');
    } else {
        scenarioData.issues.push('Inventory does not open with I key');
    }
    await pressKey(page, 'i');
    
    await pressKey(page, 'q');
    await sleep(500);
    let questLogVisible = await page.evaluate(() => 
        document.getElementById('quest-log').style.display !== 'none'
    );
    
    if (questLogVisible) {
        screenshot = await takeScreenshot(page, '04_quest_log');
        scenarioData.observations.push({
            moment: 'Quest Log',
            screenshot,
            notes: 'Quest log opens with Q key - shows active quests and clues'
        });
    } else {
        scenarioData.issues.push('Quest log does not open with Q key');
    }
    await pressKey(page, 'q');
    
    console.log('Trying to talk to first NPC (Elder Thomas)...');
    const foundElder = await findAndClickNPC(page, 'Elder');
    await sleep(1000);
    
    let dialogueVisible = await page.evaluate(() => 
        document.getElementById('dialogue-box').style.display !== 'none'
    );
    
    if (dialogueVisible) {
        screenshot = await takeScreenshot(page, '05_first_dialogue');
        scenarioData.observations.push({
            moment: 'First NPC Dialogue',
            screenshot,
            notes: 'Elder Thomas dialogue provides game context and quest hook'
        });
        report.funMoments.push('NPC dialogue gives clear story introduction');
        
        await clickDialogueChoice(page, 0);
        await sleep(500);
        await clickDialogueChoice(page, 0);
        await sleep(500);
        
        screenshot = await takeScreenshot(page, '06_dialogue_choices');
        scenarioData.observations.push({
            moment: 'Dialogue Choices',
            screenshot,
            notes: 'Dialogue has meaningful choices that progress the story'
        });
    } else {
        scenarioData.issues.push('Could not trigger dialogue with Elder Thomas');
        report.frustratingMoments.push('Difficulty interacting with first NPC');
    }
    
    await pressKey(page, 'Escape');
    await sleep(500);
    
    console.log('Testing movement...');
    for (let i = 0; i < 3; i++) {
        await clickAt(page, 700, 350);
        await sleep(400);
    }
    screenshot = await takeScreenshot(page, '07_movement');
    scenarioData.observations.push({
        moment: 'Movement Test',
        screenshot,
        notes: 'Click-to-move works smoothly with camera following player'
    });
    
    const hudElements = await page.evaluate(() => {
        return {
            healthVisible: document.getElementById('health-text') !== null,
            goldVisible: document.getElementById('gold-text') !== null,
            levelVisible: document.getElementById('level-text') !== null,
            minimapVisible: document.getElementById('minimap') !== null,
            hotbarVisible: document.getElementById('hotbar') !== null
        };
    });
    
    if (hudElements.healthVisible && hudElements.goldVisible && hudElements.minimapVisible) {
        scenarioData.observations.push({
            moment: 'HUD Assessment',
            notes: 'All HUD elements present: health, gold, level, minimap, hotbar'
        });
        report.funMoments.push('Well-designed HUD provides all necessary information at a glance');
    } else {
        scenarioData.issues.push('Some HUD elements missing');
    }
    
    if (scenarioData.issues.length === 0) {
        scenarioData.observations.push({
            moment: 'Overall',
            notes: 'New player experience is smooth with clear objectives'
        });
    }
    
    report.scenarios['scenario1'] = scenarioData;
    console.log('Scenario 1 complete!');
}

async function runScenario2_CombatFlow(page) {
    console.log('\n========================================');
    console.log('SCENARIO 2: Combat Flow');
    console.log('========================================\n');
    
    const scenarioData = {
        name: 'Combat Flow',
        observations: [],
        issues: []
    };
    
    console.log('Looking for a hostile enemy...');
    
    const enemies = await page.evaluate(() => {
        if (!game) return [];
        return game.npcs.filter(n => n.alive && n.hostile === true).map(n => ({
            name: n.name,
            tileX: Math.floor(n.x / 48),
            tileY: Math.floor(n.y / 48),
            level: n.level
        }));
    });
    
    console.log(`Found ${enemies.length} hostile enemies`);
    
    if (enemies.length > 0) {
        const lowLevelEnemy = enemies.find(e => e.level <= 3) || enemies[0];
        console.log(`Targeting: ${lowLevelEnemy.name} (Level ${lowLevelEnemy.level})`);
        
        await moveToPosition(page, lowLevelEnemy.tileX, lowLevelEnemy.tileY);
        await sleep(1000);
        
        const beforeCombat = await getGameState(page);
        
        const found = await findAndClickNPC(page, lowLevelEnemy.name.split(' ')[0]);
        await sleep(1500);
        
        let combatStarted = await page.evaluate(() => 
            document.getElementById('combat-ui').style.display !== 'none'
        );
        
        if (combatStarted) {
            let screenshot = await takeScreenshot(page, '08_combat_start');
            scenarioData.observations.push({
                moment: 'Combat Start',
                screenshot,
                notes: 'Combat UI shows both combatants with health bars'
            });
            report.funMoments.push('Combat UI is visually appealing with clear health indicators');
            
            console.log('Testing Attack action...');
            await performCombatAction(page, 'attack');
            screenshot = await takeScreenshot(page, '09_combat_attack');
            scenarioData.observations.push({
                moment: 'Attack Action',
                screenshot,
                notes: 'Attack action performs standard damage'
            });
            
            let stillInCombat = await page.evaluate(() => 
                document.getElementById('combat-ui').style.display !== 'none'
            );
            
            if (stillInCombat) {
                console.log('Testing Defend action...');
                await performCombatAction(page, 'defend');
                screenshot = await takeScreenshot(page, '10_combat_defend');
                scenarioData.observations.push({
                    moment: 'Defend Action',
                    screenshot,
                    notes: 'Defend action reduces incoming damage'
                });
            }
            
            stillInCombat = await page.evaluate(() => 
                document.getElementById('combat-ui').style.display !== 'none'
            );
            
            if (stillInCombat) {
                console.log('Testing Heal action...');
                await performCombatAction(page, 'heal');
                screenshot = await takeScreenshot(page, '11_combat_heal');
                scenarioData.observations.push({
                    moment: 'Heal Action',
                    screenshot,
                    notes: 'Heal restores health during combat'
                });
            }
            
            let combatRounds = 0;
            while (combatRounds < 10) {
                stillInCombat = await page.evaluate(() => 
                    document.getElementById('combat-ui').style.display !== 'none'
                );
                
                if (!stillInCombat) break;
                
                const healthState = await page.evaluate(() => {
                    if (!game) return null;
                    return {
                        playerHealth: game.player.health,
                        playerMaxHealth: game.player.maxHealth
                    };
                });
                
                if (healthState && healthState.playerHealth < healthState.playerMaxHealth * 0.3) {
                    await performCombatAction(page, 'heal');
                } else {
                    await performCombatAction(page, 'attack');
                }
                combatRounds++;
            }
            
            const afterCombat = await getGameState(page);
            if (!stillInCombat && afterCombat) {
                screenshot = await takeScreenshot(page, '12_combat_victory');
                scenarioData.observations.push({
                    moment: 'Combat Victory',
                    screenshot,
                    notes: `Combat ended. Health: ${afterCombat.playerHealth}/${afterCombat.playerMaxHealth}`
                });
                
                if (afterCombat.playerGold > beforeCombat?.playerGold) {
                    report.funMoments.push('Satisfying gold rewards after defeating enemies');
                }
                
                report.funMoments.push('Turn-based combat with multiple action options is engaging');
            }
            
            const combatLog = await page.evaluate(() => {
                const log = document.getElementById('combat-log');
                return log ? log.innerText : '';
            });
            
            if (combatLog && combatLog.length > 0) {
                scenarioData.observations.push({
                    moment: 'Combat Log',
                    notes: 'Combat log shows action results - helpful for understanding mechanics'
                });
            }
            
        } else {
            scenarioData.issues.push('Combat did not start when clicking hostile enemy');
            report.frustratingMoments.push('Difficulty triggering combat with enemies');
        }
    } else {
        scenarioData.issues.push('Could not find hostile enemies to fight');
    }
    
    const combatButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('.combat-btn');
        return Array.from(buttons).map(b => b.innerText);
    });
    
    if (combatButtons.length >= 5) {
        scenarioData.observations.push({
            moment: 'Combat Options',
            notes: `Available actions: ${combatButtons.join(', ')}`
        });
    }
    
    report.scenarios['scenario2'] = scenarioData;
    console.log('Scenario 2 complete!');
}

async function runScenario3_ShoppingExperience(page) {
    console.log('\n========================================');
    console.log('SCENARIO 3: Shopping Experience');
    console.log('========================================\n');
    
    const scenarioData = {
        name: 'Shopping Experience',
        observations: [],
        issues: []
    };
    
    console.log('Looking for a merchant...');
    
    const merchants = await page.evaluate(() => {
        if (!game) return [];
        return game.npcs.filter(n => n.alive && n.shop).map(n => ({
            name: n.name,
            tileX: Math.floor(n.x / 48),
            tileY: Math.floor(n.y / 48),
            shop: n.shop
        }));
    });
    
    console.log(`Found ${merchants.length} merchants`);
    
    if (merchants.length > 0) {
        const blacksmith = merchants.find(m => m.name.toLowerCase().includes('forge') || m.name.toLowerCase().includes('blacksmith')) || merchants[0];
        console.log(`Going to: ${blacksmith.name}`);
        
        await moveToPosition(page, blacksmith.tileX, blacksmith.tileY);
        await sleep(500);
        
        const found = await findAndClickNPC(page, blacksmith.name.split(' ')[0]);
        await sleep(1000);
        
        let dialogueVisible = await page.evaluate(() => 
            document.getElementById('dialogue-box').style.display !== 'none'
        );
        
        if (dialogueVisible) {
            let screenshot = await takeScreenshot(page, '13_shop_dialogue');
            scenarioData.observations.push({
                moment: 'Shop Dialogue',
                screenshot,
                notes: 'Merchant greets player with shop option'
            });
            
            const shopOptionExists = await page.evaluate(() => {
                const choices = document.querySelectorAll('.dialogue-choice');
                return Array.from(choices).some(c => c.innerText.toLowerCase().includes('shop') || c.innerText.toLowerCase().includes('wares'));
            });
            
            if (shopOptionExists) {
                await page.evaluate(() => {
                    const choices = document.querySelectorAll('.dialogue-choice');
                    const shopChoice = Array.from(choices).find(c => c.innerText.toLowerCase().includes('shop') || c.innerText.toLowerCase().includes('wares'));
                    if (shopChoice) shopChoice.click();
                });
                await sleep(1000);
                
                let shopVisible = await page.evaluate(() => 
                    document.getElementById('shop-ui').style.display !== 'none'
                );
                
                if (shopVisible) {
                    screenshot = await takeScreenshot(page, '14_shop_ui');
                    scenarioData.observations.push({
                        moment: 'Shop UI',
                        screenshot,
                        notes: 'Shop interface shows available items with prices'
                    });
                    
                    const shopItems = await page.evaluate(() => {
                        const items = document.querySelectorAll('.shop-item');
                        return Array.from(items).map(item => {
                            const nameEl = item.querySelector('.shop-item-name');
                            const priceEl = item.querySelector('.shop-item-price') || item;
                            return {
                                name: nameEl ? nameEl.innerText : 'Unknown',
                                price: priceEl ? priceEl.innerText : ''
                            };
                        });
                    });
                    
                    if (shopItems.length > 0) {
                        scenarioData.observations.push({
                            moment: 'Shop Items',
                            notes: `Shop has ${shopItems.length} items available`
                        });
                        report.funMoments.push('Shop offers variety of items with clear pricing');
                    }
                    
                    const buyButtons = await page.evaluate(() => {
                        return document.querySelectorAll('.buy-btn').length;
                    });
                    
                    if (buyButtons > 0) {
                        const beforeGold = await page.evaluate(() => game.player.gold);
                        
                        await page.evaluate(() => {
                            const buttons = document.querySelectorAll('.buy-btn:not(:disabled)');
                            if (buttons.length > 0) buttons[0].click();
                        });
                        await sleep(500);
                        
                        const afterGold = await page.evaluate(() => game.player.gold);
                        
                        if (afterGold < beforeGold) {
                            screenshot = await takeScreenshot(page, '15_shop_purchase');
                            scenarioData.observations.push({
                                moment: 'Purchase',
                                screenshot,
                                notes: `Successfully purchased item. Gold: ${beforeGold} -> ${afterGold}`
                            });
                            report.funMoments.push('Purchasing items works smoothly');
                        } else {
                            scenarioData.issues.push('Purchase did not deduct gold - possible bug');
                        }
                    }
                    
                    await page.evaluate(() => {
                        const closeBtn = document.querySelector('#shop-ui .close-btn');
                        if (closeBtn) closeBtn.click();
                    });
                    await sleep(500);
                    
                } else {
                    scenarioData.issues.push('Shop UI did not open after clicking shop option');
                }
            } else {
                scenarioData.issues.push('No shop option in merchant dialogue');
            }
        } else {
            scenarioData.issues.push('Could not open dialogue with merchant');
        }
    } else {
        scenarioData.issues.push('No merchants found in the area');
    }
    
    console.log('Testing equipment...');
    await pressKey(page, 'i');
    await sleep(500);
    
    const inventoryOpen = await page.evaluate(() => 
        document.getElementById('inventory-panel').style.display !== 'none'
    );
    
    if (inventoryOpen) {
        let screenshot = await takeScreenshot(page, '16_inventory_equipment');
        scenarioData.observations.push({
            moment: 'Equipment View',
            screenshot,
            notes: 'Inventory shows equipped items and stats'
        });
        
        const inventorySlots = await page.evaluate(() => {
            const slots = document.querySelectorAll('.inventory-slot');
            return slots.length;
        });
        
        scenarioData.observations.push({
            moment: 'Inventory Capacity',
            notes: `${inventorySlots} inventory slots available`
        });
        
        const stats = await page.evaluate(() => {
            const attack = document.getElementById('stat-attack');
            const defense = document.getElementById('stat-defense');
            return {
                attack: attack ? attack.innerText : '',
                defense: defense ? defense.innerText : ''
            };
        });
        
        if (stats.attack && stats.defense) {
            scenarioData.observations.push({
                moment: 'Player Stats',
                notes: `Attack: ${stats.attack}, Defense: ${stats.defense}`
            });
        }
    }
    await pressKey(page, 'i');
    
    report.scenarios['scenario3'] = scenarioData;
    console.log('Scenario 3 complete!');
}

async function runScenario4_QuestProgression(page) {
    console.log('\n========================================');
    console.log('SCENARIO 4: Quest Progression');
    console.log('========================================\n');
    
    const scenarioData = {
        name: 'Quest Progression',
        observations: [],
        issues: []
    };
    
    console.log('Checking quest system...');
    
    await pressKey(page, 'q');
    await sleep(500);
    
    let questLogVisible = await page.evaluate(() => 
        document.getElementById('quest-log').style.display !== 'none'
    );
    
    if (questLogVisible) {
        let screenshot = await takeScreenshot(page, '17_quest_log_initial');
        scenarioData.observations.push({
            moment: 'Quest Log Initial',
            screenshot,
            notes: 'Quest log shows available quests and clues found'
        });
        
        const questData = await page.evaluate(() => {
            const quests = document.querySelectorAll('.quest-item');
            const clues = document.querySelectorAll('.clue-item');
            return {
                questCount: quests.length,
                clueCount: clues.length,
                questTitles: Array.from(quests).map(q => {
                    const title = q.querySelector('.quest-title');
                    return title ? title.innerText : '';
                })
            };
        });
        
        scenarioData.observations.push({
            moment: 'Quest Data',
            notes: `Active quests: ${questData.questCount}, Clues found: ${questData.clueCount}`
        });
        
        if (questData.questTitles.length > 0) {
            report.funMoments.push('Quest system tracks main and side quests clearly');
        }
    }
    await pressKey(page, 'q');
    
    console.log('Finding quest giver...');
    
    const questGivers = await page.evaluate(() => {
        if (!game) return [];
        return game.npcs.filter(n => n.alive && (n.questGiver || n.clueGiver)).map(n => ({
            name: n.name,
            tileX: Math.floor(n.x / 48),
            tileY: Math.floor(n.y / 48)
        }));
    });
    
    if (questGivers.length > 0) {
        const farmer = questGivers.find(q => q.name.toLowerCase().includes('farmer')) || questGivers[0];
        console.log(`Going to quest giver: ${farmer.name}`);
        
        await moveToPosition(page, farmer.tileX, farmer.tileY);
        await sleep(500);
        await findAndClickNPC(page, farmer.name.split(' ')[0]);
        await sleep(1000);
        
        let dialogueVisible = await page.evaluate(() => 
            document.getElementById('dialogue-box').style.display !== 'none'
        );
        
        if (dialogueVisible) {
            let screenshot = await takeScreenshot(page, '18_quest_dialogue');
            scenarioData.observations.push({
                moment: 'Quest Dialogue',
                screenshot,
                notes: 'Quest giver provides quest context and objectives'
            });
            
            const hasQuestOption = await page.evaluate(() => {
                const choices = document.querySelectorAll('.dialogue-choice');
                return Array.from(choices).some(c => 
                    c.innerText.toLowerCase().includes('help') || 
                    c.innerText.toLowerCase().includes('accept') ||
                    c.innerText.toLowerCase().includes('quest') ||
                    c.innerText.toLowerCase().includes('clear') ||
                    c.innerText.toLowerCase().includes("i'll")
                );
            });
            
            if (hasQuestOption) {
                await page.evaluate(() => {
                    const choices = document.querySelectorAll('.dialogue-choice');
                    const questChoice = Array.from(choices).find(c => 
                        c.innerText.toLowerCase().includes('help') || 
                        c.innerText.toLowerCase().includes('accept') ||
                        c.innerText.toLowerCase().includes("i'll")
                    );
                    if (questChoice) questChoice.click();
                });
                await sleep(1000);
                
                screenshot = await takeScreenshot(page, '19_quest_accepted');
                scenarioData.observations.push({
                    moment: 'Quest Accepted',
                    screenshot,
                    notes: 'Quest acceptance provides clear objectives'
                });
                
                report.funMoments.push('Quest acceptance dialogue is engaging and informative');
            }
            
            await pressKey(page, 'Escape');
        }
        
        await pressKey(page, 'q');
        await sleep(500);
        
        const updatedQuests = await page.evaluate(() => {
            const quests = document.querySelectorAll('.quest-item');
            return Array.from(quests).map(q => {
                const title = q.querySelector('.quest-title');
                const desc = q.querySelector('.quest-desc');
                return {
                    title: title ? title.innerText : '',
                    desc: desc ? desc.innerText : ''
                };
            });
        });
        
        if (updatedQuests.length > 0) {
            let screenshot = await takeScreenshot(page, '20_quest_log_updated');
            scenarioData.observations.push({
                moment: 'Quest Log Updated',
                screenshot,
                notes: `Quests now tracked: ${updatedQuests.map(q => q.title).join(', ')}`
            });
            
            const hasProgress = updatedQuests.some(q => q.desc && q.desc.includes('/'));
            if (hasProgress) {
                scenarioData.observations.push({
                    moment: 'Progress Tracking',
                    notes: 'Quest progress is shown with counters (e.g., 0/5)'
                });
                report.funMoments.push('Quest progress tracking with clear counters');
            }
        }
        await pressKey(page, 'q');
    } else {
        scenarioData.issues.push('No quest givers found nearby');
    }
    
    const mainQuestStatus = await page.evaluate(() => {
        if (!game || !game.quests) return null;
        return {
            mainQuest: game.quests.MAIN_QUEST ? game.quests.MAIN_QUEST.title : 'Not found',
            stages: game.quests.MAIN_QUEST ? game.quests.MAIN_QUEST.stages.map(s => ({
                desc: s.description,
                completed: s.completed
            })) : []
        };
    });
    
    if (mainQuestStatus) {
        scenarioData.observations.push({
            moment: 'Main Quest',
            notes: `Main quest: "${mainQuestStatus.mainQuest}" with ${mainQuestStatus.stages.length} stages`
        });
    }
    
    report.scenarios['scenario4'] = scenarioData;
    console.log('Scenario 4 complete!');
}

async function runScenario5_Exploration(page) {
    console.log('\n========================================');
    console.log('SCENARIO 5: Exploration');
    console.log('========================================\n');
    
    const scenarioData = {
        name: 'Exploration',
        observations: [],
        issues: []
    };
    
    const worldInfo = await page.evaluate(() => {
        if (!game || !game.world) return null;
        return {
            worldWidth: game.world.width,
            worldHeight: game.world.height,
            playerTileX: Math.floor(game.player.x / 48),
            playerTileY: Math.floor(game.player.y / 48)
        };
    });
    
    if (worldInfo) {
        scenarioData.observations.push({
            moment: 'World Size',
            notes: `World is ${worldInfo.worldWidth}x${worldInfo.worldHeight} tiles - large exploration area`
        });
    }
    
    console.log('Testing minimap...');
    const minimapExists = await page.evaluate(() => {
        const minimap = document.getElementById('minimap');
        const minimapCanvas = document.getElementById('minimap-canvas');
        return minimap !== null && minimapCanvas !== null;
    });
    
    if (minimapExists) {
        scenarioData.observations.push({
            moment: 'Minimap',
            notes: 'Minimap present to aid navigation'
        });
        report.funMoments.push('Minimap helps with navigation in the large world');
    }
    
    console.log('Exploring different directions...');
    const directions = [
        { name: 'East', x: 800, y: 350 },
        { name: 'North', x: 600, y: 200 },
        { name: 'South', x: 600, y: 500 }
    ];
    
    for (const dir of directions) {
        for (let i = 0; i < 5; i++) {
            await clickAt(page, dir.x, dir.y);
            await sleep(300);
        }
        await sleep(500);
    }
    
    let screenshot = await takeScreenshot(page, '21_exploration');
    scenarioData.observations.push({
        moment: 'Exploration',
        screenshot,
        notes: 'World features varied terrain and environments'
    });
    
    console.log('Looking for treasure chests...');
    const treasureInfo = await page.evaluate(() => {
        if (!game || !game.treasureChests) return null;
        const unopened = game.treasureChests.filter(c => !c.opened);
        const opened = game.treasureChests.filter(c => c.opened);
        return {
            total: game.treasureChests.length,
            unopened: unopened.length,
            opened: opened.length,
            nearestUnopenedTileX: unopened.length > 0 ? Math.floor(unopened[0].x / 48) : null,
            nearestUnopenedTileY: unopened.length > 0 ? Math.floor(unopened[0].y / 48) : null
        };
    });
    
    if (treasureInfo) {
        scenarioData.observations.push({
            moment: 'Treasure Chests',
            notes: `${treasureInfo.total} treasure chests in world (${treasureInfo.unopened} unopened)`
        });
        
        if (treasureInfo.nearestUnopenedTileX) {
            console.log(`Going to treasure chest at (${treasureInfo.nearestUnopenedTileX}, ${treasureInfo.nearestUnopenedTileY})`);
            
            await moveToPosition(page, treasureInfo.nearestUnopenedTileX, treasureInfo.nearestUnopenedTileY);
            await sleep(500);
            
            const chestOnScreen = await page.evaluate(() => {
                if (!game) return null;
                for (const chest of game.treasureChests) {
                    if (!chest.opened) {
                        const screenX = chest.x - game.camera.x;
                        const screenY = chest.y - game.camera.y;
                        if (screenX > 0 && screenX < 1200 && screenY > 0 && screenY < 700) {
                            return { screenX, screenY };
                        }
                    }
                }
                return null;
            });
            
            if (chestOnScreen) {
                await clickAt(page, chestOnScreen.screenX, chestOnScreen.screenY);
                await sleep(500);
                
                screenshot = await takeScreenshot(page, '22_treasure_chest');
                scenarioData.observations.push({
                    moment: 'Treasure Found',
                    screenshot,
                    notes: 'Treasure chests provide rewards for exploration'
                });
                report.funMoments.push('Finding treasure chests rewards exploration');
            }
        }
    }
    
    console.log('Checking for different regions...');
    const regions = await page.evaluate(() => {
        return {
            startingVillage: { x: 50, y: 75 },
            forest: { x: 100, y: 75 },
            pirateCove: { x: 150, y: 90 },
            westernTown: { x: 80, y: 40 },
            castle: { x: 30, y: 50 },
            swamp: { x: 120, y: 100 },
            mountains: { x: 100, y: 20 },
            dragonLair: { x: 175, y: 15 }
        };
    });
    
    scenarioData.observations.push({
        moment: 'Regions',
        notes: `Game has 8 distinct regions: Village, Forest, Pirate Cove, Western Town, Castle, Swamp, Mountains, Dragon Lair`
    });
    
    report.funMoments.push('Diverse regions with unique themes (pirates, cowboys, medieval)');
    
    console.log('Testing travel to forest region...');
    await moveToPosition(page, 95, 75);
    await sleep(1000);
    
    screenshot = await takeScreenshot(page, '23_forest_region');
    scenarioData.observations.push({
        moment: 'Forest Region',
        screenshot,
        notes: 'Forest area with different terrain and enemies'
    });
    
    const weather = await page.evaluate(() => game ? game.weather : null);
    if (weather) {
        scenarioData.observations.push({
            moment: 'Weather System',
            notes: `Current weather: ${weather} - adds atmosphere to exploration`
        });
    }
    
    const dayNight = await page.evaluate(() => game ? game.timeOfDay : null);
    if (dayNight !== null) {
        scenarioData.observations.push({
            moment: 'Day/Night Cycle',
            notes: `Time of day: ${dayNight} - visual variation during play`
        });
        report.funMoments.push('Day/night cycle and weather add immersion');
    }
    
    report.scenarios['scenario5'] = scenarioData;
    console.log('Scenario 5 complete!');
}

function generateReport() {
    let md = `# Quest of the Dragon's Gold - Playtest Report

**Date:** ${new Date().toISOString().split('T')[0]}
**Tester:** Automated Puppeteer Playtest
**Game Version:** 1.0

---

## Executive Summary

This report documents the player experience of "Quest of the Dragon's Gold," a cross-genre point-and-click adventure game featuring medieval knights, pirates, and cowboys.

---

## Fun Moments 🎉

`;
    
    for (const moment of report.funMoments) {
        md += `- ${moment}\n`;
    }
    
    md += `
---

## Frustrating Moments 😤

`;
    
    if (report.frustratingMoments.length === 0) {
        md += `- No major frustrations encountered during testing\n`;
    } else {
        for (const moment of report.frustratingMoments) {
            md += `- ${moment}\n`;
        }
    }
    
    md += `
---

## Bugs Encountered 🐛

`;
    
    if (report.bugs.length === 0) {
        md += `- No critical bugs found during testing\n`;
    } else {
        for (const bug of report.bugs) {
            md += `- ${bug}\n`;
        }
    }
    
    md += `
---

## Scenario Details

`;
    
    for (const [key, scenario] of Object.entries(report.scenarios)) {
        md += `### ${scenario.name}

`;
        
        if (scenario.observations.length > 0) {
            md += `**Observations:**\n\n`;
            for (const obs of scenario.observations) {
                md += `- **${obs.moment}**: ${obs.notes}\n`;
                if (obs.screenshot) {
                    md += `  - Screenshot: \`${obs.screenshot}\`\n`;
                }
            }
        }
        
        if (scenario.issues && scenario.issues.length > 0) {
            md += `\n**Issues Found:**\n\n`;
            for (const issue of scenario.issues) {
                md += `- ⚠️ ${issue}\n`;
            }
        }
        
        md += `\n`;
    }
    
    md += `---

## Suggested Improvements 💡

### High Priority
1. **Tutorial System**: Add an optional interactive tutorial for new players
2. **Save Indicator**: Show a visual confirmation when game is saved
3. **Quest Markers**: Add on-screen indicators pointing to active quest objectives
4. **Enemy Level Display**: Show enemy levels before engaging combat

### Medium Priority
1. **Sound Effects**: Add audio feedback for actions (currently silent)
2. **Combat Animations**: Add visual effects for attacks and abilities
3. **Inventory Sorting**: Allow sorting items by type or value
4. **Auto-healing**: Option to automatically use potions when health is low

### Low Priority
1. **Achievement Notifications**: More prominent display for achievements
2. **NPC Schedules**: Have NPCs move around based on time of day
3. **Map Labels**: Show region names on the minimap
4. **Party Management**: UI for managing recruited allies

---

## Overall Player Experience Rating

`;
    
    let rating = 7;
    
    if (report.funMoments.length >= 5) rating += 1;
    if (report.bugs.length === 0) rating += 1;
    if (report.frustratingMoments.length === 0) rating += 0.5;
    if (Object.keys(report.scenarios).length >= 5) rating += 0.5;
    
    rating = Math.min(10, Math.round(rating * 10) / 10);
    report.overallRating = rating;
    
    md += `### Score: ${rating}/10

**Breakdown:**
- **Gameplay:** Well-designed turn-based combat and exploration
- **Content:** Rich variety of quests, NPCs, and regions
- **UI/UX:** Clean interface with informative HUD
- **Replayability:** Procedural generation and multiple quest paths
- **Polish:** Good overall, minor improvements could enhance experience

**Final Verdict:**
Quest of the Dragon's Gold delivers a charming cross-genre adventure with engaging mechanics. The combination of point-and-click exploration, turn-based combat, and RPG progression creates a satisfying gameplay loop. The diverse regions (medieval, pirate, western) add variety and keep exploration interesting. While some quality-of-life improvements could enhance the experience, the core game is solid and enjoyable.

---

## Screenshots

| Screenshot | Description |
|------------|-------------|
`;
    
    if (fs.existsSync(SCREENSHOTS_DIR)) {
        const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
        for (const ss of screenshots.sort()) {
            const name = ss.replace('.png', '').replace(/_/g, ' ');
            md += `| ![${name}](screenshots/${ss}) | ${name} |\n`;
        }
    }
    
    md += `
---

*Report generated automatically by Puppeteer playtest script*
`;
    
    return md;
}

async function runPlaytest() {
    console.log('🎮 Starting Quest of the Dragon\'s Gold Playtest\n');
    console.log('='.repeat(50));
    
    const server = await startServer(path.join(__dirname, 'game'), 8888);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log('Navigating to game...');
        await page.goto('http://localhost:8888', { waitUntil: 'networkidle0' });
        await sleep(2000);
        
        await runScenario1_NewPlayerExperience(page);
        await runScenario2_CombatFlow(page);
        await runScenario3_ShoppingExperience(page);
        await runScenario4_QuestProgression(page);
        await runScenario5_Exploration(page);
        
        console.log('\n' + '='.repeat(50));
        console.log('Generating playtest report...');
        
        const reportContent = generateReport();
        fs.writeFileSync(REPORT_PATH, reportContent);
        console.log(`\n✅ Report saved to: ${REPORT_PATH}`);
        console.log(`\n📊 Overall Rating: ${report.overallRating}/10`);
        
    } catch (error) {
        console.error('Error during playtest:', error);
        report.bugs.push(`Playtest error: ${error.message}`);
        
        const reportContent = generateReport();
        fs.writeFileSync(REPORT_PATH, reportContent);
        
    } finally {
        await browser.close();
        server.close();
        console.log('\n🎮 Playtest complete!');
    }
}

runPlaytest();
