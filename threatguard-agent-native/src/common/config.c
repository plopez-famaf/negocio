/*  ThreatGuard Agent - Configuration Management
 *  Configuration loading, validation, and management system
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"
#include <cjson/cJSON.h>

/* Global configuration instance */
static struct tg_agent_config *g_config = NULL;

/* Default configuration values */
static const struct tg_agent_config default_config = {
    .agent_id = "threatguard-agent",
    .platform = {
        .host = "api.bg-threat.com",
        .port = 443,
        .api_key = "",
        .batch_size = 1000,
        .timeout = 30,
        .retry_limit = 3,
        .compress = 1,
        .tls_verify = 1
    },
    .discovery = {
        .enabled = 1,
        .interval_seconds = 300,
        .detect_organization = 1,
        .detect_compliance = 1,
        .include_network_info = 1
    },
    .security = {
        .enabled = 1,
        .rules_file = "/etc/threatguard-agent/security-rules.conf",
        .enable_threat_intel = 1,
        .enable_behavioral_analysis = 1,
        .drop_noise = 1
    },
    .logging = {
        .level = TG_LOG_INFO,
        .file_path = "/var/log/threatguard-agent/agent.log",
        .console_output = 0,
        .max_file_size = 10485760, /* 10MB */
        .max_files = 5
    },
    .performance = {
        .max_memory_mb = 256,
        .max_cpu_percent = 20,
        .enable_profiling = 0
    }
};

/* Initialize configuration system */
int tg_config_init(const char *config_file)
{
    if (g_config) {
        return 0; /* Already initialized */
    }
    
    g_config = flb_calloc(1, sizeof(struct tg_agent_config));
    if (!g_config) {
        tg_log(TG_LOG_ERROR, "failed to allocate configuration");
        return -1;
    }
    
    /* Start with default configuration */
    memcpy(g_config, &default_config, sizeof(struct tg_agent_config));
    
    /* Load from environment variables first */
    tg_config_load_env_vars();
    
    /* Load from configuration file if provided */
    if (config_file && tg_utils_file_exists(config_file)) {
        int ret = tg_config_load_file(config_file);
        if (ret != 0) {
            tg_log(TG_LOG_WARN, "failed to load config file %s, using defaults", config_file);
        } else {
            tg_log(TG_LOG_INFO, "loaded configuration from %s", config_file);
            strncpy(g_config->config_file, config_file, sizeof(g_config->config_file) - 1);
        }
    }
    
    /* Validate configuration */
    int validation_result = tg_config_validate();
    if (validation_result != 0) {
        tg_log(TG_LOG_ERROR, "configuration validation failed: %d", validation_result);
        flb_free(g_config);
        g_config = NULL;
        return -1;
    }
    
    tg_log(TG_LOG_INFO, "configuration initialized successfully");
    return 0;
}

/* Load configuration from file */
int tg_config_load_file(const char *filename)
{
    FILE *file;
    long file_size;
    char *file_content;
    cJSON *json;
    int ret = 0;
    
    if (!g_config || !filename) {
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "loading configuration from %s", filename);
    
    /* Read file content */
    file = fopen(filename, "r");
    if (!file) {
        tg_log(TG_LOG_ERROR, "failed to open config file: %s", filename);
        return -1;
    }
    
    fseek(file, 0, SEEK_END);
    file_size = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    if (file_size <= 0 || file_size > 1048576) { /* 1MB max */
        tg_log(TG_LOG_ERROR, "invalid config file size: %ld", file_size);
        fclose(file);
        return -1;
    }
    
    file_content = flb_malloc(file_size + 1);
    if (!file_content) {
        tg_log(TG_LOG_ERROR, "failed to allocate memory for config file");
        fclose(file);
        return -1;
    }
    
    size_t bytes_read = fread(file_content, 1, file_size, file);
    file_content[bytes_read] = '\0';
    fclose(file);
    
    /* Parse JSON */
    json = cJSON_Parse(file_content);
    if (!json) {
        const char *error_ptr = cJSON_GetErrorPtr();
        tg_log(TG_LOG_ERROR, "JSON parse error: %s", error_ptr ? error_ptr : "unknown");
        flb_free(file_content);
        return -1;
    }
    
    /* Load configuration sections */
    ret = tg_config_load_json(json);
    
    cJSON_Delete(json);
    flb_free(file_content);
    
    return ret;
}

