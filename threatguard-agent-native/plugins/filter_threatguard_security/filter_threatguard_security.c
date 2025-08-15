/*  ThreatGuard Agent - Security Filter Plugin
 *  Real-time security event filtering and threat detection
 *  Copyright (C) 2025 BG Threat AI
 */

#include <fluent-bit/flb_filter.h>
#include <fluent-bit/flb_config.h>
#include <fluent-bit/flb_pack.h>
#include <fluent-bit/flb_log.h>
#include <fluent-bit/flb_mem.h>
#include <fluent-bit/flb_time.h>
#include <fluent-bit/flb_hash.h>

#include "../../include/threatguard.h"

/* Plugin configuration properties */
static struct flb_config_map config_map[] = {
    {
        FLB_CONFIG_MAP_STR, "rules_file", "/etc/threatguard-agent/security-rules.conf",
        0, FLB_TRUE, 0,
        "Path to security rules configuration file"
    },
    {
        FLB_CONFIG_MAP_BOOL, "enable_threat_intel", "true",
        0, FLB_TRUE, 0,
        "Enable threat intelligence enrichment"
    },
    {
        FLB_CONFIG_MAP_BOOL, "enable_behavioral_analysis", "true",
        0, FLB_TRUE, 0,
        "Enable behavioral analysis detection"
    },
    {
        FLB_CONFIG_MAP_INT, "max_rules", "10000",
        0, FLB_TRUE, 0,
        "Maximum number of security rules to load"
    },
    {
        FLB_CONFIG_MAP_BOOL, "drop_noise", "true",
        0, FLB_TRUE, 0,
        "Drop low-priority noise events to reduce volume"
    },
    /* Sentinel */
    {0}
};

static int tg_security_init(struct flb_filter_instance *ins,
                           struct flb_config *config, void *data)
{
    struct tg_security_ctx *ctx;
    const char *rules_file;
    int ret;
    
    flb_plg_info(ins, "initializing ThreatGuard security filter v%s", TG_VERSION);
    
    /* Allocate plugin context */
    ctx = flb_calloc(1, sizeof(struct tg_security_ctx));
    if (!ctx) {
        flb_plg_error(ins, "failed to allocate context");
        return -1;
    }
    
    ctx->ins = ins;
    
    /* Allocate agent configuration */
    ctx->config = flb_calloc(1, sizeof(struct tg_agent_config));
    if (!ctx->config) {
        flb_plg_error(ins, "failed to allocate configuration");
        flb_free(ctx);
        return -1;
    }
    
    /* Initialize security rules */
    ret = tg_security_init_rules(ctx);
    if (ret != 0) {
        flb_plg_error(ins, "failed to initialize security rules: %d", ret);
        flb_free(ctx->config);
        flb_free(ctx);
        return -1;
    }
    
    /* Load rules from file */
    rules_file = flb_filter_get_property("rules_file", ins);
    if (rules_file && tg_utils_file_exists(rules_file)) {
        ret = tg_security_load_rules_file(ctx, rules_file);
        if (ret > 0) {
            flb_plg_info(ins, "loaded %d security rules from %s", ret, rules_file);
        } else {
            flb_plg_warn(ins, "failed to load rules from %s, using defaults", rules_file);
        }
    }
    
    /* Add default rules if no rules loaded */
    if (ctx->rule_count == 0) {
        tg_security_add_default_rules(ctx);
        flb_plg_info(ins, "loaded %d default security rules", ctx->rule_count);
    }
    
    /* Set plugin context */
    flb_filter_set_context(ins, ctx);
    
    flb_plg_info(ins, "ThreatGuard security filter initialized with %d rules", ctx->rule_count);
    return 0;
}

