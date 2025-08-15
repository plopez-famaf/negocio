/*  ThreatGuard Agent - Linux Platform Discovery
 *  Linux-specific system and security tool discovery
 *  Copyright (C) 2025 BG Threat AI
 */

#ifdef TG_PLATFORM_LINUX

#include "../../../include/threatguard.h"
#include <sys/sysinfo.h>
#include <sys/statvfs.h>
#include <sys/utsname.h>
#include <ifaddrs.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <pwd.h>
#include <grp.h>

/* Linux-specific system scanning */
int tg_linux_scan_system(struct tg_system_info *system)
{
    struct sysinfo si;
    struct utsname un;
    struct statvfs vfs;
    int ret = 0;
    
    tg_log(TG_LOG_DEBUG, "starting Linux system scan");
    
    /* Get system information */
    if (sysinfo(&si) == 0) {
        system->total_memory = (uint64_t)(si.totalram * si.mem_unit / (1024 * 1024)); /* MB */
        system->cpu_cores = get_nprocs();
    }
    
    /* Get OS information */
    if (uname(&un) == 0) {
        snprintf(system->os_version, sizeof(system->os_version),
                "%s %s %s", un.sysname, un.release, un.version);
        
        /* Set architecture */
        strncpy(system->architecture, un.machine, sizeof(system->architecture) - 1);
        
        /* Determine platform type */
        if (tg_utils_file_exists("/etc/redhat-release")) {
            system->platform_type = TG_PLATFORM_LINUX_REDHAT;
        } else if (tg_utils_file_exists("/etc/debian_version")) {
            system->platform_type = TG_PLATFORM_LINUX_DEBIAN;
        } else if (tg_utils_file_exists("/etc/SuSE-release") || 
                  tg_utils_file_exists("/etc/SUSE-brand")) {
            system->platform_type = TG_PLATFORM_LINUX_SUSE;
        } else if (tg_utils_file_exists("/etc/arch-release")) {
            system->platform_type = TG_PLATFORM_LINUX_ARCH;
        } else {
            system->platform_type = TG_PLATFORM_LINUX_GENERIC;
        }
    }
    
    /* Get disk space for root filesystem */
    if (statvfs("/", &vfs) == 0) {
        system->disk_space = (uint64_t)(vfs.f_bavail * vfs.f_frsize / (1024 * 1024)); /* MB */
    }
    
    /* Get detailed OS information from /etc/os-release */
    tg_linux_get_os_details(system);
    
    /* Get network interfaces */
    ret = tg_linux_get_network_interfaces(system);
    if (ret != 0) {
        tg_log(TG_LOG_WARN, "failed to get network interfaces: %d", ret);
    }
    
    tg_log(TG_LOG_INFO, "Linux system scan completed: %s %s, %d cores, %lluMB RAM",
           system->os_version, system->architecture, system->cpu_cores, system->total_memory);
    
    return 0;
}

/* Get detailed OS information from /etc/os-release */
void tg_linux_get_os_details(struct tg_system_info *system)
{
    FILE *file;
    char line[256];
    char *name = NULL, *version = NULL, *pretty_name = NULL;
    
    file = fopen("/etc/os-release", "r");
    if (!file) {
        /* Try alternative location */
        file = fopen("/usr/lib/os-release", "r");
    }
    
    if (!file) {
        tg_log(TG_LOG_DEBUG, "could not read os-release file");
        return;
    }
    
    while (fgets(line, sizeof(line), file)) {
        char *key, *value, *equals_pos, *quote_start, *quote_end;
        
        /* Remove newline */
        line[strcspn(line, "\n")] = '\0';
        
        /* Skip empty lines and comments */
        if (line[0] == '\0' || line[0] == '#') {
            continue;
        }
        
        /* Find equals sign */
        equals_pos = strchr(line, '=');
        if (!equals_pos) {
            continue;
        }
        
        *equals_pos = '\0';
        key = line;
        value = equals_pos + 1;
        
        /* Remove quotes from value */
        if (value[0] == '"') {
            quote_start = value + 1;
            quote_end = strrchr(quote_start, '"');
            if (quote_end) {
                *quote_end = '\0';
                value = quote_start;
            }
        }
        
        /* Extract relevant fields */
        if (strcmp(key, "NAME") == 0) {
            name = flb_strdup(value);
        } else if (strcmp(key, "VERSION") == 0) {
            version = flb_strdup(value);
        } else if (strcmp(key, "PRETTY_NAME") == 0) {
            pretty_name = flb_strdup(value);
        }
    }
    
    fclose(file);
    
    /* Update OS version with better information */
    if (pretty_name) {
        strncpy(system->os_version, pretty_name, sizeof(system->os_version) - 1);
    } else if (name && version) {
        snprintf(system->os_version, sizeof(system->os_version), "%s %s", name, version);
    } else if (name) {
        strncpy(system->os_version, name, sizeof(system->os_version) - 1);
    }
    
    /* Cleanup */
    if (name) flb_free(name);
    if (version) flb_free(version);
    if (pretty_name) flb_free(pretty_name);
}

