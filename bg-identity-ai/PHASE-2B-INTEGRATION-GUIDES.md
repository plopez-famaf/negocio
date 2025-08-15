# Phase 2B Integration Guides

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Analytics Integration](#analytics-integration)
3. [ML Model Integration](#ml-model-integration)
4. [SIEM Integration](#siem-integration)
5. [Webhook Integration](#webhook-integration)
6. [Real-time Streaming](#real-time-streaming)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

## Quick Start Guide

### Prerequisites

- Valid API key for BG Threat AI platform
- HTTPS endpoint for webhook delivery (if using webhooks)
- Network access to platform APIs (port 443)

### 1. Authentication Setup

```bash
# Set environment variables
export BG_THREAT_API_KEY="your-api-key-here"
export BG_THREAT_BASE_URL="https://api.bg-threat.com"
```

### 2. Test Connectivity

```bash
# Test basic connectivity
curl -H "x-api-key: $BG_THREAT_API_KEY" \
     "$BG_THREAT_BASE_URL/health"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-15T14:30:00.000Z",
    "version": "2.0.1"
  }
}
```

### 3. Get Dashboard Overview

```bash
curl -H "x-api-key: $BG_THREAT_API_KEY" \
     "$BG_THREAT_BASE_URL/api/analytics/dashboard-metrics?includeRealtime=true"
```

## Analytics Integration

### Real-time Dashboard Integration

#### Step 1: Dashboard Metrics Polling

```python
import requests
import time
import json

class DashboardIntegration:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }
    
    def get_realtime_metrics(self):
        """Get real-time dashboard metrics"""
        url = f"{self.base_url}/api/analytics/dashboard-metrics"
        params = {
            'includeRealtime': True,
            'includePredictions': True
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def start_monitoring(self, interval=30):
        """Start real-time monitoring with specified interval"""
        while True:
            try:
                metrics = self.get_realtime_metrics()
                self.process_metrics(metrics['data'])
                time.sleep(interval)
            except Exception as e:
                print(f"Error fetching metrics: {e}")
                time.sleep(interval)
    
    def process_metrics(self, data):
        """Process and display metrics"""
        stats = data['realTimeStats']['currentPeriod']
        print(f"Total Threats: {stats['totalThreats']}")
        print(f"Critical: {stats['criticalThreats']}")
        print(f"High: {stats['highThreats']}")
        
        # Check for alerts
        alerts = data['alertSummary']
        if alerts['criticalAlerts'] > 0:
            print(f"⚠️  {alerts['criticalAlerts']} critical alerts!")

# Usage
dashboard = DashboardIntegration(api_key, base_url)
dashboard.start_monitoring(interval=30)  # Poll every 30 seconds
```

#### Step 2: Trend Analysis Integration

```python
def analyze_threat_trends(self, days_back=7):
    """Analyze threat trends over specified period"""
    from datetime import datetime, timedelta
    
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=days_back)
    
    url = f"{self.base_url}/api/analytics/trend-analysis"
    data = {
        'timeRange': {
            'start': start_time.isoformat() + 'Z',
            'end': end_time.isoformat() + 'Z'
        },
        'granularity': 'daily',
        'categories': ['malware', 'intrusion', 'anomaly'],
        'includeForecasting': True,
        'forecastPeriods': 3
    }
    
    response = requests.post(url, headers=self.headers, json=data)
    response.raise_for_status()
    
    result = response.json()
    trends = result['data']['trends']
    
    # Process trend data
    for trend in trends:
        category = trend['category']
        stats = trend['statistics']
        print(f"{category.title()} Trends:")
        print(f"  Total: {stats['total']}")
        print(f"  Average: {stats['average']:.1f}")
        print(f"  Trend: {stats['trend']['direction']} ({stats['trend']['strength']:.2f})")
    
    # Process forecasting
    if 'forecasting' in result['data']:
        forecasts = result['data']['forecasting']['predictions']
        print("\nForecasts:")
        for forecast in forecasts[:3]:  # Next 3 periods
            print(f"  {forecast['timestamp']}: {forecast['predictedCount']} threats")
    
    return result['data']
```

### Custom Analytics Queries

```javascript
// JavaScript example for custom analytics
class AnalyticsService {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async customTimeRangeAnalysis(startDate, endDate, categories) {
        const response = await fetch(`${this.baseUrl}/api/analytics/trend-analysis`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timeRange: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                },
                granularity: 'hourly',
                categories: categories,
                includeForecasting: true
            })
        });

        if (!response.ok) {
            throw new Error(`Analytics API error: ${response.status}`);
        }

        return await response.json();
    }

    async generateReport(period = '24h') {
        const endDate = new Date();
        const startDate = new Date();
        
        // Calculate start date based on period
        switch (period) {
            case '24h': startDate.setHours(startDate.getHours() - 24); break;
            case '7d': startDate.setDate(startDate.getDate() - 7); break;
            case '30d': startDate.setDate(startDate.getDate() - 30); break;
        }

        const analytics = await this.customTimeRangeAnalysis(
            startDate, 
            endDate, 
            ['malware', 'intrusion', 'anomaly', 'behavioral']
        );

        // Generate summary report
        const report = {
            period: period,
            generated: new Date().toISOString(),
            summary: {
                totalThreats: analytics.data.trends.reduce((sum, trend) => 
                    sum + trend.statistics.total, 0),
                categories: analytics.data.trends.length,
                highestRisk: Math.max(...analytics.data.trends.map(t => t.statistics.peak))
            },
            trends: analytics.data.trends,
            insights: analytics.data.insights
        };

        return report;
    }
}
```

## ML Model Integration

### Model Monitoring Setup

```python
class MLModelMonitor:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
    
    def monitor_all_models(self):
        """Monitor all ML models"""
        url = f"{self.base_url}/api/ml/model-status"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        
        models = response.json()['data']
        
        for model in models:
            self.check_model_health(model)
    
    def check_model_health(self, model):
        """Check individual model health"""
        model_id = model['modelId']
        health = model['health']
        
        print(f"Model: {model['name']} ({model_id})")
        print(f"  Status: {model['status']}")
        print(f"  Health: {health['overallHealth']} ({health['healthScore']}%)")
        print(f"  Accuracy: {model['accuracy']['overall']:.3f}")
        
        # Check for issues
        if health['overallHealth'] != 'healthy':
            print(f"  ⚠️  Issues: {health['issues']}")
        
        # Check performance metrics
        perf = model['performance']
        if perf['averageInferenceTime'] > 1000:  # >1 second
            print(f"  ⚠️  Slow inference: {perf['averageInferenceTime']}ms")
        
        if perf['errorRate'] > 0.05:  # >5% error rate
            print(f"  ⚠️  High error rate: {perf['errorRate']:.1%}")
    
    def check_model_drift(self, model_id):
        """Check for model drift"""
        url = f"{self.base_url}/api/ml/drift-detection"
        data = {'modelId': model_id}
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        drift_data = response.json()['data']
        
        print(f"Drift Analysis for {model_id}:")
        print(f"  Drift Type: {drift_data['driftType']}")
        print(f"  Severity: {drift_data['severity']}")
        print(f"  Score: {drift_data['driftScore']:.3f}")
        
        if drift_data['severity'] in ['high', 'critical']:
            print("  ⚠️  Model retraining recommended!")
            print("  Recommendations:")
            for rec in drift_data['recommendations']:
                print(f"    - {rec}")
        
        return drift_data
    
    def analyze_feature_importance(self, model_id, analysis_type='permutation'):
        """Analyze feature importance"""
        url = f"{self.base_url}/api/ml/feature-importance"
        data = {
            'modelId': model_id,
            'analysisType': analysis_type
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        importance_data = response.json()['data']
        
        print(f"Feature Importance Analysis ({analysis_type}):")
        
        # Display top 10 features
        top_features = sorted(importance_data['features'], 
                            key=lambda x: x['importance'], reverse=True)[:10]
        
        for i, feature in enumerate(top_features, 1):
            print(f"  {i:2d}. {feature['featureName']}: {feature['importance']:.3f}")
        
        return importance_data

# Usage
monitor = MLModelMonitor(api_key, base_url)

# Monitor all models
monitor.monitor_all_models()

# Check specific model for drift
drift_result = monitor.check_model_drift('isolation_forest_v1')

# Analyze feature importance
importance_result = monitor.analyze_feature_importance('isolation_forest_v1')
```

### Automated Model Retraining

```python
class ModelRetrainingService:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
    
    def setup_drift_monitoring(self, model_id, drift_threshold=0.3):
        """Set up automated drift monitoring"""
        while True:
            try:
                # Check for drift
                drift_data = self.check_drift(model_id)
                
                if drift_data['driftScore'] > drift_threshold:
                    print(f"Drift detected for {model_id}: {drift_data['driftScore']:.3f}")
                    
                    # Initiate retraining
                    retraining_job = self.initiate_retraining(model_id, 'drift_detected')
                    print(f"Retraining job initiated: {retraining_job['jobId']}")
                    
                    # Monitor retraining progress
                    self.monitor_retraining(retraining_job['jobId'])
                
                time.sleep(3600)  # Check every hour
                
            except Exception as e:
                print(f"Error in drift monitoring: {e}")
                time.sleep(300)  # Wait 5 minutes on error
    
    def initiate_retraining(self, model_id, trigger='manual'):
        """Initiate model retraining"""
        url = f"{self.base_url}/api/ml/retraining"
        data = {
            'modelId': model_id,
            'trigger': trigger,
            'priority': 'high' if trigger == 'drift_detected' else 'normal',
            'configuration': {
                'dataSource': 'latest_threats',
                'validationSplit': 0.2,
                'maxTrainingTime': 3600
            }
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        return response.json()['data']
    
    def monitor_retraining(self, job_id):
        """Monitor retraining job progress"""
        url = f"{self.base_url}/api/ml/retraining/status"
        
        while True:
            response = requests.get(url, headers=self.headers, params={'jobId': job_id})
            response.raise_for_status()
            
            job_status = response.json()['data']
            
            print(f"Retraining progress: {job_status['progress']:.1%}")
            
            if job_status['status'] == 'completed':
                print("Retraining completed successfully!")
                results = job_status['results']
                print(f"New accuracy: {results['newAccuracy']:.3f}")
                print(f"Improvement: {results['improvementPercentage']:.1f}%")
                break
            elif job_status['status'] == 'failed':
                print(f"Retraining failed: {job_status.get('errorMessage', 'Unknown error')}")
                break
            
            time.sleep(30)  # Check every 30 seconds
```

## SIEM Integration

### Splunk Integration

```python
class SplunkIntegration:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
        self.siem_id = None
    
    def setup_splunk_connection(self, splunk_config):
        """Set up Splunk SIEM connection"""
        url = f"{self.base_url}/api/integrations/siem"
        data = {
            'name': 'Production Splunk',
            'type': 'splunk',
            'config': {
                'endpoint': splunk_config['endpoint'],
                'username': splunk_config['username'],
                'password': splunk_config['password'],
                'index': splunk_config.get('index', 'security_events'),
                'protocol': 'https',
                'format': 'json'
            },
            'features': ['event_export', 'alert_import', 'query']
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        connection = response.json()['data']
        self.siem_id = connection['id']
        
        print(f"Splunk connection established: {connection['id']}")
        return connection
    
    def test_connection(self):
        """Test SIEM connection"""
        if not self.siem_id:
            raise ValueError("SIEM connection not established")
        
        url = f"{self.base_url}/api/integrations/siem/test"
        data = {'siemId': self.siem_id}
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        test_result = response.json()['data']
        
        if test_result['connectionTest']['success']:
            print("✅ SIEM connection test successful")
            print(f"Response time: {test_result['responseTime']}ms")
        else:
            print("❌ SIEM connection test failed")
            print(f"Error: {test_result['connectionTest']['error']}")
        
        return test_result
    
    def export_threats_to_splunk(self, threats, format='cef'):
        """Export threat events to Splunk"""
        if not self.siem_id:
            raise ValueError("SIEM connection not established")
        
        url = f"{self.base_url}/api/integrations/siem/export"
        
        # Convert threats to SIEM format
        events = []
        for threat in threats:
            event = {
                'id': threat['id'],
                'timestamp': threat['timestamp'],
                'type': threat['type'],
                'severity': threat['severity'],
                'source': threat.get('source', 'unknown'),
                'target': threat.get('target', 'unknown'),
                'description': threat.get('description', ''),
                'riskScore': threat.get('riskScore', 0),
                'metadata': threat.get('metadata', {})
            }
            events.append(event)
        
        data = {
            'siemId': self.siem_id,
            'events': events,
            'format': format,
            'batchSize': 100
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        export_result = response.json()['data']
        
        print(f"Exported {export_result['successfulEvents']}/{export_result['totalEvents']} events")
        
        if export_result['failedEvents'] > 0:
            print(f"⚠️  {export_result['failedEvents']} events failed to export")
        
        return export_result

# Usage
splunk_config = {
    'endpoint': 'https://splunk.company.com:8089',
    'username': 'api_user',
    'password': 'secure_password',
    'index': 'security_events'
}

splunk = SplunkIntegration(api_key, base_url)
connection = splunk.setup_splunk_connection(splunk_config)
test_result = splunk.test_connection()

# Export recent threats
threats = get_recent_threats()  # Your threat collection logic
export_result = splunk.export_threats_to_splunk(threats, format='cef')
```

### QRadar Integration

```python
class QRadarIntegration:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
        self.siem_id = None
    
    def setup_qradar_connection(self, qradar_config):
        """Set up QRadar SIEM connection"""
        url = f"{self.base_url}/api/integrations/siem"
        data = {
            'name': 'QRadar Security Intelligence',
            'type': 'qradar',
            'config': {
                'endpoint': qradar_config['endpoint'],
                'apiToken': qradar_config['api_token'],
                'version': qradar_config.get('version', '14.0'),
                'protocol': 'https',
                'format': 'json'
            },
            'features': ['event_export', 'alert_import']
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        connection = response.json()['data']
        self.siem_id = connection['id']
        
        return connection
    
    def export_to_qradar(self, events):
        """Export events to QRadar in LEEF format"""
        return self.export_events(events, format='leef')

# Usage
qradar_config = {
    'endpoint': 'https://qradar.security.local',
    'api_token': 'qradar_api_token_12345',
    'version': '14.0'
}

qradar = QRadarIntegration(api_key, base_url)
connection = qradar.setup_qradar_connection(qradar_config)
```

## Webhook Integration

### Basic Webhook Setup

```python
class WebhookIntegration:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
    
    def create_webhook(self, webhook_config):
        """Create a new webhook"""
        url = f"{self.base_url}/api/integrations/webhooks"
        
        response = requests.post(url, headers=self.headers, json=webhook_config)
        response.raise_for_status()
        
        webhook = response.json()['data']
        print(f"Webhook created: {webhook['id']}")
        print(f"Secret: {webhook['secret']}")
        
        return webhook
    
    def test_webhook(self, webhook_id):
        """Test webhook delivery"""
        url = f"{self.base_url}/api/integrations/webhooks/test"
        data = {'webhookId': webhook_id}
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        test_result = response.json()['data']
        
        if test_result['success']:
            print(f"✅ Webhook test successful ({test_result['responseTime']}ms)")
        else:
            print(f"❌ Webhook test failed: {test_result['error']}")
        
        return test_result

# Usage
webhook_config = {
    'name': 'SOC Alerts Webhook',
    'url': 'https://soc.company.com/api/webhooks/threats',
    'eventTypes': ['threat.detected', 'threat.resolved', 'alert.created'],
    'retryConfig': {
        'maxRetries': 3,
        'retryDelay': 1000,
        'backoffMultiplier': 2
    }
}

webhook_service = WebhookIntegration(api_key, base_url)
webhook = webhook_service.create_webhook(webhook_config)
test_result = webhook_service.test_webhook(webhook['id'])
```

### Webhook Receiver Implementation

```python
from flask import Flask, request, abort
import hmac
import hashlib
import json

app = Flask(__name__)

# Your webhook secret from BG Threat AI
WEBHOOK_SECRET = 'whsec_your_webhook_secret_here'

def verify_signature(payload, signature, secret):
    """Verify webhook signature"""
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

@app.route('/api/webhooks/threats', methods=['POST'])
def handle_threat_webhook():
    """Handle incoming threat webhooks"""
    # Get signature from headers
    signature = request.headers.get('X-Webhook-Signature')
    if not signature:
        abort(401, 'Missing signature')
    
    # Verify signature
    payload = request.get_data()
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        abort(401, 'Invalid signature')
    
    # Process webhook data
    try:
        data = request.get_json()
        event_type = data['type']
        event_data = data['data']
        
        if event_type == 'threat.detected':
            handle_threat_detected(event_data)
        elif event_type == 'threat.resolved':
            handle_threat_resolved(event_data)
        elif event_type == 'alert.created':
            handle_alert_created(event_data)
        
        return {'status': 'success'}, 200
        
    except Exception as e:
        print(f"Error processing webhook: {e}")
        return {'status': 'error', 'message': str(e)}, 500

def handle_threat_detected(threat):
    """Handle threat detection event"""
    print(f"🚨 Threat detected: {threat['id']}")
    print(f"   Type: {threat['type']}")
    print(f"   Severity: {threat['severity']}")
    print(f"   Risk Score: {threat['riskScore']}")
    
    # Implement your threat response logic here
    if threat['severity'] == 'critical':
        # Send to incident response team
        send_to_incident_response(threat)
    
    # Log to your security system
    log_to_security_system(threat)

def handle_threat_resolved(threat):
    """Handle threat resolution event"""
    print(f"✅ Threat resolved: {threat['id']}")
    
    # Update your tracking systems
    update_threat_status(threat['id'], 'resolved')

def handle_alert_created(alert):
    """Handle alert creation event"""
    print(f"🔔 Alert created: {alert['id']}")
    
    # Forward to alerting system
    forward_to_alerting_system(alert)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

## Real-time Streaming

### WebSocket Integration

```javascript
// JavaScript WebSocket client for real-time streaming
class ThreatStreamClient {
    constructor(wsUrl, apiKey) {
        this.wsUrl = wsUrl;
        this.apiKey = apiKey;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.callbacks = {};
    }

    connect() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to threat stream');
                this.reconnectAttempts = 0;
                
                // Authenticate
                this.ws.send(JSON.stringify({
                    type: 'auth',
                    apiKey: this.apiKey
                }));
                
                // Subscribe to channels
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['threats', 'alerts', 'analytics']
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('Disconnected from threat stream');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('Failed to connect:', error);
            this.attemptReconnect();
        }
    }

    handleMessage(message) {
        const { type, data } = message;

        switch (type) {
            case 'threat.detected':
                this.handleThreatDetected(data);
                break;
            case 'threat.resolved':
                this.handleThreatResolved(data);
                break;
            case 'alert.created':
                this.handleAlertCreated(data);
                break;
            case 'analytics.update':
                this.handleAnalyticsUpdate(data);
                break;
            default:
                console.log('Unknown message type:', type);
        }

        // Call registered callbacks
        if (this.callbacks[type]) {
            this.callbacks[type].forEach(callback => callback(data));
        }
    }

    handleThreatDetected(threat) {
        console.log('🚨 Real-time threat detected:', threat);
        
        // Update UI
        this.updateThreatDisplay(threat);
        
        // Play alert sound for critical threats
        if (threat.severity === 'critical') {
            this.playAlertSound();
        }
    }

    handleThreatResolved(threat) {
        console.log('✅ Threat resolved:', threat.id);
        this.removeThreatFromDisplay(threat.id);
    }

    handleAlertCreated(alert) {
        console.log('🔔 Alert created:', alert);
        this.showNotification(alert);
    }

    handleAnalyticsUpdate(analytics) {
        console.log('📊 Analytics update received');
        this.updateDashboard(analytics);
    }

    on(eventType, callback) {
        if (!this.callbacks[eventType]) {
            this.callbacks[eventType] = [];
        }
        this.callbacks[eventType].push(callback);
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000;
            
            console.log(`Attempting reconnect in ${delay}ms...`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    updateThreatDisplay(threat) {
        // Implementation depends on your UI framework
        const threatElement = document.createElement('div');
        threatElement.className = `threat-item severity-${threat.severity}`;
        threatElement.innerHTML = `
            <div class="threat-header">
                <span class="threat-type">${threat.type}</span>
                <span class="threat-severity">${threat.severity}</span>
                <span class="threat-time">${new Date(threat.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="threat-details">
                <p>${threat.description}</p>
                <p>Risk Score: ${threat.riskScore}/10</p>
            </div>
        `;
        
        document.getElementById('threat-list').prepend(threatElement);
    }

    playAlertSound() {
        const audio = new Audio('/sounds/alert.mp3');
        audio.play().catch(e => console.log('Could not play alert sound:', e));
    }

    showNotification(alert) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Security Alert: ${alert.type}`, {
                body: alert.message,
                icon: '/icons/alert.png'
            });
        }
    }
}

// Usage
const streamClient = new ThreatStreamClient('wss://stream.bg-threat.com', apiKey);

// Register event handlers
streamClient.on('threat.detected', (threat) => {
    console.log('Custom handler for threat:', threat);
});

streamClient.on('analytics.update', (analytics) => {
    updateDashboardCharts(analytics);
});

// Connect to stream
streamClient.connect();
```

## Performance Optimization

### Caching Strategies

```python
import redis
import json
from datetime import timedelta

class APICache:
    def __init__(self, redis_host='localhost', redis_port=6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
    
    def cache_dashboard_metrics(self, metrics, ttl_seconds=30):
        """Cache dashboard metrics with short TTL"""
        key = 'dashboard:metrics'
        self.redis_client.setex(key, ttl_seconds, json.dumps(metrics))
    
    def get_cached_dashboard_metrics(self):
        """Get cached dashboard metrics"""
        key = 'dashboard:metrics'
        cached = self.redis_client.get(key)
        return json.loads(cached) if cached else None
    
    def cache_trend_analysis(self, analysis_params, results, ttl_seconds=300):
        """Cache trend analysis results with longer TTL"""
        cache_key = self.generate_trend_cache_key(analysis_params)
        self.redis_client.setex(cache_key, ttl_seconds, json.dumps(results))
    
    def get_cached_trend_analysis(self, analysis_params):
        """Get cached trend analysis"""
        cache_key = self.generate_trend_cache_key(analysis_params)
        cached = self.redis_client.get(cache_key)
        return json.loads(cached) if cached else None
    
    def generate_trend_cache_key(self, params):
        """Generate cache key for trend analysis"""
        key_parts = [
            'trend',
            params['timeRange']['start'],
            params['timeRange']['end'],
            params['granularity'],
            '_'.join(sorted(params['categories']))
        ]
        return ':'.join(key_parts)

# Enhanced API client with caching
class CachedAPIClient:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.cache = APICache()
        self.headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
    
    def get_dashboard_metrics(self, use_cache=True):
        """Get dashboard metrics with caching"""
        if use_cache:
            cached_metrics = self.cache.get_cached_dashboard_metrics()
            if cached_metrics:
                print("📦 Using cached dashboard metrics")
                return cached_metrics
        
        # Fetch from API
        url = f"{self.base_url}/api/analytics/dashboard-metrics"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        
        metrics = response.json()
        
        # Cache the results
        if use_cache:
            self.cache.cache_dashboard_metrics(metrics, ttl_seconds=30)
        
        return metrics
    
    def analyze_trends(self, params, use_cache=True):
        """Analyze trends with caching"""
        if use_cache:
            cached_results = self.cache.get_cached_trend_analysis(params)
            if cached_results:
                print("📦 Using cached trend analysis")
                return cached_results
        
        # Fetch from API
        url = f"{self.base_url}/api/analytics/trend-analysis"
        response = requests.post(url, headers=self.headers, json=params)
        response.raise_for_status()
        
        results = response.json()
        
        # Cache the results
        if use_cache:
            self.cache.cache_trend_analysis(params, results, ttl_seconds=300)
        
        return results
```

### Connection Pooling

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class OptimizedAPIClient:
    def __init__(self, api_key, base_url, max_retries=3):
        self.api_key = api_key
        self.base_url = base_url
        
        # Configure session with connection pooling
        self.session = requests.Session()
        
        # Retry strategy
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        # HTTP adapter with connection pooling
        adapter = HTTPAdapter(
            pool_connections=10,
            pool_maxsize=20,
            max_retries=retry_strategy
        )
        
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        
        # Set default headers
        self.session.headers.update({
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        })
    
    def make_request(self, method, path, **kwargs):
        """Make optimized HTTP request"""
        url = f"{self.base_url}{path}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def get_dashboard_metrics(self):
        return self.make_request('GET', '/api/analytics/dashboard-metrics')
    
    def analyze_trends(self, params):
        return self.make_request('POST', '/api/analytics/trend-analysis', json=params)
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Errors

**Problem:** `401 Unauthorized` responses

**Solutions:**
```python
# Check API key format
if not api_key.startswith('bg_'):
    print("❌ Invalid API key format")

# Verify headers
headers = {
    'x-api-key': api_key,  # Correct header name
    'Content-Type': 'application/json'
}

# Test authentication
response = requests.get(f"{base_url}/health", headers=headers)
if response.status_code == 401:
    print("❌ Authentication failed - check your API key")
```

#### 2. Rate Limiting

**Problem:** `429 Too Many Requests`

**Solutions:**
```python
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Implement exponential backoff
def make_request_with_backoff(session, method, url, **kwargs):
    max_retries = 5
    base_delay = 1
    
    for attempt in range(max_retries):
        try:
            response = session.request(method, url, **kwargs)
            
            if response.status_code == 429:
                # Get retry-after header
                retry_after = int(response.headers.get('Retry-After', base_delay * (2 ** attempt)))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                continue
            
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(base_delay * (2 ** attempt))
```

#### 3. Timeout Issues

**Problem:** Request timeouts for long-running operations

**Solutions:**
```python
# Set appropriate timeouts
response = requests.post(
    url, 
    headers=headers, 
    json=data,
    timeout=(30, 300)  # (connect_timeout, read_timeout)
)

# For analytics operations, use longer timeouts
if 'analytics' in url:
    timeout = (30, 600)  # 10 minutes for complex analytics
elif 'ml' in url and 'drift-detection' in url:
    timeout = (30, 300)  # 5 minutes for drift detection
else:
    timeout = (10, 60)   # Default timeouts
```

#### 4. Large Dataset Handling

**Problem:** Timeouts or memory issues with large datasets

**Solutions:**
```python
# Use pagination for large results
def get_all_threats(start_date, end_date, page_size=1000):
    all_threats = []
    page = 1
    
    while True:
        params = {
            'start': start_date,
            'end': end_date,
            'limit': page_size,
            'offset': (page - 1) * page_size
        }
        
        response = requests.get(f"{base_url}/api/threats", 
                              headers=headers, params=params)
        response.raise_for_status()
        
        threats = response.json()['data']
        
        if not threats:
            break
            
        all_threats.extend(threats)
        page += 1
        
        # Small delay to avoid rate limits
        time.sleep(0.1)
    
    return all_threats

# Process data in chunks
def process_threats_in_chunks(threats, chunk_size=100):
    for i in range(0, len(threats), chunk_size):
        chunk = threats[i:i + chunk_size]
        
        # Export chunk to SIEM
        export_result = export_to_siem(chunk)
        
        print(f"Processed chunk {i//chunk_size + 1}: {len(chunk)} threats")
        
        # Brief pause between chunks
        time.sleep(1)
```

#### 5. Debugging API Responses

```python
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Add response debugging
def debug_response(response):
    print(f"Status: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    print(f"Content: {response.text[:500]}...")  # First 500 chars

# Use in requests
response = requests.get(url, headers=headers)
debug_response(response)

# Validate response structure
def validate_api_response(response):
    try:
        data = response.json()
        
        # Check required fields
        if 'success' not in data:
            print("❌ Missing 'success' field in response")
        
        if 'correlationId' not in data:
            print("❌ Missing 'correlationId' field in response")
        
        if data.get('success') and 'data' not in data:
            print("❌ Missing 'data' field in successful response")
        
        return data
        
    except json.JSONDecodeError:
        print("❌ Invalid JSON in response")
        return None
```

---

*For additional support and advanced integration patterns, refer to the Phase 2B API Documentation and contact the technical support team.*