/*  ThreatGuard Agent - Discovery Input Plugin
 *  Zero-config system discovery and auto-configuration
 *  Copyright (C) 2025 BG Threat AI
 */

#include <fluent-bit/flb_input.h>
#include <fluent-bit/flb_config.h>
#include <fluent-bit/flb_pack.h>
#include <fluent-bit/flb_log.h>
#include <fluent-bit/flb_mem.h>
#include <fluent-bit/flb_time.h>

#include "../../include/threatguard.h"

/* Plugin name */
static const char *plugin_name = "threatguard_discovery";

/* Plugin configuration properties */
static struct flb_config_map config_map[] = {
    {
        FLB_CONFIG_MAP_INT, "discovery_interval", "300",
        0, FLB_TRUE, offsetof(struct tg_discovery_ctx, discovery_timer),
        "Discovery scan interval in seconds (default: 300)"
    },
    {
        FLB_CONFIG_MAP_BOOL, "enable_auto_config", "true",
        0, FLB_TRUE, 0,
        "Enable automatic configuration generation"
    },
    {
        FLB_CONFIG_MAP_STR, "config_path", "/etc/threatguard-agent/agent.conf",
        0, FLB_TRUE, 0,
        "Path to save generated configuration"
    },
    /* Sentinel */
    {0}
};

static int tg_discovery_init(struct flb_input_instance *ins,
                            struct flb_config *config, void *data)
{
    struct tg_discovery_ctx *ctx;
    const char *config_path;
    int ret;
    
    flb_plg_info(ins, "initializing ThreatGuard discovery plugin v%s", TG_VERSION);
    
    /* Allocate plugin context */
    ctx = flb_calloc(1, sizeof(struct tg_discovery_ctx));
    if (!ctx) {
        flb_plg_error(ins, "failed to allocate context");
        return -1;
    }
    
    ctx->ins = ins;
    
    /* Allocate configuration */
    ctx->config = flb_calloc(1, sizeof(struct tg_agent_config));
    if (!ctx->config) {
        flb_plg_error(ins, "failed to allocate configuration");
        flb_free(ctx);
        return -1;
    }
    
    /* Set default configuration values */
    ctx->config->collection_interval = 60;
    ctx->config->batch_size = 100;
    ctx->config->max_memory_mb = 80;
    ctx->config->max_cpu_percent = 5;
    ctx->config->discovery_interval = 300;
    ctx->config->enable_auto_config = 1;
    ctx->config->enable_encryption = 1;
    ctx->config->enable_compression = 1;
    ctx->config->retention_days = 90;
    
    /* Load configuration from file if it exists */
    config_path = flb_input_get_property("config_path", ins);
    if (config_path && tg_utils_file_exists(config_path)) {
        ret = tg_config_load(ctx->config, config_path);
        if (ret == 0) {
            flb_plg_info(ins, "loaded configuration from %s", config_path);
        } else {
            flb_plg_warn(ins, "failed to load configuration from %s, using defaults", config_path);
        }
    }
    
    /* Initialize discovery system */
    ret = tg_discovery_init();
    if (ret != 0) {
        flb_plg_error(ins, "failed to initialize discovery system");
        flb_free(ctx->config);
        flb_free(ctx);
        return -1;
    }
    
    /* Set plugin context */
    flb_input_set_context(ins, ctx);
    
    flb_plg_info(ins, "ThreatGuard discovery plugin initialized successfully");
    return 0;
}

static int tg_discovery_collect(struct flb_input_instance *ins,
                               struct flb_config *config, void *in_context)
{
    struct tg_discovery_ctx *ctx = in_context;
    struct tg_discovery_result result;
    msgpack_sbuffer mp_sbuf;
    msgpack_packer mp_pck;
    struct flb_time tm;
    int ret;
    
    /* Get current timestamp */
    flb_time_get(&tm);
    
    flb_plg_debug(ins, "starting discovery scan");
    
    /* Initialize result structure */
    memset(&result, 0, sizeof(result));
    result.discovery_time = time(NULL);
    
