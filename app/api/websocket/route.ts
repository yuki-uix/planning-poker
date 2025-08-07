import { NextRequest } from 'next/server';

// HTTP处理函数（用于WebSocket升级）
export async function GET(_request: NextRequest) {
  // 这个路由主要用于WebSocket升级
  // 实际的WebSocket处理在独立的websocket-server.ts中
  console.log('WebSocket endpoint', _request);
  return new Response('WebSocket endpoint', { status: 200 });
} 