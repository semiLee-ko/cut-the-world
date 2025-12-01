import { CONSTANTS } from '../constants';

export class MapSystem {
    constructor() {
        this.grid = [];
        this.tileMap = [];
        this.objects = [];

        this.reset();
    }

    reset(scaleFactor = 1.0, themeName = 'forest') {
        this.width = Math.floor(CONSTANTS.GAME_WIDTH * scaleFactor);
        this.height = Math.floor(CONSTANTS.GAME_HEIGHT * scaleFactor);

        this.cols = Math.ceil(this.width / CONSTANTS.GRID_SIZE);
        this.rows = Math.ceil(this.height / CONSTANTS.GRID_SIZE);

        // Tile system
        this.tileCols = Math.ceil(this.width / CONSTANTS.TILE_SIZE);
        this.tileRows = Math.ceil(this.height / CONSTANTS.TILE_SIZE);

        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(CONSTANTS.CELL_TYPE.UNOWNED));

        // Initialize owned area around spawn
        const spawnX = Math.floor(this.cols / 2);
        const spawnY = Math.floor(this.rows / 2);
        const radius = 8; // Increased from 5 to compensate for smaller GRID_SIZE

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const gx = spawnX + dx;
                    const gy = spawnY + dy;
                    if (this.isValid(gx, gy)) {
                        this.grid[gy][gx] = CONSTANTS.CELL_TYPE.OWNED;
                    }
                }
            }
        }

        this.generateTerrain(themeName);
    }

    generateTerrain(themeName) {
        const theme = CONSTANTS.THEMES[themeName];
        if (!theme) return;

        // 1. Initial Random Fill
        this.tileMap = Array(this.tileRows).fill().map(() => Array(this.tileCols).fill(null));

        // Temporary grid for CA
        let grid = Array(this.tileRows).fill().map(() => Array(this.tileCols).fill(0));

        // Use theme ratios
        // types[0] = ratios[0], types[1] = ratios[1], types[2] = ratios[2]
        const r0 = theme.ratios[0];
        const r1 = theme.ratios[1];
        // r2 is the rest

        for (let y = 0; y < this.tileRows; y++) {
            for (let x = 0; x < this.tileCols; x++) {
                const rand = Math.random();
                if (rand < r0) grid[y][x] = 0;
                else if (rand < r0 + r1) grid[y][x] = 1;
                else grid[y][x] = 2;
            }
        }

        // 2. Cellular Automata Smoothing (Cluster tiles)
        const iterations = 4;
        for (let i = 0; i < iterations; i++) {
            const newGrid = grid.map(row => [...row]);
            for (let y = 0; y < this.tileRows; y++) {
                for (let x = 0; x < this.tileCols; x++) {
                    // Count neighbors
                    const counts = { 0: 0, 1: 0, 2: 0 };
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const ny = y + dy;
                            const nx = x + dx;
                            if (ny >= 0 && ny < this.tileRows && nx >= 0 && nx < this.tileCols) {
                                counts[grid[ny][nx]]++;
                            } else {
                                // Edge behavior: treat as same as current to encourage clumps at edges
                                counts[grid[y][x]]++;
                            }
                        }
                    }

                    // Rule: If a neighbor type has > 4 count, switch to it
                    // Priority: Type 2 > Type 1 > Type 0 (Arbitrary tie-break)
                    if (counts[2] > 4) newGrid[y][x] = 2;
                    else if (counts[1] > 4) newGrid[y][x] = 1;
                    else if (counts[0] > 4) newGrid[y][x] = 0;
                }
            }
            grid = newGrid;
        }

        // 3. Convert to Tile Names
        const types = theme.types;
        for (let y = 0; y < this.tileRows; y++) {
            for (let x = 0; x < this.tileCols; x++) {
                const typeIdx = grid[y][x];
                const type = types[typeIdx];
                const variants = theme.tiles[type];
                if (variants && variants.length > 0) {
                    this.tileMap[y][x] = variants[Math.floor(Math.random() * variants.length)];
                } else {
                    // Fallback if variants missing
                    console.warn(`[MapSystem] Missing variants for theme ${themeName} type ${type}`);
                }
            }
        }

        // 4. Generate Objects
        // Requirement: "obj01 ~ obj12", "Each 2~5 pieces"
        this.objects = [];

        // Helper to check if a tile is valid for object (not water and not overlapping)
        const isValidObjectSpot = (tx, ty, x, y) => {
            if (grid[ty][tx] === 2) return false; // No objects on Water

            // Check distance from existing objects
            for (const obj of this.objects) {
                const dist = Math.hypot(obj.x - x, obj.y - y);
                if (dist < CONSTANTS.TILE_SIZE * 0.8) { // Minimum distance check
                    return false;
                }
            }
            return true;
        };

        for (const objFile of theme.objects) {
            const count = Math.floor(Math.random() * 3) + 1; // 1 to 3

            for (let i = 0; i < count; i++) {
                let attempts = 0;
                let placed = false;

                while (attempts < 20 && !placed) {
                    const tx = Math.floor(Math.random() * this.tileCols);
                    const ty = Math.floor(Math.random() * this.tileRows);

                    // Add some random offset within the tile for natural look
                    const offsetX = Math.random() * (CONSTANTS.TILE_SIZE / 2);
                    const offsetY = Math.random() * (CONSTANTS.TILE_SIZE / 2);
                    const candidateX = tx * CONSTANTS.TILE_SIZE + offsetX;
                    const candidateY = ty * CONSTANTS.TILE_SIZE + offsetY;

                    if (isValidObjectSpot(tx, ty, candidateX, candidateY)) {
                        this.objects.push({
                            x: candidateX,
                            y: candidateY,
                            image: objFile
                        });
                        placed = true;
                    }
                    attempts++;
                }
            }
        }
    }

    getCell(x, y) {
        const gx = Math.floor(x / CONSTANTS.GRID_SIZE);
        const gy = Math.floor(y / CONSTANTS.GRID_SIZE);
        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return null;
        return this.grid[gy][gx];
    }

    setCell(x, y, type) {
        const gx = Math.floor(x / CONSTANTS.GRID_SIZE);
        const gy = Math.floor(y / CONSTANTS.GRID_SIZE);
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            this.grid[gy][gx] = type;
        }
    }

    isValid(gx, gy) {
        return gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows;
    }

    findEmptyAreas() {
        const visited = Array(this.rows).fill().map(() => Array(this.cols).fill(false));
        const areas = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === CONSTANTS.CELL_TYPE.UNOWNED && !visited[y][x]) {
                    const area = [];
                    const stack = [{ x, y }];
                    visited[y][x] = true;

                    while (stack.length > 0) {
                        const p = stack.pop();
                        area.push(p);

                        const neighbors = [
                            { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
                            { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }
                        ];

                        for (const n of neighbors) {
                            if (this.isValid(n.x, n.y) && !visited[n.y][n.x] && this.grid[n.y][n.x] === CONSTANTS.CELL_TYPE.UNOWNED) {
                                visited[n.y][n.x] = true;
                                stack.push(n);
                            }
                        }
                    }
                    areas.push(area);
                }
            }
        }
        return areas;
    }

    fillAreas(monsters) {
        const areas = this.findEmptyAreas();
        let filledCount = 0;

        if (areas.length === 0) return 0;

        // 1. Calculate size of each area
        const areasWithSize = areas.map(area => ({
            points: area,
            size: area.length
        }));

        // 2. Sort by size descending (Largest first)
        areasWithSize.sort((a, b) => b.size - a.size);

        // 3. Keep the largest area (Index 0), Fill all others
        // We start from index 1 to fill smaller areas
        for (let i = 1; i < areasWithSize.length; i++) {
            const areaToFill = areasWithSize[i].points;
            for (const p of areaToFill) {
                this.grid[p.y][p.x] = CONSTANTS.CELL_TYPE.OWNED;
                filledCount++;
            }
        }

        // 4. Convert TRAIL to OWNED
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === CONSTANTS.CELL_TYPE.TRAIL) {
                    this.grid[y][x] = CONSTANTS.CELL_TYPE.OWNED;
                }
            }
        }

        return filledCount;
    }

    clearTrails() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === CONSTANTS.CELL_TYPE.TRAIL) {
                    this.grid[y][x] = CONSTANTS.CELL_TYPE.UNOWNED;
                }
            }
        }
    }

    getOwnedPercentage() {
        let ownedCount = 0;
        const totalCount = this.rows * this.cols;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === CONSTANTS.CELL_TYPE.OWNED) {
                    ownedCount++;
                }
            }
        }

        return (ownedCount / totalCount) * 100;
    }
}