    /* Perform system discovery */
    ret = tg_discovery_scan_system(&result.system);
    if (ret != 0) {
        flb_plg_error(ins, "system discovery failed: %d", ret);
        return -1;
    }
    
    flb_plg_info(ins, "discovered system: %s (%s)", 
                 result.system.hostname, result.system.os_version);
    
    /* Discover security tools */
    ret = tg_discovery_scan_security_tools(&result.security_tools);
    if (ret < 0) {
        flb_plg_error(ins, "security tool discovery failed: %d", ret);
        return -1;
    }
    
    result.security_tool_count = ret;
    flb_plg_info(ins, "discovered %d security tools", result.security_tool_count);
    
    /* Detect organization */
    ret = tg_discovery_detect_organization(&result.organization, &result.system);
    if (ret != 0) {
        flb_plg_warn(ins, "organization detection failed, using defaults");
        strcpy(result.organization.name, "Unknown Organization");
        strcpy(result.organization.id, "unknown");
        result.organization.detection_confidence = 0;
    }
    
    flb_plg_info(ins, "detected organization: %s (confidence: %d%%)",
                 result.organization.name, result.organization.detection_confidence);
    
    /* Calculate overall confidence */
    result.overall_confidence = (result.organization.detection_confidence + 
                                (result.security_tool_count > 0 ? 80 : 50)) / 2;
    
    /* Generate configuration if auto-config is enabled */
    if (ctx->config->enable_auto_config) {
        ret = tg_discovery_generate_config(ctx->config, &result);
        if (ret != 0) {
            flb_plg_error(ins, "configuration generation failed: %d", ret);
        } else {
            flb_plg_info(ins, "generated zero-config configuration");
            
            /* Save configuration */
            const char *config_path = flb_input_get_property("config_path", ins);
            if (config_path) {
                tg_config_save(ctx->config, config_path);
            }
        }
    }
    
    /* Pack discovery result as msgpack */
    msgpack_sbuffer_init(&mp_sbuf);
    msgpack_packer_init(&mp_pck, &mp_sbuf, msgpack_sbuffer_write);
    
    /* Create discovery event */
    msgpack_pack_map(&mp_pck, 8);
    
    /* Timestamp */
    msgpack_pack_str(&mp_pck, 9);
    msgpack_pack_str_body(&mp_pck, "timestamp", 9);
    msgpack_pack_uint64(&mp_pck, result.discovery_time);
    
    /* Event type */
    msgpack_pack_str(&mp_pck, 10);
    msgpack_pack_str_body(&mp_pck, "event_type", 10);
    msgpack_pack_str(&mp_pck, 21);
    msgpack_pack_str_body(&mp_pck, "threatguard_discovery", 21);
    
    /* Hostname */
    msgpack_pack_str(&mp_pck, 8);
    msgpack_pack_str_body(&mp_pck, "hostname", 8);
    msgpack_pack_str(&mp_pck, strlen(result.system.hostname));
    msgpack_pack_str_body(&mp_pck, result.system.hostname, strlen(result.system.hostname));
    
    /* Platform */
    msgpack_pack_str(&mp_pck, 8);
    msgpack_pack_str_body(&mp_pck, "platform", 8);
    msgpack_pack_int(&mp_pck, result.system.platform_type);
    
    /* Organization */
    msgpack_pack_str(&mp_pck, 12);
    msgpack_pack_str_body(&mp_pck, "organization", 12);
    msgpack_pack_map(&mp_pck, 3);
    
    msgpack_pack_str(&mp_pck, 4);
    msgpack_pack_str_body(&mp_pck, "name", 4);
    msgpack_pack_str(&mp_pck, strlen(result.organization.name));
    msgpack_pack_str_body(&mp_pck, result.organization.name, strlen(result.organization.name));
    
    msgpack_pack_str(&mp_pck, 2);
    msgpack_pack_str_body(&mp_pck, "id", 2);
    msgpack_pack_str(&mp_pck, strlen(result.organization.id));
    msgpack_pack_str_body(&mp_pck, result.organization.id, strlen(result.organization.id));
    
