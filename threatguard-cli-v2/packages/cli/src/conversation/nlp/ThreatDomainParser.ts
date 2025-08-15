import { Logger } from '@threatguard/core';
import type { 
  Entity, 
  Intent, 
  NLParseResult,
  IntentType, 
  ConfidenceLevel 
} from '../types/Intent.js';
import type { ConversationContext } from '../types/Context.js';

export interface ThreatDomainParserOptions {
  logger: Logger;
  enableThreatIntelligence?: boolean;
  enableBehavioralAnalysis?: boolean;
  enableNetworkAnalysis?: boolean;
}

/**
 * Specialized parser for cybersecurity domain knowledge
 * Enhances generic NL processing with threat detection expertise
 */
export class ThreatDomainParser {
  private logger: Logger;
  private enableThreatIntelligence: boolean;
  private enableBehavioralAnalysis: boolean;
  private enableNetworkAnalysis: boolean;

  // Cybersecurity domain knowledge
  private readonly threatTypes = {
    malware: ['virus', 'trojan', 'ransomware', 'spyware', 'adware', 'rootkit', 'worm', 'backdoor'],
    phishing: ['phishing', 'spear phishing', 'whaling', 'smishing', 'vishing', 'pharming'],
    network: ['ddos', 'dos', 'mitm', 'arp poisoning', 'dns poisoning', 'packet sniffing'],
    intrusion: ['brute force', 'dictionary attack', 'credential stuffing', 'sql injection', 'xss'],
    vulnerability: ['cve', 'zero day', 'exploit', 'buffer overflow', 'privilege escalation'],
    anomaly: ['unusual behavior', 'suspicious activity', 'anomalous traffic', 'outlier'],
  };

  private readonly securityFrameworks = {
    mitre: ['mitre att&ck', 'attack framework', 'tactics', 'techniques', 'procedures', 'ttp'],
    nist: ['nist framework', 'cybersecurity framework', 'identify', 'protect', 'detect', 'respond', 'recover'],
    iso27001: ['iso 27001', 'information security management', 'isms'],
    owasp: ['owasp top 10', 'web application security', 'owasp'],
  };

  private readonly complianceTerms = [
    'gdpr', 'hipaa', 'pci dss', 'sox', 'compliance', 'regulation', 'audit', 'assessment'
  ];

  private readonly incidentResponseTerms = [
    'incident', 'breach', 'compromise', 'containment', 'eradication', 'recovery',
    'forensics', 'investigation', 'response', 'escalation'
  ];

  private readonly threatActors = [
    'apt', 'advanced persistent threat', 'nation state', 'cybercriminal', 'insider threat',
    'hacktivist', 'script kiddie', 'threat actor', 'adversary'
  ];

  // Network security terminology
  private readonly networkSecurityTerms = {
    devices: ['firewall', 'ids', 'ips', 'waf', 'proxy', 'gateway', 'router', 'switch'],
    protocols: ['tcp', 'udp', 'icmp', 'http', 'https', 'ssh', 'ftp', 'dns', 'dhcp'],
    monitoring: ['siem', 'soar', 'network monitoring', 'traffic analysis', 'flow analysis'],
    scanning: ['port scan', 'vulnerability scan', 'network discovery', 'enumeration'],
  };

  // Common attack vectors and indicators
  private readonly attackVectors = {
    email: ['email security', 'spam', 'malicious attachment', 'email spoofing'],
    web: ['web security', 'sql injection', 'xss', 'csrf', 'path traversal'],
    network: ['network attack', 'lateral movement', 'privilege escalation', 'persistence'],
    endpoint: ['endpoint security', 'malware', 'fileless attack', 'living off the land'],
  };

