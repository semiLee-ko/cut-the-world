import { initializeBedrock } from './bedrock.js';
import { Game } from './core/Game.js';

// 앱 초기화
async function init() {
  // Bedrock SDK 초기화
  await initializeBedrock();

  // 게임 시작
  const game = new Game();
}

init();
