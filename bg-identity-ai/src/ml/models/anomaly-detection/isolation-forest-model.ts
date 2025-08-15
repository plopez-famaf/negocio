import { logger } from '@/lib/logger';
import { BaseMLModel } from '../base/base-model';
import { 
  ModelType, 
  AnomalyDetectionInput, 
  AnomalyResult,
  TrainingData,
  TrainingConfig,
  TrainingResult
} from '../base/model-interfaces';
import { Matrix } from 'ml-matrix';

/**
 * Isolation Forest implementation for network anomaly detection
 * Based on the principle that anomalies are few and different
 */
export class IsolationForestModel extends BaseMLModel {
  private trees: IsolationTree[] = [];
  private numTrees: number = 100;
  private subsampleSize: number = 256;
  private maxDepth: number = Math.ceil(Math.log2(256));
  private featureNames: string[] = [];
  private trainingStats: {
    meanScores: number[];
    stdScores: number[];
    minScore: number;
    maxScore: number;
  } | null = null;

  constructor() {
    super(
      'isolation-forest-v1',
      'Isolation Forest Anomaly Detector',
      '1.0.0',
      ModelType.ANOMALY_DETECTION
    );
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Isolation Forest model');
    
    try {
      // Set default feature names for network analysis
      this.featureNames = [
        'packet_size',
        'connection_frequency',
        'port_diversity',
        'protocol_type',
        'byte_rate',
        'connection_duration',
        'src_ip_reputation',
        'dst_ip_reputation',
        'time_of_day',
        'day_of_week'
      ];

      // If no trees exist, create default trained trees
      if (this.trees.length === 0) {
        await this.createDefaultModel();
      }

      this._isLoaded = true;
      this.setStatus(ModelType.ANOMALY_DETECTION as any);

      logger.info('Isolation Forest model initialized successfully', {
        numTrees: this.trees.length,
        features: this.featureNames.length
      });

    } catch (error) {
      logger.error('Failed to initialize Isolation Forest model', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async predict(input: AnomalyDetectionInput): Promise<AnomalyResult> {
    if (!this.isLoaded) {
      throw new Error('Model is not loaded');
    }

    const startTime = Date.now();

    try {
      // Extract features from input
      const features = this.extractFeatures(input);
      
      // Calculate anomaly score using isolation trees
      const scores = this.trees.map(tree => tree.pathLength(features));
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      // Normalize score to 0-1 range
      const normalizedScore = this.normalizeScore(avgScore);
      
      // Determine if it's an anomaly based on threshold
      const threshold = 0.6; // Can be made configurable
      const isAnomaly = normalizedScore > threshold;
      
      // Calculate confidence based on score consistency
      const scoreVariance = this.calculateVariance(scores);
      const confidence = Math.max(0, 1 - scoreVariance / 10); // Normalize variance to confidence
      
      // Determine severity
      const severity = this.determineSeverity(normalizedScore);
      
      // Generate explanation
      const explanation = this.generateExplanation(features, normalizedScore, isAnomaly);
      
      const inferenceTime = Date.now() - startTime;
      
      logger.debug('Anomaly prediction completed', {
        modelId: this.modelId,
        isAnomaly,
        score: normalizedScore,
        confidence,
        inferenceTime
      });

      return {
        isAnomaly,
        anomalyScore: normalizedScore,
        confidence,
        explanation,
        severity,
        metadata: {
          inferenceTime,
          avgPathLength: avgScore,
          scoreVariance,
          features: this.featureNames
        }
      };

    } catch (error) {
      logger.error('Anomaly prediction failed', {
        modelId: this.modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async train(data: TrainingData, config: TrainingConfig): Promise<TrainingResult> {
    logger.info('Starting Isolation Forest training', {
      dataSize: data.features.length,
      subsampleSize: config.hyperparameters?.subsampleSize || this.subsampleSize
    });

    const startTime = Date.now();

    try {
      // Update hyperparameters from config
      this.numTrees = config.hyperparameters?.numTrees || this.numTrees;
      this.subsampleSize = config.hyperparameters?.subsampleSize || this.subsampleSize;
      this.maxDepth = Math.ceil(Math.log2(this.subsampleSize));

      // Convert training data to matrix format
      const dataMatrix = new Matrix(data.features);
      const numFeatures = dataMatrix.columns;
      const numSamples = dataMatrix.rows;

      // Clear existing trees
      this.trees = [];

      // Train isolation trees
      for (let i = 0; i < this.numTrees; i++) {
        // Create random subsample
        const subsample = this.createSubsample(dataMatrix, this.subsampleSize);
        
        // Build isolation tree
        const tree = new IsolationTree(this.maxDepth);
        await tree.build(subsample, 0, numFeatures);
        
        this.trees.push(tree);
      }

      // Calculate training statistics
      await this.calculateTrainingStats(dataMatrix);

      const trainingTime = (Date.now() - startTime) / 1000;
      
      // Evaluate on training data (for basic validation)
      const metrics = await this.evaluate(data.features.map((features, index) => ({
        features,
        label: data.labels ? data.labels[index] : false // Default to non-anomaly
      })));

      this._isLoaded = true;

      const result: TrainingResult = {
        modelId: this.modelId,
        metrics,
        hyperparameters: {
          numTrees: this.numTrees,
          subsampleSize: this.subsampleSize,
          maxDepth: this.maxDepth
        },
        trainingTime,
        iterations: this.numTrees,
        convergence: true,
        losses: [], // Not applicable for Isolation Forest
        validationLosses: []
      };

      logger.info('Isolation Forest training completed', {
        trainingTime,
        accuracy: metrics.accuracy,
        numTrees: this.numTrees
      });

      return result;

    } catch (error) {
      logger.error('Isolation Forest training failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  protected validateInput(input: AnomalyDetectionInput): boolean {
    if (!input || !input.features) {
      return false;
    }

    // Check if features array has the expected number of elements
    if (input.features.length !== this.featureNames.length) {
      logger.warn('Feature count mismatch', {
        expected: this.featureNames.length,
        received: input.features.length
      });
      return false;
    }

    // Check for valid numeric features
    return input.features.every(feature => 
      typeof feature === 'number' && !isNaN(feature) && isFinite(feature)
    );
  }

  protected preprocessInput(input: AnomalyDetectionInput): number[] {
    // Normalize features if training stats are available
    if (this.trainingStats) {
      return input.features.map((feature, index) => {
        const mean = this.trainingStats!.meanScores[index] || 0;
        const std = this.trainingStats!.stdScores[index] || 1;
        return (feature - mean) / (std || 1);
      });
    }

    return input.features;
  }

  protected postprocessOutput(output: AnomalyResult): AnomalyResult {
    // Add model-specific metadata
    return {
      ...output,
      metadata: {
        ...output.metadata,
        modelType: 'isolation-forest',
        version: this.version,
        timestamp: new Date().toISOString()
      }
    };
  }

  protected getModelDescription(): string {
    return 'Isolation Forest model for detecting network anomalies using ensemble of isolation trees';
  }

  protected getFeatureNames(): string[] {
    return [...this.featureNames];
  }

  protected getTrainingDataInfo(): { size: number; lastUpdated: string; sources: string[] } {
    return {
      size: this.trees.length * this.subsampleSize,
      lastUpdated: this._updatedAt,
      sources: ['network-logs', 'security-events']
    };
  }

  protected async serializeModel(): Promise<any> {
    return {
      trees: this.trees.map(tree => tree.serialize()),
      numTrees: this.numTrees,
      subsampleSize: this.subsampleSize,
      maxDepth: this.maxDepth,
      featureNames: this.featureNames,
      trainingStats: this.trainingStats
    };
  }

  protected async deserializeModel(modelState: any): Promise<void> {
    this.numTrees = modelState.numTrees;
    this.subsampleSize = modelState.subsampleSize;
    this.maxDepth = modelState.maxDepth;
    this.featureNames = modelState.featureNames;
    this.trainingStats = modelState.trainingStats;
    
    // Deserialize trees
    this.trees = modelState.trees.map((treeData: any) => {
      const tree = new IsolationTree(this.maxDepth);
      tree.deserialize(treeData);
      return tree;
    });
  }

  // Private helper methods
  private extractFeatures(input: AnomalyDetectionInput): number[] {
    // If input already has features, use them
    if (input.features && input.features.length > 0) {
      return input.features;
    }

    // Otherwise, extract features from metadata
    const metadata = input.metadata || {};
    const features: number[] = [];

    // Extract network-based features
    features.push(metadata.packetSize || 0);
    features.push(metadata.connectionFrequency || 0);
    features.push(metadata.portDiversity || 0);
    features.push(this.encodeProtocol(metadata.protocol));
    features.push(metadata.byteRate || 0);
    features.push(metadata.connectionDuration || 0);
    features.push(metadata.srcIpReputation || 0.5);
    features.push(metadata.dstIpReputation || 0.5);
    features.push(this.timeToHour(input.timestamp));
    features.push(this.timestampToDayOfWeek(input.timestamp));

    return features;
  }

  private encodeProtocol(protocol?: string): number {
    const protocolMap: Record<string, number> = {
      'tcp': 1,
      'udp': 2,
      'icmp': 3,
      'http': 4,
      'https': 5
    };
    return protocolMap[protocol?.toLowerCase() || ''] || 0;
  }

  private timeToHour(timestamp: string): number {
    const date = new Date(timestamp);
    return date.getHours();
  }

  private timestampToDayOfWeek(timestamp: string): number {
    const date = new Date(timestamp);
    return date.getDay();
  }

  private normalizeScore(score: number): number {
    if (!this.trainingStats) {
      // Use heuristic normalization
      const c = 2 * (Math.log(this.subsampleSize - 1) + 0.5772156649) - 
               2 * (this.subsampleSize - 1) / this.subsampleSize;
      return Math.pow(2, -score / c);
    }

    // Use training statistics for normalization
    const { minScore, maxScore } = this.trainingStats;
    return (score - minScore) / (maxScore - minScore || 1);
  }

  private calculateVariance(scores: number[]): number {
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  private determineSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.9) return 'critical';
    if (score >= 0.75) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }

  private generateExplanation(features: number[], score: number, isAnomaly: boolean): string {
    if (!isAnomaly) {
      return 'Network behavior appears normal based on learned patterns';
    }

    const topAnomalousFeatures = this.identifyAnomalousFeatures(features);
    const featureDescriptions = topAnomalousFeatures
      .map(index => this.featureNames[index])
      .join(', ');

    return `Anomalous network behavior detected (score: ${score.toFixed(3)}). ` +
           `Primary indicators: ${featureDescriptions}`;
  }

  private identifyAnomalousFeatures(features: number[]): number[] {
    // Simple heuristic: return top 3 features with highest absolute values
    return features
      .map((value, index) => ({ value: Math.abs(value), index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map(item => item.index);
  }

  private createSubsample(data: Matrix, size: number): Matrix {
    const numSamples = data.rows;
    const subsampleSize = Math.min(size, numSamples);
    
    // Create random indices
    const indices: number[] = [];
    for (let i = 0; i < subsampleSize; i++) {
      indices.push(Math.floor(Math.random() * numSamples));
    }

    // Extract subsampled rows
    const subsampleData: number[][] = [];
    for (const index of indices) {
      subsampleData.push(data.getRow(index));
    }

    return new Matrix(subsampleData);
  }

  private async calculateTrainingStats(data: Matrix): Promise<void> {
    const numFeatures = data.columns;
    const meanScores: number[] = [];
    const stdScores: number[] = [];
    
    // Calculate mean and std for each feature
    for (let i = 0; i < numFeatures; i++) {
      const column = data.getColumn(i);
      const mean = column.reduce((sum, val) => sum + val, 0) / column.length;
      const variance = column.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / column.length;
      
      meanScores.push(mean);
      stdScores.push(Math.sqrt(variance));
    }

    // Calculate score range for all samples
    const allScores: number[] = [];
    for (let i = 0; i < data.rows; i++) {
      const row = data.getRow(i);
      const scores = this.trees.map(tree => tree.pathLength(row));
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      allScores.push(avgScore);
    }

    this.trainingStats = {
      meanScores,
      stdScores,
      minScore: Math.min(...allScores),
      maxScore: Math.max(...allScores)
    };
  }

  private async createDefaultModel(): Promise<void> {
    // Create a basic model with synthetic data for initial functionality
    logger.info('Creating default Isolation Forest model with synthetic data');
    
    // Generate synthetic network data
    const syntheticData = this.generateSyntheticNetworkData(1000);
    const trainingData: TrainingData = {
      features: syntheticData,
      labels: syntheticData.map(() => false), // All normal data
      metadata: {
        size: syntheticData.length,
        source: 'synthetic',
        version: '1.0',
        createdAt: new Date().toISOString()
      }
    };

    const config: TrainingConfig = {
      algorithm: 'isolation-forest',
      hyperparameters: {
        numTrees: 50,
        subsampleSize: 256
      },
      validationSplit: 0.2
    };

    await this.train(trainingData, config);
  }

  private generateSyntheticNetworkData(count: number): number[][] {
    const data: number[][] = [];
    
    for (let i = 0; i < count; i++) {
      data.push([
        Math.random() * 10000,        // packet_size
        Math.random() * 100,          // connection_frequency
        Math.floor(Math.random() * 10), // port_diversity
        Math.floor(Math.random() * 5),  // protocol_type
        Math.random() * 1000000,      // byte_rate
        Math.random() * 3600,         // connection_duration
        0.3 + Math.random() * 0.4,    // src_ip_reputation
        0.3 + Math.random() * 0.4,    // dst_ip_reputation
        Math.floor(Math.random() * 24), // time_of_day
        Math.floor(Math.random() * 7)   // day_of_week
      ]);
    }
    
    return data;
  }
}

/**
 * Individual isolation tree implementation
 */
class IsolationTree {
  private root: TreeNode | null = null;
  private maxDepth: number;

  constructor(maxDepth: number) {
    this.maxDepth = maxDepth;
  }

  async build(data: Matrix, currentDepth: number, numFeatures: number): Promise<void> {
    this.root = this.buildNode(data, currentDepth, numFeatures);
  }

  pathLength(sample: number[]): number {
    return this.calculatePathLength(sample, this.root, 0);
  }

  serialize(): any {
    return {
      root: this.serializeNode(this.root),
      maxDepth: this.maxDepth
    };
  }

  deserialize(data: any): void {
    this.maxDepth = data.maxDepth;
    this.root = this.deserializeNode(data.root);
  }

  private buildNode(data: Matrix, depth: number, numFeatures: number): TreeNode {
    // Stopping criteria
    if (depth >= this.maxDepth || data.rows <= 1) {
      return { type: 'leaf', size: data.rows };
    }

    // Select random feature and split point
    const featureIndex = Math.floor(Math.random() * numFeatures);
    const column = data.getColumn(featureIndex);
    const minVal = Math.min(...column);
    const maxVal = Math.max(...column);
    
    if (minVal === maxVal) {
      return { type: 'leaf', size: data.rows };
    }

    const splitPoint = minVal + Math.random() * (maxVal - minVal);

    // Split data
    const leftRows: number[] = [];
    const rightRows: number[] = [];

    for (let i = 0; i < data.rows; i++) {
      if (data.get(i, featureIndex) < splitPoint) {
        leftRows.push(i);
      } else {
        rightRows.push(i);
      }
    }

    // Create child datasets
    const leftData = new Matrix(leftRows.map(i => data.getRow(i)));
    const rightData = new Matrix(rightRows.map(i => data.getRow(i)));

    // Recursively build children
    const leftChild = this.buildNode(leftData, depth + 1, numFeatures);
    const rightChild = this.buildNode(rightData, depth + 1, numFeatures);

    return {
      type: 'internal',
      featureIndex,
      splitPoint,
      left: leftChild,
      right: rightChild
    };
  }

  private calculatePathLength(sample: number[], node: TreeNode | null, depth: number): number {
    if (!node) {
      return depth;
    }

    if (node.type === 'leaf') {
      // Add average path length for remaining samples in leaf
      return depth + this.averagePathLength(node.size);
    }

    // Navigate to appropriate child
    if (sample[node.featureIndex!] < node.splitPoint!) {
      return this.calculatePathLength(sample, node.left!, depth + 1);
    } else {
      return this.calculatePathLength(sample, node.right!, depth + 1);
    }
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
  }

  private serializeNode(node: TreeNode | null): any {
    if (!node) return null;
    
    if (node.type === 'leaf') {
      return { type: 'leaf', size: node.size };
    }

    return {
      type: 'internal',
      featureIndex: node.featureIndex,
      splitPoint: node.splitPoint,
      left: this.serializeNode(node.left!),
      right: this.serializeNode(node.right!)
    };
  }

  private deserializeNode(data: any): TreeNode | null {
    if (!data) return null;
    
    if (data.type === 'leaf') {
      return { type: 'leaf', size: data.size };
    }

    return {
      type: 'internal',
      featureIndex: data.featureIndex,
      splitPoint: data.splitPoint,
      left: this.deserializeNode(data.left),
      right: this.deserializeNode(data.right)
    };
  }
}

interface TreeNode {
  type: 'leaf' | 'internal';
  size?: number;
  featureIndex?: number;
  splitPoint?: number;
  left?: TreeNode;
  right?: TreeNode;
}