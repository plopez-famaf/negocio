import { logger } from '@/lib/logger';
import { 
  IMLModel, 
  ModelInfo, 
  ModelMetrics, 
  ModelType, 
  ModelStatus,
  TrainingData,
  TrainingConfig,
  TrainingResult
} from './model-interfaces';

/**
 * Abstract base class for all ML models
 * Provides common functionality and enforces interface compliance
 */
export abstract class BaseMLModel implements IMLModel {
  public readonly modelId: string;
  public readonly modelName: string;
  public readonly version: string;
  public readonly modelType: ModelType;
  
  protected _isLoaded: boolean = false;
  protected _status: ModelStatus = ModelStatus.READY;
  protected _performance: ModelMetrics | null = null;
  protected _createdAt: string;
  protected _updatedAt: string;
  
  constructor(
    modelId: string,
    modelName: string,
    version: string,
    modelType: ModelType
  ) {
    this.modelId = modelId;
    this.modelName = modelName;
    this.version = version;
    this.modelType = modelType;
    this._createdAt = new Date().toISOString();
    this._updatedAt = new Date().toISOString();
    
    logger.info(`Initializing ML model: ${modelName}`, {
      modelId,
      version,
      type: modelType
    });
  }

  // Abstract methods that must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract predict(input: any): Promise<any>;
  abstract train(data: TrainingData, config: TrainingConfig): Promise<TrainingResult>;
  protected abstract validateInput(input: any): boolean;
  protected abstract preprocessInput(input: any): any;
  protected abstract postprocessOutput(output: any): any;

  // Concrete implementations
  public get isLoaded(): boolean {
    return this._isLoaded;
  }

  public get status(): ModelStatus {
    return this._status;
  }

