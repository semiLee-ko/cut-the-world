export class StageManager {
    constructor() {
        this.currentStage = 1;
        this.stages = [
            {
                level: 1,
                theme: 'forest',
                mapSize: 0.8,
                description: '평화로운 숲 지역입니다. 기본 조작법을 익혀보세요!',
                monsters: [
                    { count: 2 }
                ]
            },
            {
                level: 2,
                theme: 'forest',
                mapSize: 1.0,
                timeLimit: 60,
                description: '시간제한이 추가됩니다. 빠르게 영역을 확보하세요!',
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
                description: '얼음 지역에서는 아래로 미끄러집니다. 조심하세요!',
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
                description: '강한 바람이 방향을 바꿉니다. 적응하세요!',
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
                description: '첫 보스 스테이지! 용암 지역의 보스를 물리치세요!',
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
                description: '더 강력해진 얼음 지역입니다. 난이도가 상승합니다!',
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
                description: '어둠의 안개가 시야를 가립니다. 집중하세요!',
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
                description: '폭풍이 몰아칩니다. 바람에 맞서 싸우세요!',
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
                description: '우주 왜곡으로 순간이동이 발생합니다!',
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
                description: '최종 보스 스테이지! 모든 것을 쏟아부으세요!',
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
