/*  ThreatGuard Agent - Security Rules Engine
 *  Advanced pattern matching and threat detection rules
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"

/* Security rule actions */
#define TG_SECURITY_ACTION_PASS     0
#define TG_SECURITY_ACTION_FLAG     1
#define TG_SECURITY_ACTION_DROP     2
#define TG_SECURITY_ACTION_ENRICH   3

/* Security rule types */
#define TG_RULE_TYPE_FIELD_MATCH    1
#define TG_RULE_TYPE_FIELD_REGEX    2
#define TG_RULE_TYPE_FIELD_EXISTS   3
#define TG_RULE_TYPE_THREAT_INTEL   4
#define TG_RULE_TYPE_BEHAVIORAL     5
#define TG_RULE_TYPE_COMPLIANCE     6

/* Extended security rule structure */
struct tg_security_rule {
    int id;
    char name[128];
    char description[256];
    int type;
    int priority;
    int action;
    int enabled;
    
    /* Rule matching criteria */
    char field_name[64];
    char pattern[256];
    tg_compliance_t compliance_type;
    
    /* Rule statistics */
    uint64_t match_count;
    time_t last_match;
    time_t created;
};

/* Update the context structure to include the extended rules */
struct tg_security_ctx {
    struct flb_filter_instance *ins;
    struct tg_agent_config *config;
    
    /* Security rules */
    int rule_count;
    struct tg_security_rule rules[10000]; /* Support up to 10k rules */
    
    /* Threat intelligence cache */
    struct flb_hash *threat_intel_cache;
    time_t threat_intel_last_update;
    
    /* Behavioral analysis state */
    struct flb_hash *user_sessions;
    struct flb_hash *process_tracking;
    
    /* Statistics */
    uint64_t events_processed;
    uint64_t events_flagged;
    uint64_t events_dropped;
    uint64_t rules_matched;
};

/* Initialize security rules system */
int tg_security_init_rules(struct tg_security_ctx *ctx)
{
    if (!ctx) {
        tg_log(TG_LOG_ERROR, "security context is NULL");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "initializing security rules engine");
    
    /* Initialize rule array */
    ctx->rule_count = 0;
    memset(ctx->rules, 0, sizeof(ctx->rules));
    
    /* Initialize threat intelligence cache */
    ctx->threat_intel_cache = flb_hash_create(FLB_HASH_EVICT_LRU, 10000, 0);
    if (!ctx->threat_intel_cache) {
        tg_log(TG_LOG_ERROR, "failed to create threat intelligence cache");
        return -1;
    }
    ctx->threat_intel_last_update = 0;
    
    /* Initialize behavioral analysis tracking */
    ctx->user_sessions = flb_hash_create(FLB_HASH_EVICT_LRU, 1000, 300); /* 5 min TTL */
    ctx->process_tracking = flb_hash_create(FLB_HASH_EVICT_LRU, 5000, 600); /* 10 min TTL */
    
    if (!ctx->user_sessions || !ctx->process_tracking) {
        tg_log(TG_LOG_ERROR, "failed to create behavioral tracking structures");
        return -1;
    }
    
    /* Initialize statistics */
    ctx->events_processed = 0;
    ctx->events_flagged = 0;
    ctx->events_dropped = 0;
    ctx->rules_matched = 0;
    
    tg_log(TG_LOG_INFO, "security rules engine initialized successfully");
    return 0;
}

