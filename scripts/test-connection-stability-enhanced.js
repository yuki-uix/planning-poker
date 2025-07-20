#!/usr/bin/env node

/**
 * 增强的连接稳定性测试脚本
 * 测试自适应心跳、智能重连和连接质量监控功能
 */

const https = require('https');
const http = require('http');

class EnhancedConnectionTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageResponseTime: 0,
      qualityMetrics: [],
      connectionStability: 0,
      recommendations: []
    };
  }

  // 发送HTTP请求
  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const startTime = Date.now();
      
      const req = client.request(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: options.timeout || 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          resolve({
            status: res.statusCode,
            data: data,
            responseTime,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        });
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        reject({ error, responseTime, success: false });
      });

      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        reject({ error: new Error('Request timeout'), responseTime, success: false });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  // 测试连接稳定性
  async testConnectionStability(iterations = 50, interval = 1000) {
    console.log(`\n🔍 开始连接稳定性测试 (${iterations}次, 间隔${interval}ms)`);
    console.log(`目标URL: ${this.baseUrl}`);
    
    const startTime = Date.now();
    const testResults = [];

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await this.makeRequest('/api/debug/connection');
        testResults.push({
          iteration: i + 1,
          success: result.success,
          responseTime: result.responseTime,
          status: result.status,
          timestamp: Date.now()
        });

        if (result.success) {
          process.stdout.write('✅');
        } else {
          process.stdout.write('❌');
        }

        // 每10次测试显示进度
        if ((i + 1) % 10 === 0) {
          console.log(` (${i + 1}/${iterations})`);
        }

        // 等待间隔时间
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        testResults.push({
          iteration: i + 1,
          success: false,
          responseTime: error.responseTime || 0,
          status: 0,
          error: error.error?.message || 'Unknown error',
          timestamp: Date.now()
        });
        process.stdout.write('❌');
      }
    }

    console.log('\n');
    return this.analyzeResults(testResults, startTime);
  }

  // 测试质量监控API
  async testQualityMonitoring() {
    console.log('\n📊 测试质量监控API...');
    
    try {
      const result = await this.makeRequest('/api/debug/quality');
      if (result.success) {
        const data = JSON.parse(result.data);
        console.log('✅ 质量监控API正常');
        return data.data;
      } else {
        console.log('❌ 质量监控API失败');
        return null;
      }
    } catch (error) {
      console.log('❌ 质量监控API错误:', error.error?.message);
      return null;
    }
  }

  // 测试稳定性监控API
  async testStabilityMonitoring() {
    console.log('\n📈 测试稳定性监控API...');
    
    try {
      const result = await this.makeRequest('/api/debug/stability');
      if (result.success) {
        const data = JSON.parse(result.data);
        console.log('✅ 稳定性监控API正常');
        return data;
      } else {
        console.log('❌ 稳定性监控API失败');
        return null;
      }
    } catch (error) {
      console.log('❌ 稳定性监控API错误:', error.error?.message);
      return null;
    }
  }

  // 分析测试结果
  analyzeResults(testResults, startTime) {
    const totalTests = testResults.length;
    const successfulTests = testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = (successfulTests / totalTests) * 100;
    
    const responseTimes = testResults.filter(r => r.success).map(r => r.responseTime);
    const averageResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    // 计算连接稳定性评分
    const consecutiveFailures = this.calculateConsecutiveFailures(testResults);
    const stabilityScore = Math.max(0, 100 - (consecutiveFailures * 10));
    
    // 生成建议
    const recommendations = this.generateRecommendations(successRate, averageResponseTime, consecutiveFailures);

    const results = {
      totalTests,
      successfulTests,
      failedTests,
      successRate: successRate.toFixed(2),
      averageResponseTime: averageResponseTime.toFixed(0),
      minResponseTime,
      maxResponseTime,
      consecutiveFailures,
      connectionStability: stabilityScore.toFixed(1),
      recommendations,
      testDuration: Date.now() - startTime,
      qualityMetrics: testResults
    };

    return results;
  }

  // 计算连续失败次数
  calculateConsecutiveFailures(testResults) {
    let maxConsecutiveFailures = 0;
    let currentConsecutiveFailures = 0;
    
    for (const result of testResults) {
      if (!result.success) {
        currentConsecutiveFailures++;
        maxConsecutiveFailures = Math.max(maxConsecutiveFailures, currentConsecutiveFailures);
      } else {
        currentConsecutiveFailures = 0;
      }
    }
    
    return maxConsecutiveFailures;
  }

  // 生成建议
  generateRecommendations(successRate, averageResponseTime, consecutiveFailures) {
    const recommendations = [];
    
    if (successRate < 90) {
      recommendations.push('⚠️ 连接成功率较低，建议检查网络环境或服务器状态');
    }
    
    if (averageResponseTime > 2000) {
      recommendations.push('⚠️ 平均响应时间较高，建议优化网络连接或服务器性能');
    }
    
    if (consecutiveFailures > 3) {
      recommendations.push('⚠️ 连续失败次数较多，建议启用自适应重连机制');
    }
    
    if (successRate >= 95 && averageResponseTime < 1000 && consecutiveFailures <= 1) {
      recommendations.push('✅ 连接质量优秀，可以启用更积极的连接策略');
    }
    
    return recommendations;
  }

  // 显示测试结果
  displayResults(results) {
    console.log('\n📋 测试结果汇总');
    console.log('='.repeat(50));
    console.log(`总测试次数: ${results.totalTests}`);
    console.log(`成功次数: ${results.successfulTests}`);
    console.log(`失败次数: ${results.failedTests}`);
    console.log(`成功率: ${results.successRate}%`);
    console.log(`平均响应时间: ${results.averageResponseTime}ms`);
    console.log(`最小响应时间: ${results.minResponseTime}ms`);
    console.log(`最大响应时间: ${results.maxResponseTime}ms`);
    console.log(`最大连续失败: ${results.consecutiveFailures}次`);
    console.log(`连接稳定性评分: ${results.connectionStability}/100`);
    console.log(`测试持续时间: ${results.testDuration}ms`);
    
    if (results.recommendations.length > 0) {
      console.log('\n💡 建议:');
      results.recommendations.forEach(rec => console.log(rec));
    }
  }

  // 运行完整测试套件
  async runFullTest() {
    console.log('🚀 增强连接稳定性测试套件');
    console.log('='.repeat(50));
    
    // 测试基本连接
    const connectionResults = await this.testConnectionStability(30, 500);
    
    // 测试质量监控
    const qualityData = await this.testQualityMonitoring();
    
    // 测试稳定性监控
    const stabilityData = await this.testStabilityMonitoring();
    
    // 显示结果
    this.displayResults(connectionResults);
    
    // 显示质量监控数据
    if (qualityData) {
      console.log('\n📊 质量监控数据:');
      console.log('='.repeat(30));
      if (qualityData.quality) {
        console.log(`连接质量评分: ${(qualityData.quality.connectionStability * 100).toFixed(1)}%`);
        console.log(`建议连接类型: ${qualityData.quality.qualityReport?.suggestedConnectionType || 'N/A'}`);
      }
      if (qualityData.heartbeat) {
        console.log(`网络质量: ${(qualityData.heartbeat.networkQuality * 100).toFixed(1)}%`);
        console.log(`心跳间隔: ${qualityData.heartbeat.currentInterval}ms`);
      }
    }
    
    // 显示稳定性数据
    if (stabilityData) {
      console.log('\n📈 稳定性监控数据:');
      console.log('='.repeat(30));
      console.log(`总断开次数: ${stabilityData.totalDisconnections || 0}`);
      console.log(`最近断开次数: ${stabilityData.recentDisconnections || 0}`);
      console.log(`成功率: ${stabilityData.successRate || 'N/A'}%`);
    }
    
    console.log('\n✅ 测试完成');
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  
  const tester = new EnhancedConnectionTester(baseUrl);
  await tester.runFullTest();
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnhancedConnectionTester; 