static int tg_security_filter(const void *data, size_t bytes,
                             const char *tag, int tag_len,
                             void **out_buf, size_t *out_size,
                             struct flb_filter_instance *ins,
                             void *filter_context, struct flb_config *config)
{
    struct tg_security_ctx *ctx = filter_context;
    msgpack_unpacked result;
    msgpack_object root;
    msgpack_sbuffer mp_sbuf;
    msgpack_packer mp_pck;
    size_t off = 0;
    int processed = 0;
    int flagged = 0;
    int dropped = 0;
    
    /* Initialize msgpack */
    msgpack_unpacked_init(&result);
    msgpack_sbuffer_init(&mp_sbuf);
    msgpack_packer_init(&mp_pck, &mp_sbuf, msgpack_sbuffer_write);
    
    /* Process each record */
    while (msgpack_unpack_next(&result, data, bytes, &off) == MSGPACK_UNPACK_SUCCESS) {
        root = result.data;
        processed++;
        
        /* Apply security filtering */
        int action = tg_security_apply_filter(&root, ctx);
        
        switch (action) {
            case TG_SECURITY_ACTION_PASS:
                /* Pass through unchanged */
                msgpack_pack_object(&mp_pck, root);
                break;
                
            case TG_SECURITY_ACTION_FLAG:
                /* Enrich with security metadata and pass */
                tg_security_enrich_event(&root, ctx, &mp_pck);
                flagged++;
                break;
                
            case TG_SECURITY_ACTION_DROP:
                /* Drop the event */
                dropped++;
                break;
                
            case TG_SECURITY_ACTION_ENRICH:
                /* Enrich with additional context */
                tg_security_enrich_event(&root, ctx, &mp_pck);
                break;
                
            default:
                /* Unknown action, pass through */
                msgpack_pack_object(&mp_pck, root);
        }
    }
    
    /* Log processing statistics */
    if (processed > 0) {
        flb_plg_debug(ins, "processed %d events: %d flagged, %d dropped", 
                      processed, flagged, dropped);
    }
    
    /* Set output buffer */
    *out_buf = flb_malloc(mp_sbuf.size);
    if (!*out_buf) {
        flb_plg_error(ins, "failed to allocate output buffer");
        msgpack_sbuffer_destroy(&mp_sbuf);
        msgpack_unpacked_destroy(&result);
        return FLB_FILTER_NOTOUCH;
    }
    
    memcpy(*out_buf, mp_sbuf.data, mp_sbuf.size);
    *out_size = mp_sbuf.size;
    
    /* Cleanup */
    msgpack_sbuffer_destroy(&mp_sbuf);
    msgpack_unpacked_destroy(&result);
    
    return FLB_FILTER_MODIFIED;
}

static int tg_security_exit(void *data, struct flb_config *config)
{
    struct tg_security_ctx *ctx = data;
    
    if (!ctx) {
        return 0;
    }
    
    /* Free configuration */
    if (ctx->config) {
        flb_free(ctx->config);
    }
    
    /* Free context */
    flb_free(ctx);
    
    return 0;
}

/* Apply security rules to an event */
int tg_security_apply_filter(msgpack_object *obj, struct tg_security_ctx *ctx)
{
    if (!obj || !ctx) {
        return TG_SECURITY_ACTION_PASS;
    }
    
    /* Only process map objects (structured events) */
    if (obj->type != MSGPACK_OBJECT_MAP) {
        return TG_SECURITY_ACTION_PASS;
    }
    
    msgpack_object_map map = obj->via.map;
    int highest_priority_action = TG_SECURITY_ACTION_PASS;
    int highest_priority = -1;
    
    /* Apply each security rule */
    for (int i = 0; i < ctx->rule_count; i++) {
        struct tg_security_rule *rule = &ctx->rules[i];
        
        /* Skip disabled rules */
        if (!rule->enabled) {
            continue;
        }
        
        /* Check if rule matches */
        if (tg_security_rule_matches(rule, &map)) {
            /* Rule matched, check if it has higher priority */
            if (rule->priority > highest_priority) {
                highest_priority = rule->priority;
                highest_priority_action = rule->action;
            }
            
            /* Update rule statistics */
            rule->match_count++;
            rule->last_match = time(NULL);
        }
    }
    
    return highest_priority_action;
}

/* Check if a security rule matches an event */
int tg_security_rule_matches(struct tg_security_rule *rule, msgpack_object_map *map)
{
    switch (rule->type) {
        case TG_RULE_TYPE_FIELD_MATCH:
            return tg_security_check_field_match(rule, map);
            
        case TG_RULE_TYPE_FIELD_REGEX:
            return tg_security_check_field_regex(rule, map);
            
        case TG_RULE_TYPE_FIELD_EXISTS:
            return tg_security_check_field_exists(rule, map);
            
        case TG_RULE_TYPE_THREAT_INTEL:
            return tg_security_check_threat_intel(rule, map);
            
        case TG_RULE_TYPE_BEHAVIORAL:
            return tg_security_check_behavioral(rule, map);
            
        case TG_RULE_TYPE_COMPLIANCE:
            return tg_security_check_compliance(rule, map);
            
        default:
            return 0;
    }
}