    msgpack_pack_str(&mp_pck, 10);
    msgpack_pack_str_body(&mp_pck, "confidence", 10);
    msgpack_pack_int(&mp_pck, result.organization.detection_confidence);
    
    /* Security tools */
    msgpack_pack_str(&mp_pck, 14);
    msgpack_pack_str_body(&mp_pck, "security_tools", 14);
    msgpack_pack_array(&mp_pck, result.security_tool_count);
    
    struct tg_security_tool *tool = result.security_tools;
    while (tool) {
        msgpack_pack_map(&mp_pck, 4);
        
        msgpack_pack_str(&mp_pck, 4);
        msgpack_pack_str_body(&mp_pck, "name", 4);
        msgpack_pack_str(&mp_pck, strlen(tool->name));
        msgpack_pack_str_body(&mp_pck, tool->name, strlen(tool->name));
        
        msgpack_pack_str(&mp_pck, 6);
        msgpack_pack_str_body(&mp_pck, "vendor", 6);
        msgpack_pack_str(&mp_pck, strlen(tool->vendor));
        msgpack_pack_str_body(&mp_pck, tool->vendor, strlen(tool->vendor));
        
        msgpack_pack_str(&mp_pck, 4);
        msgpack_pack_str_body(&mp_pck, "type", 4);
        msgpack_pack_int(&mp_pck, tool->type);
        
        msgpack_pack_str(&mp_pck, 6);
        msgpack_pack_str_body(&mp_pck, "active", 6);
        msgpack_pack_true(&mp_pck);
        
        tool = tool->next;
    }
    
    /* Compliance */
    msgpack_pack_str(&mp_pck, 10);
    msgpack_pack_str_body(&mp_pck, "compliance", 10);
    msgpack_pack_int(&mp_pck, result.organization.compliance_requirements);
    
    /* Overall confidence */
    msgpack_pack_str(&mp_pck, 10);
    msgpack_pack_str_body(&mp_pck, "confidence", 10);
    msgpack_pack_int(&mp_pck, result.overall_confidence);
    
    /* Send the packed record to Fluent Bit */
    ret = flb_input_log_append(ins, NULL, 0, mp_sbuf.data, mp_sbuf.size);
    if (ret < 0) {
        flb_plg_error(ins, "failed to append discovery record");
    }
    
    /* Cleanup */
    msgpack_sbuffer_destroy(&mp_sbuf);
    
    /* Store result for next iteration */
    if (ctx->last_result) {
        tg_discovery_result_free(ctx->last_result);
        flb_free(ctx->last_result);
    }
    
    ctx->last_result = flb_malloc(sizeof(struct tg_discovery_result));
    if (ctx->last_result) {
        memcpy(ctx->last_result, &result, sizeof(struct tg_discovery_result));
        /* Note: We're sharing pointers here, don't free the original result */
    }
    
    flb_plg_debug(ins, "discovery scan completed, confidence: %d%%", result.overall_confidence);
    return 0;
}

static int tg_discovery_exit(void *data, struct flb_config *config)
{
    struct tg_discovery_ctx *ctx = data;
    
    if (!ctx) {
        return 0;
    }
    
    /* Free last discovery result */
    if (ctx->last_result) {
        tg_discovery_result_free(ctx->last_result);
        flb_free(ctx->last_result);
    }
    
    /* Free configuration */
    if (ctx->config) {
        flb_free(ctx->config);
    }
    
    /* Free context */
    flb_free(ctx);
    
    return 0;
}

/* Plugin definition */
struct flb_input_plugin in_threatguard_discovery_plugin = {
    .name         = "threatguard_discovery",
    .description  = "ThreatGuard zero-config discovery and profiling",
    .cb_init      = tg_discovery_init,
    .cb_pre_run   = NULL,
    .cb_collect   = tg_discovery_collect,
    .cb_flush_buf = NULL,
    .cb_exit      = tg_discovery_exit,
    .config_map   = config_map,
    .flags        = FLB_INPUT_NET
};

struct flb_input_plugin *tg_discovery_plugin_register(void)
{
    return &in_threatguard_discovery_plugin;
}