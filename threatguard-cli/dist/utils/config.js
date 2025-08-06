"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = void 0;
const conf_1 = __importDefault(require("conf"));
class ConfigManager {
    constructor() {
        this.config = new conf_1.default({
            projectName: 'threatguard-cli',
            defaults: {
                apiUrl: 'https://api.threatguard.ai',
                preferences: {
                    theme: 'dark',
                    outputFormat: 'table',
                    realTimeUpdates: true,
                    notifications: true,
                },
            },
        });
    }
    get(key) {
        return key ? this.config.get(key) : this.config.store;
    }
    set(key, value) {
        if (typeof key === 'object') {
            Object.entries(key).forEach(([k, v]) => {
                this.config.set(k, v);
            });
        }
        else {
            this.config.set(key, value);
        }
    }
    delete(key) {
        this.config.delete(key);
    }
    clear() {
        this.config.clear();
    }
    has(key) {
        return this.config.has(key);
    }
    getApiUrl() {
        return this.get('apiUrl') || 'https://api.threatguard.ai';
    }
    getToken() {
        return this.get('token');
    }
    setToken(token) {
        this.set('token', token);
    }
    getUserId() {
        return this.get('userId');
    }
    setUserId(userId) {
        this.set('userId', userId);
    }
    isAuthenticated() {
        return this.has('token') && this.has('userId');
    }
    logout() {
        this.delete('token');
        this.delete('userId');
    }
    getPreferences() {
        return this.get('preferences') || {
            theme: 'dark',
            outputFormat: 'table',
            realTimeUpdates: true,
            notifications: true,
        };
    }
    setPreference(key, value) {
        const preferences = this.getPreferences();
        preferences[key] = value;
        this.set('preferences', preferences);
    }
}
exports.configManager = new ConfigManager();
//# sourceMappingURL=config.js.map