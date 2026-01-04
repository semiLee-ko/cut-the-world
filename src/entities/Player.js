import { CONSTANTS } from '../constants';

export class Player {
    constructor(x, y, scale = 1.0) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 8 * scale;
        this.scale = scale;
        this.speed = CONSTANTS.PLAYER_SPEED;
        this.isDrawing = false;
        this.trail = [];

        // Animation
        this.animTimer = 0;
        this.currentFrame = 0;
        this.totalFrames = 2;
        this.frameDuration = 200; // 200ms per frame
    }

    update(inputVector, mapSystem, dt, effects, windData) {
        this.vx = inputVector.x;
        this.vy = inputVector.y;

        let currentSpeed = this.speed;

        let slideY = 0;

        // Apply Ice Effects
        if (effects && effects.type === 'ice') {
            // 1. Passive Slide (1px/sec downwards when idle)
            if (inputVector.x === 0 && inputVector.y === 0) {
                slideY = (10 * dt / 1000); // Changed from 1 to 10 based on user's feedback ("falling little by little" implies visibility)
                // 1px/sec is too slow to notice typically, 10px/sec is slow but visible.
                // And fixes the trail issue because dist > 0.
            }

            // 2. Speed Modifiers
            // User request: Up slower, Down faster
            if (inputVector.y < 0) {
                currentSpeed *= 0.6; // Up: 40% slower
            } else if (inputVector.y > 0) {
                currentSpeed *= 1.4; // Down: 40% faster
            }
        }

        // Apply Wind Effects
        if (effects && effects.type === 'wind' && windData) {
            if (inputVector.x !== 0 || inputVector.y !== 0) {
                // Calculate dot product to determine alignment
                const dot = inputVector.x * windData.direction.x + inputVector.y * windData.direction.y;

                // dot = 1 (With wind) => +40% speed (1.4)
                // dot = -1 (Against wind) => -40% speed (0.6)
                const speedModifier = 1 + (dot * 0.4);
                currentSpeed *= speedModifier;
            }
        }

        // Apply Dark Fog Effect (Stage 7)
        if (effects && effects.type === 'dark_fog' && effects.active) {
            currentSpeed *= 0.4; // 60% speed reduction
        }

        // Apply Space Distortion Effect (Stage 9)
        if (effects && effects.type === 'space_distortion') {
            currentSpeed *= 0.8; // 20% speed reduction
        }

        if (inputVector.x === 0 && inputVector.y === 0 && slideY === 0) return 'IDLE';

        const nextX = this.x + inputVector.x * currentSpeed;
        const nextY = this.y + inputVector.y * currentSpeed + slideY;

        if (nextX < 0 || nextX > mapSystem.width || nextY < 0 || nextY > mapSystem.height) {
            return 'BLOCKED';
        }

        const currentCell = mapSystem.getCell(this.x, this.y);
        const nextCell = mapSystem.getCell(nextX, nextY);

        if (currentCell === CONSTANTS.CELL_TYPE.OWNED && nextCell === CONSTANTS.CELL_TYPE.UNOWNED) {
            this.isDrawing = true;
        }

        if (this.isDrawing) {
            if (nextCell === CONSTANTS.CELL_TYPE.OWNED) {
                // IMPORTANT: We must fill the gap between current pos and the owned cell!
                // Otherwise fast movement leaves a gap at the very end, preventing capture.

                const dictX = nextX - this.x;
                const dictY = nextY - this.y;
                const dist = Math.hypot(dictX, dictY);
                const steps = Math.ceil(dist);

                let prevGx = Math.floor(this.x / CONSTANTS.GRID_SIZE);
                let prevGy = Math.floor(this.y / CONSTANTS.GRID_SIZE);

                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const tx = this.x + dictX * t;
                    const ty = this.y + dictY * t;

                    const currGx = Math.floor(tx / CONSTANTS.GRID_SIZE);
                    const currGy = Math.floor(ty / CONSTANTS.GRID_SIZE);

                    // Stop if we actually hit the owned cell logic? 
                    // No, we want to draw the trail UP TO the owned cell.
                    // But if we overwrite OWNED into TRAIL it might be weird?
                    // MapSystem handles it. The crucial part is connectivity.

                    // Actually, if we hit OWNED, we should conceptually stop AT the border.
                    // But drawing a few pixels properly into the OWNED area ensures overlap/connection.

                    // 4-connectivity fix for the closing segment
                    if (currGx !== prevGx && currGy !== prevGy) {
                        const cornerX = currGx * CONSTANTS.GRID_SIZE;
                        const cornerY = prevGy * CONSTANTS.GRID_SIZE;
                        mapSystem.setCell(cornerX, cornerY, CONSTANTS.CELL_TYPE.TRAIL);
                        this.trail.push({ x: cornerX, y: cornerY });
                    }

                    // Only add if it's NOT already owned?
                    // If we set OWNED to TRAIL, we might break the wall?
                    // No, TRAIL type is just temporary.
                    // But wait, if we overwrite OWNED with TRAIL, mapSystem might get confused?
                    // mapSystem.fillAreas converts TRAIL -> OWNED anyway.
                    // So it is safe to overwrite for a frame.

                    // However, we only need to bridge the gap.
                    mapSystem.setCell(tx, ty, CONSTANTS.CELL_TYPE.TRAIL);
                    this.trail.push({ x: tx, y: ty });

                    prevGx = currGx;
                    prevGy = currGy;
                }

                this.isDrawing = false;
                this.x = nextX;
                this.y = nextY;

                // 현재 trail 복사본 저장 (Game.js에서 fillAreas에 전달용)
                this.lastTrail = [...this.trail];
                console.log('✅ Player FILL - lastTrail saved:', this.lastTrail.length, 'points');
                this.trail = []; // trail 초기화

                return 'FILL';
            }

            if (nextCell === CONSTANTS.CELL_TYPE.UNOWNED) {
                // Interpolate to fill gaps if speed > 1
                const dictX = nextX - this.x;
                const dictY = nextY - this.y;
                const dist = Math.hypot(dictX, dictY);
                const steps = Math.ceil(dist); // Ensure we hit every pixel

                let prevGx = Math.floor(this.x / CONSTANTS.GRID_SIZE);
                let prevGy = Math.floor(this.y / CONSTANTS.GRID_SIZE);

                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const tx = this.x + dictX * t;
                    const ty = this.y + dictY * t;

                    const currGx = Math.floor(tx / CONSTANTS.GRID_SIZE);
                    const currGy = Math.floor(ty / CONSTANTS.GRID_SIZE);

                    // Check for diagonal break (4-connectivity fix)
                    if (currGx !== prevGx && currGy !== prevGy) {
                        // Insert corner point (using currGx, prevGy)
                        const cornerX = currGx * CONSTANTS.GRID_SIZE;
                        const cornerY = prevGy * CONSTANTS.GRID_SIZE;

                        mapSystem.setCell(cornerX, cornerY, CONSTANTS.CELL_TYPE.TRAIL);
                        this.trail.push({ x: cornerX, y: cornerY });
                    }

                    mapSystem.setCell(tx, ty, CONSTANTS.CELL_TYPE.TRAIL);

                    // Optimize trail array: only push if different from last? 
                    // For now, simple push is safer for continuity.
                    this.trail.push({ x: tx, y: ty });

                    prevGx = currGx;
                    prevGy = currGy;
                }
            }
        }

        this.x = nextX;
        this.y = nextY;

        // Update Animation (only when moving)
        this.animTimer += dt;
        if (this.animTimer >= this.frameDuration) {
            this.animTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
        }

        return 'MOVE';
    }

    teleport(mapSystem) {
        // Find a valid random position (not in a wall, preferably unowned or owned)
        let safe = false;
        let attempts = 0;
        let newX, newY;

        while (!safe && attempts < 10) {
            newX = Math.random() * mapSystem.width;
            newY = Math.random() * mapSystem.height;

            // Basic boundary check is implicit.
            // Check if it's a wall?
            const cell = mapSystem.getCell(newX, newY);
            if (cell !== CONSTANTS.CELL_TYPE.WALL) {
                safe = true;
            }
            attempts++;
        }

        if (safe) {
            this.x = newX;
            this.y = newY;
            // Cancel drawing if teleporting
            this.isDrawing = false;
            this.trail = [];
        }
    }
}
