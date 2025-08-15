import { Router } from 'express';
import { logger } from '@/lib/logger';
import { webhookManager, WebhookEventType } from '@/services/integrations/webhook-manager';
import { siemIntegrationService, SIEMType, SIEMFeature } from '@/services/integrations/siem-integration-service';

const router = Router();

// =============================================================================
// WEBHOOK MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * POST /api/integrations/webhooks
 * Register a new webhook endpoint
 */
router.post('/webhooks', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, url, eventTypes, retryConfig } = req.body;

    // Validate request
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required and must be a string' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      return res.status(400).json({ error: 'eventTypes array is required and cannot be empty' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate event types
    const validEventTypes: WebhookEventType[] = [
      'threat.detected', 'threat.resolved', 'threat.escalated',
      'alert.created', 'alert.acknowledged', 'model.retrained',
      'model.drift_detected', 'system.health_check', 'user.action',
      'integration.test'
    ];

    const invalidEventTypes = eventTypes.filter(type => !validEventTypes.includes(type));
    if (invalidEventTypes.length > 0) {
      return res.status(400).json({ 
        error: `Invalid event types: ${invalidEventTypes.join(', ')}`,
        validEventTypes
      });
    }

    logger.info('Webhook registration requested', {
      userId,
      name,
      url: url.replace(/\/\/[^\/]+/, '//***'), // Hide credentials in URL
      eventTypes
    });

    const webhook = await webhookManager.registerWebhook({
      name,
      url,
      eventTypes,
      retryConfig
    });

    // Remove secret from response for security
    const safeWebhook = { ...webhook, secret: '***' };

    logger.info('Webhook registered successfully', {
      userId,
      webhookId: webhook.id,
      name: webhook.name
    });

    return res.status(201).json({
      success: true,
      data: safeWebhook,
      metadata: {
        requestId: `webhook_register_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Webhook registration failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Webhook registration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/integrations/webhooks
 * List all webhook endpoints
 */
router.get('/webhooks', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.debug('Webhook list requested', { userId });

    const webhooks = webhookManager.getWebhooks();
    
    // Remove secrets from response
    const safeWebhooks = webhooks.map(webhook => ({
      ...webhook,
      secret: '***'
    }));

    return res.json({
      success: true,
      data: safeWebhooks,
      metadata: {
        requestId: `webhook_list_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId,
        count: safeWebhooks.length
      }
    });

  } catch (error) {
    logger.error('Webhook list retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    
    return res.status(500).json({ 
      error: 'Webhook list retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/integrations/webhooks/:webhookId
 * Update webhook endpoint
 */
router.put('/webhooks/:webhookId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { webhookId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!webhookId) {
      return res.status(400).json({ error: 'webhookId parameter is required' });
    }

    logger.info('Webhook update requested', {
      userId,
      webhookId,
      updates: Object.keys(req.body)
    });

    const updatedWebhook = await webhookManager.updateWebhook(webhookId, req.body);
    
    if (!updatedWebhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Remove secret from response
    const safeWebhook = { ...updatedWebhook, secret: '***' };

    return res.json({
      success: true,
      data: safeWebhook,
      metadata: {
        requestId: `webhook_update_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Webhook update failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      webhookId: req.params.webhookId
    });
    
    return res.status(500).json({ 
      error: 'Webhook update failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/integrations/webhooks/:webhookId
 * Delete webhook endpoint
 */
router.delete('/webhooks/:webhookId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { webhookId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Webhook deletion requested', {
      userId,
      webhookId
    });

    const deleted = await webhookManager.deleteWebhook(webhookId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    return res.json({
      success: true,
      data: { deleted: true },
      metadata: {
        requestId: `webhook_delete_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Webhook deletion failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      webhookId: req.params.webhookId
    });
    
    return res.status(500).json({ 
      error: 'Webhook deletion failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/integrations/webhooks/:webhookId/test
 * Test webhook endpoint
 */
router.post('/webhooks/:webhookId/test', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { webhookId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Webhook test requested', {
      userId,
      webhookId
    });

    const testResult = await webhookManager.testWebhook(webhookId);

    logger.info('Webhook test completed', {
      userId,
      webhookId,
      success: testResult.success,
      responseTime: testResult.responseTime
    });

    return res.json({
      success: true,
      data: testResult,
      metadata: {
        requestId: `webhook_test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Webhook test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      webhookId: req.params.webhookId
    });
    
    return res.status(500).json({ 
      error: 'Webhook test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/integrations/webhooks/:webhookId/deliveries
 * Get webhook delivery history
 */
router.get('/webhooks/:webhookId/deliveries', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { webhookId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (limit < 1 || limit > 1000) {
      return res.status(400).json({ error: 'limit must be between 1 and 1000' });
    }

    const deliveries = webhookManager.getDeliveryHistory(webhookId, limit);

    return res.json({
      success: true,
      data: deliveries,
      metadata: {
        requestId: `webhook_deliveries_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId,
        count: deliveries.length,
        limit
      }
    });

  } catch (error) {
    logger.error('Webhook delivery history retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      webhookId: req.params.webhookId
    });
    
    return res.status(500).json({ 
      error: 'Webhook delivery history retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/integrations/webhooks/stats
 * Get webhook statistics
 */
router.get('/webhooks/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = webhookManager.getWebhookStats();

    return res.json({
      success: true,
      data: stats,
      metadata: {
        requestId: `webhook_stats_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Webhook stats retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    
    return res.status(500).json({ 
      error: 'Webhook stats retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// SIEM INTEGRATION ENDPOINTS
// =============================================================================

/**
 * POST /api/integrations/siem
 * Add SIEM connection
 */
router.post('/siem', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, type, config, credentials, features } = req.body;

    // Validate request
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required and must be a string' });
    }

    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'type is required and must be a string' });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config object is required' });
    }

    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ error: 'credentials object is required' });
    }

    if (!features || !Array.isArray(features)) {
      return res.status(400).json({ error: 'features array is required' });
    }

    // Validate SIEM type
    const validSiemTypes: SIEMType[] = [
      'splunk', 'elastic_stack', 'qradar', 'sentinel', 'sumo_logic',
      'chronicle', 'arcsight', 'logrhythm', 'securonix', 'exabeam',
      'generic_api', 'syslog'
    ];

    if (!validSiemTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Invalid SIEM type: ${type}`,
        validTypes: validSiemTypes
      });
    }

    // Validate features
    const validFeatures: SIEMFeature[] = [
      'event_export', 'alert_import', 'bi_directional_sync',
      'custom_dashboards', 'automated_response', 'correlation_rules',
      'threat_intelligence_feed', 'user_behavior_analytics'
    ];

    const invalidFeatures = features.filter(feature => !validFeatures.includes(feature));
    if (invalidFeatures.length > 0) {
      return res.status(400).json({ 
        error: `Invalid features: ${invalidFeatures.join(', ')}`,
        validFeatures
      });
    }

    logger.info('SIEM connection requested', {
      userId,
      name,
      type,
      features,
      endpoint: config.endpoint
    });

    const connection = await siemIntegrationService.addConnection({
      name,
      type,
      config,
      credentials,
      features
    });

    // Remove sensitive credentials from response
    const safeConnection = {
      ...connection,
      credentials: { authType: connection.credentials.authType }
    };

    logger.info('SIEM connection added successfully', {
      userId,
      connectionId: connection.id,
      name: connection.name,
      type: connection.type
    });

    return res.status(201).json({
      success: true,
      data: safeConnection,
      metadata: {
        requestId: `siem_add_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('SIEM connection addition failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'SIEM connection addition failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/integrations/siem
 * List all SIEM connections
 */
router.get('/siem', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.debug('SIEM connections list requested', { userId });

    const connections = siemIntegrationService.getConnections();
    
    // Remove sensitive credentials from response
    const safeConnections = connections.map(connection => ({
      ...connection,
      credentials: { authType: connection.credentials.authType }
    }));

    return res.json({
      success: true,
      data: safeConnections,
      metadata: {
        requestId: `siem_list_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId,
        count: safeConnections.length
      }
    });

  } catch (error) {
    logger.error('SIEM connections list retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    
    return res.status(500).json({ 
      error: 'SIEM connections list retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/integrations/siem/:connectionId
 * Update SIEM connection
 */
router.put('/siem/:connectionId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('SIEM connection update requested', {
      userId,
      connectionId,
      updates: Object.keys(req.body)
    });

    const updatedConnection = await siemIntegrationService.updateConnection(connectionId, req.body);
    
    if (!updatedConnection) {
      return res.status(404).json({ error: 'SIEM connection not found' });
    }

    // Remove sensitive credentials from response
    const safeConnection = {
      ...updatedConnection,
      credentials: { authType: updatedConnection.credentials.authType }
    };

    return res.json({
      success: true,
      data: safeConnection,
      metadata: {
        requestId: `siem_update_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('SIEM connection update failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      connectionId: req.params.connectionId
    });
    
    return res.status(500).json({ 
      error: 'SIEM connection update failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/integrations/siem/:connectionId
 * Remove SIEM connection
 */
router.delete('/siem/:connectionId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('SIEM connection deletion requested', {
      userId,
      connectionId
    });

    const deleted = await siemIntegrationService.removeConnection(connectionId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'SIEM connection not found' });
    }

    return res.json({
      success: true,
      data: { deleted: true },
      metadata: {
        requestId: `siem_delete_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('SIEM connection deletion failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      connectionId: req.params.connectionId
    });
    
    return res.status(500).json({ 
      error: 'SIEM connection deletion failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/integrations/siem/:connectionId/test
 * Test SIEM connection
 */
router.post('/siem/:connectionId/test', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('SIEM connection test requested', {
      userId,
      connectionId
    });

    const testResult = await siemIntegrationService.testConnection(connectionId);

    logger.info('SIEM connection test completed', {
      userId,
      connectionId,
      success: testResult.success,
      responseTime: testResult.responseTime
    });

    return res.json({
      success: true,
      data: testResult,
      metadata: {
        requestId: `siem_test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('SIEM connection test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      connectionId: req.params.connectionId
    });
    
    return res.status(500).json({ 
      error: 'SIEM connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/integrations/siem/:connectionId/import-alerts
 * Import alerts from SIEM
 */
router.post('/siem/:connectionId/import-alerts', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = req.params;
    const { since } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('SIEM alert import requested', {
      userId,
      connectionId,
      since
    });

    const importResult = await siemIntegrationService.importAlerts(connectionId, since);

    logger.info('SIEM alert import completed', {
      userId,
      connectionId,
      alertsImported: importResult.alertsImported,
      duration: importResult.duration
    });

    return res.json({
      success: true,
      data: importResult,
      metadata: {
        requestId: `siem_import_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('SIEM alert import failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      connectionId: req.params.connectionId
    });
    
    return res.status(500).json({ 
      error: 'SIEM alert import failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/integrations/siem/stats
 * Get SIEM integration statistics
 */
router.get('/siem/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = siemIntegrationService.getSIEMStats();

    return res.json({
      success: true,
      data: stats,
      metadata: {
        requestId: `siem_stats_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('SIEM stats retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    
    return res.status(500).json({ 
      error: 'SIEM stats retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/integrations/siem/sync-all
 * Trigger manual sync for all SIEM connections
 */
router.post('/siem/sync-all', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Manual SIEM sync requested', { userId });

    const syncResults = await siemIntegrationService.syncAllConnections();

    logger.info('Manual SIEM sync completed', {
      userId,
      connectionsProcessed: syncResults.length,
      successfulSyncs: syncResults.filter(r => r.success).length
    });

    return res.json({
      success: true,
      data: {
        syncResults,
        summary: {
          totalConnections: syncResults.length,
          successfulSyncs: syncResults.filter(r => r.success).length,
          failedSyncs: syncResults.filter(r => !r.success).length
        }
      },
      metadata: {
        requestId: `siem_sync_all_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Manual SIEM sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    
    return res.status(500).json({ 
      error: 'Manual SIEM sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as integrationRoutes };