  public async evaluate(testData: any[]): Promise<ModelMetrics> {
    logger.info(`Evaluating model: ${this.modelName}`, {
      testDataSize: testData.length
    });

    const startTime = Date.now();
    let correctPredictions = 0;
    let totalPredictions = testData.length;
    const predictions: any[] = [];
    const actualLabels: any[] = [];

    try {
      for (const sample of testData) {
        const prediction = await this.predict(sample.features);
        predictions.push(prediction);
        actualLabels.push(sample.label);
        
        if (this.comparePrediction(prediction, sample.label)) {
          correctPredictions++;
        }
      }

      const accuracy = correctPredictions / totalPredictions;
      const inferenceTime = (Date.now() - startTime) / totalPredictions;
      const memoryUsage = this.getMemoryUsage();

      const metrics: ModelMetrics = {
        accuracy,
        precision: this.calculatePrecision(predictions, actualLabels),
        recall: this.calculateRecall(predictions, actualLabels),
        f1Score: 0, // Will be calculated
        inferenceTime,
        memoryUsage,
        timestamp: new Date().toISOString()
      };

      metrics.f1Score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall);
      
      this._performance = metrics;
      this._updatedAt = new Date().toISOString();

      logger.info(`Model evaluation completed`, {
        modelId: this.modelId,
        accuracy: metrics.accuracy,
        inferenceTime: metrics.inferenceTime
      });

      return metrics;

    } catch (error) {
      logger.error(`Model evaluation failed`, {
        modelId: this.modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async save(path: string): Promise<void> {
    logger.info(`Saving model to: ${path}`, { modelId: this.modelId });
    
    try {
      const modelData = {
        modelId: this.modelId,
        modelName: this.modelName,
        version: this.version,
        modelType: this.modelType,
        performance: this._performance,
        createdAt: this._createdAt,
        updatedAt: this._updatedAt,
        modelState: await this.serializeModel()
      };

      // In a real implementation, this would save to filesystem or cloud storage
      // For now, we'll use a simple JSON serialization approach
      await this.saveModelData(path, modelData);
      
      logger.info(`Model saved successfully`, { 
        modelId: this.modelId,
        path 
      });

    } catch (error) {
      logger.error(`Failed to save model`, {
        modelId: this.modelId,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async load(path: string): Promise<void> {
    logger.info(`Loading model from: ${path}`, { modelId: this.modelId });
    
    try {
      const modelData = await this.loadModelData(path);
      
      // Validate model compatibility
      if (modelData.modelId !== this.modelId) {
        throw new Error(`Model ID mismatch: expected ${this.modelId}, got ${modelData.modelId}`);
      }

      await this.deserializeModel(modelData.modelState);
      
      this._performance = modelData.performance;
      this._createdAt = modelData.createdAt;
      this._updatedAt = modelData.updatedAt;
      this._isLoaded = true;
      this._status = ModelStatus.READY;

      logger.info(`Model loaded successfully`, { 
        modelId: this.modelId,
        version: this.version 
      });

    } catch (error) {
      this._status = ModelStatus.ERROR;
      logger.error(`Failed to load model`, {
        modelId: this.modelId,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public getModelInfo(): ModelInfo {
    return {
      id: this.modelId,
      name: this.modelName,
      version: this.version,
      type: this.modelType,
      description: this.getModelDescription(),
      features: this.getFeatureNames(),
      trainingData: this.getTrainingDataInfo(),
      performance: this._performance || this.getDefaultMetrics(),
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }

  // Protected helper methods
  protected setStatus(status: ModelStatus): void {
    this._status = status;
    this._updatedAt = new Date().toISOString();
    
    logger.info(`Model status changed`, {
      modelId: this.modelId,
      status
    });
  }

  protected async safePredict(input: any): Promise<any> {
    if (!this._isLoaded) {
      throw new Error(`Model ${this.modelName} is not loaded`);
    }

    if (!this.validateInput(input)) {
      throw new Error(`Invalid input for model ${this.modelName}`);
    }

    const startTime = Date.now();
    try {
      const preprocessedInput = this.preprocessInput(input);
      const rawOutput = await this.predict(preprocessedInput);
      const postprocessedOutput = this.postprocessOutput(rawOutput);
      
      const inferenceTime = Date.now() - startTime;
      
      logger.debug(`Prediction completed`, {
        modelId: this.modelId,
        inferenceTime
      });

      return postprocessedOutput;

    } catch (error) {
      logger.error(`Prediction failed`, {
        modelId: this.modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Abstract methods for subclasses to implement
  protected abstract getModelDescription(): string;
  protected abstract getFeatureNames(): string[];
  protected abstract getTrainingDataInfo(): { size: number; lastUpdated: string; sources: string[] };
  protected abstract serializeModel(): Promise<any>;
  protected abstract deserializeModel(modelState: any): Promise<void>;

  // Private helper methods
  private comparePrediction(prediction: any, actual: any): boolean {
    // Simple comparison logic - can be overridden by subclasses
    if (typeof prediction === 'object' && typeof actual === 'object') {
      return JSON.stringify(prediction) === JSON.stringify(actual);
    }
    return prediction === actual;
  }

  private calculatePrecision(predictions: any[], actuals: any[]): number {
    // Simplified precision calculation
    // In practice, this would be more sophisticated based on the model type
    let truePositives = 0;
    let falsePositives = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predicted = this.isPositive(predictions[i]);
      const actual = this.isPositive(actuals[i]);
      
      if (predicted && actual) {
        truePositives++;
      } else if (predicted && !actual) {
        falsePositives++;
      }
    }

    return truePositives + falsePositives === 0 ? 0 : truePositives / (truePositives + falsePositives);
  }

  private calculateRecall(predictions: any[], actuals: any[]): number {
    // Simplified recall calculation
    let truePositives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predicted = this.isPositive(predictions[i]);
      const actual = this.isPositive(actuals[i]);
      
      if (predicted && actual) {
        truePositives++;
      } else if (!predicted && actual) {
        falseNegatives++;
      }
    }

    return truePositives + falseNegatives === 0 ? 0 : truePositives / (truePositives + falseNegatives);
  }

  private isPositive(value: any): boolean {
    // Simple heuristic to determine if a prediction is "positive"
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0.5;
    if (typeof value === 'object' && value.isAnomaly !== undefined) return value.isAnomaly;
    if (typeof value === 'object' && value.riskScore !== undefined) return value.riskScore > 0.5;
    return false;
  }

  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return Math.round(used.heapUsed / 1024 / 1024 * 100) / 100; // MB
  }

  private getDefaultMetrics(): ModelMetrics {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      inferenceTime: 0,
      memoryUsage: 0,
      timestamp: new Date().toISOString()
    };
  }

  private async saveModelData(path: string, data: any): Promise<void> {
    // Placeholder implementation
    // In practice, this would write to filesystem, S3, or other storage
    logger.debug(`Saving model data to ${path}`, { dataKeys: Object.keys(data) });
  }

  private async loadModelData(path: string): Promise<any> {
    // Placeholder implementation
    // In practice, this would read from filesystem, S3, or other storage
    logger.debug(`Loading model data from ${path}`);
    return {};
  }
}