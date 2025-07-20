import { NextRequest } from 'next/server';
import { connectionDebugger } from '@/lib/connection-debugger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const debugInfo = connectionDebugger.exportDebugInfo();
    const summary = connectionDebugger.getSummary();
    
    return new Response(JSON.stringify({
      success: true,
      timestamp: Date.now(),
      summary,
      debugInfo: JSON.parse(debugInfo)
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Failed to get connection debug info:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get debug info'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'clear':
        connectionDebugger.clear();
        return new Response(JSON.stringify({
          success: true,
          message: 'Debug log cleared'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'export':
        const debugInfo = connectionDebugger.exportDebugInfo();
        return new Response(debugInfo, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="connection-debug.json"'
          }
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Failed to handle debug action:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to handle action'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 