/* Check field exact match */
int tg_security_check_field_match(struct tg_security_rule *rule, msgpack_object_map *map)
{
    /* Find the field in the event */
    for (uint32_t i = 0; i < map->size; i++) {
        msgpack_object key = map->ptr[i].key;
        msgpack_object val = map->ptr[i].val;
        
        if (key.type == MSGPACK_OBJECT_STR && 
            key.via.str.size == strlen(rule->field_name) &&
            memcmp(key.via.str.ptr, rule->field_name, key.via.str.size) == 0) {
            
            /* Field found, check value */
            if (val.type == MSGPACK_OBJECT_STR) {
                if (val.via.str.size == strlen(rule->pattern) &&
                    memcmp(val.via.str.ptr, rule->pattern, val.via.str.size) == 0) {
                    return 1;
                }
            }
        }
    }
    
    return 0;
}

/* Check field regex match */
int tg_security_check_field_regex(struct tg_security_rule *rule, msgpack_object_map *map)
{
    /* This would implement regex matching using PCRE or similar */
    /* For now, fall back to substring matching */
    
    for (uint32_t i = 0; i < map->size; i++) {
        msgpack_object key = map->ptr[i].key;
        msgpack_object val = map->ptr[i].val;
        
        if (key.type == MSGPACK_OBJECT_STR && 
            key.via.str.size == strlen(rule->field_name) &&
            memcmp(key.via.str.ptr, rule->field_name, key.via.str.size) == 0) {
            
            if (val.type == MSGPACK_OBJECT_STR) {
                /* Simple substring matching */
                if (strnstr(val.via.str.ptr, rule->pattern, val.via.str.size)) {
                    return 1;
                }
            }
        }
    }
    
    return 0;
}

/* Check field exists */
int tg_security_check_field_exists(struct tg_security_rule *rule, msgpack_object_map *map)
{
    for (uint32_t i = 0; i < map->size; i++) {
        msgpack_object key = map->ptr[i].key;
        
        if (key.type == MSGPACK_OBJECT_STR && 
            key.via.str.size == strlen(rule->field_name) &&
            memcmp(key.via.str.ptr, rule->field_name, key.via.str.size) == 0) {
            return 1;
        }
    }
    
    return 0;
}

/* Check threat intelligence indicators */
int tg_security_check_threat_intel(struct tg_security_rule *rule, msgpack_object_map *map)
{
    /* This would implement IOC lookup against threat intelligence feeds */
    /* Check for malicious IPs, domains, file hashes, etc. */
    
    /* Look for common threat indicators */
    const char *threat_fields[] = {"src_ip", "dst_ip", "domain", "url", "file_hash", NULL};
    
    for (int field_idx = 0; threat_fields[field_idx]; field_idx++) {
        for (uint32_t i = 0; i < map->size; i++) {
            msgpack_object key = map->ptr[i].key;
            msgpack_object val = map->ptr[i].val;
            
            if (key.type == MSGPACK_OBJECT_STR && 
                key.via.str.size == strlen(threat_fields[field_idx]) &&
                memcmp(key.via.str.ptr, threat_fields[field_idx], key.via.str.size) == 0) {
                
                if (val.type == MSGPACK_OBJECT_STR) {
                    /* Check against threat intelligence */
                    if (tg_threat_intel_lookup(val.via.str.ptr, val.via.str.size)) {
                        return 1;
                    }
                }
            }
        }
    }
    
    return 0;
}

