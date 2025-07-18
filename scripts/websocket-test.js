#!/usr/bin/env node

/**
 * WebSocket连接稳定性测试脚本
 * 用于验证优化后的连接稳定性
 */

const WebSocket = require('ws');

class WebSocketTester {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      testDuration: options.testDuration || 60000, // 60秒测试
      connectionCount: options.connectionCount || 8, // 8个连接
      heartbeatInterval: options.heartbeatInterval || 15000, // 15秒心跳
      ...options
    };
    
    this.connections = [];
    this.stats = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      disconnections: 0,
      reconnections: 0,
      averageLatency: 0,
      totalHeartbeats: 0,
      successfulHeartbeats: 0,
      failedHeartbeats: 0
    };
    
    this.startTime = Date.now();
  }

  // 创建单个连接
  createConnection(sessionId, userId) {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}?sessionId=${sessionId}&userId=${userId}`;
      const ws = new WebSocket(wsUrl);
      
      const connection = {
        ws,
        sessionId,
        userId,
        connected: false,
        disconnected: false,
        reconnectAttempts: 0,
        heartbeats: [],
        lastHeartbeat: null
      };

      ws.on('open', () => {
        console.log(`✅ 连接成功: ${userId}`);
        connection.connected = true;
        this.stats.successfulConnections++;
        this.stats.totalConnections++;
        
        // 开始心跳
        this.startHeartbeat(connection);
        resolve(connection);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'heartbeat_ack') {
            this.handleHeartbeatAck(connection, message);
          }
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`❌ 连接断开: ${userId} (${code}: ${reason})`);
        connection.disconnected = true;
        this.stats.disconnections++;
        
        // 模拟重连
        if (connection.reconnectAttempts < 3) {
          setTimeout(() => {
            this.reconnect(connection);
          }, 2000 * Math.pow(2, connection.reconnectAttempts));
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ 连接错误: ${userId}`, error.message);
        this.stats.failedConnections++;
        reject(error);
      });

      // 超时处理
      setTimeout(() => {
        if (!connection.connected) {
          reject(new Error(`连接超时: ${userId}`));
        }
      }, 10000);
    });
  }

  // 开始心跳
  startHeartbeat(connection) {
    const sendHeartbeat = () => {
      if (connection.disconnected) return;
      
      const heartbeat = {
        type: 'heartbeat',
        sessionId: connection.sessionId,
        userId: connection.userId,
        timestamp: Date.now(),
        sequence: connection.heartbeats.length
      };
      
      try {
        connection.ws.send(JSON.stringify(heartbeat));
        connection.lastHeartbeat = Date.now();
        this.stats.totalHeartbeats++;
      } catch (error) {
        console.error(`心跳发送失败: ${connection.userId}`, error.message);
        this.stats.failedHeartbeats++;
      }
    };

    // 立即发送第一个心跳
    sendHeartbeat();
    
    // 设置定期心跳
    connection.heartbeatInterval = setInterval(sendHeartbeat, this.options.heartbeatInterval);
  }

  // 处理心跳确认
  handleHeartbeatAck(connection, message) {
    const now = Date.now();
    const latency = now - message.timestamp;
    
    connection.heartbeats.push({
      timestamp: now,
      latency,
      sequence: message.sequence
    });
    
    this.stats.successfulHeartbeats++;
    
    // 更新平均延迟
    const totalLatency = connection.heartbeats.reduce((sum, h) => sum + h.latency, 0);
    connection.averageLatency = totalLatency / connection.heartbeats.length;
  }

  // 重连
  reconnect(connection) {
    connection.reconnectAttempts++;
    console.log(`🔄 尝试重连: ${connection.userId} (第${connection.reconnectAttempts}次)`);
    
    this.createConnection(connection.sessionId, connection.userId)
      .then((newConnection) => {
        console.log(`✅ 重连成功: ${connection.userId}`);
        this.stats.reconnections++;
        
        // 更新连接对象
        Object.assign(connection, newConnection);
      })
      .catch((error) => {
        console.error(`❌ 重连失败: ${connection.userId}`, error.message);
      });
  }

  // 运行测试
  async runTest() {
    console.log('🚀 开始WebSocket连接稳定性测试');
    console.log(`📊 测试参数: ${this.options.connectionCount}个连接, ${this.options.testDuration/1000}秒`);
    console.log('─'.repeat(50));

    try {
      // 创建多个连接
      const promises = [];
      for (let i = 0; i < this.options.connectionCount; i++) {
        const sessionId = 'test-session';
        const userId = `user-${i + 1}`;
        promises.push(this.createConnection(sessionId, userId));
      }

      this.connections = await Promise.all(promises);
      console.log(`✅ 所有连接创建完成 (${this.connections.length}个)`);

      // 等待测试时间
      await new Promise(resolve => setTimeout(resolve, this.options.testDuration));

      // 关闭所有连接
      this.connections.forEach(connection => {
        if (connection.heartbeatInterval) {
          clearInterval(connection.heartbeatInterval);
        }
        if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1000, 'Test completed');
        }
      });

      // 输出测试结果
      this.printResults();

    } catch (error) {
      console.error('❌ 测试失败:', error.message);
    }
  }

  // 打印测试结果
  printResults() {
    const testDuration = (Date.now() - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 WebSocket连接稳定性测试结果');
    console.log('='.repeat(50));
    
    console.log(`⏱️  测试时长: ${testDuration.toFixed(1)}秒`);
    console.log(`🔗 总连接数: ${this.stats.totalConnections}`);
    console.log(`✅ 成功连接: ${this.stats.successfulConnections}`);
    console.log(`❌ 失败连接: ${this.stats.failedConnections}`);
    console.log(`🔌 断开连接: ${this.stats.disconnections}`);
    console.log(`🔄 重连次数: ${this.stats.reconnections}`);
    
    console.log('\n💓 心跳统计:');
    console.log(`📤 总心跳数: ${this.stats.totalHeartbeats}`);
    console.log(`✅ 成功心跳: ${this.stats.successfulHeartbeats}`);
    console.log(`❌ 失败心跳: ${this.stats.failedHeartbeats}`);
    
    if (this.stats.totalHeartbeats > 0) {
      const heartbeatSuccessRate = (this.stats.successfulHeartbeats / this.stats.totalHeartbeats * 100).toFixed(1);
      console.log(`📈 心跳成功率: ${heartbeatSuccessRate}%`);
    }
    
    // 计算平均延迟
    const allLatencies = this.connections
      .filter(c => c.heartbeats.length > 0)
      .map(c => c.averageLatency);
    
    if (allLatencies.length > 0) {
      const avgLatency = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
      console.log(`⏱️  平均延迟: ${avgLatency.toFixed(1)}ms`);
    }
    
    // 连接稳定性评估
    const connectionStability = this.stats.disconnections === 0 ? '优秀' :
                               this.stats.disconnections <= 2 ? '良好' :
                               this.stats.disconnections <= 5 ? '一般' : '较差';
    
    console.log(`🏆 连接稳定性: ${connectionStability}`);
    
    console.log('='.repeat(50));
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const url = args[0] || 'ws://localhost:3001';
  
  const options = {
    testDuration: parseInt(args[1]) || 60000,
    connectionCount: parseInt(args[2]) || 8,
    heartbeatInterval: parseInt(args[3]) || 15000
  };

  const tester = new WebSocketTester(url, options);
  await tester.runTest();
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = WebSocketTester; 