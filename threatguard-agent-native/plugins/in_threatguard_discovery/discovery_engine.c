/*  ThreatGuard Agent - Discovery Engine Implementation
 *  Core discovery logic and platform abstraction
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"
#include <sys/stat.h>

/* Initialize discovery system */
int tg_discovery_init(void)
{
    tg_log(TG_LOG_INFO, "initializing ThreatGuard discovery engine v%s", TG_VERSION);
    
    /* Platform-specific initialization */
#ifdef TG_PLATFORM_WINDOWS
    /* Initialize COM for WMI operations */
    HRESULT hr = CoInitializeEx(0, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        tg_log(TG_LOG_ERROR, "COM initialization failed: 0x%08x", hr);
        return -1;
    }
    
    hr = CoInitializeSecurity(
        NULL, -1, NULL, NULL, 
        RPC_C_AUTHN_LEVEL_NONE,
        RPC_C_IMP_LEVEL_IMPERSONATE,
        NULL, EOAC_NONE, NULL
    );
    if (FAILED(hr) && hr != RPC_E_TOO_LATE) {
        tg_log(TG_LOG_WARN, "COM security initialization failed: 0x%08x", hr);
    }
#endif

#ifdef TG_PLATFORM_LINUX
    /* Check for required system files */
    if (!tg_utils_file_exists("/proc/version")) {
        tg_log(TG_LOG_ERROR, "/proc filesystem not available");
        return -1;
    }
#endif

#ifdef TG_PLATFORM_DARWIN
    /* Initialize Core Foundation */
    /* No specific initialization needed for basic APIs */
#endif

    tg_log(TG_LOG_INFO, "discovery engine initialized successfully");
    return 0;
}

/* Main system discovery function */
int tg_discovery_scan_system(struct tg_system_info *system)
{
    if (!system) {
        tg_log(TG_LOG_ERROR, "system info structure is NULL");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "starting system discovery scan");
    
    /* Initialize structure */
    memset(system, 0, sizeof(struct tg_system_info));
    
    /* Get hostname */
    if (tg_utils_get_hostname(system->hostname, sizeof(system->hostname)) != 0) {
        tg_log(TG_LOG_ERROR, "failed to get hostname");
        return -1;
    }
    
    /* Get boot time */
    system->boot_time = time(NULL) - (time_t)(flb_utils_get_uptime() / 1000);
    
    /* Platform-specific system scanning */
#ifdef TG_PLATFORM_WINDOWS
    return tg_windows_scan_system(system);
#elif defined(TG_PLATFORM_LINUX)
    return tg_linux_scan_system(system);
#elif defined(TG_PLATFORM_DARWIN)
    return tg_darwin_scan_system(system);
#else
    tg_log(TG_LOG_ERROR, "unsupported platform for system scanning");
    return -1;
#endif
}

/* Security tools discovery */
int tg_discovery_scan_security_tools(struct tg_security_tool **tools)
{
    if (!tools) {
        tg_log(TG_LOG_ERROR, "security tools pointer is NULL");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "starting security tools discovery");
    
    *tools = NULL;
    
    /* Platform-specific security tool scanning */
#ifdef TG_PLATFORM_WINDOWS
    return tg_windows_scan_security_tools(tools);
#elif defined(TG_PLATFORM_LINUX)
    return tg_linux_scan_security_tools(tools);
#elif defined(TG_PLATFORM_DARWIN)
    return tg_darwin_scan_security_tools(tools);
#else
    tg_log(TG_LOG_WARN, "security tool scanning not implemented for this platform");
    return 0;
#endif
}

/* Organization detection using multiple methods */
int tg_discovery_detect_organization(struct tg_organization *org, 
                                    struct tg_system_info *system)
{
    if (!org || !system) {
        tg_log(TG_LOG_ERROR, "organization or system info is NULL");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "starting organization detection");
    
    /* Initialize organization structure */
    memset(org, 0, sizeof(struct tg_organization));
    
    /* Method 1: Domain-based detection */
    int confidence = tg_discovery_detect_via_domain(org, system);
    if (confidence > org->detection_confidence) {
        org->detection_confidence = confidence;
        strcpy(org->detection_method, "domain");
    }
    
    /* Method 2: Certificate-based detection */
    confidence = tg_discovery_detect_via_certificates(org, system);
    if (confidence > org->detection_confidence) {
        org->detection_confidence = confidence;
        strcpy(org->detection_method, "certificate");
    }
    
