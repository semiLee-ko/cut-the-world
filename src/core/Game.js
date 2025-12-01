import { CONSTANTS } from '../constants';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { MapSystem } from '../systems/MapSystem';
import { StageManager } from '../systems/StageManager';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Boss } from '../entities/Boss';

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
        this.uiTransition = document.getElementById('stage-transition');
        this.uiGameOver = document.getElementById('game-over-popup');

        this.startStage(this.currentLevel);

        this.lastTime = 0;
        this.isRunning = true;
        this.isPaused = false;

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        this.setupControls();
    }

    setupControls() {
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.addEventListener('click', () => this.togglePause());

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.uiGameOver.style.display = 'none';
            this.startStage(this.currentLevel);
        });

        document.getElementById('continue-btn').addEventListener('click', () => {
            // TODO: 나중에 앱인토스 광고 시청 로직 추가
            this.revivePlayer();
        });
    }

    async startStage(level) {
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
        this.uiTransition.style.display = 'none';
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

            const timerUI = document.getElementById('ui-timer');
            const ceilTime = Math.ceil(this.timeLeft);
            timerUI.textContent = this.formatTime(ceilTime);

            if (ceilTime <= 10) {
                timerUI.style.color = '#F44336'; // Red
            } else if (ceilTime <= 20) {
                timerUI.style.color = '#FF9800'; // Orange
            } else if (ceilTime <= 30) {
                timerUI.style.color = '#FFEB3B'; // Yellow
            } else {
                timerUI.style.color = '#fff';
            }
        }

        const inputVector = this.input.getVector();
        const playerState = this.player.update(inputVector, this.mapSystem, dt, this.currentStageEffects, this.windData);

        if (playerState === 'DIE') {
            this.gameOver();
            return;
        }

        if (playerState === 'FILL') {
            this.mapSystem.fillAreas(this.monsters);

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

        if (ownedPercent >= 85) {
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
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    nextStage() {
        this.isTransitioning = true;
        this.uiTransition.style.display = 'flex';

        setTimeout(() => {
            this.startStage(this.currentLevel + 1);
        }, 2000);
    }

    gameOver() {
        this.isRunning = false;
        this.uiGameOver.style.display = 'flex';
    }

    revivePlayer() {
        this.uiGameOver.style.display = 'none';
        this.isRunning = true;
        this.isPaused = false; // Ensure game is not paused
        this.lastTime = performance.now(); // Reset time to prevent dt jump

        // Respawn player at center safely
        const centerX = this.mapSystem.width / 2;
        const centerY = this.mapSystem.height / 2;
        this.player.x = centerX;
        this.player.y = centerY;
        this.mapSystem.clearTrails(); // Clear trails from grid
        this.player.trail = [];
        this.player.isDrawing = false;

        // Move Boss away if too close
        if (this.mapSystem.boss) {
            const dist = Math.hypot(this.mapSystem.boss.x - centerX, this.mapSystem.boss.y - centerY);
            if (dist < 300) {
                // Teleport boss to a random safe spot
                let bx, by;
                do {
                    bx = Math.random() * this.mapSystem.width;
                    by = Math.random() * this.mapSystem.height;
                } while (Math.hypot(bx - centerX, by - centerY) < 300);
                this.mapSystem.boss.x = bx;
                this.mapSystem.boss.y = by;
                // Reset boss state to avoid immediate skill hit
                this.mapSystem.boss.state = 'MOVING';
                this.mapSystem.boss.targetArea = null;
            }
        }

        // Move Monsters away if too close
        for (const monster of this.monsters) {
            const dist = Math.hypot(monster.x - centerX, monster.y - centerY);
            if (dist < 200) {
                let mx, my;
                do {
                    mx = Math.random() * this.mapSystem.width;
                    my = Math.random() * this.mapSystem.height;
                } while (Math.hypot(mx - centerX, my - centerY) < 200);
                monster.x = mx;
                monster.y = my;
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
}