/* Get network interfaces information */
int tg_linux_get_network_interfaces(struct tg_system_info *system)
{
    struct ifaddrs *ifaddrs_list, *ifa;
    int count = 0;
    
    if (getifaddrs(&ifaddrs_list) != 0) {
        tg_log(TG_LOG_ERROR, "failed to get network interfaces: %s", strerror(errno));
        return -1;
    }
    
    for (ifa = ifaddrs_list; ifa != NULL && count < 8; ifa = ifa->ifa_next) {
        if (!ifa->ifa_addr) {
            continue;
        }
        
        /* Only interested in IPv4 addresses */
        if (ifa->ifa_addr->sa_family != AF_INET) {
            continue;
        }
        
        /* Skip loopback interface */
        if (strcmp(ifa->ifa_name, "lo") == 0) {
            continue;
        }
        
        struct sockaddr_in *addr = (struct sockaddr_in *)ifa->ifa_addr;
        char *ip_str = inet_ntoa(addr->sin_addr);
        
        /* Skip invalid or link-local addresses */
        if (!ip_str || strcmp(ip_str, "0.0.0.0") == 0 || 
            strncmp(ip_str, "169.254.", 8) == 0) {
            continue;
        }
        
        /* Store interface information */
        strncpy(system->interfaces[count].name, ifa->ifa_name, 
                sizeof(system->interfaces[count].name) - 1);
        strncpy(system->interfaces[count].address, ip_str,
                sizeof(system->interfaces[count].address) - 1);
        
        /* Set interface flags */
        system->interfaces[count].flags = 0;
        if (ifa->ifa_flags & IFF_UP) {
            system->interfaces[count].flags |= 0x1; /* Interface is up */
        }
        if (ifa->ifa_flags & IFF_RUNNING) {
            system->interfaces[count].flags |= 0x2; /* Interface is running */
        }
        
        /* Try to determine interface type */
        if (tg_utils_string_starts_with(ifa->ifa_name, "eth") ||
            tg_utils_string_starts_with(ifa->ifa_name, "en")) {
            system->interfaces[count].flags |= 0x4; /* Ethernet */
        } else if (tg_utils_string_starts_with(ifa->ifa_name, "wl") ||
                  tg_utils_string_starts_with(ifa->ifa_name, "wifi")) {
            system->interfaces[count].flags |= 0x8; /* Wireless */
        }
        
        count++;
    }
    
    system->interface_count = count;
    freeifaddrs(ifaddrs_list);
    
    tg_log(TG_LOG_DEBUG, "found %d network interfaces", count);
    return 0;
}

/* Linux security tools discovery */
int tg_linux_scan_security_tools(struct tg_security_tool **tools)
{
    struct tg_security_tool *tool_list = NULL;
    int count = 0;
    
    tg_log(TG_LOG_DEBUG, "starting Linux security tools scan");
    
    /* Check common antivirus solutions */
    if (tg_linux_check_clamav(&tool_list)) count++;
    if (tg_linux_check_sophos(&tool_list)) count++;
    if (tg_linux_check_eset(&tool_list)) count++;
    if (tg_linux_check_bitdefender(&tool_list)) count++;
    
    /* Check EDR solutions */
    if (tg_linux_check_crowdstrike(&tool_list)) count++;
    if (tg_linux_check_sentinelone(&tool_list)) count++;
    if (tg_linux_check_carbonblack(&tool_list)) count++;
    if (tg_linux_check_defender_atp(&tool_list)) count++;
    
    /* Check system security tools */
    if (tg_linux_check_iptables(&tool_list)) count++;
    if (tg_linux_check_apparmor(&tool_list)) count++;
    if (tg_linux_check_selinux(&tool_list)) count++;
    if (tg_linux_check_fail2ban(&tool_list)) count++;
    if (tg_linux_check_aide(&tool_list)) count++;
    if (tg_linux_check_rkhunter(&tool_list)) count++;
    if (tg_linux_check_chkrootkit(&tool_list)) count++;
    if (tg_linux_check_auditd(&tool_list)) count++;
    if (tg_linux_check_ossec(&tool_list)) count++;
    if (tg_linux_check_suricata(&tool_list)) count++;
    
    *tools = tool_list;
    
    tg_log(TG_LOG_INFO, "Linux security tools scan completed, found %d tools", count);
    return count;
}

