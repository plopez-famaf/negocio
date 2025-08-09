#!/usr/bin/env node

/**
 * Real-time Performance Monitoring Dashboard
 * Continuously monitors system performance and displays live metrics
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:3002',
  refreshInterval: 5000, // 5 seconds
  historyLength: 20,     // Keep last 20 data points
  alertThresholds: {
    apiResponseTime: 200,   // ms
    memoryUsage: 400,       // MB
    cpuUsage: 80,          // percentage
    cacheHitRate: 70,      // percentage
    errorRate: 5           // per minute
  }
};

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      timestamp: [],
      apiResponseTime: [],
      memoryUsage: [],
      heapUsage: [],
      redisHitRate: [],
      redisResponseTime: [],
      requestCount: [],
      errorCount: [],
      uptime: [],
      connections: []
    };
    
    this.alerts = [];
    this.isRunning = false;
    this.intervalId = null;
  }

  async collectMetrics() {
    const timestamp = new Date().toISOString();
    const startTime = performance.now();
    
    try {
      // Collect health data
      const healthResponse = await axios.get(`${CONFIG.baseUrl}/health/detailed`, {
        timeout: 5000
      });
      const apiResponseTime = performance.now() - startTime;
      
      const healthData = healthResponse.data;
      
      // Extract metrics
      const memoryUsageMB = healthData.memory.rss / 1024 / 1024;
      const heapUsageMB = healthData.memory.heapUsed / 1024 / 1024;
      const uptime = healthData.uptime;
      
      // Redis specific metrics
      let redisHitRate = 0;
      let redisResponseTime = 0;
      
      if (healthData.components?.redis) {
        redisHitRate = healthData.components.redis.cache?.hitRate || 0;
        redisResponseTime = healthData.components.redis.connection?.responseTime || 0;
      }
      
      // Add to metrics history
      this.addMetric('timestamp', timestamp);
      this.addMetric('apiResponseTime', apiResponseTime);
      this.addMetric('memoryUsage', memoryUsageMB);
      this.addMetric('heapUsage', heapUsageMB);
      this.addMetric('redisHitRate', redisHitRate);
      this.addMetric('redisResponseTime', redisResponseTime);
      this.addMetric('uptime', uptime);
      
      // Check for alerts
      this.checkAlerts({
        apiResponseTime,
        memoryUsage: memoryUsageMB,
        redisHitRate
      });
      
      return {
        success: true,
        timestamp,
        apiResponseTime,
        memoryUsage: memoryUsageMB,
        heapUsage: heapUsageMB,
        redisHitRate,
        redisResponseTime,
        uptime
      };
      
    } catch (error) {
      // Record error metric
      this.addMetric('timestamp', timestamp);
      this.addMetric('errorCount', 1);
      
      this.alerts.push({
        type: 'error',
        message: `Health check failed: ${error.message}`,
        timestamp,
        severity: 'high'
      });
      
      return {
        success: false,
        error: error.message,
        timestamp
      };
    }
  }

  addMetric(key, value) {
    this.metrics[key].push(value);
    
    // Keep only recent history
    if (this.metrics[key].length > CONFIG.historyLength) {
      this.metrics[key].shift();
    }
  }

  checkAlerts(currentMetrics) {
    const now = new Date().toISOString();
    
    // API Response Time Alert
    if (currentMetrics.apiResponseTime > CONFIG.alertThresholds.apiResponseTime) {
      this.alerts.push({
        type: 'performance',
        message: `High API response time: ${currentMetrics.apiResponseTime.toFixed(2)}ms (threshold: ${CONFIG.alertThresholds.apiResponseTime}ms)`,
        timestamp: now,
        severity: 'medium'
      });
    }
    
    // Memory Usage Alert  
    if (currentMetrics.memoryUsage > CONFIG.alertThresholds.memoryUsage) {
      this.alerts.push({
        type: 'resource',
        message: `High memory usage: ${currentMetrics.memoryUsage.toFixed(1)}MB (threshold: ${CONFIG.alertThresholds.memoryUsage}MB)`,
        timestamp: now,
        severity: 'high'
      });
    }
    
    // Cache Hit Rate Alert
    if (currentMetrics.redisHitRate < CONFIG.alertThresholds.cacheHitRate) {
      this.alerts.push({
        type: 'cache',
        message: `Low cache hit rate: ${currentMetrics.redisHitRate.toFixed(1)}% (threshold: ≥${CONFIG.alertThresholds.cacheHitRate}%)`,
        timestamp: now,
        severity: 'low'
      });
    }
    
    // Keep only recent alerts (last 50)
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  calculateTrends() {
    const trends = {};
    
    // Calculate trends for key metrics
    const metricsToAnalyze = ['apiResponseTime', 'memoryUsage', 'redisHitRate'];
    
    metricsToAnalyze.forEach(metric => {
      const values = this.metrics[metric];
      if (values.length >= 2) {
        const recent = values.slice(-5);  // Last 5 values
        const older = values.slice(-10, -5); // Previous 5 values
        
        if (recent.length > 0 && older.length > 0) {
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
          
          const change = ((recentAvg - olderAvg) / olderAvg) * 100;
          
          trends[metric] = {
            current: recentAvg,
            change: change,
            direction: change > 5 ? '↗️' : change < -5 ? '↘️' : '→'
          };
        }
      }
    });
    
    return trends;
  }

  generateSparkline(values, width = 20) {
    if (values.length < 2) return '─'.repeat(width);
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    const chars = ['_', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    return values.slice(-width).map(value => {
      const normalized = (value - min) / range;
      const charIndex = Math.floor(normalized * (chars.length - 1));
      return chars[charIndex];
    }).join('');
  }

  displayDashboard() {
    // Clear console
    console.clear();
    
    const latestMetrics = this.getLatestMetrics();
    const trends = this.calculateTrends();
    const recentAlerts = this.alerts.slice(-5);
    
    console.log('🖥️  THREATGUARD PERFORMANCE DASHBOARD');
    console.log('================================================================');
    console.log(`📊 System Status: ${latestMetrics.success ? '🟢 HEALTHY' : '🔴 UNHEALTHY'}`);
    console.log(`🕐 Last Update: ${new Date().toLocaleTimeString()}`);
    console.log(`⚡ Refresh Rate: ${CONFIG.refreshInterval / 1000}s`);
    console.log('================================================================\n');

    if (latestMetrics.success) {
      // Core Performance Metrics
      console.log('📈 CORE PERFORMANCE METRICS:');
      console.log(`┌─────────────────────────┬─────────────┬─────────────┬─────────────┐`);
      console.log(`│ Metric                  │ Current     │ Trend       │ Sparkline   │`);
      console.log(`├─────────────────────────┼─────────────┼─────────────┼─────────────┤`);
      
      const apiTime = latestMetrics.apiResponseTime?.toFixed(2) || '0.00';
      const apiTrend = trends.apiResponseTime?.direction || '→';
      const apiSparkline = this.generateSparkline(this.metrics.apiResponseTime, 12);
      console.log(`│ API Response Time       │ ${apiTime.padEnd(8)}ms │ ${apiTrend.padEnd(8)}   │ ${apiSparkline} │`);
      
      const memory = latestMetrics.memoryUsage?.toFixed(1) || '0.0';
      const memoryTrend = trends.memoryUsage?.direction || '→';  
      const memorySparkline = this.generateSparkline(this.metrics.memoryUsage, 12);
      console.log(`│ Memory Usage            │ ${memory.padEnd(8)}MB │ ${memoryTrend.padEnd(8)}   │ ${memorySparkline} │`);
      
      const heap = latestMetrics.heapUsage?.toFixed(1) || '0.0';
      const heapSparkline = this.generateSparkline(this.metrics.heapUsage, 12);
      console.log(`│ Heap Usage              │ ${heap.padEnd(8)}MB │ ${'→'.padEnd(8)}   │ ${heapSparkline} │`);
      
      console.log(`└─────────────────────────┴─────────────┴─────────────┴─────────────┘\n`);

      // Redis Performance 
      console.log('🗄️  REDIS PERFORMANCE:');
      console.log(`┌─────────────────────────┬─────────────┬─────────────┬─────────────┐`);
      console.log(`│ Metric                  │ Current     │ Trend       │ Sparkline   │`);
      console.log(`├─────────────────────────┼─────────────┼─────────────┼─────────────┤`);
      
      const hitRate = latestMetrics.redisHitRate?.toFixed(1) || '0.0';
      const hitRateTrend = trends.redisHitRate?.direction || '→';
      const hitRateSparkline = this.generateSparkline(this.metrics.redisHitRate, 12);
      console.log(`│ Cache Hit Rate          │ ${hitRate.padEnd(9)}% │ ${hitRateTrend.padEnd(8)}   │ ${hitRateSparkline} │`);
      
      const redisTime = latestMetrics.redisResponseTime?.toFixed(2) || '0.00';
      const redisSparkline = this.generateSparkline(this.metrics.redisResponseTime, 12);
      console.log(`│ Redis Response Time     │ ${redisTime.padEnd(8)}ms │ ${'→'.padEnd(8)}   │ ${redisSparkline} │`);
      
      console.log(`└─────────────────────────┴─────────────┴─────────────┴─────────────┘\n`);

      // System Information
      console.log('🖱️  SYSTEM INFORMATION:');
      console.log(`• Uptime: ${this.formatUptime(latestMetrics.uptime || 0)}`);
      console.log(`• Node.js Version: ${process.version}`);
      console.log(`• Platform: ${process.platform} ${process.arch}`);
      console.log(`• PID: ${process.pid}`);
      console.log('');

    } else {
      console.log('❌ SYSTEM UNAVAILABLE');
      console.log(`Error: ${latestMetrics.error}`);
      console.log('');
    }

    // Performance Thresholds Status
    console.log('🎯 PERFORMANCE THRESHOLDS:');
    const apiStatus = (latestMetrics.apiResponseTime || 0) <= CONFIG.alertThresholds.apiResponseTime ? '✅' : '❌';
    const memoryStatus = (latestMetrics.memoryUsage || 0) <= CONFIG.alertThresholds.memoryUsage ? '✅' : '❌';
    const cacheStatus = (latestMetrics.redisHitRate || 0) >= CONFIG.alertThresholds.cacheHitRate ? '✅' : '❌';
    
    console.log(`${apiStatus} API Response Time: <${CONFIG.alertThresholds.apiResponseTime}ms`);
    console.log(`${memoryStatus} Memory Usage: <${CONFIG.alertThresholds.memoryUsage}MB`);
    console.log(`${cacheStatus} Cache Hit Rate: ≥${CONFIG.alertThresholds.cacheHitRate}%\n`);

    // Recent Alerts
    if (recentAlerts.length > 0) {
      console.log('🚨 RECENT ALERTS:');
      recentAlerts.reverse().forEach(alert => {
        const severity = alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🟠';
        const time = new Date(alert.timestamp).toLocaleTimeString();
        console.log(`${severity} [${time}] ${alert.message}`);
      });
      console.log('');
    }

    // Footer
    console.log('================================================================');
    console.log('Press Ctrl+C to stop monitoring');
  }

  getLatestMetrics() {
    const latest = {};
    
    Object.keys(this.metrics).forEach(key => {
      const values = this.metrics[key];
      if (values.length > 0) {
        latest[key] = values[values.length - 1];
      }
    });
    
    // Set success status
    latest.success = !latest.error;
    
    return latest;
  }

  formatUptime(uptimeSeconds) {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async start() {
    console.log('🚀 Starting ThreatGuard Performance Monitor...');
    console.log('================================================================\n');
    
    this.isRunning = true;
    
    // Initial metrics collection
    await this.collectMetrics();
    this.displayDashboard();
    
    // Set up periodic updates
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.collectMetrics();
        this.displayDashboard();
      }
    }, CONFIG.refreshInterval);
  }

  stop() {
    console.log('\n\n🛑 Stopping Performance Monitor...');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Generate summary report
    this.generateSummaryReport();
    
    console.log('✅ Performance monitor stopped');
    process.exit(0);
  }

  generateSummaryReport() {
    console.log('\n📊 MONITORING SESSION SUMMARY');
    console.log('================================================================');
    
    if (this.metrics.apiResponseTime.length > 0) {
      const avgResponseTime = this.metrics.apiResponseTime.reduce((sum, time) => sum + time, 0) / this.metrics.apiResponseTime.length;
      const maxResponseTime = Math.max(...this.metrics.apiResponseTime);
      const minResponseTime = Math.min(...this.metrics.apiResponseTime);
      
      console.log(`📈 API Performance:`);
      console.log(`   • Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   • Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`   • Min Response Time: ${minResponseTime.toFixed(2)}ms`);
    }
    
    if (this.metrics.memoryUsage.length > 0) {
      const avgMemory = this.metrics.memoryUsage.reduce((sum, mem) => sum + mem, 0) / this.metrics.memoryUsage.length;
      const maxMemory = Math.max(...this.metrics.memoryUsage);
      
      console.log(`🧠 Memory Usage:`);
      console.log(`   • Average Memory: ${avgMemory.toFixed(1)}MB`);
      console.log(`   • Peak Memory: ${maxMemory.toFixed(1)}MB`);
    }
    
    if (this.metrics.redisHitRate.length > 0) {
      const avgHitRate = this.metrics.redisHitRate.reduce((sum, rate) => sum + rate, 0) / this.metrics.redisHitRate.length;
      
      console.log(`🗄️  Cache Performance:`);
      console.log(`   • Average Hit Rate: ${avgHitRate.toFixed(1)}%`);
    }
    
    console.log(`🚨 Total Alerts: ${this.alerts.length}`);
    
    const alertsBySeverity = this.alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(alertsBySeverity).forEach(([severity, count]) => {
      console.log(`   • ${severity}: ${count}`);
    });
    
    console.log('================================================================\n');
  }

  async testConnection() {
    console.log('🔄 Testing connection to ThreatGuard service...');
    
    try {
      const response = await axios.get(`${CONFIG.baseUrl}/health`, { timeout: 5000 });
      console.log(`✅ Connection successful`);
      console.log(`   Service: ${response.data.service}`);
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Version: ${response.data.version}`);
      return true;
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      console.log(`   Make sure the service is running on ${CONFIG.baseUrl}`);
      return false;
    }
  }
}

// Run performance monitor if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
  });
  
  process.on('SIGTERM', () => {
    monitor.stop();
  });
  
  // Test connection and start monitoring
  monitor.testConnection()
    .then(connected => {
      if (connected) {
        monitor.start();
      } else {
        console.log('\n💡 Start the ThreatGuard service first:');
        console.log('   cd bg-identity-ai && npm run dev');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Failed to start performance monitor:', error);
      process.exit(1);
    });
}

module.exports = PerformanceMonitor;