/* Add default security rules */
void tg_security_add_default_rules(struct tg_security_ctx *ctx)
{
    if (!ctx) {
        return;
    }
    
    tg_log(TG_LOG_DEBUG, "adding default security rules");
    
    /* Rule 1: Failed login detection */
    tg_security_add_rule(ctx, 1, "Failed Login Detection", 
                         "Detect authentication failures",
                         TG_RULE_TYPE_FIELD_REGEX, 90, TG_SECURITY_ACTION_FLAG,
                         "message", "(failed|failure|denied|invalid).*login");
    
    /* Rule 2: Privilege escalation detection */
    tg_security_add_rule(ctx, 2, "Privilege Escalation",
                         "Detect privilege escalation attempts", 
                         TG_RULE_TYPE_FIELD_REGEX, 95, TG_SECURITY_ACTION_FLAG,
                         "message", "(sudo|su|runas|escalat|privileg)");
    
    /* Rule 3: Malware indicators */
    tg_security_add_rule(ctx, 3, "Malware Indicators",
                         "Detect malware-related events",
                         TG_RULE_TYPE_FIELD_REGEX, 85, TG_SECURITY_ACTION_FLAG,
                         "message", "(virus|malware|trojan|ransomware|backdoor)");
    
    /* Rule 4: Suspicious network activity */
    tg_security_add_rule(ctx, 4, "Suspicious Network Activity",
                         "Detect suspicious network connections",
                         TG_RULE_TYPE_FIELD_REGEX, 75, TG_SECURITY_ACTION_FLAG,
                         "message", "(connection.*refused|port.*scan|brute.*force)");
    
    /* Rule 5: System file modification */
    tg_security_add_rule(ctx, 5, "System File Modification",
                         "Detect modifications to system files",
                         TG_RULE_TYPE_FIELD_REGEX, 80, TG_SECURITY_ACTION_FLAG,
                         "message", "(system32|etc/passwd|etc/shadow|hosts).*modif");
    
    /* Rule 6: Compliance - PCI DSS payment data */
    tg_security_add_rule(ctx, 6, "PCI DSS Payment Data",
                         "Monitor payment card data access",
                         TG_RULE_TYPE_COMPLIANCE, 100, TG_SECURITY_ACTION_FLAG,
                         "message", "(card|payment|transaction)");
    
    /* Rule 7: HIPAA patient data */
    tg_security_add_rule(ctx, 7, "HIPAA Patient Data",
                         "Monitor patient health information",
                         TG_RULE_TYPE_COMPLIANCE, 100, TG_SECURITY_ACTION_FLAG,
                         "message", "(patient|medical|health|phi)");
    
    /* Rule 8: Noise reduction - heartbeats */
    tg_security_add_rule(ctx, 8, "Noise Reduction",
                         "Drop low-value heartbeat messages",
                         TG_RULE_TYPE_FIELD_REGEX, 10, TG_SECURITY_ACTION_DROP,
                         "message", "(heartbeat|ping|health.*check)");
    
    /* Rule 9: Critical system events */
    tg_security_add_rule(ctx, 9, "Critical System Events",
                         "Flag critical system events",
                         TG_RULE_TYPE_FIELD_REGEX, 100, TG_SECURITY_ACTION_FLAG,
                         "level", "(critical|fatal|emergency)");
    
    /* Rule 10: Threat intelligence indicators */
    tg_security_add_rule(ctx, 10, "Threat Intelligence",
                         "Check against threat intel feeds",
                         TG_RULE_TYPE_THREAT_INTEL, 98, TG_SECURITY_ACTION_FLAG,
                         "*", "*");
    
    tg_log(TG_LOG_INFO, "added %d default security rules", ctx->rule_count);
}

/* Add a security rule */
int tg_security_add_rule(struct tg_security_ctx *ctx, int id, const char *name,
                        const char *description, int type, int priority, int action,
                        const char *field_name, const char *pattern)
{
    if (!ctx || ctx->rule_count >= 10000) {
        return -1;
    }
    
    struct tg_security_rule *rule = &ctx->rules[ctx->rule_count];
    
    rule->id = id;
    strncpy(rule->name, name, sizeof(rule->name) - 1);
    strncpy(rule->description, description, sizeof(rule->description) - 1);
    rule->type = type;
    rule->priority = priority;
    rule->action = action;
    rule->enabled = 1;
    
    strncpy(rule->field_name, field_name, sizeof(rule->field_name) - 1);
    strncpy(rule->pattern, pattern, sizeof(rule->pattern) - 1);
    rule->compliance_type = TG_COMPLIANCE_NONE;
    
    rule->match_count = 0;
    rule->last_match = 0;
    rule->created = time(NULL);
    
    ctx->rule_count++;
    
    tg_log(TG_LOG_DEBUG, "added rule %d: %s (priority %d)", id, name, priority);
    return 0;
}

