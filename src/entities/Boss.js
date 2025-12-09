import { CONSTANTS } from '../constants';

export class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 19; // Reduced by ~20% (24 -> 19)
        this.speed = 80;
        this.angle = Math.random() * Math.PI * 2;

        // State
        this.state = 'MOVING'; // MOVING, CASTING
        this.skillTimer = 0;
        this.skillInterval = 10000; // 10 seconds
        this.castDuration = 3000; // 3 seconds warning
        this.castTimer = 0;

        // Skill Target
        this.targetArea = null; // { x, y, radius }

        // Animation
        this.animTimer = 0;
        this.currentFrame = 0;
        this.totalFrames = 2;
        this.frameDuration = 200; // 200ms per frame

        // Lives
        this.lives = 3;
        this.isInvincible = false;
    }

    takeDamage(mapSystem) {
        if (this.isInvincible) return false;

        this.lives--;
        this.teleportToSafeSpot(mapSystem);

        return true;
    }

    teleportToSafeSpot(mapSystem) {
        let attempts = 0;
        let bx, by;

        // Try to find a spot that is UNOWNED and within bounds with padding
        do {
            bx = this.radius + Math.random() * (mapSystem.width - this.radius * 2);
            by = this.radius + Math.random() * (mapSystem.height - this.radius * 2);
            attempts++;
        } while (
            (mapSystem.getCell(bx, by) === CONSTANTS.CELL_TYPE.OWNED) &&
            attempts < 50
        );

        if (attempts >= 50) {
            bx = this.radius + Math.random() * (mapSystem.width - this.radius * 2);
            by = this.radius + Math.random() * (mapSystem.height - this.radius * 2);
        }

        this.x = bx;
        this.y = by;

        // Reset state
        this.state = 'MOVING';
        this.targetArea = null;
    }

    update(mapSystem, dt, player) {
        if (this.state === 'MOVING') {
            this.updateMovement(mapSystem, dt);

            // Update Skill Timer
            this.skillTimer += dt;
            if (this.skillTimer >= this.skillInterval) {
                this.startCasting(mapSystem);
            }
        } else if (this.state === 'CASTING') {
            // Update Cast Timer
            this.castTimer += dt;
            if (this.castTimer >= this.castDuration) {
                this.fireSkill(mapSystem, player);
            }
        }

        // Update Animation
        this.animTimer += dt;
        if (this.animTimer >= this.frameDuration) {
            this.animTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
        }
    }

    updateMovement(mapSystem, dt) {
        // Predict next position
        let nextX = this.x + Math.cos(this.angle) * this.speed * (dt / 1000);
        let nextY = this.y + Math.sin(this.angle) * this.speed * (dt / 1000);

        let bounced = false;

        // Check Map Boundaries (Center point check with radius padding)
        if (nextX < this.radius) {
            nextX = this.radius;
            this.angle = Math.PI - this.angle;
            bounced = true;
        }
        if (nextX > mapSystem.width - this.radius) {
            nextX = mapSystem.width - this.radius;
            this.angle = Math.PI - this.angle;
            bounced = true;
        }
        if (nextY < this.radius) {
            nextY = this.radius;
            this.angle = -this.angle;
            bounced = true;
        }
        if (nextY > mapSystem.height - this.radius) {
            nextY = mapSystem.height - this.radius;
            this.angle = -this.angle;
            bounced = true;
        }

        if (!bounced) {
            // Helper to check collision with OWNED cells
            const isOwned = (x, y) => {
                // Bounds safety check
                if (x < 0 || x >= mapSystem.width || y < 0 || y >= mapSystem.height) return true;
                return mapSystem.getCell(x, y) === CONSTANTS.CELL_TYPE.OWNED;
            };

            // Bounce off OWNED cells
            // Check radius distance ahead to prevent sticking
            const checkDist = this.radius + 2;
            const checkX = nextX + Math.cos(this.angle) * checkDist;
            const checkY = nextY + Math.sin(this.angle) * checkDist;

            if (isOwned(checkX, checkY)) {
                // Let's check X and Y components separately for better bounce
                const nextX_only = this.x + Math.cos(this.angle) * this.speed * (dt / 1000);
                const nextY_only = this.y + Math.sin(this.angle) * this.speed * (dt / 1000);

                // Check if moving only in X would hit (using radius margin)
                const hitX = isOwned(nextX_only + Math.sign(Math.cos(this.angle)) * this.radius, this.y);
                // Check if moving only in Y would hit
                const hitY = isOwned(this.x, nextY_only + Math.sign(Math.sin(this.angle)) * this.radius);

                if (hitX) {
                    this.angle = Math.PI - this.angle;
                    bounced = true;
                    nextX = this.x;
                }
                if (hitY) {
                    this.angle = -this.angle;
                    bounced = true;
                    nextY = this.y;
                }

                if (!hitX && !hitY) {
                    // Head-on or complex angle, just reverse
                    this.angle += Math.PI;
                    bounced = true;
                    nextX = this.x;
                    nextY = this.y;
                }
            }
        }

        // Update position
        this.x = nextX;
        this.y = nextY;

        // Randomly change direction occasionally
        if (!bounced && Math.random() < 0.02) {
            this.angle += (Math.random() - 0.5) * Math.PI;
        }
    }

    startCasting(mapSystem) {
        this.state = 'CASTING';
        this.castTimer = 0;
        this.skillTimer = 0;

        // Calculate Target Area (5% of total map area)
        const totalArea = mapSystem.width * mapSystem.height;
        const targetAreaSize = totalArea * 0.05;
        const targetRadius = Math.sqrt(targetAreaSize / Math.PI);

        // Random position for skill center
        // Ensure circle is mostly within bounds
        const padding = targetRadius;
        const tx = padding + Math.random() * (mapSystem.width - padding * 2);
        const ty = padding + Math.random() * (mapSystem.height - padding * 2);

        this.targetArea = {
            x: tx,
            y: ty,
            radius: targetRadius
        };
    }

    fireSkill(mapSystem, player) {
        // 1. Check Player Collision (Game Over)
        const dx = player.x - this.targetArea.x;
        const dy = player.y - this.targetArea.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.targetArea.radius + player.radius) {
            // Player Hit!
            this.lastSkillResult = 'KILL';
        } else {
            this.lastSkillResult = 'MISS';
        }

        // 2. Destroy Territory
        const startCol = Math.max(0, Math.floor((this.targetArea.x - this.targetArea.radius) / CONSTANTS.GRID_SIZE));
        const endCol = Math.min(mapSystem.cols - 1, Math.ceil((this.targetArea.x + this.targetArea.radius) / CONSTANTS.GRID_SIZE));
        const startRow = Math.max(0, Math.floor((this.targetArea.y - this.targetArea.radius) / CONSTANTS.GRID_SIZE));
        const endRow = Math.min(mapSystem.rows - 1, Math.ceil((this.targetArea.y + this.targetArea.radius) / CONSTANTS.GRID_SIZE));

        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                // Check if cell center is within radius
                const cellX = x * CONSTANTS.GRID_SIZE + CONSTANTS.GRID_SIZE / 2;
                const cellY = y * CONSTANTS.GRID_SIZE + CONSTANTS.GRID_SIZE / 2;
                const ddx = cellX - this.targetArea.x;
                const ddy = cellY - this.targetArea.y;

                if (ddx * ddx + ddy * ddy < this.targetArea.radius * this.targetArea.radius) {
                    if (mapSystem.grid[y][x] === CONSTANTS.CELL_TYPE.OWNED) {
                        mapSystem.grid[y][x] = CONSTANTS.CELL_TYPE.UNOWNED;
                    }
                }
            }
        }

        // Reset State
        this.state = 'MOVING';
        this.targetArea = null;
    }

    checkCollision(player, mapSystem) {
        // Normal body collision
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + player.radius) {
            return true;
        }

        // Trail collision (same as normal monster)
        const gridX = Math.floor(this.x / CONSTANTS.GRID_SIZE);
        const gridY = Math.floor(this.y / CONSTANTS.GRID_SIZE);

        if (gridX >= 0 && gridX < mapSystem.cols && gridY >= 0 && gridY < mapSystem.rows) {
            if (mapSystem.grid[gridY][gridX] === CONSTANTS.CELL_TYPE.TRAIL) {
                return true;
            }
        }

        return false;
    }
}
