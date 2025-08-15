/*  ThreatGuard Agent - Windows Platform Discovery
 *  Windows-specific system and security tool discovery
 *  Copyright (C) 2025 BG Threat AI
 */

#ifdef TG_PLATFORM_WINDOWS

#include "../../../include/threatguard.h"
#include <wbemidl.h>
#include <comdef.h>
#include <psapi.h>
#include <tlhelp32.h>
#include <iphlpapi.h>

/* Windows-specific system scanning */
int tg_windows_scan_system(struct tg_system_info *system)
{
    SYSTEM_INFO si;
    MEMORYSTATUSEX mem_status;
    OSVERSIONINFOEX os_info;
    ULARGE_INTEGER disk_free, disk_total;
    int ret = 0;
    
    tg_log(TG_LOG_DEBUG, "starting Windows system scan");
    
    /* Get system architecture and CPU info */
    GetSystemInfo(&si);
    system->cpu_cores = si.dwNumberOfProcessors;
    
    switch (si.wProcessorArchitecture) {
        case PROCESSOR_ARCHITECTURE_AMD64:
            strcpy(system->architecture, "x64");
            break;
        case PROCESSOR_ARCHITECTURE_INTEL:
            strcpy(system->architecture, "x86");
            break;
        case PROCESSOR_ARCHITECTURE_ARM64:
            strcpy(system->architecture, "arm64");
            break;
        default:
            strcpy(system->architecture, "unknown");
    }
    
    /* Get memory information */
    mem_status.dwLength = sizeof(mem_status);
    if (GlobalMemoryStatusEx(&mem_status)) {
        system->total_memory = (uint64_t)(mem_status.ullTotalPhys / (1024 * 1024)); /* MB */
    }
    
    /* Get OS version information */
    os_info.dwOSVersionInfoSize = sizeof(os_info);
    if (GetVersionEx((OSVERSIONINFO*)&os_info)) {
        snprintf(system->os_version, sizeof(system->os_version),
                "Windows %lu.%lu Build %lu", 
                os_info.dwMajorVersion, os_info.dwMinorVersion, os_info.dwBuildNumber);
                
        /* Determine platform type */
        if (os_info.wProductType == VER_NT_WORKSTATION) {
            system->platform_type = TG_PLATFORM_WINDOWS_WORKSTATION;
        } else {
            system->platform_type = TG_PLATFORM_WINDOWS_SERVER;
        }
    } else {
        strcpy(system->os_version, "Windows (Unknown Version)");
        system->platform_type = TG_PLATFORM_WINDOWS_WORKSTATION;
    }
    
    /* Get disk space for system drive */
    if (GetDiskFreeSpaceEx("C:\\", &disk_free, &disk_total, NULL)) {
        system->disk_space = (uint64_t)(disk_free.QuadPart / (1024 * 1024)); /* MB */
    }
    
    /* Get network interfaces */
    ret = tg_windows_get_network_interfaces(system);
    if (ret != 0) {
        tg_log(TG_LOG_WARN, "failed to get network interfaces: %d", ret);
    }
    
    tg_log(TG_LOG_INFO, "Windows system scan completed: %s %s, %d cores, %lluMB RAM",
           system->os_version, system->architecture, system->cpu_cores, system->total_memory);
    
    return 0;
}