/* Load configuration from JSON */
int tg_config_load_json(cJSON *json)
{
    cJSON *item;
    
    if (!json || !g_config) {
        return -1;
    }
    
    /* Agent ID */
    item = cJSON_GetObjectItem(json, "agent_id");
    if (cJSON_IsString(item)) {
        strncpy(g_config->agent_id, item->valuestring, sizeof(g_config->agent_id) - 1);
    }
    
    /* Platform configuration */
    cJSON *platform = cJSON_GetObjectItem(json, "platform");
    if (cJSON_IsObject(platform)) {
        tg_config_load_platform_json(platform);
    }
    
    /* Discovery configuration */
    cJSON *discovery = cJSON_GetObjectItem(json, "discovery");
    if (cJSON_IsObject(discovery)) {
        tg_config_load_discovery_json(discovery);
    }
    
    /* Security configuration */
    cJSON *security = cJSON_GetObjectItem(json, "security");
    if (cJSON_IsObject(security)) {
        tg_config_load_security_json(security);
    }
    
    /* Logging configuration */
    cJSON *logging = cJSON_GetObjectItem(json, "logging");
    if (cJSON_IsObject(logging)) {
        tg_config_load_logging_json(logging);
    }
    
    /* Performance configuration */
    cJSON *performance = cJSON_GetObjectItem(json, "performance");
    if (cJSON_IsObject(performance)) {
        tg_config_load_performance_json(performance);
    }
    
    return 0;
}