    /* Method 3: DNS-based detection */
    confidence = tg_discovery_detect_via_dns(org, system);
    if (confidence > org->detection_confidence) {
        org->detection_confidence = confidence;
        strcpy(org->detection_method, "dns");
    }
    
    /* Method 4: Cloud metadata detection */
    confidence = tg_discovery_detect_via_cloud(org, system);
    if (confidence > org->detection_confidence) {
        org->detection_confidence = confidence;
        strcpy(org->detection_method, "cloud");
    }
    
    /* If no organization detected, use defaults */
    if (org->detection_confidence == 0) {
        strcpy(org->name, "Unknown Organization");
        strcpy(org->id, "unknown");
        strcpy(org->detection_method, "none");
        tg_log(TG_LOG_WARN, "organization detection failed, using defaults");
        return -1;
    }
    
    /* Detect compliance requirements */
    tg_discovery_detect_compliance_requirements(org, system);
    
    tg_log(TG_LOG_INFO, "organization detected: %s (method: %s, confidence: %d%%)",
           org->name, org->detection_method, org->detection_confidence);
    
    return 0;
}

/* Domain-based organization detection */
int tg_discovery_detect_via_domain(struct tg_organization *org, 
                                  struct tg_system_info *system)
{
#ifdef TG_PLATFORM_WINDOWS
    char domain[256];
    DWORD size = sizeof(domain);
    
    /* Get computer domain */
    if (GetComputerNameEx(ComputerNameDnsDomain, domain, &size)) {
        if (strlen(domain) > 0) {
            /* Extract organization from domain */
            char *dot = strchr(domain, '.');
            if (dot) {
                *dot = '\0';
                snprintf(org->name, sizeof(org->name), "%s Organization", domain);
                snprintf(org->id, sizeof(org->id), "domain_%s", domain);
                strcpy(org->domain, domain);
                return 85; /* High confidence for domain detection */
            }
        }
    }
#endif

#ifdef TG_PLATFORM_LINUX
    /* Check for domain join status */
    if (tg_utils_file_exists("/etc/krb5.conf")) {
        char *content = tg_utils_read_file("/etc/krb5.conf", NULL);
        if (content) {
            /* Parse Kerberos config for domain */
            char *realm = strstr(content, "default_realm");
            if (realm) {
                /* Extract realm name */
                char *start = strchr(realm, '=');
                if (start) {
                    start++;
                    while (*start == ' ' || *start == '\t') start++;
                    char *end = strchr(start, '\n');
                    if (end) {
                        *end = '\0';
                        snprintf(org->name, sizeof(org->name), "%s Organization", start);
                        snprintf(org->id, sizeof(org->id), "krb_%s", start);
                        strcpy(org->domain, start);
                        free(content);
                        return 75; /* Good confidence for Kerberos */
                    }
                }
            }
            free(content);
        }
    }
#endif

    return 0; /* No domain detected */
}

/* Certificate-based organization detection */
int tg_discovery_detect_via_certificates(struct tg_organization *org, 
                                        struct tg_system_info *system)
{
    /* This would inspect system certificates for organizational information */
    /* Implementation depends on platform certificate stores */
    return 0; /* Not implemented yet */
}

/* DNS-based organization detection */
int tg_discovery_detect_via_dns(struct tg_organization *org, 
                               struct tg_system_info *system)
{
    /* This would perform reverse DNS lookups and check TXT records */
    /* for organizational identification */
    return 0; /* Not implemented yet */
}

/* Cloud metadata-based detection */
int tg_discovery_detect_via_cloud(struct tg_organization *org, 
                                 struct tg_system_info *system)
{
    /* Check AWS metadata */
    /* Implementation would query cloud provider metadata services */
    return 0; /* Not implemented yet */
}

/* Compliance requirements detection */
void tg_discovery_detect_compliance_requirements(struct tg_organization *org, 
                                                 struct tg_system_info *system)
{
    tg_compliance_t compliance = TG_COMPLIANCE_NONE;
    
    /* Platform-specific compliance detection */
#ifdef TG_PLATFORM_WINDOWS
    tg_windows_detect_compliance(&compliance);
#elif defined(TG_PLATFORM_LINUX)
    tg_linux_detect_compliance(&compliance);
#elif defined(TG_PLATFORM_DARWIN)
    tg_darwin_detect_compliance(&compliance);
#endif
    
