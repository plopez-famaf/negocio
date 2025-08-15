import { logger } from '@/lib/logger';
import { IMLModel, ModelInfo, ModelType, ModelStatus } from './model-interfaces';

/**
 * Central registry for managing ML models
 * Handles model lifecycle, loading, and routing
 */
export class MLModelRegistry {
  private models: Map<string, IMLModel> = new Map();
  private modelTypes: Map<ModelType, string[]> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Initialize model type mapping
    Object.values(ModelType).forEach(type => {
      this.modelTypes.set(type, []);
    });
  }

  /**
   * Initialize the model registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing ML Model Registry');

    try {
      // Auto-discover and register models
      await this.discoverModels();
      
      // Load default models
      await this.loadDefaultModels();
      
      this.initialized = true;
      
      logger.info('ML Model Registry initialized successfully', {
        totalModels: this.models.size,
        modelTypes: Array.from(this.modelTypes.keys())
      });

    } catch (error) {
      logger.error('Failed to initialize ML Model Registry', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Register a model with the registry
   */
  async registerModel(model: IMLModel): Promise<void> {
    logger.info(`Registering model: ${model.modelName}`, {
      modelId: model.modelId,
      version: model.version
    });

    try {
      // Initialize the model if not already done
      if (!model.isLoaded) {
        await model.initialize();
      }

      // Add to registry
      this.models.set(model.modelId, model);
      
      // Update type mapping
      const modelInfo = model.getModelInfo();
      const typeModels = this.modelTypes.get(modelInfo.type) || [];
      if (!typeModels.includes(model.modelId)) {
        typeModels.push(model.modelId);
        this.modelTypes.set(modelInfo.type, typeModels);
      }

      logger.info(`Model registered successfully`, {
        modelId: model.modelId,
        type: modelInfo.type
      });

    } catch (error) {
      logger.error(`Failed to register model: ${model.modelName}`, {
        modelId: model.modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Unregister a model from the registry
   */
  unregisterModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (!model) {
      logger.warn(`Attempted to unregister unknown model: ${modelId}`);
      return;
    }

    // Remove from type mapping
    const modelInfo = model.getModelInfo();
    const typeModels = this.modelTypes.get(modelInfo.type) || [];
    const index = typeModels.indexOf(modelId);
    if (index > -1) {
      typeModels.splice(index, 1);
      this.modelTypes.set(modelInfo.type, typeModels);
    }

    // Remove from registry
    this.models.delete(modelId);

    logger.info(`Model unregistered`, { modelId });
  }

  /**
   * Get a model by ID
   */
  getModel(modelId: string): IMLModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all models of a specific type
   */
  getModelsByType(type: ModelType): IMLModel[] {
    const modelIds = this.modelTypes.get(type) || [];
    return modelIds.map(id => this.models.get(id)).filter(Boolean) as IMLModel[];
  }

  /**
   * Get the best model for a specific type based on performance
   */
  getBestModel(type: ModelType): IMLModel | undefined {
    const models = this.getModelsByType(type);
    if (models.length === 0) {
      return undefined;
    }

    // Find model with highest accuracy
    let bestModel = models[0];
    let bestAccuracy = 0;

    for (const model of models) {
      const info = model.getModelInfo();
      if (info.performance.accuracy > bestAccuracy) {
        bestAccuracy = info.performance.accuracy;
        bestModel = model;
      }
    }

    return bestModel;
  }

  /**
   * Get all model information
   */
  getAllModelInfo(): ModelInfo[] {
    return Array.from(this.models.values()).map(model => model.getModelInfo());
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalModels: number;
    modelsByType: Record<string, number>;
    modelsByStatus: Record<string, number>;
    averageAccuracy: number;
  } {
    const allInfo = this.getAllModelInfo();
    
    const modelsByType: Record<string, number> = {};
    const modelsByStatus: Record<string, number> = {};
    let totalAccuracy = 0;

    for (const info of allInfo) {
      // Count by type
      modelsByType[info.type] = (modelsByType[info.type] || 0) + 1;
      
      // Count by status
      modelsByStatus[info.status] = (modelsByStatus[info.status] || 0) + 1;
      
      // Sum accuracy
      totalAccuracy += info.performance.accuracy;
    }

    return {
      totalModels: this.models.size,
      modelsByType,
      modelsByStatus,
      averageAccuracy: allInfo.length > 0 ? totalAccuracy / allInfo.length : 0
    };
  }

  /**
   * Check if registry is healthy
   */
  isHealthy(): boolean {
    if (!this.initialized) {
      return false;
    }

    // Check if we have at least one model of each critical type
    const criticalTypes = [
      ModelType.ANOMALY_DETECTION,
      ModelType.THREAT_CLASSIFICATION
    ];

    for (const type of criticalTypes) {
      const models = this.getModelsByType(type);
      const healthyModels = models.filter(model => {
        const info = model.getModelInfo();
        return info.status === ModelStatus.READY && model.isLoaded;
      });

      if (healthyModels.length === 0) {
        logger.warn(`No healthy models available for type: ${type}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Perform health check on all models
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    models: Array<{
      modelId: string;
      name: string;
      status: ModelStatus;
      isLoaded: boolean;
      lastCheck: string;
    }>;
  }> {
    logger.info('Performing ML models health check');

    const results: Array<{
      modelId: string;
      name: string;
      status: ModelStatus;
      isLoaded: boolean;
      lastCheck: string;
    }> = [];

    let allHealthy = true;

    for (const model of this.models.values()) {
      const info = model.getModelInfo();
      const result = {
        modelId: model.modelId,
        name: model.modelName,
        status: info.status,
        isLoaded: model.isLoaded,
        lastCheck: new Date().toISOString()
      };

      results.push(result);

      if (info.status !== ModelStatus.READY || !model.isLoaded) {
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      models: results
    };
  }

  /**
   * Auto-discover available models
   */
  private async discoverModels(): Promise<void> {
    logger.info('Discovering available ML models');
    
    // In a real implementation, this would scan directories or configuration
    // to find available model classes and automatically register them
    
    // For now, we'll use a placeholder implementation
    logger.info('Model discovery completed', {
      discoveredCount: 0
    });
  }

  /**
   * Load default models that should always be available
   */
  private async loadDefaultModels(): Promise<void> {
    logger.info('Loading default ML models');
    
    // This would be implemented to load critical models
    // that should always be available for the threat detection system
    
    logger.info('Default models loading completed');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up ML Model Registry');

    // Clear all models
    this.models.clear();
    this.modelTypes.clear();
    this.initialized = false;

    logger.info('ML Model Registry cleanup completed');
  }
}

// Singleton instance
export const mlModelRegistry = new MLModelRegistry();