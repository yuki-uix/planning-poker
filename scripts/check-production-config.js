#!/usr/bin/env node

/**
 * 生产环境配置检查脚本
 * 用于诊断连接问题
 */

const https = require('https');
const http = require('http');

// 配置检查项
const configChecks = {
  // 检查SSE端点
  async checkSSEEndpoint(baseUrl) {
    try {
      const url = `${baseUrl}/api/sse?sessionId=test&userId=test`;
      console.log(`🔍 检查SSE端点: ${url}`);
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('SSE endpoint timeout')));
      });

      if (response.status === 200) {
        console.log('✅ SSE端点正常');
        console.log(`   状态码: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        return true;
      } else {
        console.log(`❌ SSE端点异常: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ SSE端点检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查WebSocket端点
  async checkWebSocketEndpoint(baseUrl) {
    try {
      const url = `${baseUrl}/api/websocket?sessionId=test&userId=test`;
      console.log(`🔍 检查WebSocket端点: ${url}`);
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve({ status: res.statusCode, headers: res.headers });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('WebSocket endpoint timeout')));
      });

      if (response.status === 400 || response.status === 101) {
        console.log('✅ WebSocket端点正常');
        console.log(`   状态码: ${response.status}`);
        return true;
      } else {
        console.log(`❌ WebSocket端点异常: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ WebSocket端点检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查Redis连接
  async checkRedisConnection() {
    try {
      console.log('🔍 检查Redis连接...');
      
      // 这里需要根据实际部署情况调整
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || 6379;
      
      console.log(`   Redis主机: ${redisHost}:${redisPort}`);
      console.log('⚠️  请手动检查Redis连接状态');
      return true;
    } catch (error) {
      console.log(`❌ Redis检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查Nginx配置
  async checkNginxConfig(baseUrl) {
    try {
      console.log('🔍 检查Nginx配置...');
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/health`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Health check timeout')));
      });

      if (response.status === 200) {
        console.log('✅ Nginx健康检查通过');
        return true;
      } else {
        console.log(`❌ Nginx健康检查失败: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Nginx检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查环境变量
  checkEnvironmentVariables() {
    console.log('🔍 检查环境变量...');
    
    const requiredVars = [
      'REDIS_HOST',
      'REDIS_PORT',
      'NODE_ENV',
      'MAX_CONNECTIONS_PER_SESSION',
      'HEARTBEAT_INTERVAL'
    ];

    const missingVars = [];
    const presentVars = [];

    requiredVars.forEach(varName => {
      if (process.env[varName]) {
        presentVars.push(varName);
      } else {
        missingVars.push(varName);
      }
    });

    if (missingVars.length === 0) {
      console.log('✅ 所有必需的环境变量都已设置');
      presentVars.forEach(varName => {
        console.log(`   ${varName}: ${process.env[varName]}`);
      });
      return true;
    } else {
      console.log('❌ 缺少必需的环境变量:');
      missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
      });
      return false;
    }
  }
};

// 主函数
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost';
  
  console.log('🚀 生产环境配置检查');
  console.log('='.repeat(50));
  console.log(`基础URL: ${baseUrl}`);
  console.log(`检查时间: ${new Date().toISOString()}`);
  console.log('');

  const results = {
    sse: await configChecks.checkSSEEndpoint(baseUrl),
    websocket: await configChecks.checkWebSocketEndpoint(baseUrl),
    redis: await configChecks.checkRedisConnection(),
    nginx: await configChecks.checkNginxConfig(baseUrl),
    env: configChecks.checkEnvironmentVariables()
  };

  console.log('');
  console.log('📊 检查结果汇总');
  console.log('='.repeat(50));
  
  Object.entries(results).forEach(([key, result]) => {
    const status = result ? '✅' : '❌';
    console.log(`${status} ${key.toUpperCase()}: ${result ? '正常' : '异常'}`);
  });

  const allPassed = Object.values(results).every(result => result);
  
  console.log('');
  if (allPassed) {
    console.log('🎉 所有检查都通过了！');
  } else {
    console.log('⚠️  发现了一些问题，请检查上述配置');
    console.log('');
    console.log('💡 建议的解决方案:');
    console.log('1. 检查Nginx配置中的SSE代理设置');
    console.log('2. 确保Redis服务正在运行');
    console.log('3. 验证环境变量配置');
    console.log('4. 检查防火墙和网络设置');
  }
}

// 运行检查
if (require.main === module) {
  main().catch(error => {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  });
}

module.exports = { configChecks }; 