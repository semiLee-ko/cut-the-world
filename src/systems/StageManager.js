export class StageManager {
    constructor() {
        this.currentStage = 1;
        this.stages = [
            {
                level: 1,
                theme: 'forest',
                mapSize: 0.8,
                monsters: [
                    { count: 2 }
                ]
            },
            {
                level: 2,
                theme: 'forest',
                mapSize: 1.0,
                timeLimit: 60,
                monsters: [
                    { count: 3 }
                ]
            },
            {
                level: 3,
                theme: 'ice',
                mapSize: 1.0,
                timeLimit: 90,
                effects: { type: 'ice' },
                monsters: [
                    { count: 4 }
                ]
            },
            {
                level: 4,
                theme: 'wind',
                mapSize: 1.0,
                timeLimit: 90,
                effects: { type: 'wind' },
                monsters: [
                    { count: 5 }
                ]
            },
            {
                level: 5,
                theme: 'volcano',
                mapSize: 1.2,
                timeLimit: 90,
                boss: true,
                monsters: [
                    { count: 3 }
                ]
            },
            // Volume 2 (Stages 6-10) - 10% larger characters
            {
                level: 6,
                theme: 'ice',
                mapSize: 1,
                timeLimit: 100,
                scale: 1.1,
                effects: { type: 'ice' },
                monsters: [
                    { count: 5 }
                ]
            },
            {
                level: 7,
                theme: 'forest',
                mapSize: 1,
                timeLimit: 100,
                scale: 1.1,
                effects: { type: 'dark_fog' },
                monsters: [
                    { count: 5 }
                ]
            },
            {
                level: 8,
                theme: 'wind',
                mapSize: 1,
                timeLimit: 100,
                scale: 1.1,
                effects: { type: 'wind' },
                monsters: [
                    { count: 5 }
                ]
            },
            {
                level: 9,
                theme: 'space',
                mapSize: 1,
                timeLimit: 100,
                scale: 1.1,
                effects: { type: 'space_distortion' },
                monsters: [
                    { count: 5 }
                ]
            },
            {
                level: 10,
                theme: 'volcano',
                mapSize: 1.2,
                timeLimit: 100,
                scale: 1.1,
                boss: true,
                monsters: [
                    { count: 4 }
                ]
            }
        ];
    }

    getStageData(level) {
        return this.stages.find(s => s.level === level) || this.stages[0];
    }
}
