# Phase 2B Enhanced API Capabilities - Documentation

## Overview

Phase 2B introduces advanced API capabilities for the BG Identity AI threat detection platform, including sophisticated analytics, ML model management, and enterprise integrations. This documentation covers all enhanced APIs developed during Phase 2B implementation.

## Table of Contents

1. [Authentication](#authentication)
2. [Analytics APIs](#analytics-apis)
3. [ML Management APIs](#ml-management-apis)
4. [Integration APIs](#integration-apis)
5. [Response Formats](#response-formats)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Performance Specifications](#performance-specifications)

## Authentication

All Phase 2B APIs require authentication via API key.

### Headers Required
```http
x-api-key: your-api-key-here
Content-Type: application/json
```

### Authentication Validation
- API keys are validated against the authentication service
- Invalid or missing keys return `401 Unauthorized`
- Expired keys return `401 Unauthorized` with renewal instructions

## Analytics APIs

### Trend Analysis API

**Endpoint:** `POST /api/analytics/trend-analysis`

Performs advanced trend analysis with forecasting capabilities.

#### Request Body
```json
{
  "timeRange": {
    "start": "2025-01-10T00:00:00.000Z",
    "end": "2025-01-15T23:59:59.000Z"
  },
  "granularity": "hourly", // "hourly", "daily", "weekly"
  "categories": ["malware", "intrusion", "anomaly"],
  "includeForecasting": true,
  "forecastPeriods": 5
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "analysisId": "trend_analysis_1736934567_abc123",
    "trends": [
      {
        "category": "malware",
        "granularity": "hourly",
        "dataPoints": [
          {
            "timestamp": "2025-01-10T10:00:00.000Z",
            "count": 15,
            "averageRiskScore": 7.8,
            "severity": {
              "critical": 2,
              "high": 8,
              "medium": 5,
              "low": 0
            }
          }
        ],
        "statistics": {
          "total": 145,
          "average": 12.1,
          "peak": 28,
          "trend": {
            "direction": "increasing",
            "strength": 0.75,
            "confidence": 0.92
          }
        }
      }
    ],
    "forecasting": {
      "predictions": [
        {
          "timestamp": "2025-01-16T00:00:00.000Z",
          "predictedCount": 18,
          "confidence": 0.85,
          "upperBound": 25,
          "lowerBound": 12
        }
      ],
      "confidence_intervals": {
        "overall": 0.87,
        "short_term": 0.92,
        "long_term": 0.78
      },
      "accuracy_metrics": {
        "mae": 2.1,
        "rmse": 3.4,
        "mape": 0.12
      }
    },
    "insights": [
      {
        "type": "trend_change",
        "message": "Malware detections increased 45% compared to previous period",
        "severity": "warning",
        "confidence": 0.91
      }
    ],
    "metadata": {
      "processingTime": 1247,
      "dataPoints": 336,
      "timeRange": {
        "start": "2025-01-10T00:00:00.000Z",
        "end": "2025-01-15T23:59:59.000Z"
      }
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Performance
- **Target Response Time:** <3000ms for complex analysis
- **Concurrent Requests:** Supports up to 10 concurrent analyses
- **Data Limits:** Up to 90 days of historical data

---

### Dashboard Metrics API

**Endpoint:** `GET /api/analytics/dashboard-metrics`  
**Endpoint:** `POST /api/analytics/dashboard-metrics`

Provides real-time dashboard metrics and statistics.

#### Query Parameters (GET)
- `includeRealtime` (boolean): Include real-time statistics
- `includePredictions` (boolean): Include forecast predictions
- `timeRangeStart` (ISO string): Custom time range start
- `timeRangeEnd` (ISO string): Custom time range end
- `refreshInterval` (number): Cache refresh interval in seconds

#### Request Body (POST)
```json
{
  "includeRealtime": true,
  "includePredictions": true,
  "timeRange": {
    "start": "2025-01-15T00:00:00.000Z",
    "end": "2025-01-15T23:59:59.000Z"
  },
  "refreshInterval": 30
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-15T14:30:00.000Z",
    "realTimeStats": {
      "currentPeriod": {
        "totalThreats": 127,
        "criticalThreats": 8,
        "highThreats": 32,
        "mediumThreats": 67,
        "lowThreats": 20,
        "resolvedThreats": 89,
        "falsePositives": 12
      },
      "lastHour": {
        "totalThreats": 18,
        "averageRiskScore": 6.8,
        "topCategory": "malware",
        "peakMinute": "2025-01-15T14:15:00.000Z"
      },
      "last24Hours": {
        "totalThreats": 342,
        "averageRiskScore": 7.1,
        "resolutionRate": 0.78
      },
      "comparison": {
        "hourOverHour": {
          "change": 0.15,
          "direction": "increase"
        },
        "dayOverDay": {
          "change": -0.08,
          "direction": "decrease"
        },
        "weekOverWeek": {
          "change": 0.23,
          "direction": "increase"
        }
      }
    },
    "topThreats": [
      {
        "id": "threat_001",
        "type": "malware",
        "severity": "critical",
        "riskScore": 9.5,
        "source": "endpoint_scanner",
        "target": "server_001",
        "timestamp": "2025-01-15T14:25:00.000Z",
        "description": "Advanced persistent threat detected",
        "status": "investigating",
        "tags": ["apt", "lateral_movement"],
        "impactScore": 8.9,
        "urgencyScore": 9.2,
        "metadata": {
          "correlationId": "corr_001",
          "detectionEngine": "ml_classifier",
          "confidence": 0.94
        }
      }
    ],
    "performanceMetrics": {
      "api": {
        "averageResponseTime": 145,
        "requestsPerSecond": 25.7,
        "errorRate": 0.02,
        "uptime": 99.97,
        "activeConnections": 48
      },
      "streaming": {
        "activeStreams": 12,
        "eventsPerSecond": 127,
        "streamLatency": 23
      },
      "ml": {
        "modelsActive": 6,
        "averageInferenceTime": 45,
        "modelAccuracy": 0.94,
        "predictionConfidence": 0.89
      },
      "resources": {
        "cpuUsage": 35.2,
        "memoryUsage": 67.8,
        "diskUsage": 23.4,
        "networkBandwidth": 125.6
      }
    },
    "alertSummary": {
      "activeAlerts": 23,
      "criticalAlerts": 3,
      "acknowledgedAlerts": 17,
      "recentAlerts": [
        {
          "id": "alert_001",
          "type": "threat_escalation",
          "severity": "high",
          "message": "Critical threat requires immediate attention",
          "timestamp": "2025-01-15T14:28:00.000Z",
          "acknowledged": false,
          "source": "correlation_engine"
        }
      ],
      "alertsByCategory": [
        {"category": "malware", "count": 8},
        {"category": "intrusion", "count": 5},
        {"category": "anomaly", "count": 10}
      ],
      "escalationQueue": 2,
      "averageResolutionTime": 1247,
      "slaCompliance": 97.8
    },
    "trendSummary": {
      "direction": "increasing",
      "strength": 0.73,
      "confidence": 0.89,
      "keyInsights": [
        "Malware activity increased 23% this week",
        "Network intrusions down 15% from last month",
        "Behavioral anomalies showing seasonal pattern"
      ],
      "forecastNext24h": {
        "expectedThreats": 285,
        "confidence": 0.87,
        "riskLevel": "medium"
      },
      "seasonalPatterns": {
        "detected": true,
        "peakHours": ["14:00", "15:00", "20:00"],
        "lowHours": ["03:00", "04:00", "05:00"]
      }
    },
    "systemHealth": {
      "overallHealth": "healthy",
      "healthScore": 94,
      "components": [
        {
          "component": "threat_detection",
          "status": "healthy",
          "uptime": 99.98,
          "lastCheck": "2025-01-15T14:30:00.000Z",
          "metrics": {
            "responseTime": 45,
            "throughput": 1250,
            "errorRate": 0.01
          }
        },
        {
          "component": "ml_models",
          "status": "healthy",
          "uptime": 99.95,
          "lastCheck": "2025-01-15T14:30:00.000Z",
          "metrics": {
            "accuracy": 0.94,
            "inferenceTime": 52,
            "modelDrift": 0.08
          }
        }
      ],
      "lastHealthCheck": "2025-01-15T14:30:00.000Z",
      "uptime": 2592000,
      "diagnostics": {
        "memoryLeaks": false,
        "performanceDegradation": false,
        "configurationIssues": false
      }
    },
    "metadata": {
      "generationTime": 234,
      "dataFreshness": 15,
      "coverage": {
        "timeRange": {
          "start": "2025-01-15T13:30:00.000Z",
          "end": "2025-01-15T14:30:00.000Z"
        },
        "dataPoints": 1847,
        "completeness": 98.7,
        "sources": ["endpoint_agents", "network_monitors", "ml_models"]
      }
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440001"
}
```

#### Performance
- **Target Response Time:** <1000ms for standard metrics
- **Real-time Updates:** 5-30 second refresh intervals
- **Caching:** Intelligent caching with TTL-based invalidation

---

## ML Management APIs

### Model Status API

**Endpoint:** `GET /api/ml/model-status`  
**Endpoint:** `GET /api/ml/model-status?modelId={id}`

Retrieves comprehensive ML model status and health information.

#### Query Parameters
- `modelId` (optional): Specific model ID to query

#### Response (All Models)
```json
{
  "success": true,
  "data": [
    {
      "modelId": "isolation_forest_v1",
      "name": "Isolation Forest Anomaly Detector",
      "type": "isolation_forest",
      "status": "active",
      "health": {
        "lastHealthCheck": "2025-01-15T14:30:00.000Z",
        "overallHealth": "healthy",
        "healthScore": 94,
        "componentChecks": [
          {
            "component": "model_inference",
            "status": "healthy",
            "lastCheck": "2025-01-15T14:30:00.000Z",
            "responseTime": 45
          },
          {
            "component": "feature_extraction",
            "status": "healthy",
            "lastCheck": "2025-01-15T14:30:00.000Z",
            "responseTime": 23
          }
        ],
        "issues": [],
        "uptime": 2592000
      },
      "accuracy": {
        "overall": 0.94,
        "precision": 0.92,
        "recall": 0.96,
        "f1Score": 0.94,
        "confusionMatrix": {
          "truePositives": 847,
          "falsePositives": 73,
          "trueNegatives": 1923,
          "falseNegatives": 42
        },
        "accuracyTrend": {
          "direction": "stable",
          "changeRate": 0.02,
          "lastEvaluation": "2025-01-15T12:00:00.000Z"
        },
        "lastEvaluation": "2025-01-15T12:00:00.000Z"
      },
      "performance": {
        "averageInferenceTime": 45,
        "throughput": 2250,
        "errorRate": 0.008,
        "memoryUsage": 512,
        "cpuUsage": 18.5,
        "diskUsage": 1024,
        "lastBenchmark": "2025-01-15T10:00:00.000Z"
      },
      "usage": {
        "totalPredictions": 1250847,
        "predictionsToday": 18447,
        "averagePredictionsPerDay": 15623,
        "lastPrediction": "2025-01-15T14:29:45.000Z",
        "activeSessions": 12,
        "usagePattern": {
          "peakHours": ["14:00", "15:00"],
          "averageLoad": 0.68
        }
      },
      "configuration": {
        "version": "1.2.3",
        "trainingData": "threat_dataset_v4",
        "features": 127,
        "hyperparameters": {
          "n_estimators": 100,
          "contamination": 0.1,
          "max_samples": "auto"
        },
        "lastUpdate": "2025-01-10T08:00:00.000Z"
      },
      "capabilities": [
        "anomaly_detection",
        "real_time_inference",
        "batch_processing",
        "feature_importance",
        "drift_detection"
      ]
    }
  ],
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440002"
}
```

#### Performance
- **Target Response Time:** <500ms for all models, <200ms for individual model
- **Health Check Frequency:** Every 5 minutes
- **Concurrent Requests:** Supports up to 20 concurrent status requests

---

### Feature Importance API

**Endpoint:** `POST /api/ml/feature-importance`

Analyzes feature importance using multiple methods.

#### Request Body
```json
{
  "modelId": "isolation_forest_v1",
  "analysisType": "permutation", // "permutation", "shap", "coefficient", "tree_based"
  "options": {
    "iterations": 100,
    "confidence": 0.95
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "modelId": "isolation_forest_v1",
    "analysisType": "permutation",
    "features": [
      {
        "featureName": "network_anomaly_score",
        "importance": 0.89,
        "rank": 1,
        "standardError": 0.03,
        "pValue": 0.001,
        "contribution": "high"
      },
      {
        "featureName": "file_entropy",
        "importance": 0.76,
        "rank": 2,
        "standardError": 0.04,
        "pValue": 0.002,
        "contribution": "high"
      }
    ],
    "metadata": {
      "analysisTime": 2847,
      "confidence": 0.95,
      "samplesUsed": 10000,
      "featureCount": 127,
      "baselineAccuracy": 0.94
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440003"
}
```

---

### Drift Detection API

**Endpoint:** `POST /api/ml/drift-detection`

Detects model drift and performance degradation.

#### Request Body
```json
{
  "modelId": "isolation_forest_v1",
  "options": {
    "timeWindow": "7d",
    "threshold": 0.1
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "modelId": "isolation_forest_v1",
    "driftType": "data_drift",
    "severity": "medium",
    "driftScore": 0.34,
    "detectionTime": "2025-01-15T14:30:00.000Z",
    "analysis": {
      "referenceData": {
        "period": "2024-12-01 to 2025-01-01",
        "samples": 50000,
        "characteristics": {
          "meanValues": [0.45, 0.67, 0.23],
          "distributions": "normal"
        }
      },
      "currentData": {
        "period": "2025-01-08 to 2025-01-15",
        "samples": 15000,
        "characteristics": {
          "meanValues": [0.52, 0.71, 0.19],
          "distributions": "slightly_skewed"
        }
      },
      "statisticalTests": [
        {
          "testName": "kolmogorov_smirnov",
          "pValue": 0.023,
          "significant": true,
          "threshold": 0.05
        },
        {
          "testName": "population_stability_index",
          "pValue": 0.156,
          "significant": false,
          "threshold": 0.1
        }
      ],
      "featureDrift": [
        {
          "featureName": "network_anomaly_score",
          "driftScore": 0.45,
          "driftType": "concept_drift",
          "significant": true
        }
      ],
      "performanceDrift": {
        "accuracyChange": -0.08,
        "precisionChange": -0.05,
        "recallChange": -0.12
      }
    },
    "recommendations": [
      "Consider retraining the model with recent data",
      "Monitor network_anomaly_score feature for continued drift",
      "Evaluate feature engineering for improved stability"
    ]
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440004"
}
```

---

## Integration APIs

### Webhooks API

**Endpoint:** `POST /api/integrations/webhooks` (Create)  
**Endpoint:** `GET /api/integrations/webhooks` (List)  
**Endpoint:** `PUT /api/integrations/webhooks?id={id}` (Update)  
**Endpoint:** `DELETE /api/integrations/webhooks?id={id}` (Delete)

#### Create Webhook
```json
{
  "name": "Security Operations Webhook",
  "url": "https://soc.company.com/api/webhooks/threats",
  "eventTypes": ["threat.detected", "threat.resolved", "alert.created"],
  "retryConfig": {
    "maxRetries": 3,
    "retryDelay": 1000,
    "backoffMultiplier": 2
  },
  "authentication": {
    "type": "bearer_token",
    "token": "your-webhook-token"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "webhook_abc123def456",
    "name": "Security Operations Webhook",
    "url": "https://soc.company.com/api/webhooks/threats",
    "eventTypes": ["threat.detected", "threat.resolved", "alert.created"],
    "status": "active",
    "secret": "whsec_abc123def456",
    "retryConfig": {
      "maxRetries": 3,
      "retryDelay": 1000,
      "backoffMultiplier": 2
    },
    "metadata": {
      "createdAt": "2025-01-15T14:30:00.000Z",
      "updatedAt": "2025-01-15T14:30:00.000Z",
      "failureCount": 0,
      "successCount": 0
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440005"
}
```

---

### SIEM Integration API

**Endpoint:** `POST /api/integrations/siem` (Create Connection)  
**Endpoint:** `GET /api/integrations/siem` (List Connections)  
**Endpoint:** `POST /api/integrations/siem/export` (Export Events)

#### Create SIEM Connection
```json
{
  "name": "Production Splunk",
  "type": "splunk",
  "config": {
    "endpoint": "https://splunk.company.com:8089",
    "username": "api_user",
    "password": "secure_password",
    "index": "security_events",
    "protocol": "https",
    "format": "json"
  },
  "features": ["event_export", "alert_import", "query"],
  "authentication": {
    "type": "basic",
    "credentials": {
      "username": "api_user",
      "password": "secure_password"
    }
  }
}
```

#### Export Events to SIEM
```json
{
  "siemId": "siem_abc123def456",
  "events": [
    {
      "id": "threat_001",
      "timestamp": "2025-01-15T14:30:00.000Z",
      "type": "malware",
      "severity": "critical",
      "source": "endpoint_scanner",
      "target": "workstation_001",
      "description": "Advanced malware detected",
      "riskScore": 9.5,
      "metadata": {
        "correlationId": "corr_001",
        "indicators": ["hash:abc123", "ip:192.168.1.100"]
      }
    }
  ],
  "format": "cef", // "cef", "json", "leef", "syslog"
  "batchSize": 100
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "exportId": "export_abc123def456",
    "siemId": "siem_abc123def456",
    "totalEvents": 1,
    "successfulEvents": 1,
    "failedEvents": 0,
    "processingTime": 234,
    "format": "cef",
    "batchDetails": [
      {
        "batchId": 1,
        "events": 1,
        "status": "success",
        "responseTime": 156
      }
    ]
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440006"
}
```

---

## Response Formats

### Standard Response Structure

All APIs follow a consistent response format:

```json
{
  "success": boolean,
  "data": object | array,
  "error": string | null,
  "timestamp": "ISO 8601 string",
  "correlationId": "UUID v4",
  "metadata": {
    "version": "api version",
    "processingTime": "milliseconds",
    "rateLimit": {
      "remaining": 95,
      "reset": "2025-01-15T15:00:00.000Z"
    }
  }
}
```

### Error Response Structure

```json
{
  "success": false,
  "error": "Detailed error message",
  "errorCode": "API_ERROR_CODE",
  "timestamp": "2025-01-15T14:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440007",
  "metadata": {
    "requestId": "req_abc123",
    "endpoint": "/api/analytics/trend-analysis",
    "method": "POST"
  }
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key is invalid or expired |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_REQUEST_FORMAT` | Request body format is invalid |
| `VALIDATION_FAILED` | Request validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `SERVICE_UNAVAILABLE` | External service unavailable |
| `PROCESSING_TIMEOUT` | Request processing timeout |

## Rate Limiting

### Default Limits

| Endpoint Category | Requests per Minute | Burst Limit |
|------------------|-------------------|-------------|
| Analytics APIs | 60 | 10 |
| ML Management APIs | 30 | 5 |
| Integration APIs | 120 | 20 |
| Status/Health APIs | 300 | 50 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1736935200
X-RateLimit-Window: 60
```

## Performance Specifications

### Response Time Targets

| API Category | Target Response Time | 95th Percentile |
|--------------|-------------------|-----------------|
| Dashboard Metrics | <1000ms | <1500ms |
| Trend Analysis | <3000ms | <5000ms |
| Model Status | <500ms | <800ms |
| Feature Importance | <2000ms | <3000ms |
| Drift Detection | <3000ms | <5000ms |
| Webhook Management | <200ms | <500ms |
| SIEM Export | <2000ms | <3000ms |

### Throughput Specifications

- **Concurrent Requests:** 50+ per API endpoint
- **Data Processing:** Up to 100,000 events per minute
- **Real-time Streaming:** <50ms latency
- **Analytics Queries:** 1GB+ dataset processing capability

### Availability Targets

- **Uptime:** 99.9% SLA
- **Error Rate:** <0.1% for successful requests
- **Disaster Recovery:** <5 minute RTO, <15 minute RPO

---

## Integration Examples

### Python SDK Example

```python
import requests
import json

class BgThreatAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json',
            'x-api-key': api_key
        }
    
    def get_dashboard_metrics(self, include_realtime=True):
        url = f"{self.base_url}/api/analytics/dashboard-metrics"
        params = {'includeRealtime': include_realtime}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def analyze_trends(self, time_range, categories, granularity='hourly'):
        url = f"{self.base_url}/api/analytics/trend-analysis"
        data = {
            'timeRange': time_range,
            'categories': categories,
            'granularity': granularity,
            'includeForecasting': True
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        return response.json()

# Usage
api = BgThreatAPI('https://api.bg-threat.com', 'your-api-key')
metrics = api.get_dashboard_metrics()
print(f"Total threats: {metrics['data']['realTimeStats']['currentPeriod']['totalThreats']}")
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

class BgThreatAPI {
    constructor(baseUrl, apiKey) {
        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });
    }

    async getDashboardMetrics(options = {}) {
        const response = await this.client.get('/api/analytics/dashboard-metrics', {
            params: options
        });
        return response.data;
    }

    async createWebhook(webhookData) {
        const response = await this.client.post('/api/integrations/webhooks', webhookData);
        return response.data;
    }

    async exportToSiem(siemId, events, format = 'cef') {
        const response = await this.client.post('/api/integrations/siem/export', {
            siemId,
            events,
            format,
            batchSize: 100
        });
        return response.data;
    }
}

// Usage
const api = new BgThreatAPI('https://api.bg-threat.com', 'your-api-key');

async function main() {
    try {
        const metrics = await api.getDashboardMetrics({ includeRealtime: true });
        console.log('Dashboard metrics:', metrics.data.realTimeStats);
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
    }
}

main();
```

---

*This documentation covers Phase 2B Enhanced API Capabilities. For additional examples and advanced usage, see the integration guides and SDK documentation.*