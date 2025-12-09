import { CONSTANTS } from '../constants';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { MapSystem } from '../systems/MapSystem';
import { StageManager } from '../systems/StageManager';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Boss } from '../entities/Boss';
import { prepareInterstitialAd, showInterstitialAd } from '../bedrock.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(this.canvas);
        this.input = new Input();
        this.mapSystem = new MapSystem();
        this.stageManager = new StageManager();

        this.currentLevel = 1;
        this.isTransitioning = false;

        // UI Elements
        this.uiAreaScore = document.getElementById('area-score');
        this.uiMonsterCount = document.getElementById('monster-count');
        this.uiStageLevel = document.getElementById('stage-level');
        this.uiResultPopup = document.getElementById('stage-result-popup');
        this.uiBossHud = document.getElementById('boss-hud');
        this.uiTimer = document.getElementById('ui-timer');

        this.startStage(this.currentLevel);

        this.lastTime = 0;
        this.isRunning = true;
        this.isPaused = false;

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        this.setupControls();

        // 광고 사전 로드
        prepareInterstitialAd();

        // Handle Bridge View & Age Rating (App Launch)
        setTimeout(() => {
            const bridge = document.getElementById('bridge-view');
            if (bridge) bridge.classList.add('hidden');
        }, 1500); // 1.5s splash duration

        setTimeout(() => {
            const rating = document.getElementById('age-rating');
            if (rating) rating.classList.add('hidden');
        }, 3500); // 3.5s total duration for age rating (Requirement: > 3s)
    }

    setupControls() {
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.addEventListener('click', () => this.togglePause());

        // Note: 버튼 이벤트는 showResultPopup에서 동적으로 추가됨
    }

    async startStage(level) {
        // Reset entities immediately to prevent update loop from processing old state during async load
        this.player = null;
        this.monsters = [];
        this.mapSystem.boss = null;

        const stageData = this.stageManager.getStageData(level);
        this.currentLevel = level;
        this.uiStageLevel.textContent = level;
        this.currentStageEffects = stageData.effects || {};

        // Show Loading Screen
        document.getElementById('loading-screen').style.display = 'flex';

        // Load Theme Assets
        await this.renderer.assetManager.loadTheme(stageData.theme);

        // Hide Loading Screen
        document.getElementById('loading-screen').style.display = 'none';

        // Initialize Wind Data
        if (this.currentStageEffects.type === 'wind') {
            this.windData = {
                direction: { x: 1, y: 0 }, // Default right
                angle: 0,
                timer: 0,
                changeInterval: 10000 // 10 seconds
            };
            this.updateWindDirection(); // Set initial random direction
        } else {
            this.windData = null;
        }

        // Initialize Dark Fog (Stage 7)
        if (this.currentStageEffects.type === 'dark_fog') {
            this.currentStageEffects.active = false;
            this.currentStageEffects.timer = 0;
            this.currentStageEffects.nextTrigger = Math.random() * 10000 + 15000; // 15-25s
            this.currentStageEffects.duration = 3000; // 3s
        }

        // Initialize Space Distortion (Stage 9)
        if (this.currentStageEffects.type === 'space_distortion') {
            this.currentStageEffects.teleportTimer = 0;
            this.currentStageEffects.nextTeleport = Math.random() * 5000 + 15000; // 15-20s (User requested 15-20s)
        }

        // Initialize Timer
        this.timeLimit = stageData.timeLimit;
        this.timeLeft = this.timeLimit;
        const timerUI = document.getElementById('ui-timer');
        if (this.timeLimit) {
            timerUI.style.display = 'block';
            timerUI.textContent = this.formatTime(this.timeLeft);
            timerUI.style.color = '#fff';
        } else {
            timerUI.style.display = 'none';
        }

        // Reset Map
        this.mapSystem.reset(stageData.mapSize || 1.0, stageData.theme); // Generates terrain and objects
        this.renderer.setWorldSize(this.mapSystem.width, this.mapSystem.height);

        // Spawn Player
        const centerX = this.mapSystem.width / 2;
        const centerY = this.mapSystem.height / 2;
        const scale = stageData.scale || 1.0;
        this.player = new Player(centerX, centerY, scale);

        // Spawn Monsters
        this.monsters = [];
        if (stageData && stageData.monsters) {
            stageData.monsters.forEach(m => {
                for (let i = 0; i < m.count; i++) {
                    // Random position away from center
                    let mx, my;
                    do {
                        mx = Math.random() * this.mapSystem.width;
                        my = Math.random() * this.mapSystem.height;
                    } while (Math.hypot(mx - centerX, my - centerY) < 200);

                    this.monsters.push(new Monster(mx, my, scale));
                }
            });
        }

        // Spawn Boss
        if (stageData.boss) {
            // Spawn away from player
            let bx, by;
            do {
                bx = Math.random() * this.mapSystem.width;
                by = Math.random() * this.mapSystem.height;
            } while (Math.hypot(bx - centerX, by - centerY) < 300);

            this.mapSystem.boss = new Boss(bx, by); // Boss scale handled internally or default? Boss doesn't have scale param yet but it's huge anyway.
        } else {
            this.mapSystem.boss = null;
        }

        this.uiLayer = document.getElementById('ui-layer');
        this.uiLayer.style.display = 'flex';
        this.isTransitioning = false;
        this.uiResultPopup.style.display = 'none';

        // Show/Hide Boss HUD
        if (this.mapSystem.boss) {
            this.uiBossHud.style.display = 'flex';
            this.updateBossHud();
        } else {
            this.uiBossHud.style.display = 'none';
        }

        this.isRunning = true;
        this.lastTime = performance.now(); // Reset time to prevent dt jump
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');

        if (this.isPaused) {
            // Show Play Icon
            pauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
                </svg>
            `;
        } else {
            // Show Pause Icon
            pauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z" fill="currentColor"/>
                </svg>
            `;
            this.lastTime = performance.now(); // Reset time on resume
        }
    }

    update(dt) {
        if (!this.isRunning || this.isPaused || this.isTransitioning || !this.player) return;

        // Update Wind
        if (this.windData) {
            this.windData.timer += dt;
            if (this.windData.timer >= this.windData.changeInterval) {
                this.windData.timer = 0;
                this.updateWindDirection();
            }
        }

        // Update Dark Fog
        if (this.currentStageEffects && this.currentStageEffects.type === 'dark_fog') {
            this.currentStageEffects.timer += dt;
            if (this.currentStageEffects.active) {
                if (this.currentStageEffects.timer >= this.currentStageEffects.duration) {
                    this.currentStageEffects.active = false;
                    this.currentStageEffects.timer = 0;
                    this.currentStageEffects.nextTrigger = Math.random() * 10000 + 15000; // Reset trigger
                    console.log('Dark Fog ended');
                }
            } else {
                if (this.currentStageEffects.timer >= this.currentStageEffects.nextTrigger) {
                    this.currentStageEffects.active = true;
                    this.currentStageEffects.timer = 0;
                    console.log('Dark Fog started');
                }
            }
        }

        // Update Space Distortion
        if (this.currentStageEffects && this.currentStageEffects.type === 'space_distortion') {
            this.currentStageEffects.teleportTimer += dt;
            if (this.currentStageEffects.teleportTimer >= this.currentStageEffects.nextTeleport) {
                this.currentStageEffects.teleportTimer = 0;
                this.currentStageEffects.nextTeleport = Math.random() * 5000 + 15000; // Reset trigger to 15-20s
                this.player.teleport(this.mapSystem);
                console.log('Player teleported');
                // Camera update is automatic in render() loop
            }
        }

        // Update Timer
        if (this.timeLimit && this.timeLeft > 0) {
            this.timeLeft -= dt / 1000;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.gameOver();
            }

            if (this.uiTimer) {
                const ceilTime = Math.ceil(this.timeLeft);
                this.uiTimer.textContent = this.formatTime(ceilTime);

                if (ceilTime <= 10) {
                    this.uiTimer.style.color = '#F44336'; // Red
                } else if (ceilTime <= 20) {
                    this.uiTimer.style.color = '#FF9800'; // Orange
                } else if (ceilTime <= 30) {
                    this.uiTimer.style.color = '#FFEB3B'; // Yellow
                } else {
                    this.uiTimer.style.color = '#fff';
                }
            }
        }

        const inputVector = this.input.getVector();
        const playerState = this.player.update(inputVector, this.mapSystem, dt, this.currentStageEffects, this.windData);

        if (playerState === 'DIE') {
            this.gameOver();
            return;
        }

        if (playerState === 'FILL') {
            // 현재 trail만 OWNED로 변환하도록 trail 정보 전달
            console.log(`🎮 Calling fillAreas with ${this.monsters.length} monsters`);
            const { count, newCells } = this.mapSystem.fillAreas(this.monsters, this.player.lastTrail);

            // Trigger visual effect for captured area
            if (newCells && newCells.length > 0) {
                this.renderer.addCaptureEffect(newCells);
            }

            // Remove monsters that are now in OWNED area
            this.monsters = this.monsters.filter(monster => {
                const cell = this.mapSystem.getCell(monster.x, monster.y);
                return cell !== CONSTANTS.CELL_TYPE.OWNED;
            });
        }

        // Check Win Condition
        const ownedPercent = this.mapSystem.getOwnedPercentage();
        this.uiAreaScore.textContent = ownedPercent.toFixed(1);

        // Update Monster Count UI
        if (this.uiMonsterCount) {
            this.uiMonsterCount.textContent = this.monsters.length;
        }

        if (ownedPercent >= 85 || (this.monsters.length === 0 && !this.mapSystem.boss)) {
            this.nextStage();
        }

        for (const monster of this.monsters) {
            monster.update(this.mapSystem);
            if (monster.checkCollision(this.player, this.mapSystem)) {
                this.gameOver();
                return;
            }
        }

        // Update Boss
        if (this.mapSystem.boss) {
            this.mapSystem.boss.update(this.mapSystem, dt, this.player);

            // Check Body Collision
            if (this.mapSystem.boss.checkCollision(this.player, this.mapSystem)) {
                this.gameOver();
                return;
            }

            // Check Skill Result
            if (this.mapSystem.boss.lastSkillResult === 'KILL') {
                this.gameOver();
                return;
            }
            // Reset result after handling
            this.mapSystem.boss.lastSkillResult = null;

            // Check if boss is in newly captured area (already handled in fillAreas logic?)
            // No, fillAreas filters monsters but doesn't check boss manually here unless we do it
            const bossCell = this.mapSystem.getCell(this.mapSystem.boss.x, this.mapSystem.boss.y);
            if (bossCell === CONSTANTS.CELL_TYPE.OWNED) {
                // Boss captured!
                if (this.mapSystem.boss.takeDamage(this.mapSystem)) {
                    console.log(`Boss took damage! Lives left: ${this.mapSystem.boss.lives}`);
                    this.updateBossHud();

                    if (this.mapSystem.boss.lives <= 0) {
                        console.log('Boss Defeated!');
                        this.mapSystem.boss = null;
                        this.uiBossHud.style.display = 'none';
                        // Stage clear check will happen in next frame
                    }
                }
            }
        }
    }

    updateBossHud() {
        if (!this.mapSystem.boss) return;

        const hearts = this.uiBossHud.querySelectorAll('.boss-heart');
        hearts.forEach((heart, index) => {
            if (index < this.mapSystem.boss.lives) {
                heart.classList.add('active');
            } else {
                heart.classList.remove('active');
            }
        });
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    nextStage() {
        this.isTransitioning = true;
        const nextLevel = this.currentLevel + 1;
        const nextStageData = this.stageManager.getStageData(nextLevel);

        this.showResultPopup(
            true, // success
            `STAGE ${nextLevel}`,
            nextStageData?.description || '다음 스테이지로 이동합니다.',
            () => this.startStage(nextLevel)
        );
    }

    gameOver() {
        this.isRunning = false;
        const currentStageData = this.stageManager.getStageData(this.currentLevel);

        this.showResultPopup(
            false, // failure
            `STAGE ${this.currentLevel}`,
            currentStageData?.description || '다시 도전해보세요!',
            null // no primary action for failure
        );
    }

    revivePlayer() {
        this.uiResultPopup.style.display = 'none';
        this.isRunning = true;
        this.isPaused = false; // Ensure game is not paused
        this.lastTime = performance.now(); // Reset time to prevent dt jump

        // 1. Find Safe Spawn Point (OWNED area)
        let spawnX = this.mapSystem.width / 2;
        let spawnY = this.mapSystem.height / 2;

        // Check if center is valid (OWNED)
        // Note: getCell takes (x, y) and returns cell type
        if (this.mapSystem.getCell(spawnX, spawnY) !== CONSTANTS.CELL_TYPE.OWNED) {
            let found = false;
            let attempts = 0;
            // Try 100 times to find an owned spot
            while (!found && attempts < 100) {
                const rx = Math.random() * this.mapSystem.width;
                const ry = Math.random() * this.mapSystem.height;
                if (this.mapSystem.getCell(rx, ry) === CONSTANTS.CELL_TYPE.OWNED) {
                    spawnX = rx;
                    spawnY = ry;
                    found = true;
                }
                attempts++;
            }
            if (!found) {
                // If map is somehow totally unowned, reset to start edge?
                // But normally impossible. Fallback to 10,10 or similar.
                spawnX = 10;
                spawnY = 10;
            }
        }

        this.player.x = spawnX;
        this.player.y = spawnY;
        this.mapSystem.clearTrails(); // Clear trails from grid
        this.player.trail = [];
        this.player.isDrawing = false;

        // Move Boss away if too close to SPAWN point
        if (this.mapSystem.boss) {
            const dist = Math.hypot(this.mapSystem.boss.x - spawnX, this.mapSystem.boss.y - spawnY);
            if (dist < 300) {
                // Teleport boss to a random safe spot
                let bx, by;
                do {
                    bx = Math.random() * this.mapSystem.width;
                    by = Math.random() * this.mapSystem.height;
                } while (Math.hypot(bx - spawnX, by - spawnY) < 300);
                this.mapSystem.boss.x = bx;
                this.mapSystem.boss.y = by;
                // Reset boss state to avoid immediate skill hit
                this.mapSystem.boss.state = 'MOVING';
                this.mapSystem.boss.targetArea = null;
            }
        }

        // Move Monsters away if too close or in OWNED area
        for (const monster of this.monsters) {
            const dist = Math.hypot(monster.x - spawnX, monster.y - spawnY);
            const monsterCell = this.mapSystem.getCell(monster.x, monster.y);

            if (dist < 200 || monsterCell === CONSTANTS.CELL_TYPE.OWNED) {
                let mx, my;
                let attempts = 0;
                do {
                    mx = Math.random() * this.mapSystem.width;
                    my = Math.random() * this.mapSystem.height;
                    const cell = this.mapSystem.getCell(mx, my);
                    attempts++;
                    // UNOWNED 영역이고 스폰 지점에서 충분히 떨어진 곳
                } while ((Math.hypot(mx - spawnX, my - spawnY) < 200 ||
                    this.mapSystem.getCell(mx, my) === CONSTANTS.CELL_TYPE.OWNED) &&
                    attempts < 50);

                if (attempts < 50) {
                    monster.x = mx;
                    monster.y = my;
                }
            }
        }

        // Reset Timer if applicable
        if (this.timeLimit) {
            this.timeLeft = this.timeLimit;
        }

        // Ensure loop is running
        requestAnimationFrame(this.loop);
    }

    draw() {
        if (!this.player) return;
        const theme = this.stageManager.getStageData(this.currentLevel).theme;
        this.renderer.render(this.mapSystem, this.player, this.monsters, theme, this.windData, this.currentStageEffects);
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (this.isRunning || this.isPaused || this.isTransitioning) { // Keep loop running for rendering even if paused/transitioning
            requestAnimationFrame(this.loop);
        }
    }

    updateWindDirection() {
        if (!this.windData) return;
        const angle = Math.random() * Math.PI * 2;
        this.windData.angle = angle;
        this.windData.direction = {
            x: Math.cos(angle),
            y: Math.sin(angle)
        };
        console.log(`Wind changed: angle=${(angle * 180 / Math.PI).toFixed(0)}`);
    }

    showResultPopup(isSuccess, stageName, description, onPrimaryAction) {
        const resultTitle = document.getElementById('result-title');
        const resultDescription = document.getElementById('result-description');
        const resultButtons = document.getElementById('result-buttons');

        // Set title and status
        resultDescription.innerHTML = '';
        if (isSuccess) {
            resultTitle.textContent = 'STAGE CLEAR!';
            // Set description
            resultDescription.innerHTML = `<strong>${stageName}</strong><br>${description}`;
        } else {
            resultTitle.textContent = 'GAME OVER';
        }

        // Clear and create buttons
        resultButtons.innerHTML = '';

        if (isSuccess) {
            // Success: "다음 스테이지로 이동" 버튼
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-toss btn-primary';
            nextBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                다음 스테이지로 이동
            `;
            nextBtn.addEventListener('click', () => {
                this.uiResultPopup.style.display = 'none';
                if (onPrimaryAction) onPrimaryAction();
            });
            resultButtons.appendChild(nextBtn);
        } else {
            // Failure: "광고보고 이어하기", "처음부터 다시하기" 버튼
            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn-toss btn-primary';
            continueBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                광고보고 이어하기
            `;
            continueBtn.addEventListener('click', async () => {
                await showInterstitialAd();
                this.revivePlayer();
            });

            const restartBtn = document.createElement('button');
            restartBtn.className = 'btn-toss btn-secondary';
            restartBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                처음부터 다시하기
            `;
            restartBtn.addEventListener('click', () => {
                this.uiResultPopup.style.display = 'none';
                this.isRunning = true;
                this.isPaused = false;
                this.lastTime = performance.now(); // Reset time to prevent dt jump
                this.startStage(this.currentLevel);
                requestAnimationFrame(this.loop); // Restart game loop
            });

            resultButtons.appendChild(continueBtn);
            resultButtons.appendChild(restartBtn);
        }

        // Show popup
        this.uiResultPopup.style.display = 'flex';
    }
}
