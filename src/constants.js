export const CONSTANTS = {
    GAME_WIDTH: 288,
    GAME_HEIGHT: 624,
    GRID_SIZE: 3, // Collision grid size remains small for precision
    TILE_SIZE: 48, // Visual tile size
    COLORS: {
        UNOWNED: '#222',
        OWNED: '#4CAF50',
        TRAIL: '#FFC107',
        PLAYER: '#2196F3',
        MONSTER: '#F44336',
        WALL: '#555'
    },
    PLAYER_SPEED: 1, // Increased speed for larger map
    MONSTER_SPEED: 0.5, // Increased speed for larger map
    CELL_TYPE: {
        UNOWNED: 0,
        OWNED: 1,
        TRAIL: 2,
        WALL: 3
    },
    THEMES: {
        forest: {
            path: 'assets/theme/forest',
            // Types mapped to internal indices [0, 1, 2]
            // Forest typo in desc said 'ice' 60%, assuming 'grass' based on file list
            types: ['grass', 'dirt', 'water'],
            ratios: [0.6, 0.1, 0.3], // 60%, 10%, 30%
            tiles: {
                grass: ['tiles_forest_grass1.png', 'tiles_forest_grass2.png'],
                dirt: ['tiles_forest_dirt1.png', 'tiles_forest_dirt2.png'],
                water: ['tiles_forest_water1.png', 'tiles_forest_water2.png']
            },
            objects: Array.from({ length: 12 }, (_, i) => `obj${String(i + 1).padStart(2, '0')}.png`)
        },
        ice: {
            path: 'assets/theme/ice',
            types: ['ice', 'dirt', 'water'],
            ratios: [0.6, 0.1, 0.3], // 60%, 10%, 30%
            tiles: {
                ice: ['tiles_ice_ice1.png', 'tiles_ice_ice2.png'],
                dirt: ['tiles_ice_dirt1.png', 'tiles_ice_dirt2.png'],
                water: ['tiles_ice_water1.png', 'tiles_ice_water2.png']
            },
            objects: Array.from({ length: 12 }, (_, i) => `obj${String(i + 1).padStart(2, '0')}.png`)
        },
        wind: {
            path: 'assets/theme/wind',
            types: ['dirt', 'grass', 'water'],
            ratios: [0.85, 0.05, 0.1], // 85%, 5%, 10%
            tiles: {
                dirt: ['tiles_wind_dirt1.png', 'tiles_wind_dirt2.png'],
                grass: ['tiles_wind_grass1.png', 'tiles_wind_grass2.png'],
                water: ['tiles_wind_water1.png', 'tiles_wind_water2.png']
            },
            objects: Array.from({ length: 12 }, (_, i) => `obj${String(i + 1).padStart(2, '0')}.png`)
        },
        space: {
            path: 'assets/theme/space',
            types: ['void', 'wreck', 'dust'],
            ratios: [0.8, 0.05, 0.15], // 80%, 5%, 15%
            tiles: {
                void: ['tiles_space_void1.png', 'tiles_space_void2.png'],
                wreck: ['tiles_space_wreck1.png', 'tiles_space_wreck2.png'],
                dust: ['tiles_space_dust1.png', 'tiles_space_dust2.png']
            },
            objects: Array.from({ length: 12 }, (_, i) => `obj${String(i + 1).padStart(2, '0')}.png`)
        },
        volcano: {
            path: 'assets/theme/volcano',
            types: ['dust', 'lava', 'ore'],
            ratios: [0.5, 0.4, 0.1], // 50%, 40%, 10%
            tiles: {
                dust: ['tiles_volcano_dust1.png', 'tiles_volcano_dust2.png'],
                lava: ['tiles_volcano_lava1.png', 'tiles_volcano_lava2.png'],
                ore: ['tiles_volcano_ore1.png', 'tiles_volcano_ore2.png']
            },
            objects: Array.from({ length: 12 }, (_, i) => `obj${String(i + 1).padStart(2, '0')}.png`)
        }
    }
};
