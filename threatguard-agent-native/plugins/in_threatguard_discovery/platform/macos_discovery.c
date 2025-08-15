/*  ThreatGuard Agent - macOS Platform Discovery
 *  macOS-specific system and security tool discovery
 *  Copyright (C) 2025 BG Threat AI
 */

#ifdef TG_PLATFORM_MACOS

#include "../../../include/threatguard.h"
#include <sys/sysctl.h>
#include <sys/mount.h>
#include <CoreFoundation/CoreFoundation.h>
#include <SystemConfiguration/SystemConfiguration.h>
#include <ifaddrs.h>
#include <netinet/in.h>
#include <arpa/inet.h>

/* macOS-specific system scanning */
int tg_macos_scan_system(struct tg_system_info *system)
{
    size_t size;
    int mib[2];
    uint64_t memory;
    char buffer[256];
    struct statfs fs;
    int ret = 0;
    
    tg_log(TG_LOG_DEBUG, "starting macOS system scan");
    
    /* Get CPU count */
    mib[0] = CTL_HW;
    mib[1] = HW_NCPU;
    size = sizeof(system->cpu_cores);
    if (sysctl(mib, 2, &system->cpu_cores, &size, NULL, 0) != 0) {
        system->cpu_cores = 1;
    }
    
    /* Get total memory */
    mib[0] = CTL_HW;
    mib[1] = HW_MEMSIZE;
    size = sizeof(memory);
    if (sysctl(mib, 2, &memory, &size, NULL, 0) == 0) {
        system->total_memory = (uint64_t)(memory / (1024 * 1024)); /* MB */
    }
    
    /* Get architecture */
    mib[0] = CTL_HW;
    mib[1] = HW_MACHINE;
    size = sizeof(buffer);
    if (sysctl(mib, 2, buffer, &size, NULL, 0) == 0) {
        strncpy(system->architecture, buffer, sizeof(system->architecture) - 1);
    }
    
    /* Get macOS version information */
    tg_macos_get_os_version(system);
    
    /* Get disk space for root filesystem */
    if (statfs("/", &fs) == 0) {
        system->disk_space = (uint64_t)(fs.f_bavail * fs.f_frsize / (1024 * 1024)); /* MB */
    }
    
    /* Set platform type */
    system->platform_type = TG_PLATFORM_MACOS;
    
    /* Get network interfaces */
    ret = tg_macos_get_network_interfaces(system);
    if (ret != 0) {
        tg_log(TG_LOG_WARN, "failed to get network interfaces: %d", ret);
    }
    
    tg_log(TG_LOG_INFO, "macOS system scan completed: %s %s, %d cores, %lluMB RAM",
           system->os_version, system->architecture, system->cpu_cores, system->total_memory);
    
    return 0;
}

/* Get macOS version information */
void tg_macos_get_os_version(struct tg_system_info *system)
{
    CFStringRef version_string;
    CFDictionaryRef version_dict;
    char version_buffer[128];
    
    /* Try to get version from SystemVersion.plist */
    CFURLRef plist_url = CFURLCreateWithFileSystemPath(kCFAllocatorDefault,
        CFSTR("/System/Library/CoreServices/SystemVersion.plist"),
        kCFURLPOSIXPathStyle, false);
    
    if (plist_url) {
        CFDataRef plist_data;
        SInt32 error_code;
        
        if (CFURLCreateDataAndPropertiesFromResource(kCFAllocatorDefault,
                plist_url, &plist_data, NULL, NULL, &error_code)) {
            
            CFPropertyListRef plist = CFPropertyListCreateWithData(kCFAllocatorDefault,
                plist_data, kCFPropertyListImmutable, NULL, NULL);
            
            if (plist && CFGetTypeID(plist) == CFDictionaryGetTypeID()) {
                version_dict = (CFDictionaryRef)plist;
                
                /* Get ProductVersion */
                version_string = (CFStringRef)CFDictionaryGetValue(version_dict, 
                    CFSTR("ProductVersion"));
                if (version_string && CFGetTypeID(version_string) == CFStringGetTypeID()) {
                    if (CFStringGetCString(version_string, version_buffer, 
                            sizeof(version_buffer), kCFStringEncodingUTF8)) {
                        snprintf(system->os_version, sizeof(system->os_version),
                                "macOS %s", version_buffer);
                    }
                }
                
                CFRelease(plist);
            }
            CFRelease(plist_data);
        }
        CFRelease(plist_url);
    }
    
    /* Fallback if plist reading failed */
    if (strlen(system->os_version) == 0) {
        strcpy(system->os_version, "macOS (Unknown Version)");
    }
}

