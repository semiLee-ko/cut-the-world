import { CONSTANTS } from '../constants';

export class AssetManager {
    constructor() {
        this.images = {};
        this.loaded = false;
    }

    async loadTheme(themeName) {
        const theme = CONSTANTS.THEMES[themeName];
        if (!theme) {
            console.error(`[AssetManager] Theme ${themeName} not found`);
            return;
        }

        const promises = [];

        // Load Tiles
        for (const [type, files] of Object.entries(theme.tiles)) {
            files.forEach(file => {
                const key = file; // Use filename as key
                const src = `${theme.path}/${file}`;
                promises.push(this.loadImage(key, src));
            });
        }

        // Load Objects
        theme.objects.forEach(file => {
            const key = file;
            const src = `${theme.path}/${file}`;
            promises.push(this.loadImage(key, src));
        });

        // Load Player and Monster (Dynamic based on theme)
        // Assuming standard filenames in theme folder
        promises.push(this.loadImage('player', `${theme.path}/player_moving.png`, true));
        promises.push(this.loadImage('monster', `${theme.path}/monster.png`, true));

        // Load Boss (Static for now, or could be theme based if needed)
        // Boss assets are currently at root assets/
        promises.push(this.loadImage('boss', 'assets/monster_boss.png', true));
        promises.push(this.loadImage('bossSkill', 'assets/monster_boss_skill.png', true));

        await Promise.all(promises);
        this.loaded = true;
        console.log(`[AssetManager] Theme ${themeName} loaded`);
    }

    loadImage(key, src, process = false) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (process) {
                    this.images[key] = this.removeCheckerboard(img);
                } else {
                    this.images[key] = img;
                }
                resolve(this.images[key]);
            };
            img.onerror = (e) => {
                console.error(`[AssetManager] Failed to load ${src}`, e);
                resolve(null);
            };
            img.src = src;
        });
    }

    removeCheckerboard(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const isWhite = r > 240 && g > 240 && b > 240;
            const isLightGray = r > 180 && r < 200 && g > 180 && g < 200 && b > 180 && b < 200;
            if (isWhite || isLightGray) data[i + 3] = 0;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    getImage(key) {
        return this.images[key];
    }
}