    /* Check for common compliance indicators in organization name/domain */
    char *name_lower = flb_strdup(org->name);
    if (name_lower) {
        /* Convert to lowercase for comparison */
        for (int i = 0; name_lower[i]; i++) {
            name_lower[i] = tolower(name_lower[i]);
        }
        
        /* Healthcare indicators */
        if (strstr(name_lower, "hospital") || strstr(name_lower, "medical") ||
            strstr(name_lower, "health") || strstr(name_lower, "clinic")) {
            compliance |= TG_COMPLIANCE_HIPAA;
        }
        
        /* Financial indicators */
        if (strstr(name_lower, "bank") || strstr(name_lower, "financial") ||
            strstr(name_lower, "credit") || strstr(name_lower, "insurance")) {
            compliance |= TG_COMPLIANCE_PCI_DSS | TG_COMPLIANCE_SOX;
        }
        
        /* Government indicators */
        if (strstr(name_lower, "gov") || strstr(name_lower, "federal") ||
            strstr(name_lower, "state") || strstr(name_lower, "county")) {
            compliance |= TG_COMPLIANCE_NIST;
        }
        
        flb_free(name_lower);
    }
    
    org->compliance_requirements = compliance;
    
    if (compliance != TG_COMPLIANCE_NONE) {
        tg_log(TG_LOG_INFO, "detected compliance requirements: 0x%08x", compliance);
    }
}

/* Generate agent configuration from discovery results */
int tg_discovery_generate_config(struct tg_agent_config *config,
                                struct tg_discovery_result *result)
{
    if (!config || !result) {
        tg_log(TG_LOG_ERROR, "config or result is NULL");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "generating agent configuration");
    
    /* Adjust settings based on system capabilities */
    if (result->system.total_memory < 2048) {
        /* Low memory system */
        config->max_memory_mb = 32;
        config->batch_size = 50;
    } else if (result->system.total_memory > 8192) {
        /* High memory system */
        config->max_memory_mb = 128;
        config->batch_size = 500;
    }
    
    /* Adjust based on CPU cores */
    if (result->system.cpu_cores > 8) {
        config->max_cpu_percent = 10;
    } else if (result->system.cpu_cores < 4) {
        config->max_cpu_percent = 2;
    }
    
    /* Adjust based on security tools */
    if (result->security_tool_count > 3) {
        /* Heavy security environment, reduce resource usage */
        config->max_cpu_percent = max(1, config->max_cpu_percent - 1);
        config->collection_interval = 120; /* Less frequent collection */
    }
    
    /* Compliance-based settings */
    if (result->organization.compliance_requirements & TG_COMPLIANCE_PCI_DSS) {
        config->enable_encryption = 1;
        config->retention_days = 365;
        config->collection_interval = 30; /* More frequent for PCI */
    }
    
    if (result->organization.compliance_requirements & TG_COMPLIANCE_HIPAA) {
        config->enable_encryption = 1;
        config->retention_days = 2190; /* 6 years */
    }
    
    if (result->organization.compliance_requirements & TG_COMPLIANCE_SOX) {
        config->retention_days = 2555; /* 7 years */
        config->enable_encryption = 1;
    }
    
    /* Generate Fluent Bit configuration */
    int ret = tg_config_generate_fluent_bit(config);
    if (ret != 0) {
        tg_log(TG_LOG_ERROR, "failed to generate Fluent Bit configuration");
        return ret;
    }
    
    config->config_generated = time(NULL);
    
    tg_log(TG_LOG_INFO, "configuration generated successfully");
    tg_log(TG_LOG_DEBUG, "memory limit: %dMB, CPU limit: %d%%, batch size: %d",
           config->max_memory_mb, config->max_cpu_percent, config->batch_size);
    
    return 0;
}

/* Free discovery result structure */
void tg_discovery_result_free(struct tg_discovery_result *result)
{
    if (!result) {
        return;
    }
    
    /* Free security tools linked list */
    struct tg_security_tool *tool = result->security_tools;
    while (tool) {
        struct tg_security_tool *next = tool->next;
        tg_security_tool_free(tool);
        tool = next;
    }
    
    result->security_tools = NULL;
    result->security_tool_count = 0;
}

/* Free security tool structure */
void tg_security_tool_free(struct tg_security_tool *tool)
{
    if (tool) {
        flb_free(tool);
    }
}