/* Get network interfaces information */
int tg_macos_get_network_interfaces(struct tg_system_info *system)
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
        if (strcmp(ifa->ifa_name, "lo0") == 0) {
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
        if (tg_utils_string_starts_with(ifa->ifa_name, "en")) {
            system->interfaces[count].flags |= 0x4; /* Ethernet */
        } else if (tg_utils_string_starts_with(ifa->ifa_name, "wi") ||
                  tg_utils_string_starts_with(ifa->ifa_name, "wl")) {
            system->interfaces[count].flags |= 0x8; /* Wireless */
        }
        
        count++;
    }
    
    system->interface_count = count;
    freeifaddrs(ifaddrs_list);
    
    tg_log(TG_LOG_DEBUG, "found %d network interfaces", count);
    return 0;
}

/* macOS security tools discovery */
int tg_macos_scan_security_tools(struct tg_security_tool **tools)
{
    struct tg_security_tool *tool_list = NULL;
    int count = 0;
    
    tg_log(TG_LOG_DEBUG, "starting macOS security tools scan");
    
    /* Check built-in macOS security features */
    if (tg_macos_check_xprotect(&tool_list)) count++;
    if (tg_macos_check_gatekeeper(&tool_list)) count++;
    if (tg_macos_check_sip(&tool_list)) count++;
    if (tg_macos_check_firewall(&tool_list)) count++;
    if (tg_macos_check_filevault(&tool_list)) count++;
    
    /* Check third-party antivirus solutions */
    if (tg_macos_check_bitdefender(&tool_list)) count++;
    if (tg_macos_check_kaspersky(&tool_list)) count++;
    if (tg_macos_check_norton(&tool_list)) count++;
    if (tg_macos_check_avast(&tool_list)) count++;
    if (tg_macos_check_avg(&tool_list)) count++;
    if (tg_macos_check_sophos(&tool_list)) count++;
    if (tg_macos_check_eset(&tool_list)) count++;
    if (tg_macos_check_clamav(&tool_list)) count++;
    
    /* Check EDR solutions */
    if (tg_macos_check_crowdstrike(&tool_list)) count++;
    if (tg_macos_check_sentinelone(&tool_list)) count++;
    if (tg_macos_check_carbonblack(&tool_list)) count++;
    if (tg_macos_check_defender_atp(&tool_list)) count++;
    if (tg_macos_check_jamf_protect(&tool_list)) count++;
    
    /* Check security monitoring tools */
    if (tg_macos_check_osquery(&tool_list)) count++;
    if (tg_macos_check_objective_see(&tool_list)) count++;
    
    *tools = tool_list;
    
    tg_log(TG_LOG_INFO, "macOS security tools scan completed, found %d tools", count);
    return count;
}

/* Check XProtect (built-in antimalware) */
int tg_macos_check_xprotect(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/System/Library/CoreServices/XProtect.bundle") ||
        tg_utils_file_exists("/Library/Apple/System/Library/CoreServices/XProtect.bundle")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "XProtect");
            strcpy(tool->vendor, "Apple");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIMALWARE;
            tool->active = 1; /* Always active on macOS */
            strcpy(tool->config_path, "/System/Library/CoreServices/XProtect.bundle");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found XProtect (built-in)");
            return 1;
        }
    }
    return 0;
}

/* Check Gatekeeper */
int tg_macos_check_gatekeeper(struct tg_security_tool **tools)
{
    /* Gatekeeper is always present on modern macOS */
    if (tg_macos_command_exists("spctl")) {
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Gatekeeper");
            strcpy(tool->vendor, "Apple");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_APPLICATION_CONTROL;
            tool->active = tg_macos_gatekeeper_enabled();
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Gatekeeper (%s)", tool->active ? "enabled" : "disabled");
            return 1;
        }
    }
    return 0;
}

/* Check System Integrity Protection (SIP) */
int tg_macos_check_sip(struct tg_security_tool **tools)
{
    if (tg_macos_command_exists("csrutil")) {
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "System Integrity Protection");
            strcpy(tool->vendor, "Apple");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_SYSTEM_PROTECTION;
            tool->active = tg_macos_sip_enabled();
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found SIP (%s)", tool->active ? "enabled" : "disabled");
            return 1;
        }
    }
    return 0;
}

