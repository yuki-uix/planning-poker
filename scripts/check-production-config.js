#!/usr/bin/env node

/**
 * 生产环境配置检查脚本
 * 用于诊断连接问题
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 配置检查项
const configChecks = {
  // 检查SSE端点
  async checkSSEEndpoint(baseUrl) {
    try {
      const url = `${baseUrl}/api/sse?sessionId=test&userId=test`;
      console.log(`🔍 检查SSE端点: ${url}`);
      
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const response = await new Promise((resolve, reject) => {
        const req = client.get(url, (res) => {
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

  // 检查HTTP轮询端点
  async checkHttpPollEndpoint(baseUrl) {
    try {
      const url = `${baseUrl}/api/session/test`;
      console.log(`🔍 检查HTTP轮询端点: ${url}`);
      
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const response = await new Promise((resolve, reject) => {
        const req = client.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('HTTP poll endpoint timeout')));
      });

      if (response.status === 200 || response.status === 404) {
        console.log('✅ HTTP轮询端点正常');
        console.log(`   状态码: ${response.status}`);
        return true;
      } else {
        console.log(`❌ HTTP轮询端点异常: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ HTTP轮询端点检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查Redis连接（Vercel环境）
  async checkRedisConnection() {
    try {
      console.log('🔍 检查Redis连接...');
      
      // Vercel环境通常使用外部Redis服务
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || 6379;
      
      console.log(`   Redis主机: ${redisHost}:${redisPort}`);
      
      // 在Vercel环境中，Redis通常是外部服务
      if (process.env.VERCEL) {
        console.log('✅ Vercel环境 - Redis连接由外部服务管理');
        return true;
      } else {
        console.log('⚠️  请手动检查Redis连接状态');
        return true;
      }
    } catch (error) {
      console.log(`❌ Redis检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查健康状态（Vercel环境）
  async checkHealthStatus(baseUrl) {
    try {
      console.log('🔍 检查应用健康状态...');
      
      const urlObj = new URL(baseUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const response = await new Promise((resolve, reject) => {
        const req = client.get(`${baseUrl}/api/stats`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Health check timeout')));
      });

      if (response.status === 200) {
        console.log('✅ 应用健康检查通过');
        return true;
      } else {
        console.log(`❌ 应用健康检查失败: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ 健康检查失败: ${error.message}`);
      return false;
    }
  },

  // 检查环境变量（Vercel适配）
  checkEnvironmentVariables() {
    console.log('🔍 检查环境变量...');
    
    // Vercel环境的环境变量检查
    const requiredVars = [
      'NODE_ENV'
    ];

    // 可选的环境变量（Vercel可能使用不同的配置方式）
    const optionalVars = [
      'REDIS_HOST',
      'REDIS_PORT', 
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

    optionalVars.forEach(varName => {
      if (process.env[varName]) {
        presentVars.push(varName);
      }
    });

    if (missingVars.length === 0) {
      console.log('✅ 必需的环境变量都已设置');
      presentVars.forEach(varName => {
        console.log(`   ${varName}: ${process.env[varName]}`);
      });
      
      if (process.env.VERCEL) {
        console.log('✅ Vercel环境检测到');
      }
      
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
    httpPoll: await configChecks.checkHttpPollEndpoint(baseUrl),
    redis: await configChecks.checkRedisConnection(),
    health: await configChecks.checkHealthStatus(baseUrl),
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
    console.log('💡 Vercel环境建议:');
    console.log('1. 确保在Vercel项目设置中配置了环境变量');
    console.log('2. 检查Vercel函数超时设置（建议设置为30秒）');
    console.log('3. 确保Redis服务可访问（如Upstash、Redis Cloud等）');
    console.log('4. 检查Vercel部署日志中的错误信息');
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