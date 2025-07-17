#!/usr/bin/env node

/**
 * 性能测试脚本 - 测试12人同时在线的场景
 * 使用方法: node scripts/performance-test.js
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class PerformanceTest {
  constructor(options = {}) {
    this.options = {
      baseUrl: options.baseUrl || 'ws://localhost:3000/api/websocket',
      sessionId: options.sessionId || 'test-session-' + Date.now(),
      userCount: options.userCount || 12,
      testDuration: options.testDuration || 60000, // 60秒
      heartbeatInterval: options.heartbeatInterval || 25000,
      ...options
    };

    this.connections = new Map();
    this.messages = [];
    this.stats = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      averageLatency: 0,
      startTime: 0,
      endTime: 0
    };
  }

  // 生成随机用户ID
  generateUserId(index) {
    return `user-${index}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 创建WebSocket连接
  async createConnection(userId, index) {
    return new Promise((resolve, reject) => {
      const url = `${this.options.baseUrl}?sessionId=${this.options.sessionId}&userId=${userId}`;
      const ws = new WebSocket(url);
      const connectionId = `conn-${index}`;

      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for user ${userId}`));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.connections.set(connectionId, {
          ws,
          userId,
          index,
          connectedAt: Date.now(),
          messageCount: 0,
          lastHeartbeat: Date.now()
        });
        this.stats.successfulConnections++;
        console.log(`✅ User ${userId} connected successfully`);
        resolve(connectionId);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(connectionId, message);
        } catch (error) {
          console.error(`Failed to parse message from ${userId}:`, error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.stats.failedConnections++;
        console.error(`❌ Connection error for user ${userId}:`, error.message);
        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 User ${userId} disconnected: ${code} - ${reason}`);
        this.connections.delete(connectionId);
      });
    });
  }

  // 处理接收到的消息
  handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.messageCount++;
    this.stats.successfulMessages++;

    if (message.type === 'heartbeat_ack') {
      connection.lastHeartbeat = Date.now();
    }

    // 记录消息延迟
    if (message.timestamp) {
      const latency = Date.now() - message.timestamp;
      this.messages.push(latency);
    }
  }

  // 发送消息
  async sendMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const fullMessage = {
        ...message,
        sessionId: this.options.sessionId,
        userId: connection.userId,
        timestamp: Date.now()
      };

      connection.ws.send(JSON.stringify(fullMessage));
      this.stats.totalMessages++;
      return true;
    } catch (error) {
      this.stats.failedMessages++;
      console.error(`Failed to send message to ${connection.userId}:`, error);
      return false;
    }
  }

  // 发送心跳
  async sendHeartbeat(connectionId) {
    return this.sendMessage(connectionId, { type: 'heartbeat' });
  }

  // 发送投票
  async sendVote(connectionId, vote) {
    return this.sendMessage(connectionId, {
      type: 'vote',
      data: { vote }
    });
  }

  // 开始测试
  async start() {
    console.log('🚀 Starting performance test...');
    console.log(`📊 Target: ${this.options.userCount} users in session ${this.options.sessionId}`);
    console.log(`⏱️  Duration: ${this.options.testDuration / 1000} seconds`);
    console.log('');

    this.stats.startTime = performance.now();

    try {
      // 创建所有连接
      console.log('🔗 Creating connections...');
      const connectionPromises = [];
      
      for (let i = 0; i < this.options.userCount; i++) {
        const userId = this.generateUserId(i);
        const promise = this.createConnection(userId, i).catch(error => {
          console.error(`Failed to create connection for user ${i}:`, error.message);
        });
        connectionPromises.push(promise);
        
        // 添加延迟避免同时连接过多
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await Promise.all(connectionPromises);
      this.stats.totalConnections = this.connections.size;

      console.log(`✅ Created ${this.connections.size} connections`);
      console.log('');

      // 开始测试活动
      console.log('🎯 Starting test activities...');
      await this.runTestActivities();

    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  // 运行测试活动
  async runTestActivities() {
    const startTime = Date.now();
    const endTime = startTime + this.options.testDuration;

    // 定期发送心跳
    const heartbeatInterval = setInterval(() => {
      for (const [connectionId] of this.connections) {
        this.sendHeartbeat(connectionId);
      }
    }, this.options.heartbeatInterval);

    // 模拟投票活动
    const voteInterval = setInterval(() => {
      const votes = ['1', '2', '3', '5', '8', '13'];
      for (const [connectionId] of this.connections) {
        const randomVote = votes[Math.floor(Math.random() * votes.length)];
        this.sendVote(connectionId, randomVote);
      }
    }, 10000); // 每10秒投票一次

    // 等待测试结束
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (Date.now() >= endTime) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });

    clearInterval(heartbeatInterval);
    clearInterval(voteInterval);
  }

  // 清理连接
  async cleanup() {
    console.log('🧹 Cleaning up connections...');
    
    for (const [connectionId, connection] of this.connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, 'Test completed');
      }
    }

    // 等待所有连接关闭
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 打印测试结果
  printResults() {
    this.stats.endTime = performance.now();
    const duration = this.stats.endTime - this.stats.startTime;

    console.log('');
    console.log('📈 Performance Test Results');
    console.log('========================');
    console.log(`⏱️  Test Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`👥 Target Users: ${this.options.userCount}`);
    console.log(`🔗 Total Connections: ${this.stats.totalConnections}`);
    console.log(`✅ Successful Connections: ${this.stats.successfulConnections}`);
    console.log(`❌ Failed Connections: ${this.stats.failedConnections}`);
    console.log(`📨 Total Messages: ${this.stats.totalMessages}`);
    console.log(`✅ Successful Messages: ${this.stats.successfulMessages}`);
    console.log(`❌ Failed Messages: ${this.stats.failedMessages}`);

    if (this.messages.length > 0) {
      const avgLatency = this.messages.reduce((sum, latency) => sum + latency, 0) / this.messages.length;
      const minLatency = Math.min(...this.messages);
      const maxLatency = Math.max(...this.messages);
      
      console.log(`📊 Average Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`📊 Min Latency: ${minLatency}ms`);
      console.log(`📊 Max Latency: ${maxLatency}ms`);
    }

    const connectionSuccessRate = (this.stats.successfulConnections / this.options.userCount) * 100;
    const messageSuccessRate = this.stats.totalMessages > 0 ? 
      (this.stats.successfulMessages / this.stats.totalMessages) * 100 : 0;

    console.log(`📊 Connection Success Rate: ${connectionSuccessRate.toFixed(2)}%`);
    console.log(`📊 Message Success Rate: ${messageSuccessRate.toFixed(2)}%`);

    // 性能评估
    console.log('');
    console.log('🎯 Performance Assessment');
    console.log('========================');
    
    if (connectionSuccessRate >= 95) {
      console.log('✅ Excellent: Connection success rate is very high');
    } else if (connectionSuccessRate >= 80) {
      console.log('⚠️  Good: Connection success rate is acceptable');
    } else {
      console.log('❌ Poor: Connection success rate needs improvement');
    }

    if (this.messages.length > 0 && this.messages.reduce((sum, latency) => sum + latency, 0) / this.messages.length < 200) {
      console.log('✅ Excellent: Message latency is very low');
    } else if (this.messages.length > 0 && this.messages.reduce((sum, latency) => sum + latency, 0) / this.messages.length < 500) {
      console.log('⚠️  Good: Message latency is acceptable');
    } else {
      console.log('❌ Poor: Message latency is too high');
    }

    if (this.stats.totalConnections >= this.options.userCount * 0.9) {
      console.log('✅ Excellent: System can handle target user load');
    } else if (this.stats.totalConnections >= this.options.userCount * 0.7) {
      console.log('⚠️  Good: System can handle most of target user load');
    } else {
      console.log('❌ Poor: System cannot handle target user load');
    }
  }
}

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

// 主函数
async function main() {
  const args = parseArgs();
  
  const test = new PerformanceTest({
    baseUrl: args.url || 'ws://localhost:3000/api/websocket',
    sessionId: args.session || `test-session-${Date.now()}`,
    userCount: parseInt(args.users) || 12,
    testDuration: parseInt(args.duration) || 60000,
    heartbeatInterval: parseInt(args.heartbeat) || 25000
  });

  try {
    await test.start();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = PerformanceTest; 