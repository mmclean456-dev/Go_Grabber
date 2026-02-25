#!/usr/bin/env node

/**
 * Quest of the Dragon's Gold - Automated Test Runner
 * Uses Puppeteer to run comprehensive game tests in headless browser
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class GameTestRunner {
    constructor() {
        this.browser = null;
        this.page = null;
        this.screenshotDir = path.join(__dirname, 'screenshots');
        this.reportPath = path.join(__dirname, 'test-report.json');
        this.htmlReportPath = path.join(__dirname, 'test-report.html');
    }

    async init() {
        console.log('🎮 Quest of the Dragon\'s Gold - Test Runner');
        console.log('=' .repeat(50));
        
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }

        console.log('🚀 Launching headless browser...');
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set viewport to match game canvas
        await this.page.setViewport({
            width: 1280,
            height: 800
        });

        // Log console messages from page
        this.page.on('console', msg => {
            const text = msg.text();
            if (text.includes('✅') || text.includes('❌') || text.includes('⚠️')) {
                console.log(`  ${text}`);
            }
        });

        // Log page errors
        this.page.on('pageerror', error => {
            console.error('❌ Page Error:', error.message);
        });

        console.log('✅ Browser launched successfully');
    }

    async loadGame() {
        console.log('\n📁 Loading game...');
        
        const gamePath = path.join(__dirname, '..', 'index.html');
        const gameUrl = `file://${gamePath}`;
        
        try {
            await this.page.goto(gameUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            console.log('✅ Game loaded successfully');
            
            // Take initial screenshot
            await this.takeScreenshot('01-game-loaded');
            
            // Wait for game to be ready
            await this.page.waitForSelector('#start-btn', { timeout: 10000 });
            console.log('✅ Start button found');

            return true;
        } catch (error) {
            console.error('❌ Failed to load game:', error.message);
            await this.takeScreenshot('error-load-failed');
            return false;
        }
    }

    async startGame() {
        console.log('\n🎯 Starting game...');
        
        try {
            // Check for existing save prompt
            const loadSaveBtn = await this.page.$('#load-save-btn');
            if (loadSaveBtn) {
                console.log('  Found save prompt, clicking New Game...');
                const newGameBtn = await this.page.$('#new-game-btn');
                if (newGameBtn) {
                    await newGameBtn.click();
                    await this.page.waitForTimeout(500);
                }
            }

            // Click start button
            await this.page.click('#start-btn');
            console.log('✅ Clicked start button');
            
            // Wait for loading screen to disappear
            await this.page.waitForFunction(
                () => document.getElementById('loading-screen').style.display === 'none',
                { timeout: 10000 }
            );
            
            console.log('✅ Game started');
            await this.takeScreenshot('02-game-started');
            
            // Verify game is running
            const gameRunning = await this.page.evaluate(() => {
                return typeof game !== 'undefined' && game.running === true;
            });
            
            if (!gameRunning) {
                // Try to wait a bit more
                await this.page.waitForTimeout(1000);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to start game:', error.message);
            await this.takeScreenshot('error-start-failed');
            return false;
        }
    }

    async injectTestSuite() {
        console.log('\n📥 Injecting test suite...');
        
        try {
            const testCode = fs.readFileSync(
                path.join(__dirname, 'game-tests.js'), 
                'utf8'
            );
            
            await this.page.evaluate(testCode => {
                const script = document.createElement('script');
                script.textContent = testCode;
                document.head.appendChild(script);
            }, testCode);
            
            console.log('✅ Test suite injected');
            return true;
        } catch (error) {
            console.error('❌ Failed to inject test suite:', error.message);
            return false;
        }
    }

    async runTests() {
        console.log('\n🧪 Running tests...');
        console.log('-'.repeat(50));
        
        try {
            const report = await this.page.evaluate(async () => {
                const testRunner = new GameTests();
                return await testRunner.runAllTests(game);
            });
            
            console.log('-'.repeat(50));
            console.log('✅ Tests completed');
            
            await this.takeScreenshot('03-tests-completed');
            
            return report;
        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            await this.takeScreenshot('error-tests-failed');
            return null;
        }
    }

    async runAdditionalChecks() {
        console.log('\n🔍 Running additional checks...');
        const additionalBugs = [];

        // Check for JavaScript errors in console
        const errors = await this.page.evaluate(() => {
            return window.__consoleErrors || [];
        });
        
        if (errors.length > 0) {
            additionalBugs.push({
                severity: 'MEDIUM',
                title: 'Console Errors',
                description: `${errors.length} JavaScript errors detected`,
                reproduction: errors.slice(0, 3).join(', ')
            });
        }

        // Check UI element overlaps
        const uiIssues = await this.page.evaluate(() => {
            const issues = [];
            const elements = [
                '#hud', '#minimap', '#hotbar', '#dialogue-box',
                '#combat-ui', '#inventory-panel', '#quest-log', '#shop-ui'
            ];
            
            for (let i = 0; i < elements.length; i++) {
                const el1 = document.querySelector(elements[i]);
                if (!el1 || el1.style.display === 'none') continue;
                
                const rect1 = el1.getBoundingClientRect();
                
                for (let j = i + 1; j < elements.length; j++) {
                    const el2 = document.querySelector(elements[j]);
                    if (!el2 || el2.style.display === 'none') continue;
                    
                    const rect2 = el2.getBoundingClientRect();
                    
                    const overlap = !(rect1.right < rect2.left || 
                                     rect1.left > rect2.right || 
                                     rect1.bottom < rect2.top || 
                                     rect1.top > rect2.bottom);
                    
                    if (overlap) {
                        issues.push(`${elements[i]} overlaps with ${elements[j]}`);
                    }
                }
            }
            return issues;
        });
        
        if (uiIssues.length > 0) {
            additionalBugs.push({
                severity: 'LOW',
                title: 'UI Element Overlaps',
                description: `${uiIssues.length} overlapping UI elements detected`,
                reproduction: uiIssues.join('; ')
            });
        }

        // Check for broken NPC interactions
        const brokenNPCs = await this.page.evaluate(() => {
            const issues = [];
            if (typeof game !== 'undefined' && game.npcs) {
                for (const npc of game.npcs) {
                    if (!npc.alive) continue;
                    
                    // Check for NPCs without required properties
                    if (!npc.type || !npc.name) {
                        issues.push(`NPC missing type or name at (${npc.x}, ${npc.y})`);
                    }
                    
                    // Check for hostile NPCs without stats
                    if (npc.hostile && (!npc.attack || !npc.defense || !npc.health)) {
                        issues.push(`Hostile NPC ${npc.name} missing combat stats`);
                    }
                    
                    // Check for dialogue NPCs without dialogue
                    if (!npc.hostile && npc.type.dialogue && !npc.dialogue) {
                        issues.push(`NPC ${npc.name} should have dialogue but doesn't`);
                    }
                }
            }
            return issues;
        });
        
        if (brokenNPCs.length > 0) {
            additionalBugs.push({
                severity: 'MEDIUM',
                title: 'NPC Issues',
                description: `${brokenNPCs.length} NPCs with issues detected`,
                reproduction: brokenNPCs.slice(0, 5).join('; ')
            });
        }

        // Performance check
        const performanceMetrics = await this.page.evaluate(() => {
            const start = performance.now();
            for (let i = 0; i < 100; i++) {
                game.update(0.016);
            }
            const elapsed = performance.now() - start;
            return {
                updateTime: elapsed,
                avgUpdateMs: elapsed / 100
            };
        });
        
        console.log(`  ⏱️ Average update time: ${performanceMetrics.avgUpdateMs.toFixed(2)}ms`);
        
        if (performanceMetrics.avgUpdateMs > 16) {
            additionalBugs.push({
                severity: 'MEDIUM',
                title: 'Performance Issue',
                description: `Game update takes ${performanceMetrics.avgUpdateMs.toFixed(2)}ms (should be < 16ms for 60fps)`,
                reproduction: 'Run 100 update cycles and measure time'
            });
        }

        console.log(`✅ Additional checks found ${additionalBugs.length} issues`);
        return additionalBugs;
    }

    async testGameplayScenarios() {
        console.log('\n🎮 Testing gameplay scenarios...');
        const scenarioBugs = [];

        // Scenario 1: Open inventory and check items
        try {
            await this.page.keyboard.press('i');
            await this.page.waitForTimeout(500);
            await this.takeScreenshot('04-inventory-open');
            
            const inventoryVisible = await this.page.evaluate(() => {
                return document.getElementById('inventory-panel').style.display === 'block';
            });
            
            if (!inventoryVisible) {
                scenarioBugs.push({
                    severity: 'MEDIUM',
                    title: 'Inventory Hotkey',
                    description: 'Pressing I key does not open inventory',
                    reproduction: 'Press I key during gameplay'
                });
            }
            
            await this.page.keyboard.press('i');
            await this.page.waitForTimeout(300);
        } catch (e) {
            console.log(`  ⚠️ Inventory test: ${e.message}`);
        }

        // Scenario 2: Open quest log
        try {
            await this.page.keyboard.press('q');
            await this.page.waitForTimeout(500);
            await this.takeScreenshot('05-quest-log-open');
            
            await this.page.keyboard.press('q');
            await this.page.waitForTimeout(300);
        } catch (e) {
            console.log(`  ⚠️ Quest log test: ${e.message}`);
        }

        // Scenario 3: Player movement click
        try {
            await this.page.click('#gameCanvas', { 
                button: 'left',
                offset: { x: 700, y: 400 }
            });
            await this.page.waitForTimeout(1000);
            await this.takeScreenshot('06-player-moved');
        } catch (e) {
            console.log(`  ⚠️ Movement test: ${e.message}`);
        }

        // Scenario 4: Test save/load
        try {
            await this.page.keyboard.press('F5');
            await this.page.waitForTimeout(500);
            await this.takeScreenshot('07-game-saved');
            
            const saveSuccess = await this.page.evaluate(() => {
                return localStorage.getItem('dragonQuestSave') !== null;
            });
            
            if (!saveSuccess) {
                scenarioBugs.push({
                    severity: 'HIGH',
                    title: 'Save System',
                    description: 'F5 quick save does not work',
                    reproduction: 'Press F5 during gameplay'
                });
            }
        } catch (e) {
            console.log(`  ⚠️ Save test: ${e.message}`);
        }

        // Scenario 5: Close all panels with ESC
        try {
            await this.page.keyboard.press('i');
            await this.page.waitForTimeout(200);
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
            
            const panelsClosed = await this.page.evaluate(() => {
                return document.getElementById('inventory-panel').style.display === 'none';
            });
            
            if (!panelsClosed) {
                scenarioBugs.push({
                    severity: 'LOW',
                    title: 'ESC Key',
                    description: 'ESC key does not close all panels',
                    reproduction: 'Open inventory, press ESC'
                });
            }
        } catch (e) {
            console.log(`  ⚠️ ESC test: ${e.message}`);
        }

        console.log(`✅ Gameplay scenarios tested, found ${scenarioBugs.length} issues`);
        return scenarioBugs;
    }

    async takeScreenshot(name) {
        try {
            const screenshotPath = path.join(this.screenshotDir, `${name}.png`);
            await this.page.screenshot({ 
                path: screenshotPath,
                fullPage: false
            });
            console.log(`  📸 Screenshot saved: ${name}.png`);
        } catch (error) {
            console.error(`  ⚠️ Failed to take screenshot: ${error.message}`);
        }
    }

    generateHTMLReport(report) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Quest of the Dragon's Gold - Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #1a1a2e;
            color: #eee;
        }
        h1 { color: #ffcc44; text-align: center; }
        h2 { color: #aaccff; border-bottom: 2px solid #4a4a6a; padding-bottom: 10px; }
        .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 30px 0;
        }
        .stat-card {
            background: #2d2d44;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .stat-value {
            font-size: 36px;
            font-weight: bold;
        }
        .stat-label { color: #888; }
        .pass { color: #44ff44; }
        .fail { color: #ff4444; }
        .bug-list { margin: 20px 0; }
        .bug {
            background: #2d2d44;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #ff4444;
        }
        .bug.high { border-left-color: #ff4444; }
        .bug.medium { border-left-color: #ffaa44; }
        .bug.low { border-left-color: #44aaff; }
        .bug-title { font-weight: bold; font-size: 16px; }
        .bug-severity {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
        }
        .severity-high { background: #ff4444; }
        .severity-medium { background: #ffaa44; color: #000; }
        .severity-low { background: #44aaff; color: #000; }
        .test-results {
            max-height: 400px;
            overflow-y: auto;
            background: #2d2d44;
            padding: 15px;
            border-radius: 8px;
        }
        .test-item {
            padding: 5px 10px;
            margin: 2px 0;
            border-radius: 4px;
        }
        .test-pass { background: rgba(68, 255, 68, 0.1); }
        .test-fail { background: rgba(255, 68, 68, 0.2); }
        .screenshots {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 20px 0;
        }
        .screenshot {
            background: #2d2d44;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
        }
        .screenshot img {
            max-width: 100%;
            border-radius: 5px;
        }
        .screenshot-label { 
            margin-top: 8px;
            font-size: 12px;
            color: #888;
        }
        .timestamp {
            text-align: center;
            color: #666;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <h1>⚔️ Quest of the Dragon's Gold - Test Report ⚔️</h1>
    
    <div class="summary">
        <div class="stat-card">
            <div class="stat-value">${report.summary.totalTests}</div>
            <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat-card">
            <div class="stat-value pass">${report.summary.passed}</div>
            <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card">
            <div class="stat-value fail">${report.summary.failed}</div>
            <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.summary.passRate}</div>
            <div class="stat-label">Pass Rate</div>
        </div>
    </div>

    <h2>🐛 Bugs Found (${report.bugs.length})</h2>
    <div class="bug-list">
        ${report.bugs.length === 0 ? '<p>No bugs found!</p>' : 
          report.bugs.map(bug => `
            <div class="bug ${bug.severity.toLowerCase()}">
                <div class="bug-title">
                    ${bug.title}
                    <span class="bug-severity severity-${bug.severity.toLowerCase()}">${bug.severity}</span>
                </div>
                <p>${bug.description}</p>
                ${bug.reproduction ? `<p><strong>Reproduction:</strong> ${bug.reproduction}</p>` : ''}
            </div>
          `).join('')}
    </div>

    <h2>📋 Test Results</h2>
    <div class="test-results">
        ${report.results.map(r => `
            <div class="test-item ${r.passed ? 'test-pass' : 'test-fail'}">
                ${r.passed ? '✅' : '❌'} [${r.test}] ${r.description}
                ${r.details ? `<br><small style="color:#888;margin-left:20px;">${r.details}</small>` : ''}
            </div>
        `).join('')}
    </div>

    <h2>📸 Screenshots</h2>
    <div class="screenshots">
        ${fs.readdirSync(this.screenshotDir).filter(f => f.endsWith('.png')).map(file => `
            <div class="screenshot">
                <img src="screenshots/${file}" alt="${file}">
                <div class="screenshot-label">${file.replace('.png', '').replace(/-/g, ' ')}</div>
            </div>
        `).join('')}
    </div>

    <div class="timestamp">
        Generated: ${report.timestamp}
    </div>
</body>
</html>`;

        fs.writeFileSync(this.htmlReportPath, html);
        console.log(`\n📄 HTML report saved: ${this.htmlReportPath}`);
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('\n🔒 Browser closed');
        }
    }

    async run() {
        let report = null;
        
        try {
            await this.init();
            
            const loaded = await this.loadGame();
            if (!loaded) throw new Error('Failed to load game');
            
            const started = await this.startGame();
            if (!started) throw new Error('Failed to start game');
            
            const injected = await this.injectTestSuite();
            if (!injected) throw new Error('Failed to inject test suite');
            
            report = await this.runTests();
            if (!report) {
                report = {
                    summary: { totalTests: 0, passed: 0, failed: 0, passRate: '0%' },
                    bugs: [],
                    results: [],
                    timestamp: new Date().toISOString()
                };
            }
            
            // Run additional checks
            const additionalBugs = await this.runAdditionalChecks();
            report.bugs = [...report.bugs, ...additionalBugs];
            
            // Run gameplay scenarios
            const scenarioBugs = await this.testGameplayScenarios();
            report.bugs = [...report.bugs, ...scenarioBugs];
            
            // Final screenshot
            await this.takeScreenshot('99-final-state');
            
            // Save reports
            fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
            console.log(`\n📊 JSON report saved: ${this.reportPath}`);
            
            this.generateHTMLReport(report);
            
            // Print summary
            console.log('\n' + '='.repeat(50));
            console.log('📊 FINAL SUMMARY');
            console.log('='.repeat(50));
            console.log(`Total Tests: ${report.summary.totalTests}`);
            console.log(`✅ Passed: ${report.summary.passed}`);
            console.log(`❌ Failed: ${report.summary.failed}`);
            console.log(`📈 Pass Rate: ${report.summary.passRate}`);
            console.log(`🐛 Bugs Found: ${report.bugs.length}`);
            
            if (report.bugs.length > 0) {
                console.log('\n🐛 Bugs by Severity:');
                const high = report.bugs.filter(b => b.severity === 'HIGH').length;
                const medium = report.bugs.filter(b => b.severity === 'MEDIUM').length;
                const low = report.bugs.filter(b => b.severity === 'LOW').length;
                if (high > 0) console.log(`  🔴 HIGH: ${high}`);
                if (medium > 0) console.log(`  🟠 MEDIUM: ${medium}`);
                if (low > 0) console.log(`  🔵 LOW: ${low}`);
            }
            
        } catch (error) {
            console.error('\n❌ Test runner error:', error.message);
            await this.takeScreenshot('error-fatal');
        } finally {
            await this.cleanup();
        }
        
        return report;
    }
}

// Run tests
const runner = new GameTestRunner();
runner.run().then(report => {
    if (report) {
        process.exit(report.summary.failed > 0 ? 1 : 0);
    } else {
        process.exit(1);
    }
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