/* Check macOS Firewall */
int tg_macos_check_firewall(struct tg_security_tool **tools)
{
    struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
    if (tool) {
        strcpy(tool->name, "macOS Firewall");
        strcpy(tool->vendor, "Apple");
        strcpy(tool->version, "Unknown");
        tool->type = TG_SECURITY_FIREWALL;
        tool->active = tg_macos_firewall_enabled();
        strcpy(tool->config_path, "/Library/Preferences/com.apple.alf.plist");
        
        tool->next = *tools;
        *tools = tool;
        
        tg_log(TG_LOG_DEBUG, "found macOS Firewall (%s)", tool->active ? "enabled" : "disabled");
        return 1;
    }
    return 0;
}

/* Check FileVault */
int tg_macos_check_filevault(struct tg_security_tool **tools)
{
    if (tg_macos_command_exists("fdesetup")) {
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "FileVault");
            strcpy(tool->vendor, "Apple");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ENCRYPTION;
            tool->active = tg_macos_filevault_enabled();
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found FileVault (%s)", tool->active ? "enabled" : "disabled");
            return 1;
        }
    }
    return 0;
}

/* Check Bitdefender */
int tg_macos_check_bitdefender(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Bitdefender Antivirus for Mac.app") ||
        tg_macos_process_running("BitdefenderAgent")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Bitdefender Antivirus");
            strcpy(tool->vendor, "Bitdefender");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("BitdefenderAgent");
            strcpy(tool->config_path, "/Library/Application Support/Bitdefender");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Bitdefender (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Kaspersky */
int tg_macos_check_kaspersky(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Kaspersky Internet Security for Mac.app") ||
        tg_macos_process_running("kav")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Kaspersky Internet Security");
            strcpy(tool->vendor, "Kaspersky");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("kav");
            strcpy(tool->config_path, "/Library/Application Support/Kaspersky Lab");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Kaspersky (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Norton */
int tg_macos_check_norton(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Norton 360.app") ||
        tg_macos_process_running("SymDaemon")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Norton 360");
            strcpy(tool->vendor, "NorTech");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("SymDaemon");
            strcpy(tool->config_path, "/Library/Application Support/Symantec");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Norton (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Avast */
int tg_macos_check_avast(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Avast Security.app") ||
        tg_macos_process_running("com.avast.daemon")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Avast Security");
            strcpy(tool->vendor, "Avast");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("com.avast.daemon");
            strcpy(tool->config_path, "/Library/Application Support/Avast");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Avast (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check AVG */
int tg_macos_check_avg(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/AVG AntiVirus.app") ||
        tg_macos_process_running("com.avg.daemon")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "AVG AntiVirus");
            strcpy(tool->vendor, "AVG");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("com.avg.daemon");
            strcpy(tool->config_path, "/Library/Application Support/AVG");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found AVG (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Sophos */
int tg_macos_check_sophos(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Sophos Endpoint.app") ||
        tg_macos_process_running("SophosAgent")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Sophos Endpoint");
            strcpy(tool->vendor, "Sophos");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS | TG_SECURITY_EDR;
            tool->active = tg_macos_process_running("SophosAgent");
            strcpy(tool->config_path, "/Library/Application Support/Sophos");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Sophos (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check ESET */
int tg_macos_check_eset(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/ESET Endpoint Antivirus.app") ||
        tg_macos_process_running("esets_daemon")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "ESET Endpoint Antivirus");
            strcpy(tool->vendor, "ESET");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("esets_daemon");
            strcpy(tool->config_path, "/Library/Application Support/ESET");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found ESET (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check ClamAV */
int tg_macos_check_clamav(struct tg_security_tool **tools)
{
    if (tg_macos_command_exists("clamscan") ||
        tg_utils_file_exists("/usr/local/bin/clamscan")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "ClamAV");
            strcpy(tool->vendor, "Cisco");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = tg_macos_process_running("clamd");
            strcpy(tool->config_path, "/usr/local/etc/clamav");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found ClamAV (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check CrowdStrike Falcon */
int tg_macos_check_crowdstrike(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Falcon.app") ||
        tg_macos_process_running("falcond")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "CrowdStrike Falcon");
            strcpy(tool->vendor, "CrowdStrike");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_macos_process_running("falcond");
            strcpy(tool->config_path, "/Applications/Falcon.app");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found CrowdStrike Falcon (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check SentinelOne */
int tg_macos_check_sentinelone(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Library/Sentinel/sentinel-agent") ||
        tg_macos_process_running("SentinelAgent")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "SentinelOne");
            strcpy(tool->vendor, "SentinelOne");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_macos_process_running("SentinelAgent");
            strcpy(tool->config_path, "/Library/Sentinel");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found SentinelOne (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Carbon Black */
int tg_macos_check_carbonblack(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/CbOSXSensorService") ||
        tg_macos_process_running("CbOSXSensorService")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Carbon Black");
            strcpy(tool->vendor, "VMware");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_macos_process_running("CbOSXSensorService");
            strcpy(tool->config_path, "/Applications/CbOSXSensorService");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Carbon Black (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Microsoft Defender ATP */
int tg_macos_check_defender_atp(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Applications/Microsoft Defender ATP.app") ||
        tg_macos_process_running("wdavdaemon")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Microsoft Defender ATP");
            strcpy(tool->vendor, "Microsoft");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_macos_process_running("wdavdaemon");
            strcpy(tool->config_path, "/Library/Application Support/Microsoft/Defender");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Microsoft Defender ATP (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Jamf Protect */
int tg_macos_check_jamf_protect(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("/Library/Application Support/JamfProtect") ||
        tg_macos_process_running("JamfProtect")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Jamf Protect");
            strcpy(tool->vendor, "Jamf");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = tg_macos_process_running("JamfProtect");
            strcpy(tool->config_path, "/Library/Application Support/JamfProtect");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Jamf Protect (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check osquery */
int tg_macos_check_osquery(struct tg_security_tool **tools)
{
    if (tg_macos_command_exists("osqueryi") ||
        tg_utils_file_exists("/usr/local/bin/osqueryd")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "osquery");
            strcpy(tool->vendor, "Facebook/Linux Foundation");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_MONITORING;
            tool->active = tg_macos_process_running("osqueryd");
            strcpy(tool->config_path, "/var/osquery");
            
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found osquery (%s)", tool->active ? "active" : "inactive");
            return 1;
        }
    }
    return 0;
}

/* Check Objective-See tools */
int tg_macos_check_objective_see(struct tg_security_tool **tools)
{
    int found = 0;
    
    /* Check for various Objective-See tools */
    const char *objective_see_tools[] = {
        "/Applications/BlockBlock.app",
        "/Applications/KnockKnock.app", 
        "/Applications/LuLu.app",
        "/Applications/OverSight.app",
        "/Applications/RansomWhere.app",
        NULL
    };
    
    for (int i = 0; objective_see_tools[i]; i++) {
        if (tg_utils_file_exists(objective_see_tools[i])) {
            struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
            if (tool) {
                const char *tool_name = strrchr(objective_see_tools[i], '/');
                if (tool_name) {
                    tool_name++; /* Skip the slash */
                    /* Remove .app extension */
                    char name_buffer[64];
                    strncpy(name_buffer, tool_name, sizeof(name_buffer) - 1);
                    char *app_ext = strstr(name_buffer, ".app");
                    if (app_ext) *app_ext = '\0';
                    
                    strncpy(tool->name, name_buffer, sizeof(tool->name) - 1);
                } else {
                    strcpy(tool->name, "Objective-See Tool");
                }
                
                strcpy(tool->vendor, "Objective-See");
                strcpy(tool->version, "Unknown");
                tool->type = TG_SECURITY_MONITORING;
                tool->active = 1; /* Assume active if installed */
                strncpy(tool->config_path, objective_see_tools[i], sizeof(tool->config_path) - 1);
                
                tool->next = *tools;
                *tools = tool;
                
                tg_log(TG_LOG_DEBUG, "found Objective-See tool: %s", tool->name);
                found++;
            }
        }
    }
    
    return found;
}

/* Check if a command exists */
int tg_macos_command_exists(const char *command)
{
    char path_cmd[256];
    
    if (!command) {
        return 0;
    }
    
    snprintf(path_cmd, sizeof(path_cmd), "which %s >/dev/null 2>&1", command);
    return (system(path_cmd) == 0);
}

/* Check if a process is running */
int tg_macos_process_running(const char *process_name)
{
    char cmd[256];
    
    if (!process_name) {
        return 0;
    }
    
    snprintf(cmd, sizeof(cmd), "pgrep -f %s >/dev/null 2>&1", process_name);
    return (system(cmd) == 0);
}

/* Check if Gatekeeper is enabled */
int tg_macos_gatekeeper_enabled(void)
{
    FILE *fp;
    char result[128];
    
    fp = popen("spctl --status 2>/dev/null", "r");
    if (!fp) {
        return 0;
    }
    
    if (fgets(result, sizeof(result), fp)) {
        pclose(fp);
        return (strstr(result, "enabled") != NULL);
    }
    
    pclose(fp);
    return 0;
}

/* Check if SIP is enabled */
int tg_macos_sip_enabled(void)
{
    FILE *fp;
    char result[128];
    
    fp = popen("csrutil status 2>/dev/null", "r");
    if (!fp) {
        return 1; /* Assume enabled if can't check */
    }
    
    if (fgets(result, sizeof(result), fp)) {
        pclose(fp);
        return (strstr(result, "enabled") != NULL);
    }
    
    pclose(fp);
    return 1; /* Assume enabled if can't determine */
}

/* Check if macOS firewall is enabled */
int tg_macos_firewall_enabled(void)
{
    FILE *fp;
    char result[128];
    
    fp = popen("defaults read /Library/Preferences/com.apple.alf globalstate 2>/dev/null", "r");
    if (!fp) {
        return 0;
    }
    
    if (fgets(result, sizeof(result), fp)) {
        pclose(fp);
        int state = atoi(result);
        return (state == 1 || state == 2); /* 1 = on for specific services, 2 = on for essential services */
    }
    
    pclose(fp);
    return 0;
}

/* Check if FileVault is enabled */
int tg_macos_filevault_enabled(void)
{
    FILE *fp;
    char result[128];
    
    fp = popen("fdesetup status 2>/dev/null", "r");
    if (!fp) {
        return 0;
    }
    
    if (fgets(result, sizeof(result), fp)) {
        pclose(fp);
        return (strstr(result, "On") != NULL);
    }
    
    pclose(fp);
    return 0;
}

/* Detect compliance requirements on macOS */
int tg_macos_detect_compliance(tg_compliance_t *compliance)
{
    *compliance = TG_COMPLIANCE_NONE;
    
    /* Check for PCI DSS indicators */
    if (tg_macos_check_pci_software()) {
        *compliance |= TG_COMPLIANCE_PCI_DSS;
        tg_log(TG_LOG_INFO, "detected PCI DSS compliance requirement");
    }
    
    /* Check for HIPAA indicators */
    if (tg_macos_check_healthcare_software()) {
        *compliance |= TG_COMPLIANCE_HIPAA;
        tg_log(TG_LOG_INFO, "detected HIPAA compliance requirement");
    }
    
    /* Check for SOX indicators */
    if (tg_macos_check_financial_software()) {
        *compliance |= TG_COMPLIANCE_SOX;
        tg_log(TG_LOG_INFO, "detected SOX compliance requirement");
    }
    
    return 0;
}

/* Check for PCI DSS software indicators */
int tg_macos_check_pci_software(void)
{
    /* Check for common payment processing applications */
    const char *pci_apps[] = {
        "/Applications/Stripe.app",
        "/Applications/PayPal.app", 
        "/Applications/Square.app",
        "/Applications/Toast POS.app",
        "/Applications/Shopify POS.app",
        NULL
    };
    
    for (int i = 0; pci_apps[i]; i++) {
        if (tg_utils_file_exists(pci_apps[i])) {
            return 1;
        }
    }
    
    /* Check for payment-related processes */
    const char *pci_processes[] = {
        "stripe", "paypal", "square", "authorize", "braintree", NULL
    };
    
    for (int i = 0; pci_processes[i]; i++) {
        if (tg_macos_process_running(pci_processes[i])) {
            return 1;
        }
    }
    
    return 0;
}

/* Check for healthcare software indicators */
int tg_macos_check_healthcare_software(void)
{
    /* Check for common healthcare applications */
    const char *healthcare_apps[] = {
        "/Applications/Epic.app",
        "/Applications/Cerner.app",
        "/Applications/Allscripts.app",
        "/Applications/athenahealth.app",
        "/Applications/eClinicalWorks.app",
        NULL
    };
    
    for (int i = 0; healthcare_apps[i]; i++) {
        if (tg_utils_file_exists(healthcare_apps[i])) {
            return 1;
        }
    }
    
    return 0;
}

/* Check for financial software indicators */
int tg_macos_check_financial_software(void)
{
    /* Check for common financial applications */
    const char *financial_apps[] = {
        "/Applications/QuickBooks.app",
        "/Applications/Sage 50cloud.app",
        "/Applications/Xero.app",
        "/Applications/FreshBooks.app",
        "/Applications/Wave Accounting.app",
        "/Applications/SAP.app",
        NULL
    };
    
    for (int i = 0; financial_apps[i]; i++) {
        if (tg_utils_file_exists(financial_apps[i])) {
            return 1;
        }
    }
    
    return 0;
}

#endif /* TG_PLATFORM_MACOS */