/* Load rules from configuration file */
int tg_security_load_rules_file(struct tg_security_ctx *ctx, const char *filename)
{
    FILE *file;
    char line[512];
    int rules_loaded = 0;
    
    if (!ctx || !filename) {
        return -1;
    }
    
    file = fopen(filename, "r");
    if (!file) {
        tg_log(TG_LOG_ERROR, "failed to open rules file: %s", filename);
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "loading security rules from %s", filename);
    
    while (fgets(line, sizeof(line), file) && ctx->rule_count < 10000) {
        /* Skip comments and empty lines */
        if (line[0] == '#' || line[0] == '\n' || line[0] == '\0') {
            continue;
        }
        
        /* Parse rule line: id|name|type|priority|action|field|pattern */
        char *token;
        char *tokens[7];
        int token_count = 0;
        
        /* Tokenize the line */
        token = strtok(line, "|");
        while (token && token_count < 7) {
            tokens[token_count] = token;
            token_count++;
            token = strtok(NULL, "|");
        }
        
        if (token_count >= 6) {
            int id = atoi(tokens[0]);
            char *name = tokens[1];
            int type = atoi(tokens[2]);
            int priority = atoi(tokens[3]);
            int action = atoi(tokens[4]);
            char *field = tokens[5];
            char *pattern = tokens[6];
            
            /* Remove newline from pattern */
            pattern[strcspn(pattern, "\n")] = '\0';
            
            if (tg_security_add_rule(ctx, id, name, "", type, priority, action, field, pattern) == 0) {
                rules_loaded++;
            }
        }
    }
    
    fclose(file);
    
    tg_log(TG_LOG_INFO, "loaded %d security rules from %s", rules_loaded, filename);
    return rules_loaded;
}

/* Threat intelligence lookup */
int tg_threat_intel_lookup(const char *indicator, size_t indicator_len)
{
    /* This is a placeholder implementation */
    /* In production, this would query real threat intelligence feeds */
    
    if (!indicator || indicator_len == 0) {
        return 0;
    }
    
    /* Create null-terminated string for comparison */
    char *temp = flb_malloc(indicator_len + 1);
    if (!temp) {
        return 0;
    }
    memcpy(temp, indicator, indicator_len);
    temp[indicator_len] = '\0';
    
    /* Check against known malicious indicators */
    const char *malicious_indicators[] = {
        "192.168.1.666",     /* Example malicious IP */
        "evil.com",          /* Example malicious domain */
        "malware.exe",       /* Example malicious file */
        "backdoor.dll",      /* Example malicious library */
        "c2server.net",      /* Example C2 server */
        NULL
    };
    
    int is_malicious = 0;
    for (int i = 0; malicious_indicators[i]; i++) {
        if (strstr(temp, malicious_indicators[i])) {
            is_malicious = 1;
            break;
        }
    }
    
    flb_free(temp);
    
    if (is_malicious) {
        tg_log(TG_LOG_WARN, "threat intelligence match: %.*s", (int)indicator_len, indicator);
    }
    
    return is_malicious;
}

/* Update threat intelligence cache */
int tg_security_update_threat_intel(struct tg_security_ctx *ctx)
{
    if (!ctx || !ctx->threat_intel_cache) {
        return -1;
    }
    
    time_t current_time = time(NULL);
    
    /* Update every 15 minutes */
    if (current_time - ctx->threat_intel_last_update < 900) {
        return 0;
    }
    
    tg_log(TG_LOG_DEBUG, "updating threat intelligence cache");
    
    /* This would fetch updates from threat intelligence feeds */
    /* For now, just update the timestamp */
    ctx->threat_intel_last_update = current_time;
    
    tg_log(TG_LOG_DEBUG, "threat intelligence cache updated");
    return 0;
}