/* Get network interfaces information */
int tg_windows_get_network_interfaces(struct tg_system_info *system)
{
    IP_ADAPTER_INFO *adapter_info = NULL;
    ULONG buffer_length = 0;
    DWORD result;
    int count = 0;
    
    /* Get required buffer size */
    result = GetAdaptersInfo(NULL, &buffer_length);
    if (result != ERROR_BUFFER_OVERFLOW) {
        tg_log(TG_LOG_ERROR, "GetAdaptersInfo failed to get buffer size: %lu", result);
        return -1;
    }
    
    /* Allocate buffer */
    adapter_info = (IP_ADAPTER_INFO*)malloc(buffer_length);
    if (!adapter_info) {
        tg_log(TG_LOG_ERROR, "failed to allocate adapter info buffer");
        return -1;
    }
    
    /* Get adapter information */
    result = GetAdaptersInfo(adapter_info, &buffer_length);
    if (result != NO_ERROR) {
        tg_log(TG_LOG_ERROR, "GetAdaptersInfo failed: %lu", result);
        free(adapter_info);
        return -1;
    }
    
    /* Process adapters */
    IP_ADAPTER_INFO *adapter = adapter_info;
    while (adapter && count < 8) {
        /* Skip loopback and non-operational interfaces */
        if (adapter->Type != MIB_IF_TYPE_LOOPBACK && 
            strlen(adapter->IpAddressList.IpAddress.String) > 0 &&
            strcmp(adapter->IpAddressList.IpAddress.String, "0.0.0.0") != 0) {
            
            strncpy(system->interfaces[count].name, adapter->AdapterName, 
                   sizeof(system->interfaces[count].name) - 1);
            strncpy(system->interfaces[count].address, adapter->IpAddressList.IpAddress.String,
                   sizeof(system->interfaces[count].address) - 1);
            
            /* Set interface flags */
            system->interfaces[count].flags = 0;
            if (adapter->Type == IF_TYPE_ETHERNET_CSMACD) {
                system->interfaces[count].flags |= 0x1; /* Ethernet */
            } else if (adapter->Type == IF_TYPE_IEEE80211) {
                system->interfaces[count].flags |= 0x2; /* Wireless */
            }
            
            count++;
        }
        adapter = adapter->Next;
    }
    
    system->interface_count = count;
    free(adapter_info);
    
    tg_log(TG_LOG_DEBUG, "found %d network interfaces", count);
    return 0;
}

/* Windows security tools discovery */
int tg_windows_scan_security_tools(struct tg_security_tool **tools)
{
    struct tg_security_tool *tool_list = NULL;
    int count = 0;
    
    tg_log(TG_LOG_DEBUG, "starting Windows security tools scan");
    
    /* Check Windows Defender */
    if (tg_windows_check_defender(&tool_list)) {
        count++;
    }
    
    /* Check Windows Firewall */
    if (tg_windows_check_firewall(&tool_list)) {
        count++;
    }
    
    /* Check CrowdStrike Falcon */
    if (tg_windows_check_crowdstrike(&tool_list)) {
        count++;
    }
    
    /* Check Symantec Endpoint Protection */
    if (tg_windows_check_symantec(&tool_list)) {
        count++;
    }
    
    /* Check McAfee products */
    if (tg_windows_check_mcafee(&tool_list)) {
        count++;
    }
    
    /* Check Trend Micro */
    if (tg_windows_check_trend(&tool_list)) {
        count++;
    }
    
    /* Check SentinelOne */
    if (tg_windows_check_sentinelone(&tool_list)) {
        count++;
    }
    
    /* Check Carbon Black */
    if (tg_windows_check_carbonblack(&tool_list)) {
        count++;
    }
    
    *tools = tool_list;
    
    tg_log(TG_LOG_INFO, "Windows security tools scan completed, found %d tools", count);
    return count;
}

/* Check Windows Defender */
int tg_windows_check_defender(struct tg_security_tool **tools)
{
    HKEY hkey;
    DWORD value_type, value_size = sizeof(DWORD);
    DWORD defender_enabled = 0;
    
    /* Check if Windows Defender is enabled */
    if (RegOpenKeyEx(HKEY_LOCAL_MACHINE,
                    "SOFTWARE\\Microsoft\\Windows Defender\\Real-Time Protection",
                    0, KEY_READ, &hkey) == ERROR_SUCCESS) {
        
        if (RegQueryValueEx(hkey, "DisableRealtimeMonitoring", NULL, &value_type,
                           (BYTE*)&defender_enabled, &value_size) == ERROR_SUCCESS) {
            defender_enabled = !defender_enabled; /* Registry value is inverted */
        }
        RegCloseKey(hkey);
        
        if (defender_enabled) {
            struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
            if (tool) {
                strcpy(tool->name, "Windows Defender");
                strcpy(tool->vendor, "Microsoft");
                strcpy(tool->version, "Unknown");
                tool->type = TG_SECURITY_ANTIVIRUS;
                tool->active = 1;
                strcpy(tool->log_path, "Application:Microsoft-Windows-Windows Defender");
                
                /* Add to list */
                tool->next = *tools;
                *tools = tool;
                
                tg_log(TG_LOG_DEBUG, "found Windows Defender (active)");
                return 1;
            }
        }
    }
    
    return 0;
}

