const Redis = require('ioredis');

async function testSessionCreation() {
  console.log('Testing session creation...');
  
  const redis = new Redis({
    host: 'gusc1-present-ocelot-32222.upstash.io',
    port: 32222,
    password: '371e40c0e23147338b9cd399a2ae6b49',
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: true,
    enableReadyCheck: true,
    connectTimeout: 15000,
    commandTimeout: 10000,
    keepAlive: 30000,
    family: 4,
    tls: {},
  });

  try {
    console.log('Connecting to Redis...');
    await redis.ping();
    console.log('✅ Redis connection successful!');
    
    // Test session creation
    const sessionId = 'test-session-' + Date.now();
    const userId = 'test-user-' + Date.now();
    const userName = 'Test User';
    
    const sessionData = {
      id: sessionId,
      users: [{
        id: userId,
        name: userName,
        role: 'host',
        vote: null,
        hasVoted: false,
        lastSeen: Date.now()
      }],
      revealed: false,
      votes: {},
      createdAt: Date.now(),
      hostId: userId,
      template: {
        type: 'fibonacci',
        customCards: '☕️,1,2,3,5,8,13'
      }
    };
    
    console.log('Creating session...');
    await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(sessionData));
    console.log('✅ Session created successfully!');
    
    // Test session retrieval
    console.log('Retrieving session...');
    const retrievedSessionData = await redis.get(`session:${sessionId}`);
    const retrievedSession = JSON.parse(retrievedSessionData);
    console.log('✅ Session retrieved successfully!');
    console.log('Session ID:', retrievedSession.id);
    console.log('Host user:', retrievedSession.users[0].name);
    
    // Cleanup
    await redis.del(`session:${sessionId}`);
    console.log('✅ Session cleaned up successfully!');
    
    console.log('🎉 All session creation tests passed!');
    
  } catch (error) {
    console.error('❌ Session creation test failed:', error);
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

testSessionCreation(); 