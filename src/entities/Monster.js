import { CONSTANTS } from '../constants';

export class Monster {
    constructor(x, y, scale = 1.0) {
        this.x = x;
        this.y = y;
        this.radius = 12 * scale;
        this.scale = scale;
        this.speed = CONSTANTS.MONSTER_SPEED;

        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;

        this.changeDirTimer = 0;

        // Animation
        this.animTimer = 0;
        this.currentFrame = 0;
        this.totalFrames = 2;
        this.frameDuration = 200; // 200ms per frame
    }

    update(mapSystem) {
        this.changeDirTimer++;
        if (this.changeDirTimer > 60) {
            this.changeDirTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        }

        let nextX = this.x + this.vx;
        let nextY = this.y + this.vy;

        if (nextX < 0 || nextX > mapSystem.width) {
            this.vx *= -1;
            nextX = Math.max(0, Math.min(mapSystem.width, nextX));
        }
        if (nextY < 0 || nextY > mapSystem.height) {
            this.vy *= -1;
            nextY = Math.max(0, Math.min(mapSystem.height, nextY));
        }

        if (mapSystem.getCell(nextX, nextY) === CONSTANTS.CELL_TYPE.OWNED) {
            this.vx *= -1;
            this.vy *= -1;
            const angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        } else {
            this.x = nextX;
            this.y = nextY;
        }

        // Update Animation
        this.animTimer += 16; // Approx dt for 60fps since dt isn't passed to monster update yet
        if (this.animTimer >= this.frameDuration) {
            this.animTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
        }
    }

    checkCollision(player, mapSystem) {
        // ONLY check direct collision with player
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.radius + player.radius) {
            console.log('Monster collision: Direct hit!');
            return true;
        }

        // Check trail collision
        // Check center point for now to avoid false positives at edges
        const cell = mapSystem.getCell(this.x, this.y);
        if (cell === CONSTANTS.CELL_TYPE.TRAIL) {
            console.log('Monster collision: Trail hit!');
            return true;
        }

        return false;
    }
}
