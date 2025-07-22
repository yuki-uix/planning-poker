const Redis = require('ioredis');

async function testRedisConnection() {
  console.log('Testing Redis connection...');
  console.log('Environment variables:');
  console.log('REDIS_HOST:', process.env.REDIS_HOST);
  console.log('REDIS_PORT:', process.env.REDIS_PORT);
  console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '***' : 'undefined');
  
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: true,
    enableReadyCheck: true,
    connectTimeout: 15000,
    commandTimeout: 10000,
    keepAlive: 30000,
    family: 4,
    // 添加TLS支持
    tls: process.env.REDIS_HOST && process.env.REDIS_HOST.includes('upstash.io') ? {} : undefined,
    // 增加重试次数
    maxRetriesPerRequest: 5,
    retryDelayOnFailover: 100,
    // 添加重连配置
    reconnectOnError: (err) => {
      console.log('Redis reconnect on error:', err.message);
      return true;
    },
  });

  try {
    console.log('Attempting to connect to Redis...');
    await redis.ping();
    console.log('✅ Redis connection successful!');
    
    // Test basic operations
    const testKey = 'test:connection';
    const testValue = 'test-value-' + Date.now();
    
    await redis.set(testKey, testValue);
    console.log('✅ Redis SET operation successful');
    
    const retrievedValue = await redis.get(testKey);
    console.log('✅ Redis GET operation successful');
    console.log('Retrieved value:', retrievedValue);
    
    await redis.del(testKey);
    console.log('✅ Redis DEL operation successful');
    
    // Test session creation
    const sessionId = 'test-session-' + Date.now();
    const sessionData = {
      id: sessionId,
      users: [{
        id: 'test-user',
        name: 'Test User',
        role: 'host',
        vote: null,
        hasVoted: false,
        lastSeen: Date.now()
      }],
      revealed: false,
      votes: {},
      createdAt: Date.now(),
      hostId: 'test-user',
      template: {
        type: 'fibonacci',
        customCards: '☕️,1,2,3,5,8,13'
      }
    };
    
    await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(sessionData));
    console.log('✅ Session creation test successful');
    
    const retrievedSession = await redis.get(`session:${sessionId}`);
    console.log('✅ Session retrieval test successful');
    
    await redis.del(`session:${sessionId}`);
    console.log('✅ Session cleanup test successful');
    
    console.log('🎉 All Redis tests passed!');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port
    });
  } finally {
    await redis.quit();
    console.log('Redis connection closed');
  }
}

// Load environment variables if .env file exists
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using system environment variables');
}

testRedisConnection(); 