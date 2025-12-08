console.log('🚀 main.js loaded - Version 2025-12-09');

import { initializeBedrock } from './bedrock.js';
import { Game } from './core/Game.js';

// 앱 초기화
async function init() {
  console.log('🎮 Initializing game...');
  // Bedrock SDK 초기화
  await initializeBedrock();

  // 게임 시작
  const game = new Game();
  console.log('✅ Game initialized successfully');
}

init();