/* Load platform configuration from JSON */
void tg_config_load_platform_json(cJSON *platform)
{
    cJSON *item;
    
    item = cJSON_GetObjectItem(platform, "host");
    if (cJSON_IsString(item)) {
        strncpy(g_config->platform.host, item->valuestring, sizeof(g_config->platform.host) - 1);
    }
    
    item = cJSON_GetObjectItem(platform, "port");
    if (cJSON_IsNumber(item)) {
        g_config->platform.port = item->valueint;
    }
    
    item = cJSON_GetObjectItem(platform, "api_key");
    if (cJSON_IsString(item)) {
        strncpy(g_config->platform.api_key, item->valuestring, sizeof(g_config->platform.api_key) - 1);
    }
    
    item = cJSON_GetObjectItem(platform, "batch_size");
    if (cJSON_IsNumber(item)) {
        g_config->platform.batch_size = item->valueint;
    }
    
    item = cJSON_GetObjectItem(platform, "timeout");
    if (cJSON_IsNumber(item)) {
        g_config->platform.timeout = item->valueint;
    }
    
    item = cJSON_GetObjectItem(platform, "retry_limit");
    if (cJSON_IsNumber(item)) {
        g_config->platform.retry_limit = item->valueint;
    }
    
    item = cJSON_GetObjectItem(platform, "compress");
    if (cJSON_IsBool(item)) {
        g_config->platform.compress = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(platform, "tls_verify");
    if (cJSON_IsBool(item)) {
        g_config->platform.tls_verify = cJSON_IsTrue(item) ? 1 : 0;
    }
}

/* Load discovery configuration from JSON */
void tg_config_load_discovery_json(cJSON *discovery)
{
    cJSON *item;
    
    item = cJSON_GetObjectItem(discovery, "enabled");
    if (cJSON_IsBool(item)) {
        g_config->discovery.enabled = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(discovery, "interval_seconds");
    if (cJSON_IsNumber(item)) {
        g_config->discovery.interval_seconds = item->valueint;
    }
    
    item = cJSON_GetObjectItem(discovery, "detect_organization");
    if (cJSON_IsBool(item)) {
        g_config->discovery.detect_organization = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(discovery, "detect_compliance");
    if (cJSON_IsBool(item)) {
        g_config->discovery.detect_compliance = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(discovery, "include_network_info");
    if (cJSON_IsBool(item)) {
        g_config->discovery.include_network_info = cJSON_IsTrue(item) ? 1 : 0;
    }
}

/* Load security configuration from JSON */
void tg_config_load_security_json(cJSON *security)
{
    cJSON *item;
    
    item = cJSON_GetObjectItem(security, "enabled");
    if (cJSON_IsBool(item)) {
        g_config->security.enabled = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(security, "rules_file");
    if (cJSON_IsString(item)) {
        strncpy(g_config->security.rules_file, item->valuestring, sizeof(g_config->security.rules_file) - 1);
    }
    
    item = cJSON_GetObjectItem(security, "enable_threat_intel");
    if (cJSON_IsBool(item)) {
        g_config->security.enable_threat_intel = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(security, "enable_behavioral_analysis");
    if (cJSON_IsBool(item)) {
        g_config->security.enable_behavioral_analysis = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(security, "drop_noise");
    if (cJSON_IsBool(item)) {
        g_config->security.drop_noise = cJSON_IsTrue(item) ? 1 : 0;
    }
}

/* Load logging configuration from JSON */
void tg_config_load_logging_json(cJSON *logging)
{
    cJSON *item;
    
    item = cJSON_GetObjectItem(logging, "level");
    if (cJSON_IsString(item)) {
        const char *level_str = item->valuestring;
        if (strcmp(level_str, "trace") == 0) g_config->logging.level = TG_LOG_TRACE;
        else if (strcmp(level_str, "debug") == 0) g_config->logging.level = TG_LOG_DEBUG;
        else if (strcmp(level_str, "info") == 0) g_config->logging.level = TG_LOG_INFO;
        else if (strcmp(level_str, "warn") == 0) g_config->logging.level = TG_LOG_WARN;
        else if (strcmp(level_str, "error") == 0) g_config->logging.level = TG_LOG_ERROR;
        else if (strcmp(level_str, "fatal") == 0) g_config->logging.level = TG_LOG_FATAL;
    }
    
    item = cJSON_GetObjectItem(logging, "file_path");
    if (cJSON_IsString(item)) {
        strncpy(g_config->logging.file_path, item->valuestring, sizeof(g_config->logging.file_path) - 1);
    }
    
    item = cJSON_GetObjectItem(logging, "console_output");
    if (cJSON_IsBool(item)) {
        g_config->logging.console_output = cJSON_IsTrue(item) ? 1 : 0;
    }
    
    item = cJSON_GetObjectItem(logging, "max_file_size");
    if (cJSON_IsNumber(item)) {
        g_config->logging.max_file_size = item->valueint;
    }
    
    item = cJSON_GetObjectItem(logging, "max_files");
    if (cJSON_IsNumber(item)) {
        g_config->logging.max_files = item->valueint;
    }
}

/* Load performance configuration from JSON */
void tg_config_load_performance_json(cJSON *performance)
{
    cJSON *item;
    
    item = cJSON_GetObjectItem(performance, "max_memory_mb");
    if (cJSON_IsNumber(item)) {
        g_config->performance.max_memory_mb = item->valueint;
    }
    
    item = cJSON_GetObjectItem(performance, "max_cpu_percent");
    if (cJSON_IsNumber(item)) {
        g_config->performance.max_cpu_percent = item->valueint;
    }
    
    item = cJSON_GetObjectItem(performance, "enable_profiling");
    if (cJSON_IsBool(item)) {
        g_config->performance.enable_profiling = cJSON_IsTrue(item) ? 1 : 0;
    }
}

/* Load configuration from environment variables */
void tg_config_load_env_vars(void)
{
    const char *env_value;
    
    /* Platform configuration */
    env_value = getenv("TG_PLATFORM_HOST");
    if (env_value) {
        strncpy(g_config->platform.host, env_value, sizeof(g_config->platform.host) - 1);
    }
    
    env_value = getenv("TG_PLATFORM_PORT");
    if (env_value) {
        g_config->platform.port = atoi(env_value);
    }
    
    env_value = getenv("TG_API_KEY");
    if (env_value) {
        strncpy(g_config->platform.api_key, env_value, sizeof(g_config->platform.api_key) - 1);
    }
    
    env_value = getenv("TG_LOG_LEVEL");
    if (env_value) {
        if (strcmp(env_value, "trace") == 0) g_config->logging.level = TG_LOG_TRACE;
        else if (strcmp(env_value, "debug") == 0) g_config->logging.level = TG_LOG_DEBUG;
        else if (strcmp(env_value, "info") == 0) g_config->logging.level = TG_LOG_INFO;
        else if (strcmp(env_value, "warn") == 0) g_config->logging.level = TG_LOG_WARN;
        else if (strcmp(env_value, "error") == 0) g_config->logging.level = TG_LOG_ERROR;
        else if (strcmp(env_value, "fatal") == 0) g_config->logging.level = TG_LOG_FATAL;
    }
    
    env_value = getenv("TG_LOG_FILE");
    if (env_value) {
        strncpy(g_config->logging.file_path, env_value, sizeof(g_config->logging.file_path) - 1);
    }
    
    env_value = getenv("TG_CONSOLE_OUTPUT");
    if (env_value) {
        g_config->logging.console_output = (strcmp(env_value, "1") == 0 || 
                                           strcmp(env_value, "true") == 0) ? 1 : 0;
    }
}

/* Validate configuration */
int tg_config_validate(void)
{
    if (!g_config) {
        return -1;
    }
    
    /* Validate platform configuration */
    if (strlen(g_config->platform.host) == 0) {
        tg_log(TG_LOG_ERROR, "platform host is required");
        return -1;
    }
    
    if (g_config->platform.port <= 0 || g_config->platform.port > 65535) {
        tg_log(TG_LOG_ERROR, "invalid platform port: %d", g_config->platform.port);
        return -1;
    }
    
    if (strlen(g_config->platform.api_key) == 0) {
        tg_log(TG_LOG_WARN, "platform API key is not set");
    }
    
    if (g_config->platform.batch_size <= 0 || g_config->platform.batch_size > 10000) {
        tg_log(TG_LOG_ERROR, "invalid batch size: %d", g_config->platform.batch_size);
        return -1;
    }
    
    /* Validate discovery configuration */
    if (g_config->discovery.interval_seconds < 60) {
        tg_log(TG_LOG_WARN, "discovery interval too short, setting to 60 seconds");
        g_config->discovery.interval_seconds = 60;
    }
    
    /* Validate logging configuration */
    if (g_config->logging.level < TG_LOG_TRACE || g_config->logging.level > TG_LOG_FATAL) {
        tg_log(TG_LOG_ERROR, "invalid log level: %d", g_config->logging.level);
        return -1;
    }
    
    /* Validate performance limits */
    if (g_config->performance.max_memory_mb < 64) {
        tg_log(TG_LOG_WARN, "memory limit too low, setting to 64MB");
        g_config->performance.max_memory_mb = 64;
    }
    
    if (g_config->performance.max_cpu_percent < 5 || g_config->performance.max_cpu_percent > 100) {
        tg_log(TG_LOG_ERROR, "invalid CPU limit: %d", g_config->performance.max_cpu_percent);
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "configuration validation successful");
    return 0;
}

/* Get global configuration */
struct tg_agent_config *tg_config_get(void)
{
    return g_config;
}

/* Save configuration to file */
int tg_config_save_file(const char *filename)
{
    FILE *file;
    cJSON *json;
    char *json_string;
    
    if (!g_config || !filename) {
        return -1;
    }
    
    /* Create JSON representation */
    json = tg_config_to_json();
    if (!json) {
        tg_log(TG_LOG_ERROR, "failed to create JSON configuration");
        return -1;
    }
    
    json_string = cJSON_Print(json);
    if (!json_string) {
        tg_log(TG_LOG_ERROR, "failed to serialize JSON configuration");
        cJSON_Delete(json);
        return -1;
    }
    
    /* Write to file */
    file = fopen(filename, "w");
    if (!file) {
        tg_log(TG_LOG_ERROR, "failed to open config file for writing: %s", filename);
        cJSON_free(json_string);
        cJSON_Delete(json);
        return -1;
    }
    
    fputs(json_string, file);
    fclose(file);
    
    cJSON_free(json_string);
    cJSON_Delete(json);
    
    tg_log(TG_LOG_INFO, "configuration saved to %s", filename);
    return 0;
}

/* Convert configuration to JSON */
cJSON *tg_config_to_json(void)
{
    if (!g_config) {
        return NULL;
    }
    
    cJSON *json = cJSON_CreateObject();
    cJSON *platform = cJSON_CreateObject();
    cJSON *discovery = cJSON_CreateObject();
    cJSON *security = cJSON_CreateObject();
    cJSON *logging = cJSON_CreateObject();
    cJSON *performance = cJSON_CreateObject();
    
    /* Agent ID */
    cJSON_AddStringToObject(json, "agent_id", g_config->agent_id);
    
    /* Platform configuration */
    cJSON_AddStringToObject(platform, "host", g_config->platform.host);
    cJSON_AddNumberToObject(platform, "port", g_config->platform.port);
    cJSON_AddStringToObject(platform, "api_key", g_config->platform.api_key);
    cJSON_AddNumberToObject(platform, "batch_size", g_config->platform.batch_size);
    cJSON_AddNumberToObject(platform, "timeout", g_config->platform.timeout);
    cJSON_AddNumberToObject(platform, "retry_limit", g_config->platform.retry_limit);
    cJSON_AddBoolToObject(platform, "compress", g_config->platform.compress);
    cJSON_AddBoolToObject(platform, "tls_verify", g_config->platform.tls_verify);
    cJSON_AddItemToObject(json, "platform", platform);
    
    /* Discovery configuration */
    cJSON_AddBoolToObject(discovery, "enabled", g_config->discovery.enabled);
    cJSON_AddNumberToObject(discovery, "interval_seconds", g_config->discovery.interval_seconds);
    cJSON_AddBoolToObject(discovery, "detect_organization", g_config->discovery.detect_organization);
    cJSON_AddBoolToObject(discovery, "detect_compliance", g_config->discovery.detect_compliance);
    cJSON_AddBoolToObject(discovery, "include_network_info", g_config->discovery.include_network_info);
    cJSON_AddItemToObject(json, "discovery", discovery);
    
    /* Security configuration */
    cJSON_AddBoolToObject(security, "enabled", g_config->security.enabled);
    cJSON_AddStringToObject(security, "rules_file", g_config->security.rules_file);
    cJSON_AddBoolToObject(security, "enable_threat_intel", g_config->security.enable_threat_intel);
    cJSON_AddBoolToObject(security, "enable_behavioral_analysis", g_config->security.enable_behavioral_analysis);
    cJSON_AddBoolToObject(security, "drop_noise", g_config->security.drop_noise);
    cJSON_AddItemToObject(json, "security", security);
    
    /* Logging configuration */
    const char *level_names[] = {"trace", "debug", "info", "warn", "error", "fatal"};
    cJSON_AddStringToObject(logging, "level", level_names[g_config->logging.level]);
    cJSON_AddStringToObject(logging, "file_path", g_config->logging.file_path);
    cJSON_AddBoolToObject(logging, "console_output", g_config->logging.console_output);
    cJSON_AddNumberToObject(logging, "max_file_size", g_config->logging.max_file_size);
    cJSON_AddNumberToObject(logging, "max_files", g_config->logging.max_files);
    cJSON_AddItemToObject(json, "logging", logging);
    
    /* Performance configuration */
    cJSON_AddNumberToObject(performance, "max_memory_mb", g_config->performance.max_memory_mb);
    cJSON_AddNumberToObject(performance, "max_cpu_percent", g_config->performance.max_cpu_percent);
    cJSON_AddBoolToObject(performance, "enable_profiling", g_config->performance.enable_profiling);
    cJSON_AddItemToObject(json, "performance", performance);
    
    return json;
}

/* Cleanup configuration system */
void tg_config_cleanup(void)
{
    if (g_config) {
        tg_log(TG_LOG_DEBUG, "cleaning up configuration");
        flb_free(g_config);
        g_config = NULL;
    }
}