/* Check behavioral analysis patterns */
int tg_security_check_behavioral(struct tg_security_rule *rule, msgpack_object_map *map)
{
    /* This would implement behavioral analysis */
    /* Check for unusual login patterns, privilege escalation, etc. */
    
    /* Look for behavioral indicators */
    for (uint32_t i = 0; i < map->size; i++) {
        msgpack_object key = map->ptr[i].key;
        msgpack_object val = map->ptr[i].val;
        
        if (key.type == MSGPACK_OBJECT_STR && val.type == MSGPACK_OBJECT_STR) {
            /* Check for privilege escalation keywords */
            if (strncmp(key.via.str.ptr, "event_type", key.via.str.size) == 0) {
                if (strnstr(val.via.str.ptr, "privilege", val.via.str.size) ||
                    strnstr(val.via.str.ptr, "escalation", val.via.str.size) ||
                    strnstr(val.via.str.ptr, "sudo", val.via.str.size)) {
                    return 1;
                }
            }
        }
    }
    
    return 0;
}

/* Check compliance-related events */
int tg_security_check_compliance(struct tg_security_rule *rule, msgpack_object_map *map)
{
    /* Check for compliance-relevant events (PCI DSS, HIPAA, SOX, etc.) */
    
    for (uint32_t i = 0; i < map->size; i++) {
        msgpack_object key = map->ptr[i].key;
        msgpack_object val = map->ptr[i].val;
        
        if (key.type == MSGPACK_OBJECT_STR && val.type == MSGPACK_OBJECT_STR) {
            /* PCI DSS indicators */
            if (rule->compliance_type & TG_COMPLIANCE_PCI_DSS) {
                if (strnstr(val.via.str.ptr, "payment", val.via.str.size) ||
                    strnstr(val.via.str.ptr, "card", val.via.str.size) ||
                    strnstr(val.via.str.ptr, "transaction", val.via.str.size)) {
                    return 1;
                }
            }
            
            /* HIPAA indicators */
            if (rule->compliance_type & TG_COMPLIANCE_HIPAA) {
                if (strnstr(val.via.str.ptr, "patient", val.via.str.size) ||
                    strnstr(val.via.str.ptr, "medical", val.via.str.size) ||
                    strnstr(val.via.str.ptr, "phi", val.via.str.size)) {
                    return 1;
                }
            }
        }
    }
    
    return 0;
}

/* Enrich event with security metadata */
void tg_security_enrich_event(msgpack_object *obj, struct tg_security_ctx *ctx, msgpack_packer *packer)
{
    if (!obj || !ctx || !packer) {
        return;
    }
    
    if (obj->type == MSGPACK_OBJECT_MAP) {
        msgpack_object_map map = obj->via.map;
        
        /* Create new map with additional security fields */
        msgpack_pack_map(packer, map.size + 4);
        
        /* Copy original fields */
        for (uint32_t i = 0; i < map.size; i++) {
            msgpack_pack_object(packer, map.ptr[i].key);
            msgpack_pack_object(packer, map.ptr[i].val);
        }
        
        /* Add security enrichment */
        msgpack_pack_str(packer, 15);
        msgpack_pack_str_body(packer, "tg_security_tag", 15);
        msgpack_pack_str(packer, 8);
        msgpack_pack_str_body(packer, "flagged", 8);
        
        msgpack_pack_str(packer, 18);
        msgpack_pack_str_body(packer, "tg_detection_time", 18);
        msgpack_pack_uint64(packer, time(NULL));
        
        msgpack_pack_str(packer, 16);
        msgpack_pack_str_body(packer, "tg_threat_score", 16);
        msgpack_pack_int(packer, 75); /* Medium threat score */
        
        msgpack_pack_str(packer, 12);
        msgpack_pack_str_body(packer, "tg_agent_id", 12);
        msgpack_pack_str(packer, strlen(TG_AGENT_NAME));
        msgpack_pack_str_body(packer, TG_AGENT_NAME, strlen(TG_AGENT_NAME));
    } else {
        /* Non-map object, pass through unchanged */
        msgpack_pack_object(packer, *obj);
    }
}

/* Plugin definition */
struct flb_filter_plugin filter_threatguard_security_plugin = {
    .name         = "threatguard_security",
    .description  = "ThreatGuard security event filtering and threat detection",
    .cb_init      = tg_security_init,
    .cb_filter    = tg_security_filter,
    .cb_exit      = tg_security_exit,
    .config_map   = config_map,
    .flags        = 0
};

struct flb_filter_plugin *tg_security_plugin_register(void)
{
    return &filter_threatguard_security_plugin;
}