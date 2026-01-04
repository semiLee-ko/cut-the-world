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
        const radius = 40; // Increased to 40 for GRID_SIZE=1 (was 8)

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
        const rows = this.rows;
        const cols = this.cols;
        const total = rows * cols;
        const visited = new Uint8Array(total); // 0: not visited, 1: visited
        const areas = [];

        // Stack for DFS
        const stack = [];

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                // Check if unowned and not visited
                // Must calculate linear index
                const startIdx = y * cols + x;

                if (this.grid[y][x] === CONSTANTS.CELL_TYPE.UNOWNED && visited[startIdx] === 0) {

                    let currentArea = []; // Stores indices now
                    let touchesBorder = false;

                    stack.push(startIdx);
                    visited[startIdx] = 1;

                    while (stack.length > 0) {
                        const idx = stack.pop();
                        const cy = Math.floor(idx / cols);
                        const cx = idx % cols;

                        // Identify border touch
                        if (cx === 0 || cx === cols - 1 || cy === 0 || cy === rows - 1) {
                            touchesBorder = true;
                            // Optimization: Discard immediately
                            if (currentArea.length > 0) currentArea = [];
                        }

                        // Only collect cells if we haven't touched the border yet
                        if (!touchesBorder) {
                            currentArea.push(idx);
                        }

                        // Neighbors: Up, Down, Left, Right
                        // Right
                        if (cx + 1 < cols) {
                            const nIdx = idx + 1;
                            if (visited[nIdx] === 0 && this.grid[cy][cx + 1] === CONSTANTS.CELL_TYPE.UNOWNED) {
                                visited[nIdx] = 1;
                                stack.push(nIdx);
                            }
                        }
                        // Left
                        if (cx - 1 >= 0) {
                            const nIdx = idx - 1;
                            if (visited[nIdx] === 0 && this.grid[cy][cx - 1] === CONSTANTS.CELL_TYPE.UNOWNED) {
                                visited[nIdx] = 1;
                                stack.push(nIdx);
                            }
                        }
                        // Down
                        if (cy + 1 < rows) {
                            const nIdx = idx + cols;
                            if (visited[nIdx] === 0 && this.grid[cy + 1][cx] === CONSTANTS.CELL_TYPE.UNOWNED) {
                                visited[nIdx] = 1;
                                stack.push(nIdx);
                            }
                        }
                        // Up
                        if (cy - 1 >= 0) {
                            const nIdx = idx - cols;
                            if (visited[nIdx] === 0 && this.grid[cy - 1][cx] === CONSTANTS.CELL_TYPE.UNOWNED) {
                                visited[nIdx] = 1;
                                stack.push(nIdx);
                            }
                        }
                    }

                    if (!touchesBorder && currentArea.length > 0) {
                        areas.push(currentArea);
                    }
                }
            }
        }
        return areas;
    }

    fillAreas(monsters, currentTrail = []) {
        // 1. 현재 trail을 먼저 OWNED로 변환 (경계 확정)
        for (const point of currentTrail) {
            const gx = Math.floor(point.x / CONSTANTS.GRID_SIZE);
            const gy = Math.floor(point.y / CONSTANTS.GRID_SIZE);
            if (this.isValid(gx, gy) && this.grid[gy][gx] === CONSTANTS.CELL_TYPE.TRAIL) {
                this.grid[gy][gx] = CONSTANTS.CELL_TYPE.OWNED;
            }
        }

        this.isDirty = true; // Set dirty flag after converting trail to owned

        // 2. 경계가 확정된 후 빈 영역 찾기
        const areas = this.findEmptyAreas();
        console.log(`  Found ${areas.length} empty areas`);
        let filledCount = 0;

        // If no areas explicitly found, we still check trail cleanup below.
        // But logic requires: if background is connected, areas will be empty.
        // Wait, logic in original was: "If areas is empty -> convert remaining trail".

        // 4. 모든 영역 채우기 (몬스터 여부 무시 - monsters were filtered elsewhere? 
        // No, original logic blindly filled areas. Monsters inside are killed by Game.js loop checking OWNED)
        const newCells = []; // Stores indices
        for (const area of areas) {
            console.log(`  Filling area (${area.length} cells)`);
            for (const idx of area) {
                const cy = Math.floor(idx / this.cols);
                const cx = idx % this.cols;
                this.grid[cy][cx] = CONSTANTS.CELL_TYPE.OWNED;
                newCells.push(idx);
                filledCount++;
            }
        }

        if (areas.length > 0) this.isDirty = true;

        // 5. 남은 TRAIL도 모두 OWNED로 변환
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === CONSTANTS.CELL_TYPE.TRAIL) {
                    this.grid[y][x] = CONSTANTS.CELL_TYPE.OWNED;
                    // Also add to newCells for effect
                    newCells.push(y * this.cols + x);
                }
            }
        }

        // Optimize: If we converted trail, dirty is true.
        // Actually fillAreas usually implies we closed a loop, so trail is converted.
        this.isDirty = true;

        return { count: filledCount, newCells, cols: this.cols };
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