/* Check Windows Firewall */
int tg_windows_check_firewall(struct tg_security_tool **tools)
{
    /* This is a simplified check - would use Windows Firewall API in full implementation */
    if (tg_windows_service_running("MpsSvc")) {
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Windows Firewall");
            strcpy(tool->vendor, "Microsoft");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_FIREWALL;
            tool->active = 1;
            strcpy(tool->log_path, "System:Microsoft-Windows-Windows Firewall With Advanced Security");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Windows Firewall (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check CrowdStrike Falcon */
int tg_windows_check_crowdstrike(struct tg_security_tool **tools)
{
    /* Check for CrowdStrike installation */
    if (tg_utils_file_exists("C:\\Program Files\\CrowdStrike\\CSFalconContainer.exe") ||
        tg_windows_service_running("CSFalconService")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "CrowdStrike Falcon");
            strcpy(tool->vendor, "CrowdStrike");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = 1;
            strcpy(tool->config_path, "C:\\Program Files\\CrowdStrike");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found CrowdStrike Falcon (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check Symantec Endpoint Protection */
int tg_windows_check_symantec(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("C:\\Program Files (x86)\\Symantec\\Symantec Endpoint Protection\\smc.exe") ||
        tg_windows_service_running("SepMasterService")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Symantec Endpoint Protection");
            strcpy(tool->vendor, "Symantec");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS | TG_SECURITY_EDR;
            tool->active = 1;
            strcpy(tool->config_path, "C:\\Program Files (x86)\\Symantec\\Symantec Endpoint Protection");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Symantec Endpoint Protection (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check McAfee products */
int tg_windows_check_mcafee(struct tg_security_tool **tools)
{
    if (tg_utils_file_exists("C:\\Program Files\\McAfee\\Agent\\masvc.exe") ||
        tg_windows_service_running("McAfeeFramework")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "McAfee Endpoint Security");
            strcpy(tool->vendor, "McAfee");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = 1;
            strcpy(tool->config_path, "C:\\Program Files\\McAfee");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found McAfee Endpoint Security (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check Trend Micro */
int tg_windows_check_trend(struct tg_security_tool **tools)
{
    if (tg_windows_service_running("ds_agent") ||
        tg_utils_file_exists("C:\\Program Files (x86)\\Trend Micro\\Security Agent\\dsa.exe")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Trend Micro Deep Security");
            strcpy(tool->vendor, "Trend Micro");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_ANTIVIRUS;
            tool->active = 1;
            strcpy(tool->config_path, "C:\\Program Files (x86)\\Trend Micro");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Trend Micro Deep Security (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check SentinelOne */
int tg_windows_check_sentinelone(struct tg_security_tool **tools)
{
    if (tg_windows_service_running("SentinelAgent") ||
        tg_utils_file_exists("C:\\Program Files\\SentinelOne\\Sentinel Agent\\SentinelAgent.exe")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "SentinelOne");
            strcpy(tool->vendor, "SentinelOne");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = 1;
            strcpy(tool->config_path, "C:\\Program Files\\SentinelOne");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found SentinelOne (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check Carbon Black */
int tg_windows_check_carbonblack(struct tg_security_tool **tools)
{
    if (tg_windows_service_running("CarbonBlack") ||
        tg_utils_file_exists("C:\\Program Files\\Confer\\confer.exe")) {
        
        struct tg_security_tool *tool = flb_calloc(1, sizeof(struct tg_security_tool));
        if (tool) {
            strcpy(tool->name, "Carbon Black");
            strcpy(tool->vendor, "VMware");
            strcpy(tool->version, "Unknown");
            tool->type = TG_SECURITY_EDR;
            tool->active = 1;
            strcpy(tool->config_path, "C:\\Program Files\\Confer");
            
            /* Add to list */
            tool->next = *tools;
            *tools = tool;
            
            tg_log(TG_LOG_DEBUG, "found Carbon Black (active)");
            return 1;
        }
    }
    
    return 0;
}

/* Check if a Windows service is running */
int tg_windows_service_running(const char *service_name)
{
    SC_HANDLE scm, service;
    SERVICE_STATUS status;
    int running = 0;
    
    scm = OpenSCManager(NULL, NULL, SC_MANAGER_CONNECT);
    if (scm) {
        service = OpenService(scm, service_name, SERVICE_QUERY_STATUS);
        if (service) {
            if (QueryServiceStatus(service, &status)) {
                running = (status.dwCurrentState == SERVICE_RUNNING);
            }
            CloseServiceHandle(service);
        }
        CloseServiceHandle(scm);
    }
    
    return running;
}

/* Detect compliance requirements on Windows */
int tg_windows_detect_compliance(tg_compliance_t *compliance)
{
    *compliance = TG_COMPLIANCE_NONE;
    
    /* Check for PCI DSS indicators */
    if (tg_windows_check_pci_software()) {
        *compliance |= TG_COMPLIANCE_PCI_DSS;
        tg_log(TG_LOG_INFO, "detected PCI DSS compliance requirement");
    }
    
    /* Check for HIPAA indicators */
    if (tg_windows_check_healthcare_software()) {
        *compliance |= TG_COMPLIANCE_HIPAA;
        tg_log(TG_LOG_INFO, "detected HIPAA compliance requirement");
    }
    
    /* Check for SOX indicators */
    if (tg_windows_check_financial_software()) {
        *compliance |= TG_COMPLIANCE_SOX;
        tg_log(TG_LOG_INFO, "detected SOX compliance requirement");
    }
    
    return 0;
}

/* Check for PCI DSS software indicators */
int tg_windows_check_pci_software(void)
{
    /* Check registry for common payment processing software */
    const char *pci_software[] = {
        "SOFTWARE\\Stripe",
        "SOFTWARE\\PayPal",
        "SOFTWARE\\Square",
        "SOFTWARE\\Authorize.Net",
        NULL
    };
    
    HKEY hkey;
    for (int i = 0; pci_software[i]; i++) {
        if (RegOpenKeyEx(HKEY_LOCAL_MACHINE, pci_software[i], 0, KEY_READ, &hkey) == ERROR_SUCCESS) {
            RegCloseKey(hkey);
            return 1;
        }
    }
    
    return 0;
}

/* Check for healthcare software indicators */
int tg_windows_check_healthcare_software(void)
{
    /* Check for common healthcare software installations */
    const char *healthcare_paths[] = {
        "C:\\Program Files\\Epic",
        "C:\\Program Files\\Cerner",
        "C:\\Program Files\\Allscripts",
        "C:\\Program Files\\athenahealth",
        NULL
    };
    
    for (int i = 0; healthcare_paths[i]; i++) {
        if (tg_utils_file_exists(healthcare_paths[i])) {
            return 1;
        }
    }
    
    return 0;
}

/* Check for financial software indicators */
int tg_windows_check_financial_software(void)
{
    /* Check for common financial software */
    const char *financial_paths[] = {
        "C:\\Program Files\\SAP",
        "C:\\Program Files\\Oracle\\Financial",
        "C:\\Program Files\\QuickBooks",
        "C:\\Program Files\\Sage",
        NULL
    };
    
    for (int i = 0; financial_paths[i]; i++) {
        if (tg_utils_file_exists(financial_paths[i])) {
            return 1;
        }
    }
    
    return 0;
}

#endif /* TG_PLATFORM_WINDOWS */