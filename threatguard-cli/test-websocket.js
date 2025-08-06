#!/usr/bin/env node

const io = require('socket.io-client');
const chalk = require('chalk');

console.log(chalk.cyan('🔗 Testing ThreatGuard CLI WebSocket Connection...'));

// Test WebSocket connection to bg-threat-ai service
const socket = io('http://localhost:3001', {
  auth: {
    token: 'test-jwt-token-for-development'
  },
  transports: ['websocket', 'polling']
});

let connectionTimeout = setTimeout(() => {
  console.log(chalk.red('❌ Connection timeout - service may not be running'));
  console.log(chalk.yellow('💡 Make sure to start: cd bg-identity-ai && npm run dev'));
  process.exit(1);
}, 5000);

socket.on('connect', () => {
  clearTimeout(connectionTimeout);
  console.log(chalk.green('✅ WebSocket connected successfully!'));
  console.log(chalk.dim(`   Socket ID: ${socket.id}`));
  console.log(chalk.dim(`   Transport: ${socket.io.engine.transport.name}`));
  
  // Test stream event reception
  let eventCount = 0;
  socket.on('stream_event', (event) => {
    eventCount++;
    console.log(chalk.blue(`📡 Stream Event #${eventCount}:`));
    console.log(chalk.dim(`   Type: ${event.type}`));
    console.log(chalk.dim(`   Source: ${event.metadata.source}`));
    console.log(chalk.dim(`   Time: ${event.timestamp}`));
    
    if (eventCount >= 3) {
      console.log(chalk.green('\n✅ CLI WebSocket streaming test complete!'));
      console.log(chalk.cyan('🎯 Next: Implement full authentication & interactive UI'));
      socket.disconnect();
      process.exit(0);
    }
  });

  // Test heartbeat
  socket.emit('heartbeat');
  socket.on('heartbeat_response', (response) => {
    console.log(chalk.green('💗 Heartbeat successful'));
    console.log(chalk.dim(`   Status: ${response.status}`));
  });
});

socket.on('connect_error', (error) => {
  clearTimeout(connectionTimeout);
  console.log(chalk.red('❌ WebSocket connection failed'));
  console.log(chalk.red(`   Error: ${error.message}`));
  
  if (error.message.includes('xhr poll error')) {
    console.log(chalk.yellow('💡 Service might not be running. Start with:'));
    console.log(chalk.dim('   cd bg-identity-ai && npm run dev'));
  } else if (error.message.includes('Authentication failed')) {
    console.log(chalk.yellow('💡 Authentication error - this is expected without proper JWT'));
  }
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log(chalk.yellow(`🔌 Disconnected: ${reason}`));
});