  constructor(options: ThreatDomainParserOptions) {
    this.logger = options.logger;
    this.enableThreatIntelligence = options.enableThreatIntelligence ?? true;
    this.enableBehavioralAnalysis = options.enableBehavioralAnalysis ?? true;
    this.enableNetworkAnalysis = options.enableNetworkAnalysis ?? true;

    this.logger.debug('Threat domain parser initialized', {
      threatIntelligence: this.enableThreatIntelligence,
      behavioralAnalysis: this.enableBehavioralAnalysis,
      networkAnalysis: this.enableNetworkAnalysis,
    });
  }

  /**
   * Enhance parse result with cybersecurity domain knowledge
   */
  async enhanceParseResult(
    parseResult: NLParseResult,
    context?: ConversationContext
  ): Promise<NLParseResult> {
    this.logger.debug('Enhancing parse result with threat domain knowledge', {
      originalIntent: parseResult.intent.type,
      originalConfidence: parseResult.confidence,
    });

    try {
      // Create enhanced copy
      const enhanced = { ...parseResult };

      // Enhance intent classification with domain knowledge
      enhanced.intent = await this.enhanceIntentClassification(parseResult, context);

      // Extract domain-specific entities
      const domainEntities = await this.extractDomainEntities(parseResult.originalText, context);
      enhanced.entities = [...parseResult.entities, ...domainEntities];

      // Recalculate confidence with domain knowledge
      enhanced.confidence = this.recalculateConfidence(enhanced, context);

      // Add domain-specific context
      enhanced.intent.context = {
        ...enhanced.intent.context,
        domainEnhancements: {
          threatTypesDetected: this.detectThreatTypes(parseResult.originalText),
          securityFrameworks: this.detectSecurityFrameworks(parseResult.originalText),
          complianceRelevant: this.detectComplianceTerms(parseResult.originalText),
          incidentResponse: this.detectIncidentResponseContext(parseResult.originalText),
        },
      };

      this.logger.debug('Domain enhancement completed', {
        enhancedIntent: enhanced.intent.type,
        enhancedConfidence: enhanced.confidence,
        additionalEntities: domainEntities.length,
      });

      return enhanced;

    } catch (error) {
      this.logger.error('Domain enhancement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return parseResult; // Return original on error
    }
  }

  /**
   * Enhance intent classification with cybersecurity domain knowledge
   */
  private async enhanceIntentClassification(
    parseResult: NLParseResult,
    context?: ConversationContext
  ): Promise<Intent> {
    const { intent, originalText } = parseResult;
    const normalizedText = originalText.toLowerCase();

    // Start with original intent
    let enhancedIntent = { ...intent };

    // Domain-specific intent refinement
    if (intent.type === 'conversation_unknown' || intent.confidence === 'very_low') {
      enhancedIntent = await this.classifyDomainSpecificIntent(normalizedText, context);
    }

    // Enhance existing classifications
    enhancedIntent = this.refineExistingIntent(enhancedIntent, normalizedText, context);

    return enhancedIntent;
  }

  /**
   * Classify domain-specific intents for unknown or low-confidence inputs
   */
  private async classifyDomainSpecificIntent(
    normalizedText: string,
    context?: ConversationContext
  ): Promise<Intent> {
    // Check for incident response terminology
    if (this.containsTerms(normalizedText, this.incidentResponseTerms)) {
      if (normalizedText.includes('investigate') || normalizedText.includes('analyze')) {
        return {
          type: 'behavior_analyze',
          confidence: 'medium',
          context: { domainReason: 'incident_response_investigation' },
        };
      }
      if (normalizedText.includes('contain') || normalizedText.includes('isolate')) {
        return {
          type: 'network_scan',
          confidence: 'medium',
          context: { domainReason: 'incident_containment' },
        };
      }
    }

    // Check for threat intelligence queries
    if (this.enableThreatIntelligence) {
      const threatIntelKeywords = ['reputation', 'lookup', 'check', 'verify', 'intelligence'];
      if (this.containsTerms(normalizedText, threatIntelKeywords)) {
        return {
          type: 'intel_query',
          confidence: 'high',
          context: { domainReason: 'threat_intelligence_lookup' },
        };
      }
    }

    // Check for behavioral analysis requests
    if (this.enableBehavioralAnalysis) {
      const behaviorKeywords = ['behavior', 'pattern', 'baseline', 'anomaly', 'outlier'];
      if (this.containsTerms(normalizedText, behaviorKeywords)) {
        return {
          type: 'behavior_analyze',
          confidence: 'high',
          context: { domainReason: 'behavioral_analysis_request' },
        };
      }
    }

    // Check for network security requests
    if (this.enableNetworkAnalysis) {
      const networkKeywords = ['network', 'traffic', 'flow', 'packet', 'connection'];
      if (this.containsTerms(normalizedText, networkKeywords)) {
        if (normalizedText.includes('monitor') || normalizedText.includes('watch')) {
          return {
            type: 'network_monitor',
            confidence: 'high',
            context: { domainReason: 'network_monitoring_request' },
          };
        } else {
          return {
            type: 'network_scan',
            confidence: 'medium',
            context: { domainReason: 'network_analysis_request' },
          };
        }
      }
    }

    // Check for compliance/audit requests
    if (this.containsTerms(normalizedText, this.complianceTerms)) {
      return {
        type: 'system_status',
        confidence: 'medium',
        context: { domainReason: 'compliance_check' },
      };
    }

    // Default to unknown with domain context
    return {
      type: 'conversation_unknown',
      confidence: 'low',
      context: { domainReason: 'no_domain_match' },
    };
  }

  /**
   * Refine existing intent classifications with domain knowledge
   */
  private refineExistingIntent(
    intent: Intent,
    normalizedText: string,
    context?: ConversationContext
  ): Intent {
    const refined = { ...intent };

    // Boost confidence for domain-relevant intents
    switch (intent.type) {
      case 'threat_scan':
        if (this.detectThreatTypes(normalizedText).length > 0) {
          refined.confidence = this.boostConfidence(intent.confidence);
          refined.context = {
            ...refined.context,
            domainBoost: 'threat_types_detected',
          };
        }
        break;

      case 'threat_list':
        const severityMentioned = ['critical', 'high', 'medium', 'low'].some(sev => 
          normalizedText.includes(sev)
        );
        if (severityMentioned) {
          refined.confidence = this.boostConfidence(intent.confidence);
        }
        break;

      case 'intel_query':
        const hasIOC = this.containsIOC(normalizedText);
        if (hasIOC) {
          refined.confidence = this.boostConfidence(intent.confidence);
          refined.context = {
            ...refined.context,
            domainBoost: 'ioc_detected',
          };
        }
        break;

      case 'behavior_analyze':
        const behaviorTerms = ['pattern', 'baseline', 'anomaly', 'unusual'];
        if (this.containsTerms(normalizedText, behaviorTerms)) {
          refined.confidence = this.boostConfidence(intent.confidence);
        }
        break;
    }

    // Context-aware refinement
    if (context) {
      refined.confidence = this.adjustConfidenceWithContext(refined, context);
    }

    return refined;
  }

  /**
   * Extract domain-specific entities
   */
  private async extractDomainEntities(
    text: string,
    context?: ConversationContext
  ): Promise<Entity[]> {
    const entities: Entity[] = [];
    const normalizedText = text.toLowerCase();

    // Extract threat types
    Object.entries(this.threatTypes).forEach(([category, types]) => {
      types.forEach(type => {
        if (normalizedText.includes(type)) {
          entities.push({
            type: 'threat_type',
            value: type,
            confidence: 'high',
            start: normalizedText.indexOf(type),
            end: normalizedText.indexOf(type) + type.length,
            metadata: { category },
          });
        }
      });
    });

    // Extract compliance frameworks
    Object.entries(this.securityFrameworks).forEach(([framework, terms]) => {
      terms.forEach(term => {
        if (normalizedText.includes(term)) {
          entities.push({
            type: 'framework',
            value: framework,
            confidence: 'high',
            start: normalizedText.indexOf(term),
            end: normalizedText.indexOf(term) + term.length,
            metadata: { term },
          });
        }
      });
    });

    // Extract network security devices
    Object.values(this.networkSecurityTerms.devices).forEach(device => {
      if (normalizedText.includes(device)) {
        entities.push({
          type: 'security_device',
          value: device,
          confidence: 'high',
          start: normalizedText.indexOf(device),
          end: normalizedText.indexOf(device) + device.length,
        });
      }
    });

    // Extract attack vectors
    Object.entries(this.attackVectors).forEach(([vector, attacks]) => {
      attacks.forEach(attack => {
        if (normalizedText.includes(attack)) {
          entities.push({
            type: 'attack_vector',
            value: attack,
            confidence: 'high',
            start: normalizedText.indexOf(attack),
            end: normalizedText.indexOf(attack) + attack.length,
            metadata: { vector },
          });
        }
      });
    });

    // Extract CVE references
    const cvePattern = /cve-\d{4}-\d{4,}/gi;
    const cveMatches = [...text.matchAll(cvePattern)];
    cveMatches.forEach(match => {
      if (match.index !== undefined) {
        entities.push({
          type: 'cve',
          value: match[0].toUpperCase(),
          confidence: 'very_high',
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    });

    return entities;
  }

  /**
   * Detect threat types mentioned in text
   */
  private detectThreatTypes(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const detectedTypes: string[] = [];

    Object.entries(this.threatTypes).forEach(([category, types]) => {
      types.forEach(type => {
        if (normalizedText.includes(type)) {
          detectedTypes.push(category);
        }
      });
    });

    return [...new Set(detectedTypes)]; // Remove duplicates
  }

  /**
   * Detect security frameworks mentioned
   */
  private detectSecurityFrameworks(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const frameworks: string[] = [];

    Object.entries(this.securityFrameworks).forEach(([framework, terms]) => {
      if (terms.some(term => normalizedText.includes(term))) {
        frameworks.push(framework);
      }
    });

    return frameworks;
  }

  /**
   * Detect compliance-related terms
   */
  private detectComplianceTerms(text: string): string[] {
    const normalizedText = text.toLowerCase();
    return this.complianceTerms.filter(term => normalizedText.includes(term));
  }

  /**
   * Detect incident response context
   */
  private detectIncidentResponseContext(text: string): string[] {
    const normalizedText = text.toLowerCase();
    return this.incidentResponseTerms.filter(term => normalizedText.includes(term));
  }

  /**
   * Check if text contains indicators of compromise (IOCs)
   */
  private containsIOC(text: string): boolean {
    // Simple IOC patterns
    const iocPatterns = [
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/, // IP
      /\b[a-fA-F0-9]{32,64}\b/, // Hash
      /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/, // Domain
    ];

    return iocPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if text contains any of the specified terms
   */
  private containsTerms(text: string, terms: string[]): boolean {
    return terms.some(term => text.includes(term));
  }

  /**
   * Boost confidence level by one step
   */
  private boostConfidence(current: ConfidenceLevel): ConfidenceLevel {
    const levels: ConfidenceLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
    const currentIndex = levels.indexOf(current);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : current;
  }

  /**
   * Adjust confidence based on conversation context
   */
  private adjustConfidenceWithContext(
    intent: Intent,
    context: ConversationContext
  ): ConfidenceLevel {
    let confidence = intent.confidence;

    // Boost if this intent follows logically from recent conversation
    const recentIntents = context.recentIntents.slice(0, 3);
    
    // Common security workflow patterns
    const workflowPatterns = [
      ['system_status', 'threat_scan'], // Status check -> scan
      ['threat_scan', 'threat_list'], // Scan -> review results
      ['threat_list', 'behavior_analyze'], // Review -> analyze
      ['behavior_analyze', 'intel_query'], // Analyze -> intelligence lookup
    ];

    for (const pattern of workflowPatterns) {
      if (recentIntents.includes(pattern[0]) && intent.type === pattern[1]) {
        confidence = this.boostConfidence(confidence);
        break;
      }
    }

    // Boost if user has been working in this domain
    const domainFocus = this.determineDomainFocus(context.recentIntents);
    if (this.isIntentInDomain(intent.type, domainFocus)) {
      confidence = this.boostConfidence(confidence);
    }

    return confidence;
  }

  /**
   * Recalculate overall confidence with domain enhancements
   */
  private recalculateConfidence(
    enhanced: NLParseResult,
    context?: ConversationContext
  ): ConfidenceLevel {
    const { intent, entities } = enhanced;
    
    // Start with intent confidence
    let confidence = intent.confidence;

    // Boost for domain-specific entities
    const domainEntities = entities.filter(e => 
      ['threat_type', 'framework', 'security_device', 'attack_vector', 'cve'].includes(e.type)
    );

    if (domainEntities.length > 0) {
      confidence = this.boostConfidence(confidence);
    }

    // Extra boost for high-confidence domain entities
    const highConfidenceDomainEntities = domainEntities.filter(e => 
      e.confidence === 'very_high' || e.confidence === 'high'
    );

    if (highConfidenceDomainEntities.length >= 2) {
      confidence = this.boostConfidence(confidence);
    }

    return confidence;
  }

  /**
   * Determine the domain focus from recent intents
   */
  private determineDomainFocus(recentIntents: string[]): string {
    const domainCounts = {
      threat: 0,
      network: 0,
      behavior: 0,
      intel: 0,
      system: 0,
    };

    recentIntents.forEach(intent => {
      if (intent.startsWith('threat_')) domainCounts.threat++;
      else if (intent.startsWith('network_')) domainCounts.network++;
      else if (intent.startsWith('behavior_')) domainCounts.behavior++;
      else if (intent.startsWith('intel_')) domainCounts.intel++;
      else if (intent.startsWith('system_')) domainCounts.system++;
    });

    return Object.entries(domainCounts).reduce((a, b) => 
      domainCounts[a[0]] > domainCounts[b[0]] ? a : b
    )[0];
  }

  /**
   * Check if intent belongs to a specific domain
   */
  private isIntentInDomain(intent: IntentType, domain: string): boolean {
    return intent.startsWith(domain + '_');
  }

  /**
   * Get domain-specific suggestions based on context
   */
  generateDomainSuggestions(
    parseResult: NLParseResult,
    context?: ConversationContext
  ): string[] {
    const suggestions: string[] = [];
    const { intent } = parseResult;

    // Intent-specific domain suggestions
    switch (intent.type) {
      case 'threat_scan':
        suggestions.push('analyze scan results for behavioral patterns');
        suggestions.push('check threat intelligence for discovered IOCs');
        break;

      case 'threat_list':
        suggestions.push('investigate specific threats in detail');
        suggestions.push('perform behavioral analysis on affected systems');
        break;

      case 'intel_query':
        suggestions.push('scan systems for this threat indicator');
        suggestions.push('check for lateral movement patterns');
        break;

      case 'behavior_analyze':
        suggestions.push('correlate with network traffic patterns');
        suggestions.push('check for compliance violations');
        break;
    }

    // Context-based suggestions
    if (context) {
      const domainFocus = this.determineDomainFocus(context.recentIntents);
      
      if (domainFocus === 'threat' && !intent.type.startsWith('intel_')) {
        suggestions.push('lookup threat intelligence for context');
      }
      
      if (domainFocus === 'network' && !intent.type.startsWith('behavior_')) {
        suggestions.push('analyze user behavior patterns');
      }
    }

    return suggestions.slice(0, 3); // Limit to top 3
  }
}