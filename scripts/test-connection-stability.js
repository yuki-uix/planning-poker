#!/usr/bin/env node

/**
 * 连接稳定性测试脚本
 * 用于测试连接断开和重连的稳定性
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class ConnectionStabilityTest {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.testResults = [];
    this.currentTest = 0;
  }

  // 测试SSE连接稳定性
  async testSSEStability(duration = 60000) {
    console.log(`🔍 测试SSE连接稳定性 (${duration/1000}秒)`);
    
    const startTime = Date.now();
    const url = `${this.baseUrl}/api/sse?sessionId=test&userId=test`;
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    return new Promise((resolve) => {
      const req = client.get(url, (res) => {
        let data = '';
        let messageCount = 0;
        let lastMessageTime = Date.now();
        
        res.on('data', chunk => {
          data += chunk;
          const lines = data.split('\n');
          data = lines.pop(); // 保留不完整的行
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              messageCount++;
              lastMessageTime = Date.now();
            }
          }
        });
        
        res.on('end', () => {
          const endTime = Date.now();
          const testDuration = endTime - startTime;
          
          this.testResults.push({
            type: 'SSE',
            duration: testDuration,
            messageCount,
            lastMessageTime: endTime - lastMessageTime,
            success: true
          });
          
          console.log(`✅ SSE测试完成: ${messageCount}条消息, 持续${testDuration}ms`);
          resolve();
        });
      });
      
      req.on('error', (error) => {
        const endTime = Date.now();
        this.testResults.push({
          type: 'SSE',
          duration: endTime - startTime,
          error: error.message,
          success: false
        });
        
        console.log(`❌ SSE测试失败: ${error.message}`);
        resolve();
      });
      
      req.setTimeout(duration, () => {
        req.destroy();
        const endTime = Date.now();
        this.testResults.push({
          type: 'SSE',
          duration: endTime - startTime,
          error: 'Timeout',
          success: false
        });
        
        console.log(`⏰ SSE测试超时`);
        resolve();
      });
    });
  }

  // 测试HTTP轮询稳定性
  async testHttpPollStability(iterations = 30) {
    console.log(`🔍 测试HTTP轮询稳定性 (${iterations}次)`);
    
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const response = await this.makeHttpRequest(`${this.baseUrl}/api/session/test`);
        if (response.status === 200 || response.status === 404) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
      
      // 等待2秒
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const endTime = Date.now();
    const testDuration = endTime - startTime;
    
    this.testResults.push({
      type: 'HTTP Poll',
      duration: testDuration,
      iterations,
      successCount,
      errorCount,
      successRate: successCount / iterations * 100,
      success: errorCount === 0
    });
    
    console.log(`✅ HTTP轮询测试完成: ${successCount}/${iterations} 成功 (${(successCount/iterations*100).toFixed(1)}%)`);
  }

  // 测试健康检查
  async testHealthCheck() {
    console.log(`🔍 测试健康检查`);
    
    try {
      const response = await this.makeHttpRequest(`${this.baseUrl}/api/stats`);
      
      this.testResults.push({
        type: 'Health Check',
        duration: 0,
        status: response.status,
        success: response.status === 200
      });
      
      console.log(`✅ 健康检查: ${response.status}`);
    } catch (error) {
      this.testResults.push({
        type: 'Health Check',
        duration: 0,
        error: error.message,
        success: false
      });
      
      console.log(`❌ 健康检查失败: ${error.message}`);
    }
  }

  // 测试连接稳定性监控
  async testStabilityMonitoring() {
    console.log(`🔍 测试连接稳定性监控`);
    
    try {
      const response = await this.makeHttpRequest(`${this.baseUrl}/api/debug/stability`);
      
      this.testResults.push({
        type: 'Stability Monitoring',
        duration: 0,
        status: response.status,
        success: response.status === 200
      });
      
      console.log(`✅ 稳定性监控: ${response.status}`);
    } catch (error) {
      this.testResults.push({
        type: 'Stability Monitoring',
        duration: 0,
        error: error.message,
        success: false
      });
      
      console.log(`❌ 稳定性监控失败: ${error.message}`);
    }
  }

  // 发送HTTP请求
  makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));
    });
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🚀 开始连接稳定性测试');
    console.log('='.repeat(50));
    console.log(`基础URL: ${this.baseUrl}`);
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log('');

    await this.testHealthCheck();
    await this.testStabilityMonitoring();
    await this.testHttpPollStability();
    await this.testSSEStability(30000); // 30秒SSE测试

    console.log('');
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.type}: ${result.success ? '通过' : '失败'}`);
      
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
      
      if (result.duration) {
        console.log(`   耗时: ${result.duration}ms`);
      }
      
      if (result.successRate !== undefined) {
        console.log(`   成功率: ${result.successRate.toFixed(1)}%`);
      }
    });

    const overallSuccess = this.testResults.every(r => r.success);
    console.log('');
    console.log(overallSuccess ? '🎉 所有测试通过！' : '⚠️  部分测试失败');
  }
}

// 主函数
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  
  const tester = new ConnectionStabilityTest(baseUrl);
  await tester.runAllTests();
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  });
}

module.exports = { ConnectionStabilityTest }; 