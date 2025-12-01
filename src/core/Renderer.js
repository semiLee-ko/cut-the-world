import { CONSTANTS } from '../constants';
import { AssetManager } from './AssetManager';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assetManager = new AssetManager();

        // Offscreen canvas for pre-rendered terrain
        this.terrainCanvas = document.createElement('canvas');
        this.terrainCtx = this.terrainCanvas.getContext('2d');
        this.terrainRendered = false;

        // Offscreen canvas for Fog of War
        this.fogCanvas = document.createElement('canvas');
        this.fogCtx = this.fogCanvas.getContext('2d');

        // Offscreen canvas for Mask (to create soft edges)
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');

        // Temporary storage for common assets not yet in AssetManager
        this.commonImages = {};
        this.processedCommonImages = {};

        // Camera
        this.camera = { x: 0, y: 0, width: 0, height: 0 };
        this.zoomLevel = 1.5; // Zoom in by 50%

        this.snowParticles = [];
        this.initSnow();

        this.windParticles = [];
        this.initWind();

        this.init();
    }

    init() {
        this.worldWidth = CONSTANTS.GAME_WIDTH;
        this.worldHeight = CONSTANTS.GAME_HEIGHT;
        this.initAsync();
    }

    async initAsync() {
        try {
            this.resize();
            window.addEventListener('resize', () => this.resize());
        } catch (e) {
            console.error('[Renderer] Init failed:', e);
        }
    }

    setWorldSize(width, height) {
        this.worldWidth = width;
        this.worldHeight = height;
        this.resize();
    }

    resize() {
        // Set canvas to full window size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        // Adjust camera viewport based on zoom level
        this.camera.width = this.canvas.width / this.zoomLevel;
        this.camera.height = this.canvas.height / this.zoomLevel;

        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;

        // Offscreen canvases match World Size
        this.terrainCanvas.width = this.worldWidth;
        this.terrainCanvas.height = this.worldHeight;
        this.terrainCtx.imageSmoothingEnabled = false;
        this.terrainCtx.webkitImageSmoothingEnabled = false;
        this.terrainCtx.mozImageSmoothingEnabled = false;
        this.terrainCtx.msImageSmoothingEnabled = false;

        this.fogCanvas.width = this.worldWidth;
        this.fogCanvas.height = this.worldHeight;
        this.fogCtx.imageSmoothingEnabled = false;
        this.fogCtx.webkitImageSmoothingEnabled = false;
        this.fogCtx.mozImageSmoothingEnabled = false;
        this.fogCtx.msImageSmoothingEnabled = false;

        this.maskCanvas.width = this.worldWidth;
        this.maskCanvas.height = this.worldHeight;
        this.maskCtx.imageSmoothingEnabled = false;
        this.maskCtx.webkitImageSmoothingEnabled = false;
        this.maskCtx.mozImageSmoothingEnabled = false;
        this.maskCtx.msImageSmoothingEnabled = false;

        if (this.assetManager.loaded) {
            this.terrainRendered = false;
        }
    }

    updateCamera(player) {
        // Center on player
        this.camera.x = player.x - this.camera.width / 2;
        this.camera.y = player.y - this.camera.height / 2;

        // Clamp to map bounds
        if (this.worldWidth < this.camera.width) {
            this.camera.x = -(this.camera.width - this.worldWidth) / 2;
        } else {
            this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldWidth - this.camera.width));
        }

        if (this.worldHeight < this.camera.height) {
            this.camera.y = -(this.camera.height - this.worldHeight) / 2;
        } else {
            this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldHeight - this.camera.height));
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render(mapSystem, player, monsters, theme, windData, effects) {
        this.clear();
        this.updateCamera(player);

        this.ctx.save();

        // Apply Zoom
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        // Apply Camera Translation
        this.ctx.translate(-this.camera.x, -this.camera.y);

        this.drawMap(mapSystem, theme);
        this.drawPlayer(player);
        this.drawMonsters(monsters);
        if (mapSystem.boss) {
            this.drawBoss(mapSystem.boss);
        }

        // Draw Wind Indicator (World Space, above player)
        if (theme === 'wind' && windData) {
            this.drawWindIndicator(player, windData);
        }

        this.ctx.restore();

        // Draw Weather Effects (Screen Space)
        if (theme === 'ice') {
            this.updateSnow();
            this.drawSnow();
        } else if (theme === 'wind' && windData) {
            this.updateWind(windData);
            this.drawWind(windData);
        }

        // Draw Dark Fog (Screen Space)
        if (effects && effects.type === 'dark_fog' && effects.active) {
            this.drawDarkFog(player);
        }
    }

    renderTerrainLayer(mapSystem) {
        if (!this.assetManager.loaded) return;
        if (!mapSystem.tileMap || mapSystem.tileMap.length === 0) return;

        this.terrainCtx.clearRect(0, 0, this.terrainCanvas.width, this.terrainCanvas.height);

        const tileSize = CONSTANTS.TILE_SIZE;
        for (let y = 0; y < mapSystem.tileRows; y++) {
            for (let x = 0; x < mapSystem.tileCols; x++) {
                const tileName = mapSystem.tileMap[y][x];
                if (tileName) {
                    const img = this.assetManager.getImage(tileName);
                    if (img && img.complete) {
                        this.terrainCtx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
                    }
                }
            }
        }

        for (const obj of mapSystem.objects) {
            const img = this.assetManager.getImage(obj.image);
            if (img && img.complete) {
                this.terrainCtx.drawImage(img, obj.x, obj.y);
            }
        }

        this.terrainRendered = true;
    }

    drawMap(mapSystem, theme) {
        // 1. Render Terrain if needed
        if (this.assetManager.loaded && !this.terrainRendered) {
            this.renderTerrainLayer(mapSystem);
        }

        // 2. Draw Terrain (Always visible)
        this.ctx.drawImage(this.terrainCanvas, 0, 0);

        // 3. Draw Fog of War
        // A. Prepare Mask (White on Transparent)
        this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        this.maskCtx.fillStyle = '#FFF';

        const size = CONSTANTS.GRID_SIZE;
        const grid = mapSystem.grid;

        for (let y = 0; y < mapSystem.rows; y++) {
            for (let x = 0; x < mapSystem.cols; x++) {
                if (grid[y][x] === CONSTANTS.CELL_TYPE.OWNED) {
                    this.maskCtx.fillRect(x * size, y * size, size, size);
                }
            }
        }

        // B. Draw Fog Background
        this.fogCtx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
        this.fogCtx.globalCompositeOperation = 'source-over';

        if (theme === 'space') {
            this.fogCtx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // White Fog for Space
        } else {
            this.fogCtx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Black Fog for others
        }

        this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);

        // C. Cut out Mask with Soft Edge
        this.fogCtx.globalCompositeOperation = 'destination-out';
        this.fogCtx.shadowBlur = 20; // Soft edge amount
        this.fogCtx.shadowColor = '#000'; // Color doesn't matter for destination-out, but needed for shadow
        this.fogCtx.drawImage(this.maskCanvas, 0, 0);

        // Reset shadow
        this.fogCtx.shadowBlur = 0;
        this.fogCtx.shadowColor = 'transparent';

        // D. Draw Fog Overlay
        this.ctx.drawImage(this.fogCanvas, 0, 0);

        // 4. Draw Trails
        this.ctx.fillStyle = CONSTANTS.COLORS.TRAIL;
        for (let y = 0; y < mapSystem.rows; y++) {
            for (let x = 0; x < mapSystem.cols; x++) {
                if (grid[y][x] === CONSTANTS.CELL_TYPE.TRAIL) {
                    this.ctx.fillRect(x * size, y * size, size, size);
                }
            }
        }
    }

    drawPlayer(player) {
        const img = this.assetManager.getImage('player');
        const scale = player.scale || 1.0;
        if (img) {
            const size = 24 * scale;
            const frameSize = 48;
            this.ctx.drawImage(
                img,
                player.currentFrame * frameSize, 0, frameSize, frameSize,
                player.x - size / 2, player.y - size / 2, size, size
            );
        } else {
            this.ctx.fillStyle = '#2196F3';
            this.ctx.beginPath();
            this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFF';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    drawMonsters(monsters) {
        const img = this.assetManager.getImage('monster');
        for (const monster of monsters) {
            const scale = monster.scale || 1.0;
            if (img) {
                const size = 24 * scale;
                const frameSize = 48;
                this.ctx.drawImage(
                    img,
                    monster.currentFrame * frameSize, 0, frameSize, frameSize,
                    monster.x - size / 2, monster.y - size / 2, size, size
                );
            } else {
                this.ctx.fillStyle = '#F44336';
                this.ctx.beginPath();
                this.ctx.arc(monster.x, monster.y, monster.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#FFF';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }

    drawBoss(boss) {
        if (!boss) return;

        // Draw Skill Warning
        if (boss.state === 'CASTING' && boss.targetArea) {
            const { x, y, radius } = boss.targetArea;

            // Warning Circle (Red, Alpha 0.5)
            this.ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(244, 67, 54, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Shrinking Circle (1 second interval)
            const progress = (boss.castTimer % 1000) / 1000; // 0 to 1 every second
            const shrinkRadius = radius * (1 - progress);

            this.ctx.fillStyle = 'rgba(244, 67, 54, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, shrinkRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw Boss Icon
        let img = this.assetManager.getImage('boss');
        if (boss.state === 'CASTING') {
            const skillImg = this.assetManager.getImage('bossSkill');
            if (skillImg) img = skillImg;
        }

        if (img) {
            const size = 40; // Larger than normal monster
            const frameSize = 48; // Source frame size

            this.ctx.drawImage(
                img,
                boss.currentFrame * frameSize, 0, frameSize, frameSize, // Source: sx, sy, sw, sh
                boss.x - size / 2, boss.y - size / 2, size, size // Dest: dx, dy, dw, dh
            );
        } else {
            // Fallback
            this.ctx.fillStyle = '#9C27B0'; // Purple
            this.ctx.beginPath();
            this.ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFF';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    }

    initSnow() {
        this.snowParticles = Array.from({ length: 100 }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            radius: Math.random() * 2 + 1,
            speed: Math.random() * 1 + 0.5,
            opacity: Math.random() * 0.5 + 0.3
        }));
    }

    updateSnow() {
        for (const p of this.snowParticles) {
            p.y += p.speed;
            if (p.y > window.innerHeight) {
                p.y = -5;
                p.x = Math.random() * window.innerWidth;
            }
        }
    }

    drawSnow() {
        this.ctx.fillStyle = '#FFF';
        for (const p of this.snowParticles) {
            this.ctx.globalAlpha = p.opacity;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
    }

    initWind() {
        this.windParticles = Array.from({ length: 50 }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            length: Math.random() * 20 + 10,
            speed: Math.random() * 2 + 2,
            opacity: Math.random() * 0.3 + 0.1
        }));
    }

    updateWind(windData) {
        for (const p of this.windParticles) {
            p.x += windData.direction.x * p.speed;
            p.y += windData.direction.y * p.speed;

            // Wrap around screen
            if (p.x < -50) p.x = window.innerWidth + 50;
            if (p.x > window.innerWidth + 50) p.x = -50;
            if (p.y < -50) p.y = window.innerHeight + 50;
            if (p.y > window.innerHeight + 50) p.y = -50;
        }
    }

    drawWind(windData) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        for (const p of this.windParticles) {
            this.ctx.globalAlpha = p.opacity;
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x - windData.direction.x * p.length, p.y - windData.direction.y * p.length);
            this.ctx.stroke();
        }
        this.ctx.globalAlpha = 1.0;
    }

    drawWindIndicator(player, windData) {
        const x = player.x;
        const y = player.y - 60; // Moved higher (was 40)

        this.ctx.save();
        this.ctx.translate(x, y);

        // Draw Pivot
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 3, 0, Math.PI * 2); // Smaller pivot
        this.ctx.fill();

        // Rotate for wind direction
        this.ctx.rotate(windData.angle);

        // Draw Weather Vane Arrow
        this.ctx.strokeStyle = '#D32F2F'; // Reddish
        this.ctx.lineWidth = 2; // Thinner line
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Shaft
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 0); // Shorter shaft
        this.ctx.lineTo(15, 0);
        this.ctx.stroke();

        // Arrow Head
        this.ctx.fillStyle = '#D32F2F';
        this.ctx.beginPath();
        this.ctx.moveTo(18, 0); // Smaller head
        this.ctx.lineTo(10, -6);
        this.ctx.lineTo(10, 6);
        this.ctx.closePath();
        this.ctx.fill();

        // Tail Fin
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 0); // Smaller tail
        this.ctx.lineTo(-22, -7);
        this.ctx.lineTo(-22, 7);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    drawDarkFog(player) {
        // Create a temporary canvas for the fog mask if not exists (reusing fogCanvas logic but screen space)
        // Actually, we can draw directly to screen with composite operations.

        this.ctx.save();

        // 1. Fill screen with black
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Cut out player circle
        this.ctx.globalCompositeOperation = 'destination-out';

        // Calculate player position in screen space
        // World -> Screen: (world - camera) * zoom
        const screenX = (player.x - this.camera.x) * this.zoomLevel;
        const screenY = (player.y - this.camera.y) * this.zoomLevel;
        const radius = 100; // Visibility radius

        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }
}
