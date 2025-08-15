/*  ThreatGuard Agent - Core Header
 *  Zero-config endpoint security collector
 *  Built on Fluent Bit foundations
 */

#ifndef THREATGUARD_H
#define THREATGUARD_H

#include <fluent-bit/flb_info.h>
#include <fluent-bit/flb_input.h>
#include <fluent-bit/flb_filter.h>
#include <fluent-bit/flb_output.h>
#include <fluent-bit/flb_config.h>
#include <fluent-bit/flb_pack.h>
#include <fluent-bit/flb_log.h>
#include <fluent-bit/flb_mem.h>
#include <fluent-bit/flb_str.h>
#include <fluent-bit/flb_time.h>
#include <fluent-bit/flb_hash.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <errno.h>

/* Platform-specific includes */
#ifdef TG_PLATFORM_WINDOWS
#include <windows.h>
#include <wevtapi.h>
#include <winevt.h>
#include <wbemidl.h>
#include <ole2.h>
#include <oleauto.h>
#endif

#ifdef TG_PLATFORM_LINUX
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/utsname.h>
#include <systemd/sd-journal.h>
#include <libudev.h>
#include <dirent.h>
#endif

#ifdef TG_PLATFORM_DARWIN
#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/IOKitLib.h>
#include <sys/types.h>
#include <sys/sysctl.h>
#include <mach/mach.h>
#endif

/* ThreatGuard constants */
#define TG_VERSION "2.0.1"
#define TG_AGENT_NAME "threatguard-agent"
#define TG_MAX_PATH 4096
#define TG_MAX_HOSTNAME 256
#define TG_MAX_EVENTS_PER_BATCH 1000
#define TG_DISCOVERY_INTERVAL 300  /* 5 minutes */
#define TG_HEALTH_INTERVAL 60      /* 1 minute */

/* Log levels */
typedef enum {
    TG_LOG_ERROR = 0,
    TG_LOG_WARN  = 1,
    TG_LOG_INFO  = 2,
    TG_LOG_DEBUG = 3,
    TG_LOG_TRACE = 4
} tg_log_level_t;

/* Platform types */
typedef enum {
    TG_PLATFORM_UNKNOWN = 0,
    TG_PLATFORM_WINDOWS_SERVER,
    TG_PLATFORM_WINDOWS_WORKSTATION,
    TG_PLATFORM_LINUX_SERVER,
    TG_PLATFORM_LINUX_WORKSTATION,
    TG_PLATFORM_DARWIN_SERVER,
    TG_PLATFORM_DARWIN_WORKSTATION
} tg_platform_type_t;

/* Security tool types */
typedef enum {
    TG_SECURITY_ANTIVIRUS = 1,
    TG_SECURITY_EDR = 2,
    TG_SECURITY_FIREWALL = 4,
    TG_SECURITY_IDS = 8,
    TG_SECURITY_DLP = 16,
    TG_SECURITY_SIEM = 32,
    TG_SECURITY_MDM = 64,
    TG_SECURITY_MAC = 128  /* Mandatory Access Control */
} tg_security_type_t;

/* Compliance frameworks */
typedef enum {
    TG_COMPLIANCE_NONE = 0,
    TG_COMPLIANCE_PCI_DSS = 1,
    TG_COMPLIANCE_HIPAA = 2,
    TG_COMPLIANCE_SOX = 4,
    TG_COMPLIANCE_ISO27001 = 8,
    TG_COMPLIANCE_GDPR = 16,
    TG_COMPLIANCE_NIST = 32
} tg_compliance_t;

/* System information structure */
struct tg_system_info {
    char hostname[TG_MAX_HOSTNAME];
    tg_platform_type_t platform_type;
    char os_version[128];
    char architecture[32];
    uint32_t cpu_cores;
    uint64_t total_memory;  /* MB */
    uint64_t disk_space;    /* MB */
    time_t boot_time;
    
    /* Network interfaces */
    int interface_count;
    struct {
        char name[64];
        char address[INET6_ADDRSTRLEN];
        uint32_t flags;
    } interfaces[8];
};

/* Security tool information */
struct tg_security_tool {
    char name[128];
    char vendor[128];
    char version[64];
    tg_security_type_t type;
    int active;
    char config_path[TG_MAX_PATH];
    char log_path[TG_MAX_PATH];
    
    struct tg_security_tool *next;
};

/* Organization information */
struct tg_organization {
    char id[128];
    char name[256];
    char domain[256];
    tg_compliance_t compliance_requirements;
    int detection_confidence;  /* 0-100 */
    char detection_method[64]; /* domain, cert, dns, etc. */
};

