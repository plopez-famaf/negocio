# ThreatGuard Agent - Native Fluent Bit Implementation
cmake_minimum_required(VERSION 3.12)
project(threatguard-agent VERSION 2.0.1 LANGUAGES C)

# Build options
option(TG_BUILD_STATIC "Build static binary" ON)
option(TG_BUILD_DISCOVERY "Build discovery plugin" ON)
option(TG_BUILD_SECURITY "Build security plugin" ON)
option(TG_BUILD_PLATFORM "Build platform output plugin" ON)

# Compiler settings
set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Platform detection
if(WIN32)
    set(TG_PLATFORM "windows")
    add_definitions(-DTG_PLATFORM_WINDOWS)
elseif(APPLE)
    set(TG_PLATFORM "darwin")
    add_definitions(-DTG_PLATFORM_DARWIN)
elseif(UNIX)
    set(TG_PLATFORM "linux")
    add_definitions(-DTG_PLATFORM_LINUX)
endif()

# Fluent Bit integration
set(FLUENT_BIT_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/deps/fluent-bit")
if(NOT EXISTS "${FLUENT_BIT_ROOT}")
    message(FATAL_ERROR "Fluent Bit source not found. Run: git submodule update --init --recursive")
endif()

# Include Fluent Bit
add_subdirectory("${FLUENT_BIT_ROOT}")

# ThreatGuard Agent includes
include_directories(
    "${CMAKE_CURRENT_SOURCE_DIR}/include"
    "${FLUENT_BIT_ROOT}/include"
    "${FLUENT_BIT_ROOT}/lib/flb_libco"
    "${FLUENT_BIT_ROOT}/lib/msgpack-c/include"
    "${FLUENT_BIT_ROOT}/lib/monkey/include"
)

# Platform-specific libraries
if(TG_PLATFORM STREQUAL "windows")
    set(PLATFORM_LIBS 
        ws2_32 
        advapi32 
        kernel32 
        wevtapi 
        oleaut32
        ole32
        wbemuuid
    )
elseif(TG_PLATFORM STREQUAL "linux")
    set(PLATFORM_LIBS 
        systemd 
        udev 
        dl 
        pthread
    )
elseif(TG_PLATFORM STREQUAL "darwin")
    find_library(COREFOUNDATION_FRAMEWORK CoreFoundation)
    find_library(IOKIT_FRAMEWORK IOKit)
    find_library(OSLOG_FRAMEWORK OSLog)
    set(PLATFORM_LIBS 
        ${COREFOUNDATION_FRAMEWORK}
        ${IOKIT_FRAMEWORK}
        ${OSLOG_FRAMEWORK}
    )
endif()

# ThreatGuard Agent common library
set(TG_COMMON_SOURCES
    src/common/tg_log.c
    src/common/tg_config.c
    src/common/tg_utils.c
    src/common/tg_security.c
    src/common/tg_discovery.c
)

add_library(threatguard-common STATIC ${TG_COMMON_SOURCES})
target_include_directories(threatguard-common PUBLIC include)

# Discovery Input Plugin
if(TG_BUILD_DISCOVERY)
    set(TG_DISCOVERY_SOURCES
        plugins/in_threatguard_discovery/in_threatguard_discovery.c
        plugins/in_threatguard_discovery/discovery_engine.c
        plugins/in_threatguard_discovery/platform/${TG_PLATFORM}_discovery.c
    )
    
    add_library(flb-in_threatguard_discovery STATIC ${TG_DISCOVERY_SOURCES})
    target_link_libraries(flb-in_threatguard_discovery 
        threatguard-common 
        fluent-bit-static
        ${PLATFORM_LIBS}
    )
endif()

# Security Filter Plugin  
if(TG_BUILD_SECURITY)
    set(TG_SECURITY_SOURCES
        plugins/filter_threatguard_security/filter_threatguard_security.c
        plugins/filter_threatguard_security/security_rules.c
        plugins/filter_threatguard_security/threat_detection.c
    )
    
    add_library(flb-filter_threatguard_security STATIC ${TG_SECURITY_SOURCES})
    target_link_libraries(flb-filter_threatguard_security 
        threatguard-common 
        fluent-bit-static
    )
endif()

# Platform Output Plugin
if(TG_BUILD_PLATFORM)
    set(TG_PLATFORM_SOURCES
        plugins/out_threatguard_platform/out_threatguard_platform.c
        plugins/out_threatguard_platform/secure_transport.c
        plugins/out_threatguard_platform/batch_processor.c
    )
    
    add_library(flb-out_threatguard_platform STATIC ${TG_PLATFORM_SOURCES})
    target_link_libraries(flb-out_threatguard_platform 
        threatguard-common 
        fluent-bit-static
        ${PLATFORM_LIBS}
    )
endif()

# Main ThreatGuard Agent executable
set(TG_AGENT_SOURCES
    src/main.c
    src/tg_agent.c
    src/tg_plugins.c
)

add_executable(threatguard-agent ${TG_AGENT_SOURCES})

# Link all components
target_link_libraries(threatguard-agent
    threatguard-common
    fluent-bit-static
)

# Add plugins if built
if(TG_BUILD_DISCOVERY)
    target_link_libraries(threatguard-agent flb-in_threatguard_discovery)
endif()

if(TG_BUILD_SECURITY)
    target_link_libraries(threatguard-agent flb-filter_threatguard_security)
endif()

if(TG_BUILD_PLATFORM)
    target_link_libraries(threatguard-agent flb-out_threatguard_platform)
endif()

# Platform-specific linking
target_link_libraries(threatguard-agent ${PLATFORM_LIBS})

# Static linking for minimal dependencies
if(TG_BUILD_STATIC)
    if(TG_PLATFORM STREQUAL "linux")
        set_target_properties(threatguard-agent PROPERTIES LINK_FLAGS "-static")
    elseif(TG_PLATFORM STREQUAL "windows")
        set_target_properties(threatguard-agent PROPERTIES LINK_FLAGS "/MT")
    endif()
endif()

# Compiler flags
target_compile_options(threatguard-agent PRIVATE
    $<$<PLATFORM_ID:Windows>:/W4>
    $<$<NOT:$<PLATFORM_ID:Windows>>:-Wall -Wextra -Werror>
)

# Release optimizations
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_compile_options(threatguard-agent PRIVATE -O3 -DNDEBUG)
    if(TG_PLATFORM STREQUAL "linux" OR TG_PLATFORM STREQUAL "darwin")
        target_compile_options(threatguard-agent PRIVATE -s) # Strip symbols
    endif()
endif()

# Installation
install(TARGETS threatguard-agent 
    RUNTIME DESTINATION bin
    COMPONENT Runtime
)

install(FILES 
    config/threatguard-agent.conf
    DESTINATION etc/threatguard-agent
    COMPONENT Configuration
)

# Packaging
set(CPACK_PACKAGE_NAME "threatguard-agent")
set(CPACK_PACKAGE_VERSION ${PROJECT_VERSION})
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Zero-config endpoint security collector")
set(CPACK_PACKAGE_VENDOR "BG Threat AI")

if(TG_PLATFORM STREQUAL "windows")
    set(CPACK_GENERATOR "WIX")
elseif(TG_PLATFORM STREQUAL "linux")
    set(CPACK_GENERATOR "DEB;RPM")
elseif(TG_PLATFORM STREQUAL "darwin")
    set(CPACK_GENERATOR "PKG")
endif()

include(CPack)