# AI Engineering Foundations
## ThreatGuard Threat Detection and Behavioral Analysis

**Target Audience:** AI Engineers, ML Engineers, and Security Researchers  
**Prerequisites:** Machine Learning, Statistics, and Cybersecurity Fundamentals  
**Last Updated:** August 2025

---

## Table of Contents
1. [Theoretical Foundations](#theoretical-foundations)
2. [Threat Detection Algorithms](#threat-detection-algorithms)  
3. [Behavioral Analysis Models](#behavioral-analysis-models)
4. [Real-time ML Pipeline](#real-time-ml-pipeline)
5. [Performance Optimization](#performance-optimization)
6. [Model Architecture](#model-architecture)
7. [Implementation Patterns](#implementation-patterns)

---

## Theoretical Foundations

### Cybersecurity as a Machine Learning Problem

**Core Principle:** Security threats exhibit statistical patterns that can be learned and detected through anomaly detection, classification, and temporal analysis.

#### Problem Formulation
```mathematical
Let X = {x₁, x₂, ..., xₙ} be a stream of security events
Let f: X → {benign, malicious} be the threat classification function
Let g: X → [0, 1] be the risk scoring function
Let h: X × T → ℝ be the behavioral baseline function
```

**Key Challenges:**
- **High False Positive Rates**: Balancing sensitivity with precision in noisy environments
- **Concept Drift**: Adversarial actors continuously evolving attack patterns  
- **Real-time Constraints**: Sub-100ms inference requirements for live systems
- **Imbalanced Data**: Rare attack events vs. abundant benign activity
- **Feature Engineering**: Extracting meaningful signals from complex, high-dimensional data

### Mathematical Framework

#### Anomaly Detection Theory
**Statistical Foundation:** Identify observations that deviate significantly from established patterns.

```mathematical
Anomaly Score = P(x | θ) < τ
where:
- P(x | θ) = probability of observation x given model parameters θ  
- τ = threshold determined by false positive tolerance
```

**Distance-Based Methods:**
- **Mahalanobis Distance**: Accounts for feature correlation and scaling
- **Local Outlier Factor**: Density-based local anomaly scoring
- **Isolation Forest**: Tree-based isolation scoring for high-dimensional data

#### Behavioral Modeling Theory
**Time Series Analysis:** Model normal behavior patterns over temporal windows.

```mathematical
Behavioral Baseline: B(t) = μ(t) ± k·σ(t)
where:
- μ(t) = expected behavior at time t (seasonal trends)
- σ(t) = variance in behavior (uncertainty bounds)
- k = confidence interval multiplier (typically 2-3 standard deviations)
```

**Change Point Detection:**
- **Bayesian Online Change Point Detection**: Detect regime changes in behavioral patterns
- **CUSUM**: Cumulative sum control charts for detecting persistent changes
- **Page-Hinkley Test**: Sequential change detection with statistical guarantees

---

## Threat Detection Algorithms

### Real-time Threat Classification

#### Ensemble Approach
**Philosophy:** Combine multiple weak learners to create robust threat detection.

```python
class ThreatDetectionEnsemble:
    def __init__(self):
        self.models = {
            'anomaly_detector': IsolationForest(contamination=0.1),
            'pattern_classifier': RandomForestClassifier(n_estimators=100),
            'sequential_analyzer': LSTMThreatDetector(),
            'network_analyzer': GraphNeuralNetwork()
        }
        self.weights = [0.3, 0.25, 0.25, 0.2]  # Weighted voting
    
    def predict_threat(self, event_features):
        predictions = []
        for model_name, model in self.models.items():
            prediction = model.predict(event_features)
            predictions.append(prediction)
        
        # Weighted ensemble decision
        final_score = np.average(predictions, weights=self.weights)
        return final_score > 0.5  # Binary classification threshold
```

#### Feature Engineering Pipeline

**Raw Event Processing:**
```typescript
interface RawSecurityEvent {
  timestamp: string;
  source_ip: string;
  dest_ip: string;
  protocol: string;
  port: number;
  bytes_transferred: number;
  event_type: string;
  user_agent?: string;
  user_id?: string;
}

interface ProcessedFeatures {
  temporal: {
    hour_of_day: number;
    day_of_week: number;
    time_since_last_event: number;
    event_frequency_1h: number;
    event_frequency_24h: number;
  };
  network: {
    ip_reputation_score: number;
    geographic_distance: number;
    port_risk_score: number;
    protocol_anomaly_score: number;
  };
  behavioral: {
    deviation_from_baseline: number;
    user_risk_score: number;
    session_anomaly_score: number;
  };
  contextual: {
    threat_intelligence_match: boolean;
    known_ioc_match: boolean;
    attack_pattern_similarity: number;
  };
}
```

**Feature Extraction Algorithms:**

1. **Temporal Features**
   - **Circadian Rhythm Detection**: Identify normal time-based patterns
   - **Seasonality Analysis**: Weekly, monthly, and yearly behavioral patterns
   - **Burst Detection**: Identify sudden spikes in activity

2. **Network Features**  
   - **IP Reputation Scoring**: Aggregate reputation from threat intelligence feeds
   - **Geolocation Analysis**: Detect impossible travel and geographic anomalies
   - **Protocol Analysis**: Identify unusual protocol usage and port scanning

3. **Statistical Features**
   - **Z-Score Normalization**: Standard deviation-based anomaly scoring
   - **Percentile Rankings**: Compare current behavior to historical distributions
   - **Entropy Measures**: Information-theoretic measures of randomness

### Advanced Threat Detection Models

#### 1. Isolation Forest for Anomaly Detection
**Theory:** Anomalies are easier to isolate than normal points in high-dimensional space.

```python
class OptimizedIsolationForest:
    def __init__(self, contamination=0.1, n_estimators=100):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.feature_importance_ = None
    
    def fit(self, X_train):
        # Build isolation trees with feature subsampling
        self.trees = []
        for i in range(self.n_estimators):
            tree = self._build_isolation_tree(
                X_train, 
                max_depth=np.ceil(np.log2(len(X_train)))
            )
            self.trees.append(tree)
        
        # Calculate feature importance for interpretability
        self._calculate_feature_importance(X_train)
    
    def anomaly_score(self, X):
        path_lengths = np.array([
            tree.path_length(X) for tree in self.trees
        ]).mean(axis=0)
        
        # Normalized anomaly score
        return 2 ** (-path_lengths / self._average_path_length(len(X)))
```

**Optimization Techniques:**
- **Feature Subsampling**: Reduce overfitting and improve diversity
- **Adaptive Contamination**: Dynamic threshold adjustment based on recent data
- **Incremental Learning**: Update models with new data without full retraining

#### 2. LSTM for Sequential Pattern Analysis
**Theory:** Capture temporal dependencies in attack sequences and user behavior.

```python
class LSTMThreatDetector:
    def __init__(self, sequence_length=50, hidden_size=128):
        self.sequence_length = sequence_length
        self.model = self._build_model(hidden_size)
        self.scaler = StandardScaler()
    
    def _build_model(self, hidden_size):
        model = Sequential([
            LSTM(hidden_size, return_sequences=True, dropout=0.2),
            LSTM(hidden_size//2, dropout=0.2),
            Dense(64, activation='relu'),
            Dense(1, activation='sigmoid')  # Binary threat classification
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['precision', 'recall', 'f1_score']
        )
        return model
    
    def predict_sequence_threat(self, event_sequence):
        # Preprocess sequence
        normalized_sequence = self.scaler.transform(event_sequence)
        sequence_tensor = np.expand_dims(normalized_sequence, axis=0)
        
        # Get threat probability
        threat_probability = self.model.predict(sequence_tensor)[0][0]
        
        # Get attention weights for interpretability
        attention_weights = self._get_attention_weights(sequence_tensor)
        
        return threat_probability, attention_weights
```

#### 3. Graph Neural Networks for Network Analysis
**Theory:** Model network relationships and propagation patterns for advanced threat detection.

```python
class GraphThreatDetector:
    def __init__(self, embedding_dim=64):
        self.embedding_dim = embedding_dim
        self.node_features = {}
        self.edge_features = {}
    
    def build_network_graph(self, network_events):
        """Build graph from network communication events"""
        G = nx.DiGraph()
        
        for event in network_events:
            # Add nodes (IP addresses)
            if event.source_ip not in G:
                G.add_node(event.source_ip, 
                          reputation=self._get_ip_reputation(event.source_ip),
                          geolocation=self._get_geolocation(event.source_ip))
            
            if event.dest_ip not in G:
                G.add_node(event.dest_ip,
                          reputation=self._get_ip_reputation(event.dest_ip),
                          geolocation=self._get_geolocation(event.dest_ip))
            
            # Add edges (communications)
            G.add_edge(event.source_ip, event.dest_ip,
                      bytes=event.bytes_transferred,
                      protocol=event.protocol,
                      timestamp=event.timestamp)
        
        return G
    
    def detect_graph_anomalies(self, G):
        """Detect anomalous patterns in network graph"""
        anomalies = []
        
        # Detect unusual communication patterns
        centrality_scores = nx.betweenness_centrality(G)
        degree_scores = dict(G.degree())
        
        for node, centrality in centrality_scores.items():
            if centrality > np.percentile(list(centrality_scores.values()), 95):
                anomalies.append({
                    'type': 'high_centrality',
                    'node': node,
                    'score': centrality,
                    'explanation': 'Node acts as unusual communication hub'
                })
        
        return anomalies
```

---

## Behavioral Analysis Models

### User Behavior Analytics (UBA)

#### Baseline Establishment
**Statistical Foundation:** Model normal user behavior using time series analysis and statistical process control.

```python
class BehaviorBaseline:
    def __init__(self, window_size=30, confidence_level=0.95):
        self.window_size = window_size  # days
        self.confidence_level = confidence_level
        self.baselines = {}
    
    def establish_baseline(self, user_id, behavior_data):
        """Establish behavioral baseline for user"""
        # Time series decomposition
        decomposition = seasonal_decompose(
            behavior_data,
            model='additive',
            period=7  # weekly seasonality
        )
        
        # Extract components
        trend = decomposition.trend
        seasonal = decomposition.seasonal
        residuals = decomposition.resid
        
        # Calculate control limits
        residual_std = np.nanstd(residuals)
        upper_limit = trend + seasonal + 3 * residual_std
        lower_limit = trend + seasonal - 3 * residual_std
        
        self.baselines[user_id] = {
            'trend': trend,
            'seasonal': seasonal,
            'control_limits': (lower_limit, upper_limit),
            'residual_std': residual_std,
            'last_updated': datetime.now()
        }
    
    def calculate_anomaly_score(self, user_id, current_behavior):
        """Calculate how anomalous current behavior is"""
        if user_id not in self.baselines:
            return 0.5  # Unknown user, medium suspicion
        
        baseline = self.baselines[user_id]
        expected_behavior = baseline['trend'] + baseline['seasonal']
        
        # Calculate standardized deviation
        deviation = abs(current_behavior - expected_behavior)
        anomaly_score = min(deviation / (3 * baseline['residual_std']), 1.0)
        
        return anomaly_score
```

#### Advanced Behavioral Models

**1. Markov Chain User Modeling**
Model user state transitions to detect unusual behavior patterns.

```python
class MarkovBehaviorModel:
    def __init__(self, order=2):
        self.order = order  # N-gram order for context
        self.transition_matrices = {}
        self.state_encodings = {}
    
    def fit_user_model(self, user_id, action_sequence):
        """Learn user's behavioral patterns"""
        # Create state representations
        states = self._encode_actions(action_sequence)
        
        # Build transition probability matrix
        transition_counts = defaultdict(lambda: defaultdict(int))
        
        for i in range(len(states) - self.order):
            current_state = tuple(states[i:i+self.order])
            next_state = states[i+self.order]
            transition_counts[current_state][next_state] += 1
        
        # Convert counts to probabilities
        transition_probs = {}
        for current_state, next_states in transition_counts.items():
            total_count = sum(next_states.values())
            transition_probs[current_state] = {
                next_state: count / total_count
                for next_state, count in next_states.items()
            }
        
        self.transition_matrices[user_id] = transition_probs
    
    def calculate_action_probability(self, user_id, action_sequence):
        """Calculate probability of action sequence for user"""
        if user_id not in self.transition_matrices:
            return 0.5  # Unknown user
        
        model = self.transition_matrices[user_id]
        states = self._encode_actions(action_sequence)
        
        log_probability = 0.0
        for i in range(len(states) - self.order):
            current_state = tuple(states[i:i+self.order])
            next_state = states[i+self.order]
            
            if current_state in model and next_state in model[current_state]:
                prob = model[current_state][next_state]
                log_probability += np.log(prob)
            else:
                log_probability += np.log(1e-6)  # Smoothing for unseen transitions
        
        return np.exp(log_probability / (len(states) - self.order))
```

**2. Autoencoder for Complex Behavioral Patterns**
Neural network approach for learning complex, non-linear behavioral representations.

```python
class BehavioralAutoencoder:
    def __init__(self, input_dim=50, encoding_dim=16):
        self.input_dim = input_dim
        self.encoding_dim = encoding_dim
        self.model = self._build_autoencoder()
        self.reconstruction_threshold = None
    
    def _build_autoencoder(self):
        # Encoder
        input_layer = Input(shape=(self.input_dim,))
        encoded = Dense(32, activation='relu')(input_layer)
        encoded = Dense(self.encoding_dim, activation='relu')(encoded)
        
        # Decoder  
        decoded = Dense(32, activation='relu')(encoded)
        decoded = Dense(self.input_dim, activation='sigmoid')(decoded)
        
        # Autoencoder model
        autoencoder = Model(input_layer, decoded)
        autoencoder.compile(optimizer='adam', loss='mse')
        
        return autoencoder
    
    def fit_normal_behavior(self, normal_behavior_data):
        """Train autoencoder on normal behavioral patterns"""
        self.model.fit(
            normal_behavior_data,
            normal_behavior_data,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            verbose=0
        )
        
        # Establish reconstruction error threshold
        reconstructed = self.model.predict(normal_behavior_data)
        reconstruction_errors = np.mean(np.square(normal_behavior_data - reconstructed), axis=1)
        self.reconstruction_threshold = np.percentile(reconstruction_errors, 95)
    
    def detect_behavioral_anomaly(self, behavior_sample):
        """Detect if behavior sample is anomalous"""
        reconstructed = self.model.predict(behavior_sample.reshape(1, -1))
        reconstruction_error = np.mean(np.square(behavior_sample - reconstructed[0]))
        
        anomaly_score = min(reconstruction_error / self.reconstruction_threshold, 2.0)
        is_anomaly = reconstruction_error > self.reconstruction_threshold
        
        return is_anomaly, anomaly_score
```

---

## Real-time ML Pipeline

### Stream Processing Architecture

#### Event Processing Pipeline
```python
class RealTimeThreatPipeline:
    def __init__(self):
        self.feature_extractors = [
            TemporalFeatureExtractor(),
            NetworkFeatureExtractor(),
            BehavioralFeatureExtractor(),
            ContextualFeatureExtractor()
        ]
        
        self.models = {
            'isolation_forest': joblib.load('models/isolation_forest.pkl'),
            'lstm_detector': tf.keras.models.load_model('models/lstm_threat.h5'),
            'behavioral_autoencoder': tf.keras.models.load_model('models/behavioral_ae.h5')
        }
        
        self.feature_cache = TTLCache(maxsize=10000, ttl=300)  # 5-minute cache
        self.model_cache = TTLCache(maxsize=1000, ttl=60)     # 1-minute cache
    
    async def process_event(self, raw_event):
        """Process single security event through ML pipeline"""
        start_time = time.time()
        
        try:
            # 1. Feature Extraction (target: <10ms)
            features = await self._extract_features(raw_event)
            
            # 2. Model Inference (target: <50ms)
            threat_scores = await self._run_inference(features)
            
            # 3. Risk Assessment (target: <5ms)
            final_risk_score = self._aggregate_scores(threat_scores)
            
            # 4. Decision Making (target: <5ms)
            threat_decision = self._make_threat_decision(final_risk_score, raw_event)
            
            processing_time = time.time() - start_time
            
            return {
                'threat_detected': threat_decision['is_threat'],
                'risk_score': final_risk_score,
                'confidence': threat_decision['confidence'],
                'processing_time_ms': processing_time * 1000,
                'model_contributions': threat_scores,
                'features': features.to_dict()
            }
        
        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            return self._fallback_decision(raw_event)
    
    async def _extract_features(self, event):
        """Extract features from raw event"""
        cache_key = f"features:{hash(str(event))}"
        
        if cache_key in self.feature_cache:
            return self.feature_cache[cache_key]
        
        # Parallel feature extraction
        feature_tasks = [
            extractor.extract(event) 
            for extractor in self.feature_extractors
        ]
        
        feature_results = await asyncio.gather(*feature_tasks)
        combined_features = pd.concat(feature_results, axis=1)
        
        self.feature_cache[cache_key] = combined_features
        return combined_features
    
    async def _run_inference(self, features):
        """Run inference on all models"""
        inference_tasks = []
        
        for model_name, model in self.models.items():
            task = self._cached_inference(model_name, model, features)
            inference_tasks.append(task)
        
        results = await asyncio.gather(*inference_tasks)
        return dict(zip(self.models.keys(), results))
    
    async def _cached_inference(self, model_name, model, features):
        """Cached model inference to avoid redundant computation"""
        feature_hash = hash(features.values.tobytes())
        cache_key = f"{model_name}:{feature_hash}"
        
        if cache_key in self.model_cache:
            return self.model_cache[cache_key]
        
        # Run inference
        if model_name == 'isolation_forest':
            score = model.decision_function(features.values.reshape(1, -1))[0]
        elif model_name == 'lstm_detector':
            score = model.predict(features.values.reshape(1, 1, -1))[0][0]
        elif model_name == 'behavioral_autoencoder':
            reconstructed = model.predict(features.values.reshape(1, -1))
            score = 1.0 - np.mean(np.square(features.values - reconstructed[0]))
        
        self.model_cache[cache_key] = score
        return score
```

### Model Serving Optimization

#### GPU Acceleration (for future implementation)
```python
class GPUThreatDetector:
    def __init__(self, model_path, batch_size=32):
        self.batch_size = batch_size
        self.model = self._load_optimized_model(model_path)
        self.batch_queue = asyncio.Queue(maxsize=100)
        self.result_futures = {}
        
        # Start batch processing task
        asyncio.create_task(self._batch_processor())
    
    def _load_optimized_model(self, model_path):
        """Load model with TensorRT optimization"""
        # Convert to TensorRT for GPU optimization
        model = tf.keras.models.load_model(model_path)
        
        # Optimize for inference
        model = tf.function(
            model.call,
            experimental_relax_shapes=True,
            experimental_compile=True
        )
        
        return model
    
    async def predict_async(self, features):
        """Asynchronous prediction with batching"""
        future = asyncio.Future()
        request_id = str(uuid.uuid4())
        
        await self.batch_queue.put((request_id, features, future))
        self.result_futures[request_id] = future
        
        return await future
    
    async def _batch_processor(self):
        """Process requests in batches for GPU efficiency"""
        while True:
            batch = []
            
            # Collect batch
            for _ in range(self.batch_size):
                try:
                    item = await asyncio.wait_for(
                        self.batch_queue.get(), 
                        timeout=0.010  # 10ms timeout
                    )
                    batch.append(item)
                except asyncio.TimeoutError:
                    break
            
            if not batch:
                continue
            
            # Process batch
            request_ids, features_batch, futures = zip(*batch)
            features_tensor = tf.stack(features_batch)
            
            # GPU inference
            predictions = self.model(features_tensor)
            
            # Return results
            for i, (request_id, prediction) in enumerate(zip(request_ids, predictions)):
                if request_id in self.result_futures:
                    self.result_futures[request_id].set_result(prediction.numpy())
                    del self.result_futures[request_id]
```

---

## Performance Optimization

### Algorithmic Optimizations

#### 1. Feature Selection and Dimensionality Reduction
```python
class OptimizedFeatureSelector:
    def __init__(self, target_features=50):
        self.target_features = target_features
        self.selected_features = None
        self.feature_importance = None
    
    def select_features(self, X_train, y_train):
        """Select most informative features for threat detection"""
        
        # Method 1: Mutual Information
        mi_scores = mutual_info_classif(X_train, y_train)
        
        # Method 2: Random Forest Feature Importance
        rf = RandomForestClassifier(n_estimators=50, random_state=42)
        rf.fit(X_train, y_train)
        rf_importance = rf.feature_importances_
        
        # Method 3: Recursive Feature Elimination
        rfe = RFE(
            estimator=LogisticRegression(random_state=42),
            n_features_to_select=self.target_features
        )
        rfe.fit(X_train, y_train)
        rfe_ranking = rfe.ranking_
        
        # Ensemble feature scoring
        normalized_mi = mi_scores / np.max(mi_scores)
        normalized_rf = rf_importance / np.max(rf_importance)
        normalized_rfe = (np.max(rfe_ranking) - rfe_ranking + 1) / np.max(rfe_ranking)
        
        ensemble_scores = (normalized_mi + normalized_rf + normalized_rfe) / 3
        
        # Select top features
        selected_indices = np.argsort(ensemble_scores)[-self.target_features:]
        self.selected_features = selected_indices
        self.feature_importance = ensemble_scores[selected_indices]
        
        return selected_indices
```

#### 2. Model Compression and Quantization
```python
class ModelCompressor:
    @staticmethod
    def compress_tensorflow_model(model, compression_type='quantization'):
        """Compress TensorFlow model for faster inference"""
        
        if compression_type == 'quantization':
            # Post-training quantization
            converter = tf.lite.TFLiteConverter.from_keras_model(model)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            converter.target_spec.supported_types = [tf.float16]
            
            quantized_model = converter.convert()
            return quantized_model
        
        elif compression_type == 'pruning':
            # Structured pruning
            pruning_params = {
                'pruning_schedule': tfmot.sparsity.keras.PolynomialDecay(
                    initial_sparsity=0.0,
                    final_sparsity=0.5,
                    begin_step=0,
                    end_step=1000
                )
            }
            
            pruned_model = tfmot.sparsity.keras.prune_low_magnitude(
                model, **pruning_params
            )
            
            return pruned_model
    
    @staticmethod  
    def compress_sklearn_model(model, compression_type='tree_pruning'):
        """Compress scikit-learn models"""
        
        if compression_type == 'tree_pruning' and hasattr(model, 'tree_'):
            # Prune decision trees to reduce complexity
            pruned_model = clone(model)
            
            # Post-pruning using minimal cost-complexity
            path = pruned_model.cost_complexity_pruning_path(X_train, y_train)
            ccp_alphas = path.ccp_alphas[:-1]  # Remove max alpha
            
            # Select optimal alpha using validation
            best_alpha = ccp_alphas[len(ccp_alphas) // 2]  # Simple heuristic
            pruned_model.ccp_alpha = best_alpha
            
            return pruned_model
        
        return model  # Return original if pruning not applicable
```

### Memory and Compute Optimization

#### 1. Efficient Data Structures
```python
class EfficientEventBuffer:
    """Ring buffer for real-time event storage with memory efficiency"""
    
    def __init__(self, max_size=10000, feature_dim=50):
        self.max_size = max_size
        self.feature_dim = feature_dim
        
        # Pre-allocate numpy arrays for efficiency
        self.events = np.zeros((max_size, feature_dim), dtype=np.float32)
        self.timestamps = np.zeros(max_size, dtype=np.int64)
        self.labels = np.zeros(max_size, dtype=np.uint8)
        
        self.current_idx = 0
        self.size = 0
    
    def add_event(self, event_features, timestamp, label=0):
        """Add event to buffer (O(1) operation)"""
        idx = self.current_idx % self.max_size
        
        self.events[idx] = event_features
        self.timestamps[idx] = timestamp
        self.labels[idx] = label
        
        self.current_idx += 1
        self.size = min(self.size + 1, self.max_size)
    
    def get_recent_events(self, count=100):
        """Get most recent events efficiently"""
        if self.size < count:
            count = self.size
        
        if self.current_idx >= count:
            start_idx = self.current_idx - count
            return self.events[start_idx:self.current_idx]
        else:
            # Handle wrap-around
            part1 = self.events[self.max_size - (count - self.current_idx):self.max_size]
            part2 = self.events[0:self.current_idx]
            return np.concatenate([part1, part2])
    
    def memory_usage_mb(self):
        """Calculate memory usage in MB"""
        events_size = self.events.nbytes
        timestamps_size = self.timestamps.nbytes
        labels_size = self.labels.nbytes
        total_bytes = events_size + timestamps_size + labels_size
        return total_bytes / (1024 * 1024)
```

#### 2. Caching Strategies
```python
class IntelligentCache:
    """Smart caching system for ML predictions and features"""
    
    def __init__(self, max_size=1000, ttl_seconds=300):
        self.cache = {}
        self.access_times = {}
        self.access_counts = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
    
    def get(self, key):
        """Get item from cache with LFU/TTL eviction"""
        current_time = time.time()
        
        if key in self.cache:
            # Check TTL
            if current_time - self.access_times[key] > self.ttl_seconds:
                del self.cache[key]
                del self.access_times[key]
                del self.access_counts[key]
                return None
            
            # Update access statistics
            self.access_times[key] = current_time
            self.access_counts[key] += 1
            
            return self.cache[key]
        
        return None
    
    def put(self, key, value):
        """Put item in cache with intelligent eviction"""
        current_time = time.time()
        
        # Evict if at capacity
        if len(self.cache) >= self.max_size:
            self._evict_least_frequently_used()
        
        self.cache[key] = value
        self.access_times[key] = current_time
        self.access_counts[key] = 1
    
    def _evict_least_frequently_used(self):
        """Evict least frequently used item"""
        if not self.cache:
            return
        
        # Find item with lowest access count (LFU)
        lfu_key = min(self.access_counts.keys(), 
                     key=lambda k: self.access_counts[k])
        
        del self.cache[lfu_key]
        del self.access_times[lfu_key]
        del self.access_counts[lfu_key]
```

---

## Model Architecture

### Hybrid Ensemble Architecture

```python
class ThreatDetectionEnsemble:
    """Production-ready ensemble combining multiple ML approaches"""
    
    def __init__(self, config):
        self.config = config
        self.models = {}
        self.preprocessors = {}
        self.performance_monitor = ModelPerformanceMonitor()
        
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize all ensemble models"""
        
        # 1. Statistical Anomaly Detection
        self.models['isolation_forest'] = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42,
            n_jobs=-1
        )
        
        # 2. Deep Learning Sequential Model
        self.models['lstm_classifier'] = self._build_lstm_model()
        
        # 3. Traditional ML Classifier
        self.models['gradient_boosting'] = GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        )
        
        # 4. Behavioral Autoencoder
        self.models['behavioral_ae'] = self._build_autoencoder()
        
        # 5. Graph-based Network Analyzer
        self.models['graph_detector'] = GraphThreatDetector()
    
    def _build_lstm_model(self):
        """Build LSTM model for sequential pattern detection"""
        model = Sequential([
            LSTM(128, return_sequences=True, dropout=0.3),
            LSTM(64, dropout=0.3),
            Dense(32, activation='relu'),
            Dropout(0.5),
            Dense(1, activation='sigmoid')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['precision', 'recall', 'auc']
        )
        
        return model
    
    def predict(self, features, return_explanations=True):
        """Ensemble prediction with model explanations"""
        predictions = {}
        explanations = {}
        
        # Run each model
        for model_name, model in self.models.items():
            try:
                pred, explanation = self._run_single_model(
                    model_name, model, features
                )
                predictions[model_name] = pred
                if return_explanations:
                    explanations[model_name] = explanation
            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}")
                predictions[model_name] = 0.5  # Neutral score
        
        # Weighted ensemble decision
        final_score = self._ensemble_decision(predictions)
        
        # Track performance
        self.performance_monitor.log_prediction(
            predictions, final_score, features
        )
        
        result = {
            'threat_score': final_score,
            'is_threat': final_score > self.config.threat_threshold,
            'model_scores': predictions,
            'confidence': self._calculate_confidence(predictions)
        }
        
        if return_explanations:
            result['explanations'] = explanations
        
        return result
    
    def _ensemble_decision(self, predictions):
        """Weighted ensemble decision making"""
        weights = {
            'isolation_forest': 0.25,
            'lstm_classifier': 0.30,
            'gradient_boosting': 0.25,
            'behavioral_ae': 0.15,
            'graph_detector': 0.05
        }
        
        weighted_score = sum(
            predictions.get(model, 0.5) * weight
            for model, weight in weights.items()
        )
        
        return weighted_score
    
    def _calculate_confidence(self, predictions):
        """Calculate confidence based on model agreement"""
        scores = list(predictions.values())
        
        # High confidence when models agree
        score_variance = np.var(scores)
        confidence = 1.0 / (1.0 + score_variance)
        
        return confidence
```

### Model Interpretability

```python
class ModelExplainer:
    """Provide explanations for model decisions"""
    
    def __init__(self, models, feature_names):
        self.models = models
        self.feature_names = feature_names
        self.explainers = {}
        
        self._initialize_explainers()
    
    def _initialize_explainers(self):
        """Initialize SHAP explainers for interpretability"""
        try:
            import shap
            
            # Tree-based model explainer
            if 'gradient_boosting' in self.models:
                self.explainers['gradient_boosting'] = shap.TreeExplainer(
                    self.models['gradient_boosting']
                )
            
            # Deep learning explainer
            if 'lstm_classifier' in self.models:
                self.explainers['lstm_classifier'] = shap.DeepExplainer(
                    self.models['lstm_classifier']
                )
        
        except ImportError:
            logger.warning("SHAP not available, explanations will be limited")
    
    def explain_prediction(self, features, model_name=None):
        """Generate explanation for prediction"""
        explanations = {}
        
        models_to_explain = [model_name] if model_name else self.explainers.keys()
        
        for model in models_to_explain:
            if model in self.explainers:
                try:
                    # SHAP explanation
                    shap_values = self.explainers[model].shap_values(features)
                    
                    # Top contributing features
                    feature_importance = list(zip(
                        self.feature_names,
                        np.abs(shap_values).mean(axis=0)
                    ))
                    feature_importance.sort(key=lambda x: x[1], reverse=True)
                    
                    explanations[model] = {
                        'shap_values': shap_values,
                        'top_features': feature_importance[:10],
                        'explanation_type': 'shap'
                    }
                
                except Exception as e:
                    logger.warning(f"SHAP explanation failed for {model}: {e}")
                    explanations[model] = self._fallback_explanation(model, features)
            
            else:
                explanations[model] = self._fallback_explanation(model, features)
        
        return explanations
    
    def _fallback_explanation(self, model_name, features):
        """Fallback explanation when SHAP is not available"""
        if model_name == 'isolation_forest':
            model = self.models[model_name]
            # Use decision path for tree-based explanation
            decision_path = model.decision_path(features.reshape(1, -1))
            return {
                'explanation_type': 'decision_path',
                'path_length': decision_path.nnz,
                'anomaly_score': model.decision_function(features.reshape(1, -1))[0]
            }
        
        return {
            'explanation_type': 'not_available',
            'message': f'No explanation available for {model_name}'
        }
```

---

## Implementation Patterns

### Production Deployment Patterns

#### 1. A/B Testing Framework
```python
class ModelABTester:
    """A/B testing framework for model deployment"""
    
    def __init__(self, control_model, test_model, traffic_split=0.1):
        self.control_model = control_model
        self.test_model = test_model
        self.traffic_split = traffic_split
        
        self.metrics_collector = MetricsCollector()
    
    def predict(self, features, user_id=None):
        """Route prediction to appropriate model based on A/B test"""
        
        # Determine which model to use
        if self._should_use_test_model(user_id):
            model_version = 'test'
            prediction = self.test_model.predict(features)
        else:
            model_version = 'control'
            prediction = self.control_model.predict(features)
        
        # Collect metrics
        self.metrics_collector.log_prediction(
            model_version=model_version,
            prediction=prediction,
            features=features,
            user_id=user_id
        )
        
        return prediction
    
    def _should_use_test_model(self, user_id):
        """Determine if user should use test model"""
        if user_id is None:
            return random.random() < self.traffic_split
        
        # Consistent assignment based on user_id
        hash_value = hash(str(user_id)) % 100
        return hash_value < (self.traffic_split * 100)
    
    def get_performance_comparison(self):
        """Compare performance between control and test models"""
        return self.metrics_collector.compare_models()
```

#### 2. Model Monitoring and Alerting
```python
class ModelMonitor:
    """Monitor model performance and detect drift"""
    
    def __init__(self, alert_thresholds):
        self.alert_thresholds = alert_thresholds
        self.metrics_history = defaultdict(list)
        self.baseline_metrics = {}
        
    def log_prediction(self, prediction_result, ground_truth=None):
        """Log prediction for monitoring"""
        timestamp = time.time()
        
        # Log prediction metrics
        self.metrics_history['predictions'].append({
            'timestamp': timestamp,
            'prediction': prediction_result,
            'ground_truth': ground_truth
        })
        
        # Calculate drift metrics
        if ground_truth is not None:
            self._update_performance_metrics(prediction_result, ground_truth)
        
        # Check for alerts
        self._check_alert_conditions()
    
    def _update_performance_metrics(self, prediction, ground_truth):
        """Update running performance metrics"""
        current_time = time.time()
        
        # Accuracy in sliding window
        window_size = 1000  # Last 1000 predictions
        recent_predictions = self.metrics_history['predictions'][-window_size:]
        
        if len(recent_predictions) >= 100:  # Minimum sample size
            accuracy = np.mean([
                p['prediction']['is_threat'] == p['ground_truth']
                for p in recent_predictions
                if p['ground_truth'] is not None
            ])
            
            self.metrics_history['accuracy'].append({
                'timestamp': current_time,
                'value': accuracy
            })
    
    def _check_alert_conditions(self):
        """Check if any alert conditions are met"""
        current_time = time.time()
        
        # Check accuracy degradation
        if len(self.metrics_history['accuracy']) >= 2:
            current_accuracy = self.metrics_history['accuracy'][-1]['value']
            baseline_accuracy = self.baseline_metrics.get('accuracy', 0.9)
            
            if current_accuracy < baseline_accuracy - self.alert_thresholds['accuracy_drop']:
                self._send_alert(
                    alert_type='accuracy_degradation',
                    message=f"Accuracy dropped to {current_accuracy:.3f} (baseline: {baseline_accuracy:.3f})"
                )
        
        # Check prediction drift
        recent_scores = [
            p['prediction']['threat_score']
            for p in self.metrics_history['predictions'][-100:]
        ]
        
        if len(recent_scores) >= 100:
            score_mean = np.mean(recent_scores)
            baseline_mean = self.baseline_metrics.get('threat_score_mean', 0.1)
            
            if abs(score_mean - baseline_mean) > self.alert_thresholds['score_drift']:
                self._send_alert(
                    alert_type='prediction_drift',
                    message=f"Threat score distribution shifted: {score_mean:.3f} vs baseline {baseline_mean:.3f}"
                )
    
    def _send_alert(self, alert_type, message):
        """Send alert through configured channels"""
        alert_data = {
            'timestamp': time.time(),
            'alert_type': alert_type,
            'message': message,
            'severity': 'medium'
        }
        
        # Log alert
        logger.warning(f"Model Alert: {alert_type} - {message}")
        
        # Send to monitoring system
        # This would integrate with your monitoring infrastructure
        # e.g., PagerDuty, Slack, email, etc.
```

---

## Conclusion

This document provides the theoretical and practical foundations for implementing AI-driven threat detection and behavioral analysis in the ThreatGuard platform. The algorithms and architectures described here are designed to operate in real-time environments with strict performance requirements while maintaining high accuracy and low false positive rates.

**Key Takeaways for AI Engineers:**

1. **Multi-Modal Approach**: Combine statistical, machine learning, and deep learning methods for robust threat detection
2. **Real-time Constraints**: Design algorithms with <100ms inference requirements in mind
3. **Interpretability**: Always provide explanations for security decisions to build trust with analysts
4. **Continuous Learning**: Implement systems that adapt to new threats and changing behavior patterns
5. **Performance Monitoring**: Build comprehensive monitoring to detect model drift and performance degradation

**Next Steps:**
- Review SERVICE-IMPLEMENTATION.md for practical deployment patterns
- Examine the actual service implementation in bg-identity-ai/src/services/
- Contribute to the open-source ML model implementations
- Help optimize algorithms for edge deployment and mobile integration