/* Discovery result */
struct tg_discovery_result {
    struct tg_system_info system;
    struct tg_organization organization;
    struct tg_security_tool *security_tools;
    int security_tool_count;
    time_t discovery_time;
    int overall_confidence;
};

/* Agent configuration */
struct tg_agent_config {
    /* Collection settings */
    int collection_interval;
    int batch_size;
    int max_memory_mb;
    int max_cpu_percent;
    
    /* Security settings */
    int enable_encryption;
    int enable_compression;
    char api_key[256];
    char endpoint_url[512];
    
    /* Discovery settings */
    int discovery_interval;
    int enable_auto_config;
    
    /* Compliance settings */
    tg_compliance_t required_compliance;
    int retention_days;
    
    /* Generated configuration */
    char fluent_bit_config[4096];
    time_t config_generated;
};

/* Plugin context structures */
struct tg_discovery_ctx {
    struct flb_input_instance *ins;
    struct tg_discovery_result *last_result;
    struct tg_agent_config *config;
    int discovery_timer;
    int health_timer;
};

struct tg_security_ctx {
    struct flb_filter_instance *ins;
    struct tg_agent_config *config;
    
    /* Security rules */
    int rule_count;
    struct {
        char pattern[256];
        int priority;
        int action;  /* 0=pass, 1=flag, 2=drop */
    } rules[100];
};

struct tg_platform_ctx {
    struct flb_output_instance *ins;
    struct tg_agent_config *config;
    
    /* Connection state */
    int connected;
    time_t last_connect_attempt;
    int retry_count;
    
    /* Batching */
    msgpack_sbuffer batch_buffer;
    int batch_count;
    time_t batch_start_time;
};

/* Function prototypes */

/* Common utilities */
int tg_log_init(void);
void tg_log(int level, const char *fmt, ...);
int tg_utils_get_hostname(char *hostname, size_t len);
uint64_t tg_utils_get_timestamp_ms(void);
int tg_utils_file_exists(const char *path);
char *tg_utils_read_file(const char *path, size_t *size);

/* Discovery functions */
int tg_discovery_init(void);
int tg_discovery_scan_system(struct tg_system_info *system);
int tg_discovery_scan_security_tools(struct tg_security_tool **tools);
int tg_discovery_detect_organization(struct tg_organization *org, 
                                    struct tg_system_info *system);
int tg_discovery_generate_config(struct tg_agent_config *config,
                                struct tg_discovery_result *result);

/* Platform-specific discovery */
#ifdef TG_PLATFORM_WINDOWS
int tg_windows_scan_system(struct tg_system_info *system);
int tg_windows_scan_security_tools(struct tg_security_tool **tools);
int tg_windows_detect_compliance(tg_compliance_t *compliance);
#endif

#ifdef TG_PLATFORM_LINUX
int tg_linux_scan_system(struct tg_system_info *system);
int tg_linux_scan_security_tools(struct tg_security_tool **tools);
int tg_linux_detect_compliance(tg_compliance_t *compliance);
#endif

#ifdef TG_PLATFORM_DARWIN
int tg_darwin_scan_system(struct tg_system_info *system);
int tg_darwin_scan_security_tools(struct tg_security_tool **tools);
int tg_darwin_detect_compliance(tg_compliance_t *compliance);
#endif

/* Security functions */
int tg_security_init_rules(struct tg_security_ctx *ctx);
int tg_security_apply_filter(msgpack_object *obj, struct tg_security_ctx *ctx);
int tg_security_enrich_event(msgpack_object *obj, struct tg_discovery_result *result);

/* Transport functions */
int tg_transport_init(struct tg_platform_ctx *ctx);
int tg_transport_connect(struct tg_platform_ctx *ctx);
int tg_transport_send_batch(struct tg_platform_ctx *ctx, 
                           const char *data, size_t len);
void tg_transport_disconnect(struct tg_platform_ctx *ctx);

/* Configuration functions */
int tg_config_load(struct tg_agent_config *config, const char *path);
int tg_config_save(struct tg_agent_config *config, const char *path);
int tg_config_generate_fluent_bit(struct tg_agent_config *config);

/* Memory management */
void tg_security_tool_free(struct tg_security_tool *tool);
void tg_discovery_result_free(struct tg_discovery_result *result);

/* Plugin registration functions */
struct flb_input_plugin *tg_discovery_plugin_register(void);
struct flb_filter_plugin *tg_security_plugin_register(void);
struct flb_output_plugin *tg_platform_plugin_register(void);

#endif /* THREATGUARD_H */