/* Behavioral analysis - track user sessions */
void tg_security_track_user_session(struct tg_security_ctx *ctx, const char *username,
                                   const char *source_ip, const char *event_type)
{
    if (!ctx || !username || !ctx->user_sessions) {
        return;
    }
    
    char session_key[128];
    snprintf(session_key, sizeof(session_key), "%s:%s", username, source_ip);
    
    /* Get existing session info */
    int session_data_size;
    char *session_data = flb_hash_get(ctx->user_sessions, session_key, 
                                     strlen(session_key), &session_data_size);
    
    if (!session_data) {
        /* New session */
        char new_session[64];
        snprintf(new_session, sizeof(new_session), "1:%ld", time(NULL));
        flb_hash_add(ctx->user_sessions, session_key, strlen(session_key),
                     new_session, strlen(new_session));
        
        tg_log(TG_LOG_DEBUG, "new user session tracked: %s", session_key);
    } else {
        /* Update existing session */
        int login_count;
        time_t first_login;
        sscanf(session_data, "%d:%ld", &login_count, &first_login);
        
        login_count++;
        
        /* Check for suspicious activity */
        if (login_count > 10) {
            tg_log(TG_LOG_WARN, "excessive login attempts detected: %s (%d attempts)", 
                   session_key, login_count);
        }
        
        char updated_session[64];
        snprintf(updated_session, sizeof(updated_session), "%d:%ld", login_count, first_login);
        flb_hash_add(ctx->user_sessions, session_key, strlen(session_key),
                     updated_session, strlen(updated_session));
    }
}

/* Behavioral analysis - track process execution */
void tg_security_track_process(struct tg_security_ctx *ctx, const char *process_name,
                              const char *username, const char *command_line)
{
    if (!ctx || !process_name || !ctx->process_tracking) {
        return;
    }
    
    char process_key[128];
    snprintf(process_key, sizeof(process_key), "%s:%s", username ? username : "unknown", 
             process_name);
    
    /* Check for suspicious processes */
    const char *suspicious_processes[] = {
        "nc.exe", "netcat", "ncat",        /* Network utilities */
        "psexec", "wmic", "powershell",    /* Admin tools */
        "mimikatz", "procdump", "lsass",   /* Credential dumping */
        "tor.exe", "proxychains",          /* Anonymization */
        NULL
    };
    
    for (int i = 0; suspicious_processes[i]; i++) {
        if (strstr(process_name, suspicious_processes[i])) {
            tg_log(TG_LOG_WARN, "suspicious process detected: %s by %s", 
                   process_name, username ? username : "unknown");
            
            /* Add to tracking */
            char process_info[256];
            snprintf(process_info, sizeof(process_info), "SUSPICIOUS:%ld:%s", 
                     time(NULL), command_line ? command_line : "");
            flb_hash_add(ctx->process_tracking, process_key, strlen(process_key),
                         process_info, strlen(process_info));
            return;
        }
    }
    
    /* Track normal process */
    char process_info[256];
    snprintf(process_info, sizeof(process_info), "NORMAL:%ld:%s", 
             time(NULL), command_line ? command_line : "");
    flb_hash_add(ctx->process_tracking, process_key, strlen(process_key),
                 process_info, strlen(process_info));
}

/* Get rule statistics */
void tg_security_get_rule_stats(struct tg_security_ctx *ctx, char *buffer, size_t buffer_size)
{
    if (!ctx || !buffer) {
        return;
    }
    
    snprintf(buffer, buffer_size,
             "Rules: %d active, Events: %llu processed, %llu flagged, %llu dropped, Rules matched: %llu",
             ctx->rule_count, 
             (unsigned long long)ctx->events_processed,
             (unsigned long long)ctx->events_flagged,
             (unsigned long long)ctx->events_dropped,
             (unsigned long long)ctx->rules_matched);
}

/* Cleanup security rules system */
void tg_security_cleanup_rules(struct tg_security_ctx *ctx)
{
    if (!ctx) {
        return;
    }
    
    if (ctx->threat_intel_cache) {
        flb_hash_destroy(ctx->threat_intel_cache);
        ctx->threat_intel_cache = NULL;
    }
    
    if (ctx->user_sessions) {
        flb_hash_destroy(ctx->user_sessions);
        ctx->user_sessions = NULL;
    }
    
    if (ctx->process_tracking) {
        flb_hash_destroy(ctx->process_tracking);
        ctx->process_tracking = NULL;
    }
    
    ctx->rule_count = 0;
    
    tg_log(TG_LOG_DEBUG, "security rules system cleaned up");
}