/* Check ClamAV antivirus */
int tg_linux_check_clamav(struct tg_security_tool **tools)
{
    if (tg_linux_command_exists("clamscan") || 
        tg_linux_service_running("clamav-daemon") ||
        tg_utils_file_exists("/usr/bin/clamscan")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "ClamAV");
            strcpy(tool->vendor, "Cisco");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_linux_service_running("clamav-daemon");
            strcpy(tool->config_path, "/etc/clamav");
            strcpy(tool->log_path, "/var/log/clamav");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found ClamAV (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Sophos */
int tg_linux_check_sophos(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/sophos-av/bin/savdctl") ||
        tg_linux_service_running("sav-protect")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Sophos Antivirus");
            strcpy(tool->vendor, "Sophos");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_linux_service_running("sav-protect");
            strcpy(tool->config_path, "/opt/sophos-av/etc");
            strcpy(tool->log_path, "/opt/sophos-av/log");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Sophos (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check ESET */
int tg_linux_check_eset(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/eset/esets/bin/esets_daemon") ||
        tg_linux_service_running("esets")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "ESET Security");
            strcpy(tool->vendor, "ESET");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_linux_service_running("esets");
            strcpy(tool->config_path, "/etc/opt/eset/esets");
            strcpy(tool->log_path, "/var/log/eset");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found ESET (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Bitdefender */
int tg_linux_check_bitdefender(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/BitDefender-scanner/bin/bdss") ||
        tg_linux_service_running("bdss")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Bitdefender Scanner");
            strcpy(tool->vendor, "Bitdefender");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_linux_service_running("bdss");
            strcpy(tool->config_path, "/opt/BitDefender-scanner/etc");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Bitdefender (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check CrowdStrike Falcon */
int tg_linux_check_crowdstrike(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/CrowdStrike/falcond") ||
        tg_linux_service_running("falcon-sensor")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "CrowdStrike Falcon");
            strcpy(tool->vendor, "CrowdStrike");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_linux_service_running("falcon-sensor");
            strcpy(tool->config_path, "/opt/CrowdStrike");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found CrowdStrike Falcon (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check SentinelOne */
int tg_linux_check_sentinelone(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/sentinelone/bin/sentinelctl") ||
        tg_linux_service_running("sentinelone")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "SentinelOne");
            strcpy(tool->vendor, "SentinelOne");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_linux_service_running("sentinelone");
            strcpy(tool->config_path, "/opt/sentinelone");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found SentinelOne (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Carbon Black */
int tg_linux_check_carbonblack(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/carbonblack/psc/bin/cbagentd") ||
        tg_linux_service_running("cbagentd")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Carbon Black");
            strcpy(tool->vendor, "VMware");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_linux_service_running("cbagentd");
            strcpy(tool->config_path, "/opt/carbonblack/psc");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Carbon Black (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Microsoft Defender ATP */
int tg_linux_check_defender_atp(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/opt/microsoft/mdatp/sbin/wdavdaemon") ||
        tg_linux_service_running("mdatp")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Microsoft Defender ATP");
            strcpy(tool->vendor, "Microsoft");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_linux_service_running("mdatp");
            strcpy(tool->config_path, "/etc/opt/microsoft/mdatp");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Microsoft Defender ATP (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check iptables firewall */
int tg_linux_check_iptables(struct tg_security_tool **tools)
{
    if (tg_linux_command_exists("iptables")) {
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "iptables");
            strcpy(tool->vendor, "Netfilter");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_FIREWALL;
            tool->active = 1; /* Assume active if command exists */
            strcpy(tool->config_path, "/etc/iptables");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found iptables");
            return 1;
        }
    }
    return 0;
}

/* Check AppArmor */
int tg_linux_check_apparmor(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/sys/module/apparmor") ||
        tg_linux_command_exists("aa-status")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "AppArmor");
            strcpy(tool->vendor, "Canonical");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_MAC;
            tool->active = tg_utils_file_exists("/sys/module/apparmor");
            strcpy(tool->config_path, "/etc/apparmor.d");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found AppArmor (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check SELinux */
int tg_linux_check_selinux(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/sys/fs/selinux") ||
        tg_linux_command_exists("getenforce")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "SELinux");
            strcpy(tool->vendor, "NSA/Red Hat");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_MAC;
            tool->active = tg_utils_file_exists("/sys/fs/selinux");
            strcpy(tool->config_path, "/etc/selinux");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found SELinux (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Fail2ban */
int tg_linux_check_fail2ban(struct tg_security_tool **tools)
{
    if (tg_linux_service_running("fail2ban") ||
        tg_utils_file_exists("/etc/fail2ban/fail2ban.conf")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Fail2ban");
            strcpy(tool->vendor, "Fail2ban Community");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_IPS;
            tool->active = tg_linux_service_running("fail2ban");
            strcpy(tool->config_path, "/etc/fail2ban");
            strcpy(tool->log_path, "/var/log/fail2ban.log");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Fail2ban (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check AIDE (Advanced Intrusion Detection Environment) */
int tg_linux_check_aide(struct tg_security_tool **tools)
{
    if (tg_linux_command_exists("aide") ||
        tg_utils_file_exists("/etc/aide.conf")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "AIDE");
            strcpy(tool->vendor, "AIDE Community");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_HIDS;
            tool->active = tg_utils_file_exists("/var/lib/aide/aide.db");
            strcpy(tool->config_path, "/etc/aide.conf");
            strcpy(tool->log_path, "/var/log/aide");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found AIDE (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check RKHunter (Rootkit Hunter) */
int tg_linux_check_rkhunter(struct tg_security_tool **tools)
{
    if (tg_linux_command_exists("rkhunter") ||
        tg_utils_file_exists("/etc/rkhunter.conf")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "RKHunter");
            strcpy(tool->vendor, "RKHunter Project");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIMALWARE;
            tool->active = 1; /* Assume active if installed */
            strcpy(tool->config_path, "/etc/rkhunter.conf");
            strcpy(tool->log_path, "/var/log/rkhunter.log");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found RKHunter");
            return 1;
        }
    }
    return 0;
}

/* Check chkrootkit */
int tg_linux_check_chkrootkit(struct tg_security_tool **tools)
{
    if (tg_linux_command_exists("chkrootkit")) {
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "chkrootkit");
            strcpy(tool->vendor, "chkrootkit Team");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIMALWARE;
            tool->active = 1; /* Assume active if installed */
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found chkrootkit");
            return 1;
        }
    }
    return 0;
}

/* Check auditd */
int tg_linux_check_auditd(struct tg_security_tool **tools)
{
    if (tg_linux_service_running("auditd") ||
        tg_utils_file_exists("/etc/audit/auditd.conf")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "auditd");
            strcpy(tool->vendor, "Linux Audit Project");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_AUDIT;
            tool->active = tg_linux_service_running("auditd");
            strcpy(tool->config_path, "/etc/audit");
            strcpy(tool->log_path, "/var/log/audit");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found auditd (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check OSSEC */
int tg_linux_check_ossec(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/var/ossec/bin/ossec-control") ||
        tg_linux_service_running("ossec")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "OSSEC HIDS");
            strcpy(tool->vendor, "OSSEC Foundation");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_HIDS;
            tool->active = tg_linux_service_running("ossec");
            strcpy(tool->config_path, "/var/ossec/etc");
            strcpy(tool->log_path, "/var/ossec/logs");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found OSSEC (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Suricata */
int tg_linux_check_suricata(struct tg_security_tool **tools)
{
    if (tg_linux_service_running("suricata") ||
        tg_utils_file_exists("/etc/suricata/suricata.yaml")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Suricata");
            strcpy(tool->vendor, "OISF");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_IDS;
            tool->active = tg_linux_service_running("suricata");
            strcpy(tool->config_path, "/etc/suricata");
            strcpy(tool->log_path, "/var/log/suricata");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Suricata (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check if a command exists in PATH */
int tg_linux_command_exists(const char *command)
{
    char path_cmd[256];
    
    if (!command) {
        return 0;
    }
    
    snprintf(path_cmd, sizeof(path_cmd), "which %s >/dev/null 2>&1", command);
    return (system(path_cmd) == 0);
}

/* Check if a systemd service is running */
int tg_linux_service_running(const char *service_name)
{
    char cmd[256];
    
    if (!service_name) {
        return 0;
    }
    
    /* Try systemctl first (systemd) */
    snprintf(cmd, sizeof(cmd), "systemctl is-active %s >/dev/null 2>&1", service_name);
    if (system(cmd) == 0) {
        return 1;
    }
    
    /* Try service command (SysV init) */
    snprintf(cmd, sizeof(cmd), "service %s status >/dev/null 2>&1", service_name);
    if (system(cmd) == 0) {
        return 1;
    }
    
    /* Check if process is running */
    snprintf(cmd, sizeof(cmd), "pgrep %s >/dev/null 2>&1", service_name);
    return (system(cmd) == 0);
}

/* Detect compliance requirements on Linux */
int tg_linux_detect_compliance(tg_compliance_t *compliance)
{
    *compliance = TG_COMPLIANCE_NONE;
    
    /* Check for PCI DSS indicators */
    if (tg_linux_check_pci_software()) {
        *compliance |= TG_COMPLIANCE_PCI_DSS;
        tg_log(TG_LOG_INFO, "detected PCI DSS compliance requirement");
    }
    
    /* Check for HIPAA indicators */
    if (tg_linux_check_healthcare_software()) {
        *compliance |= TG_COMPLIANCE_HIPAA;
        tg_log(TG_LOG_INFO, "detected HIPAA compliance requirement");
    }
    
    /* Check for SOX indicators */
    if (tg_linux_check_financial_software()) {
        *compliance |= TG_COMPLIANCE_SOX;
        tg_log(TG_LOG_INFO, "detected SOX compliance requirement");
    }
    
    /* Check for GDPR indicators (European systems) */
    if (tg_linux_check_gdpr_indicators()) {
        *compliance |= TG_COMPLIANCE_GDPR;
        tg_log(TG_LOG_INFO, "detected GDPR compliance requirement");
    }
    
    return 0;
}

/* Check for PCI DSS software indicators */
int tg_linux_check_pci_software(void)
{
    /* Check for common payment processing software */
    const char *pci_processes[] = {
        "stripe", "paypal", "square", "authorize", "braintree", NULL
    };
    
    for (int i = 0; pci_processes[i]; i++) {
        if (tg_linux_process_running(pci_processes[i])) {
            return 1;
        }
    }
    
    /* Check for payment-related directories */
    const char *pci_dirs[] = {
        "/opt/payment", "/var/payment", "/usr/local/payment", NULL
    };
    
    for (int i = 0; pci_dirs[i]; i++) {
        if (tg_utils_is_directory(pci_dirs[i])) {
            return 1;
        }
    }
    
    return 0;
}

/* Check for healthcare software indicators */
int tg_linux_check_healthcare_software(void)
{
    /* Check for common healthcare software */
    const char *healthcare_processes[] = {
        "epic", "cerner", "allscripts", "athenahealth", "meditech", NULL
    };
    
    for (int i = 0; healthcare_processes[i]; i++) {
        if (tg_linux_process_running(healthcare_processes[i])) {
            return 1;
        }
    }
    
    /* Check for healthcare-related directories */
    const char *healthcare_dirs[] = {
        "/opt/healthcare", "/var/healthcare", "/usr/local/healthcare", 
        "/opt/medical", "/var/medical", NULL
    };
    
    for (int i = 0; healthcare_dirs[i]; i++) {
        if (tg_utils_is_directory(healthcare_dirs[i])) {
            return 1;
        }
    }
    
    return 0;
}

/* Check for financial software indicators */
int tg_linux_check_financial_software(void)
{
    /* Check for common financial software */
    const char *financial_processes[] = {
        "sap", "oracle", "quickbooks", "sage", "peoplesoft", NULL
    };
    
    for (int i = 0; financial_processes[i]; i++) {
        if (tg_linux_process_running(financial_processes[i])) {
            return 1;
        }
    }
    
    /* Check for financial-related directories */
    const char *financial_dirs[] = {
        "/opt/finance", "/var/finance", "/usr/local/finance",
        "/opt/accounting", "/var/accounting", NULL
    };
    
    for (int i = 0; financial_dirs[i]; i++) {
        if (tg_utils_is_directory(financial_dirs[i])) {
            return 1;
        }
    }
    
    return 0;
}

/* Check for GDPR indicators */
int tg_linux_check_gdpr_indicators(void)
{
    /* Check system locale for European countries */
    const char *locale = getenv("LANG");
    if (locale) {
        /* Common European locales */
        const char *eu_locales[] = {
            "_DE", "_FR", "_IT", "_ES", "_NL", "_BE", "_AT", "_SE", "_DK", "_FI", NULL
        };
        
        for (int i = 0; eu_locales[i]; i++) {
            if (strstr(locale, eu_locales[i])) {
                return 1;
            }
        }
    }
    
    /* Check timezone for European zones */
    const char *tz = getenv("TZ");
    if (tz && strstr(tz, "Europe/")) {
        return 1;
    }
    
    return 0;
}

/* Check if a process is running */
int tg_linux_process_running(const char *process_name)
{
    char cmd[256];
    
    if (!process_name) {
        return 0;
    }
    
    snprintf(cmd, sizeof(cmd), "pgrep -f %s >/dev/null 2>&1", process_name);
    return (system(cmd) == 0);
}

#endif /* TG_PLATFORM_LINUX */