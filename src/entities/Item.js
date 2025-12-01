import { CONSTANTS } from '../constants';

export class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'boots', 'shield', etc.
        this.radius = 5;
        this.active = true;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = '#FFD700'; // Gold color for items
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    checkCollection(player) {
        if (!this.active) return false;
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.radius + player.radius) {
            this.active = false;
            return true;
        }
        return false;
    }
}
