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

        // Apply Ice Effects
        if (effects && effects.type === 'ice') {
            // 1. Passive Slide (1px/sec downwards when idle)
            if (inputVector.x === 0 && inputVector.y === 0) {
                this.y += (1 * dt / 1000);
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

        if (inputVector.x === 0 && inputVector.y === 0 && (!effects || effects.type !== 'ice')) return 'IDLE';

        const nextX = this.x + inputVector.x * currentSpeed;
        const nextY = this.y + inputVector.y * currentSpeed;

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
                this.isDrawing = false;
                this.x = nextX;
                this.y = nextY;
                return 'FILL';
            }

            if (nextCell === CONSTANTS.CELL_TYPE.UNOWNED) {
                mapSystem.setCell(nextX, nextY, CONSTANTS.CELL_TYPE.TRAIL);
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
