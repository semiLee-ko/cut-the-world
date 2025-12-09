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

        this.captureEffects = [];

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

        this.needsRedraw = true;
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

        this.drawMap(mapSystem, theme, player);
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

        // Draw Capture Effects (World Space, but overlay)
        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.drawCaptureEffects();
        this.ctx.restore();
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

    drawMap(mapSystem, theme, player) {
        // 1. Render Terrain if needed
        if (this.assetManager.loaded && !this.terrainRendered) {
            this.renderTerrainLayer(mapSystem);
        }

        // 2. Draw Terrain (Always visible)
        this.ctx.drawImage(this.terrainCanvas, 0, 0);

        // 3. Draw Fog of War
        // A. Prepare Mask (Update only if dirty)
        // Note: The mask is persistent. We only add new OWNED areas or reset if needed.
        // For simplicity with the current architecture where we don't track incremental updates easily in Renderer,
        // we can check a dirty flag from MapSystem or just optimize the loop.

        // BETTER APPROACH: Render grid to imageData directly if dirty? 
        // OR: Just don't clear the maskCanvas every frame. The mask accumulates OWNED areas.
        // The only time we need to clear is on reset.
        // BUT: MapSystem resets sometimes.

        if (mapSystem.isDirty || this.needsRedraw) {
            this.maskCtx.fillStyle = '#FFF';
            const size = CONSTANTS.GRID_SIZE;
            const grid = mapSystem.grid;

            // Optimization: If full redraw is needed (e.g. reset), clear first.
            // If incremental, just draw new... but we don't know which are new easily here without diff.
            // Given the performance issue, let's assume we redraw the whole thing ONLY when dirty.
            // Ideally we should track "newly owned" pixels, but for now 360k iterations once per capture is better than 60 FPS.

            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

            // Use direct pixel manipulation for speed (ImageData)
            const width = this.maskCanvas.width;
            const height = this.maskCanvas.height;
            const imageData = this.maskCtx.getImageData(0, 0, width, height);
            const data = imageData.data;

            for (let y = 0; y < mapSystem.rows; y++) {
                for (let x = 0; x < mapSystem.cols; x++) {
                    if (grid[y][x] === CONSTANTS.CELL_TYPE.OWNED) {
                        // Set pixel to white (255, 255, 255, 255)
                        const index = (y * width + x) * 4;
                        data[index] = 255;
                        data[index + 1] = 255;
                        data[index + 2] = 255;
                        data[index + 3] = 255;
                    }
                }
            }
            this.maskCtx.putImageData(imageData, 0, 0);
            mapSystem.isDirty = false;
            this.needsRedraw = false;
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
        this.fogCtx.shadowBlur = 3; // Reduced to 4 for very sharp edge
        this.fogCtx.shadowColor = '#000';

        // Offset Shadow Trick
        const offset = 20000;
        this.fogCtx.shadowOffsetX = offset;
        this.fogCtx.shadowOffsetY = 0;

        this.fogCtx.drawImage(this.maskCanvas, -offset, 0);

        // Reset shadow props
        this.fogCtx.shadowOffsetX = 0;
        this.fogCtx.shadowOffsetY = 0;

        // Reset shadow
        this.fogCtx.shadowBlur = 2;
        this.fogCtx.shadowColor = 'transparent';

        // D. Draw Fog Overlay
        this.ctx.drawImage(this.fogCanvas, 0, 0);

        // 4. Draw Trails
        if (player && player.trail && player.trail.length > 0) {
            const size = Math.max(CONSTANTS.GRID_SIZE, 3); // Minimum 3px for visibility/smoothness

            this.ctx.save();
            this.ctx.strokeStyle = CONSTANTS.COLORS.TRAIL;
            this.ctx.lineWidth = size;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();

            // Start from the first point
            const startP = player.trail[0];
            let startGx = Math.floor(startP.x / CONSTANTS.GRID_SIZE) * CONSTANTS.GRID_SIZE + size / 2; // Center offset if needed? No, path follows points.
            // Actually, if we use coordinates directly it's smoother.
            // The grid logic is for logic, but rendering can be world coords.
            // player.trail contains world coordinates (interpolated in Player.js).

            this.ctx.moveTo(startP.x, startP.y);

            for (let i = 1; i < player.trail.length; i++) {
                const point = player.trail[i];
                this.ctx.lineTo(point.x, point.y);
            }

            // Connect to current player position? 
            // Usually valid to prevent gap between last trail point and player.
            this.ctx.lineTo(player.x, player.y);

            this.ctx.stroke();
            this.ctx.restore();
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
    addCaptureEffect(cells) {
        // Create a new effect object
        this.captureEffects.push({
            cells: cells, // Array of {x, y}
            timer: 0,
            duration: 1000, // 1 second fade out
            opacity: 1.0
        });
    }

    drawCaptureEffects() {
        if (this.captureEffects.length === 0) return;

        const size = CONSTANTS.GRID_SIZE; // 1

        // Update and filter
        this.captureEffects.forEach(effect => {
            effect.timer += 16.6; // Approx dt
            effect.opacity = 1.0 - (effect.timer / effect.duration);
        });

        this.captureEffects = this.captureEffects.filter(e => e.timer < e.duration);

        // Draw
        for (const effect of this.captureEffects) {
            if (effect.opacity <= 0) continue;

            this.ctx.save();
            this.ctx.globalAlpha = effect.opacity;
            this.ctx.fillStyle = CONSTANTS.COLORS.TRAIL;

            this.ctx.beginPath();
            for (const cell of effect.cells) {
                const gx = Math.floor(cell.x / CONSTANTS.GRID_SIZE) * CONSTANTS.GRID_SIZE;
                const gy = Math.floor(cell.y / CONSTANTS.GRID_SIZE) * CONSTANTS.GRID_SIZE;
                this.ctx.rect(gx, gy, size, size);
            }
            this.ctx.fill();
            this.ctx.restore();
        }
    }
}
