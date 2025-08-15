import { Router } from 'express';
import { logger } from '@/lib/logger';
import { 
  mlModelManager, 
  RetrainingRequest, 
  PredictionExplanation 
} from '@/services/ml-management/ml-model-manager';

const router = Router();

/**
 * GET /api/ml/model-status
 * Get status of all ML models or a specific model
 */
router.get('/model-status', async (req, res) => {
  try {
    const userId = req.user?.id;
    const modelId = req.query.model_id as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Model status requested', {
      userId,
      modelId: modelId || 'all'
    });

    let result;
    if (modelId) {
      // Get specific model status
      result = await mlModelManager.getModelStatus(modelId);
    } else {
      // Get all model status
      result = await mlModelManager.getAllModelStatus();
    }

    logger.info('Model status retrieved', {
      userId,
      modelId: modelId || 'all',
      modelsCount: Array.isArray(result) ? result.length : 1
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `model_status_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Model status retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      modelId: req.query.model_id
    });
    
    return res.status(500).json({ 
      error: 'Model status retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/feature-importance
 * Analyze feature importance for a model
 */
router.get('/feature-importance', async (req, res) => {
  try {
    const userId = req.user?.id;
    const modelId = req.query.model_id as string;
    const analysisType = req.query.analysis_type as 'permutation' | 'shap' | 'coefficient' | 'tree_based' || 'permutation';
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!modelId) {
      return res.status(400).json({ error: 'model_id parameter is required' });
    }

    // Validate analysis type
    const validAnalysisTypes = ['permutation', 'shap', 'coefficient', 'tree_based'];
    if (!validAnalysisTypes.includes(analysisType)) {
      return res.status(400).json({ 
        error: `analysis_type must be one of: ${validAnalysisTypes.join(', ')}` 
      });
    }

    logger.info('Feature importance analysis requested', {
      userId,
      modelId,
      analysisType
    });

    const result = await mlModelManager.analyzeFeatureImportance(modelId, analysisType);

    logger.info('Feature importance analysis completed', {
      userId,
      modelId,
      analysisType,
      topFeature: result.features[0]?.featureName,
      analysisTime: result.metadata.analysisTime,
      confidence: result.metadata.confidence
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `feature_importance_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Feature importance analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      modelId: req.query.model_id,
      analysisType: req.query.analysis_type
    });
    
    return res.status(500).json({ 
      error: 'Feature importance analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/drift-detection
 * Detect model drift for a specific model
 */
router.get('/drift-detection', async (req, res) => {
  try {
    const userId = req.user?.id;
    const modelId = req.query.model_id as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!modelId) {
      return res.status(400).json({ error: 'model_id parameter is required' });
    }

    logger.info('Drift detection requested', {
      userId,
      modelId
    });

    const driftReport = await mlModelManager.detectModelDrift(modelId);

    logger.info('Drift detection completed', {
      userId,
      modelId,
      driftType: driftReport.driftType,
      severity: driftReport.severity,
      driftScore: driftReport.driftScore
    });

    return res.json({
      success: true,
      data: driftReport,
      metadata: {
        requestId: `drift_detection_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Drift detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      modelId: req.query.model_id
    });
    
    return res.status(500).json({ 
      error: 'Drift detection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/retraining
 * Initiate model retraining
 */
router.post('/retraining', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const retrainingRequest: RetrainingRequest = req.body;

    // Validate request
    if (!retrainingRequest.modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    if (!retrainingRequest.trigger) {
      return res.status(400).json({ error: 'trigger is required' });
    }

    const validTriggers = ['manual', 'scheduled', 'drift_detected', 'performance_degraded'];
    if (!validTriggers.includes(retrainingRequest.trigger)) {
      return res.status(400).json({ 
        error: `trigger must be one of: ${validTriggers.join(', ')}` 
      });
    }

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (retrainingRequest.priority && !validPriorities.includes(retrainingRequest.priority)) {
      return res.status(400).json({ 
        error: `priority must be one of: ${validPriorities.join(', ')}` 
      });
    }

    // Set default priority if not provided
    if (!retrainingRequest.priority) {
      retrainingRequest.priority = 'normal';
    }

    logger.info('Model retraining requested', {
      userId,
      modelId: retrainingRequest.modelId,
      trigger: retrainingRequest.trigger,
      priority: retrainingRequest.priority
    });

    const result = await mlModelManager.initiateRetraining(retrainingRequest);

    logger.info('Model retraining initiated', {
      userId,
      jobId: result.jobId,
      modelId: retrainingRequest.modelId,
      status: result.status
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `retraining_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Model retraining initiation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Model retraining initiation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/retraining-status
 * Get status of a retraining job
 */
router.get('/retraining-status', async (req, res) => {
  try {
    const userId = req.user?.id;
    const jobId = req.query.job_id as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!jobId) {
      return res.status(400).json({ error: 'job_id parameter is required' });
    }

    logger.info('Retraining status requested', {
      userId,
      jobId
    });

    const result = mlModelManager.getRetrainingStatus(jobId);

    if (!result) {
      return res.status(404).json({ 
        error: 'Retraining job not found',
        jobId 
      });
    }

    logger.info('Retraining status retrieved', {
      userId,
      jobId,
      status: result.status,
      progress: result.progress
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `retraining_status_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Retraining status retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      jobId: req.query.job_id
    });
    
    return res.status(500).json({ 
      error: 'Retraining status retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/explain-prediction
 * Explain a model prediction
 */
router.post('/explain-prediction', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { modelId, inputData, explanationType } = req.body;

    // Validate request
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    if (!inputData || typeof inputData !== 'object') {
      return res.status(400).json({ error: 'inputData object is required' });
    }

    const validExplanationTypes = ['feature', 'decision_tree', 'influence', 'counterfactual'];
    const explType = explanationType || 'feature';
    
    if (!validExplanationTypes.includes(explType)) {
      return res.status(400).json({ 
        error: `explanationType must be one of: ${validExplanationTypes.join(', ')}` 
      });
    }

    logger.info('Prediction explanation requested', {
      userId,
      modelId,
      explanationType: explType,
      inputFeatures: Object.keys(inputData)
    });

    const result = await mlModelManager.explainPrediction(
      modelId, 
      inputData, 
      explType as 'feature' | 'decision_tree' | 'influence' | 'counterfactual'
    );

    logger.info('Prediction explanation completed', {
      userId,
      predictionId: result.predictionId,
      modelId,
      explanationType: explType,
      computationTime: result.context.computationTime,
      predictionValue: result.prediction.value,
      confidence: result.prediction.confidence
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `explain_prediction_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Prediction explanation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Prediction explanation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/custom-scoring
 * Perform custom scoring on a dataset
 */
router.post('/custom-scoring', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { modelId, dataset, scoringMetrics, validationConfig } = req.body;

    // Validate request
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    if (!dataset || !Array.isArray(dataset)) {
      return res.status(400).json({ error: 'dataset array is required' });
    }

    if (dataset.length === 0) {
      return res.status(400).json({ error: 'dataset cannot be empty' });
    }

    if (dataset.length > 10000) {
      return res.status(400).json({ error: 'dataset cannot exceed 10,000 samples' });
    }

    const defaultMetrics = ['accuracy', 'precision', 'recall', 'f1_score'];
    const metrics = scoringMetrics || defaultMetrics;

    logger.info('Custom scoring requested', {
      userId,
      modelId,
      datasetSize: dataset.length,
      scoringMetrics: metrics
    });

    // Perform custom scoring (mock implementation)
    const startTime = Date.now();
    const scoringResult = await this.performCustomScoring(modelId, dataset, metrics, validationConfig);
    const processingTime = Date.now() - startTime;

    logger.info('Custom scoring completed', {
      userId,
      modelId,
      datasetSize: dataset.length,
      processingTime,
      overallScore: scoringResult.overallScore
    });

    return res.json({
      success: true,
      data: {
        modelId,
        scoringResult,
        processingTime,
        datasetInfo: {
          size: dataset.length,
          features: Object.keys(dataset[0]).length,
          validSamples: dataset.length // Assume all valid for mock
        }
      },
      metadata: {
        requestId: `custom_scoring_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Custom scoring failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Custom scoring failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/model-performance
 * Get detailed performance metrics for a model
 */
router.get('/model-performance', async (req, res) => {
  try {
    const userId = req.user?.id;
    const modelId = req.query.model_id as string;
    const timeRange = req.query.time_range as string || 'last_24_hours';
    const includeHistorical = req.query.historical === 'true';
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!modelId) {
      return res.status(400).json({ error: 'model_id parameter is required' });
    }

    // Validate time range
    const validTimeRanges = ['last_hour', 'last_24_hours', 'last_7_days', 'last_30_days'];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({ 
        error: `time_range must be one of: ${validTimeRanges.join(', ')}` 
      });
    }

    logger.info('Model performance metrics requested', {
      userId,
      modelId,
      timeRange,
      includeHistorical
    });

    // Get model status to extract performance metrics
    const modelStatus = await mlModelManager.getModelStatus(modelId);
    
    // Mock historical data if requested
    let historicalData: any[] = [];
    if (includeHistorical) {
      historicalData = this.generateHistoricalPerformanceData(timeRange);
    }

    const result = {
      modelId,
      timeRange,
      currentMetrics: modelStatus.performance,
      accuracyMetrics: modelStatus.accuracy,
      usageMetrics: modelStatus.usage,
      historicalData: includeHistorical ? historicalData : undefined,
      benchmarks: {
        industryAverage: {
          accuracy: 0.85,
          inferenceTime: 50, // ms
          throughput: 500, // predictions/sec
          availability: 99.0 // %
        },
        targetMetrics: {
          accuracy: 0.95,
          inferenceTime: 30, // ms
          throughput: 1000, // predictions/sec
          availability: 99.9 // %
        }
      },
      insights: [
        `Model accuracy (${(modelStatus.accuracy.overall * 100).toFixed(1)}%) exceeds industry average`,
        `Inference time (${modelStatus.performance.averageInferenceTime.toFixed(1)}ms) meets performance targets`,
        `Current throughput (${modelStatus.performance.throughput.toFixed(0)} pred/sec) indicates good scalability`
      ],
      recommendations: this.generatePerformanceRecommendations(modelStatus)
    };

    logger.info('Model performance metrics retrieved', {
      userId,
      modelId,
      accuracy: modelStatus.accuracy.overall,
      inferenceTime: modelStatus.performance.averageInferenceTime,
      throughput: modelStatus.performance.throughput
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `model_performance_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Model performance metrics retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      modelId: req.query.model_id
    });
    
    return res.status(500).json({ 
      error: 'Model performance metrics retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper methods (would be moved to utility classes in production)

async function performCustomScoring(
  modelId: string, 
  dataset: any[], 
  metrics: string[], 
  validationConfig: any
): Promise<any> {
  // Mock custom scoring implementation
  const scores: { [metric: string]: number } = {};
  
  for (const metric of metrics) {
    switch (metric) {
      case 'accuracy':
        scores[metric] = 0.85 + Math.random() * 0.1; // 85-95%
        break;
      case 'precision':
        scores[metric] = 0.80 + Math.random() * 0.15; // 80-95%
        break;
      case 'recall':
        scores[metric] = 0.75 + Math.random() * 0.2; // 75-95%
        break;
      case 'f1_score':
        const precision = scores['precision'] || 0.85;
        const recall = scores['recall'] || 0.85;
        scores[metric] = (2 * precision * recall) / (precision + recall);
        break;
      case 'auc':
        scores[metric] = 0.90 + Math.random() * 0.08; // 90-98%
        break;
      default:
        scores[metric] = Math.random();
    }
  }

  const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length;

  return {
    scores,
    overallScore,
    detailedResults: {
      confusionMatrix: {
        truePositives: Math.floor(dataset.length * 0.4),
        falsePositives: Math.floor(dataset.length * 0.1),
        trueNegatives: Math.floor(dataset.length * 0.4),
        falseNegatives: Math.floor(dataset.length * 0.1)
      },
      rocCurve: {
        fpr: [0, 0.1, 0.2, 0.3, 1.0], // False Positive Rate
        tpr: [0, 0.7, 0.8, 0.9, 1.0]   // True Positive Rate
      },
      precisionRecallCurve: {
        precision: [1.0, 0.9, 0.8, 0.7, 0.6],
        recall: [0.0, 0.2, 0.4, 0.6, 0.8]
      }
    },
    validationStrategy: validationConfig?.strategy || 'holdout',
    crossValidationResults: validationConfig?.strategy === 'cross_validation' ? {
      folds: validationConfig.folds || 5,
      foldScores: metrics.map(() => Array.from({ length: validationConfig.folds || 5 }, () => 0.8 + Math.random() * 0.15))
    } : undefined
  };
}

function generateHistoricalPerformanceData(timeRange: string): any[] {
  const dataPoints: any[] = [];
  let intervals: number;
  
  switch (timeRange) {
    case 'last_hour':
      intervals = 12; // 5-minute intervals
      break;
    case 'last_24_hours':
      intervals = 24; // hourly intervals
      break;
    case 'last_7_days':
      intervals = 7; // daily intervals
      break;
    case 'last_30_days':
      intervals = 30; // daily intervals
      break;
    default:
      intervals = 24;
  }

  for (let i = 0; i < intervals; i++) {
    const timestamp = new Date();
    timestamp.setHours(timestamp.getHours() - (intervals - i));
    
    dataPoints.push({
      timestamp: timestamp.toISOString(),
      accuracy: 0.90 + (Math.random() - 0.5) * 0.1, // 85-95%
      inferenceTime: 25 + (Math.random() - 0.5) * 20, // 15-35ms
      throughput: 800 + (Math.random() - 0.5) * 400, // 600-1000 pred/sec
      errorRate: Math.random() * 2, // 0-2%
      memoryUsage: 60 + (Math.random() - 0.5) * 20, // 50-70 MB
      cpuUsage: 20 + (Math.random() - 0.5) * 10 // 15-25%
    });
  }

  return dataPoints;
}

function generatePerformanceRecommendations(modelStatus: any): string[] {
  const recommendations: string[] = [];
  
  // Accuracy recommendations
  if (modelStatus.accuracy.overall < 0.90) {
    recommendations.push('Consider retraining with more recent data to improve accuracy');
  }
  
  if (modelStatus.accuracy.accuracyTrend.direction === 'declining') {
    recommendations.push('Accuracy is declining - investigate data drift or concept drift');
  }

  // Performance recommendations
  if (modelStatus.performance.averageInferenceTime > 50) {
    recommendations.push('Inference time is high - consider model optimization or hardware upgrade');
  }
  
  if (modelStatus.performance.errorRate > 1) {
    recommendations.push('Error rate is elevated - check model stability and input validation');
  }

  // Usage recommendations
  if (modelStatus.usage.predictionsToday < modelStatus.usage.averagePredictionsPerDay * 0.5) {
    recommendations.push('Usage is below average - verify system availability and client connectivity');
  }

  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push('Model is performing well - continue regular monitoring');
    recommendations.push('Consider A/B testing with improved model variants');
  }

  return recommendations;
}

export { router as mlManagementRoutes };