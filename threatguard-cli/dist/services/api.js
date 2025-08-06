"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
class APIClient {
    constructor() {
        this.client = axios_1.default.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'threatguard-cli/1.0.0'
            }
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use((config) => {
            const baseUrl = config_1.configManager.getApiUrl();
            config.baseURL = baseUrl;
            const token = config_1.configManager.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            logger_1.logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            logger_1.logger.error(`Request error: ${error.message}`);
            return Promise.reject(error);
        });
        // Response interceptor
        this.client.interceptors.response.use((response) => {
            logger_1.logger.debug(`API Response: ${response.status} ${response.config.url}`);
            return response;
        }, (error) => {
            if (error.response?.status === 401) {
                logger_1.logger.error('Authentication failed. Please login again.');
                config_1.configManager.logout();
            }
            else if (error.response?.status >= 500) {
                logger_1.logger.error('Server error. Please try again later.');
            }
            else {
                logger_1.logger.error(`API error: ${error.response?.data?.error?.message || error.message}`);
            }
            return Promise.reject(error);
        });
    }
    // Authentication
    async login(credentials) {
        const response = await this.client.post('/auth/login', credentials);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Login failed');
        }
        const tokenData = response.data.data;
        config_1.configManager.setToken(tokenData.token);
        config_1.configManager.setUserId(tokenData.userId);
        return tokenData;
    }
    async logout() {
        try {
            await this.client.post('/auth/logout');
        }
        finally {
            config_1.configManager.logout();
        }
    }
    async validateToken() {
        try {
            const response = await this.client.get('/auth/validate');
            return response.data.success;
        }
        catch {
            return false;
        }
    }
    // Threat Detection
    async startThreatScan(targets, options) {
        const response = await this.client.post('/threat/scan', {
            targets,
            options
        });
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Failed to start threat scan');
        }
        return response.data.data;
    }
    async getThreatScanStatus(scanId) {
        const response = await this.client.get(`/threat/scan/${scanId}`);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Failed to get scan status');
        }
        return response.data.data;
    }
    async getThreats(filters) {
        const response = await this.client.get('/threat/events', {
            params: filters
        });
        if (!response.data.success) {
            throw new Error(response.data.error?.message || 'Failed to get threats');
        }
        return response.data.data || [];
    }
    // Behavioral Analysis
    async analyzeBehavior(request) {
        const response = await this.client.post('/behavior/analyze', request);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Behavioral analysis failed');
        }
        return response.data.data;
    }
    async getBehaviorPatterns(target, timeRange) {
        const response = await this.client.get('/behavior/patterns', {
            params: { target, ...timeRange }
        });
        if (!response.data.success) {
            throw new Error(response.data.error?.message || 'Failed to get behavior patterns');
        }
        return response.data.data || [];
    }
    // Network Monitoring
    async scanNetwork(target) {
        const response = await this.client.post('/network/scan', target);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Network scan failed');
        }
        return response.data.data;
    }
    async getNetworkEvents(filters) {
        const response = await this.client.get('/network/events', {
            params: filters
        });
        if (!response.data.success) {
            throw new Error(response.data.error?.message || 'Failed to get network events');
        }
        return response.data.data || [];
    }
    // Threat Intelligence
    async queryThreatIntel(query) {
        const response = await this.client.post('/intel/query', query);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Threat intelligence query failed');
        }
        return response.data.data;
    }
    // Reports
    async generateReport(request) {
        const response = await this.client.post('/reports/generate', request);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Report generation failed');
        }
        return response.data.data;
    }
    async getReportStatus(reportId) {
        const response = await this.client.get(`/reports/${reportId}`);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error?.message || 'Failed to get report status');
        }
        return response.data.data;
    }
    // System Health
    async getSystemHealth() {
        const response = await this.client.get('/health');
        if (!response.data.success) {
            throw new Error(response.data.error?.message || 'Failed to get system health');
        }
        return response.data.data;
    }
    // Metrics
    async getMetrics(timeRange) {
        const response = await this.client.get('/metrics', {
            params: timeRange
        });
        if (!response.data.success) {
            throw new Error(response.data.error?.message || 'Failed to get metrics');
        }
        return response.data.data;
    }
}
exports.apiClient = new APIClient();
//# sourceMappingURL=api.js.map