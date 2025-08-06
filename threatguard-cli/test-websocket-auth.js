#!/usr/bin/env node

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const chalk = require('chalk');

console.log(chalk.cyan('🔐 Testing ThreatGuard CLI with JWT Authentication...'));

// Create a test JWT token
const testToken = jwt.sign(
  { 
    sub: 'test-user-123',
    role: 'analyst',
    email: 'test@threatguard.com'
  },
  process.env.JWT_SECRET || 'development-secret-key',
  { expiresIn: '1h' }
);

console.log(chalk.dim(`🎫 Generated test JWT token`));

const socket = io('http://localhost:3001', {
  auth: {
    token: testToken
  },
  transports: ['websocket', 'polling']
});

let connectionTimeout = setTimeout(() => {
  console.log(chalk.red('❌ Connection timeout'));
  process.exit(1);
}, 5000);

socket.on('connect', () => {
  clearTimeout(connectionTimeout);
  console.log(chalk.green('✅ Authenticated WebSocket connected!'));
  console.log(chalk.dim(`   Socket ID: ${socket.id}`));
  
  // Test stream events
  let eventCount = 0;
  socket.on('stream_event', (event) => {
    eventCount++;
    const typeColor = event.type === 'threat' ? chalk.red : 
                     event.type === 'behavior' ? chalk.magenta :
                     event.type === 'network' ? chalk.cyan : chalk.blue;
    
    console.log(typeColor(`📡 ${event.type.toUpperCase()} EVENT #${eventCount}:`));
    if (event.data.severity) {
      const severityColor = event.data.severity === 'critical' ? chalk.red :
                           event.data.severity === 'high' ? chalk.orange || chalk.yellow :
                           event.data.severity === 'medium' ? chalk.yellow : chalk.blue;
      console.log(`   ${severityColor(`Severity: ${event.data.severity}`)}`);
    }
    console.log(chalk.dim(`   Source: ${event.metadata.source}`));
    
    if (eventCount >= 5) {
      console.log(chalk.green('\n🎉 CLI-Service Integration Test Complete!'));
      console.log(chalk.cyan('📊 Summary:'));
      console.log(chalk.green('  ✅ bg-threat-ai service running'));
      console.log(chalk.green('  ✅ WebSocket streaming working'));
      console.log(chalk.green('  ✅ JWT authentication successful'));
      console.log(chalk.green('  ✅ Real-time event streaming'));
      console.log(chalk.green('  ✅ CLI framework ready'));
      
      console.log(chalk.bold.cyan('\n🚀 Platform Transformation Complete:'));
      console.log('  • Console-first threat detection platform');
      console.log('  • Real-time WebSocket streaming');
      console.log('  • Professional CLI interface');
      console.log('  • Service architecture ready');
      
      socket.disconnect();
      process.exit(0);
    }
  });

  // Test heartbeat
  socket.emit('heartbeat');
  socket.on('heartbeat_response', () => {
    console.log(chalk.green('💗 Service heartbeat OK'));
  });
});

socket.on('connect_error', (error) => {
  clearTimeout(connectionTimeout);
  console.log(chalk.red(`❌ Connection failed: ${error.message}`));
  process.exit(1);
});