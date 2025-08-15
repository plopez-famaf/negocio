/*  ThreatGuard Agent - Logging System
 *  Structured logging with log levels, rotation, and correlation IDs
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"
#include <time.h>
#include <sys/stat.h>
#include <unistd.h>

/* Global logger instance */
static struct tg_logger *g_logger = NULL;

/* Logger context structure */
struct tg_logger {
    FILE *log_file;
    int log_level;
    int console_output;
    int syslog_enabled;
    char log_path[256];
    char correlation_id[64];
    
    /* Log rotation settings */
    size_t max_file_size;
    int max_files;
    time_t last_rotation_check;
    
    /* Performance tracking */
    uint64_t messages_logged;
    uint64_t bytes_written;
    time_t start_time;
    
    /* Thread safety */
    pthread_mutex_t log_mutex;
};

/* Log level names */
static const char *log_level_names[] = {
    "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"
};

/* Log level colors for console output */
static const char *log_level_colors[] = {
    "\033[37m",  /* TRACE - White */
    "\033[36m",  /* DEBUG - Cyan */
    "\033[32m",  /* INFO - Green */
    "\033[33m",  /* WARN - Yellow */
    "\033[31m",  /* ERROR - Red */
    "\033[35m"   /* FATAL - Magenta */
};

#define COLOR_RESET "\033[0m"

/* Initialize logging system */
int tg_logger_init(const char *log_path, int log_level, int console_output)
{
    if (g_logger) {
        return 0; /* Already initialized */
    }
    
    g_logger = flb_calloc(1, sizeof(struct tg_logger));
    if (!g_logger) {
        fprintf(stderr, "[ERROR] Failed to allocate logger\n");
        return -1;
    }
    
    /* Initialize mutex */
    if (pthread_mutex_init(&g_logger->log_mutex, NULL) != 0) {
        fprintf(stderr, "[ERROR] Failed to initialize log mutex\n");
        flb_free(g_logger);
        g_logger = NULL;
        return -1;
    }
    
    /* Set basic configuration */
    g_logger->log_level = log_level;
    g_logger->console_output = console_output;
    g_logger->syslog_enabled = 0;
    
    /* Set log rotation defaults */
    g_logger->max_file_size = 10 * 1024 * 1024; /* 10MB */
    g_logger->max_files = 5;
    g_logger->last_rotation_check = time(NULL);
    
    /* Initialize statistics */
    g_logger->messages_logged = 0;
    g_logger->bytes_written = 0;
    g_logger->start_time = time(NULL);
    
    /* Generate initial correlation ID */
    tg_logger_generate_correlation_id();
    
    /* Open log file if path provided */
    if (log_path && strlen(log_path) > 0) {
        strncpy(g_logger->log_path, log_path, sizeof(g_logger->log_path) - 1);
        
        /* Create directory if needed */
        char dir_path[256];
        strncpy(dir_path, log_path, sizeof(dir_path) - 1);
        char *last_slash = strrchr(dir_path, '/');
        if (last_slash) {
            *last_slash = '\0';
            tg_utils_create_directory(dir_path);
        }
        
        g_logger->log_file = fopen(log_path, "a");
        if (!g_logger->log_file) {
            fprintf(stderr, "[ERROR] Failed to open log file: %s\n", log_path);
            /* Continue without file logging */
        }
    }
    
    /* Enable syslog for production */
#ifndef TG_DEBUG_BUILD
    openlog("threatguard-agent", LOG_PID | LOG_NDELAY, LOG_DAEMON);
    g_logger->syslog_enabled = 1;
#endif
    
    tg_log(TG_LOG_INFO, "ThreatGuard logger initialized: level=%s, file=%s, console=%s",
           log_level_names[log_level], 
           log_path ? log_path : "none",
           console_output ? "enabled" : "disabled");
    
    return 0;
}

/* Log a message */
void tg_log(int level, const char *format, ...)
{
    if (!g_logger || level < g_logger->log_level) {
        return;
    }
    
    va_list args;
    char message[2048];
    char timestamp[32];
    time_t now;
    struct tm *tm_info;
    size_t message_len;
    
    /* Format the message */
    va_start(args, format);
    vsnprintf(message, sizeof(message), format, args);
    va_end(args);
    
    /* Get timestamp */
    now = time(NULL);
    tm_info = localtime(&now);
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", tm_info);
    
    /* Thread-safe logging */
    pthread_mutex_lock(&g_logger->log_mutex);
    
    /* Check for log rotation */
    if (now - g_logger->last_rotation_check > 60) { /* Check every minute */
        tg_logger_check_rotation();
        g_logger->last_rotation_check = now;
    }
    
    /* Console output */
    if (g_logger->console_output) {
        fprintf(stderr, "%s[%s]%s [%s] [%s] %s\n",
                log_level_colors[level],
                log_level_names[level],
                COLOR_RESET,
                timestamp,
                g_logger->correlation_id,
                message);
        fflush(stderr);
    }
    
    /* File output */
    if (g_logger->log_file) {
        message_len = fprintf(g_logger->log_file, 
                             "[%s] [%s] [%s] %s\n",
                             log_level_names[level],
                             timestamp,
                             g_logger->correlation_id,
                             message);
        fflush(g_logger->log_file);
        g_logger->bytes_written += message_len;
    }
    
    /* Syslog output */
    if (g_logger->syslog_enabled) {
        int syslog_priority;
        switch (level) {
            case TG_LOG_TRACE:
            case TG_LOG_DEBUG:
                syslog_priority = LOG_DEBUG;
                break;
            case TG_LOG_INFO:
                syslog_priority = LOG_INFO;
                break;
            case TG_LOG_WARN:
                syslog_priority = LOG_WARNING;
                break;
            case TG_LOG_ERROR:
                syslog_priority = LOG_ERR;
                break;
            case TG_LOG_FATAL:
                syslog_priority = LOG_CRIT;
                break;
            default:
                syslog_priority = LOG_INFO;
        }
        syslog(syslog_priority, "[%s] %s", g_logger->correlation_id, message);
    }
    
    g_logger->messages_logged++;
    pthread_mutex_unlock(&g_logger->log_mutex);
    
    /* For fatal errors, abort */
    if (level == TG_LOG_FATAL) {
        tg_logger_cleanup();
        abort();
    }
}

/* Set log level */
void tg_logger_set_level(int level)
{
    if (g_logger && level >= TG_LOG_TRACE && level <= TG_LOG_FATAL) {
        g_logger->log_level = level;
        tg_log(TG_LOG_INFO, "log level changed to %s", log_level_names[level]);
    }
}

/* Get current log level */
int tg_logger_get_level(void)
{
    return g_logger ? g_logger->log_level : TG_LOG_INFO;
}

/* Generate new correlation ID */
void tg_logger_generate_correlation_id(void)
{
    if (!g_logger) {
        return;
    }
    
    /* Generate UUID-like correlation ID */
    snprintf(g_logger->correlation_id, sizeof(g_logger->correlation_id),
             "%08x-%04x-%04x",
             (unsigned int)time(NULL),
             (unsigned int)(getpid() & 0xFFFF),
             (unsigned int)(rand() & 0xFFFF));
}

/* Set custom correlation ID */
void tg_logger_set_correlation_id(const char *correlation_id)
{
    if (g_logger && correlation_id) {
        strncpy(g_logger->correlation_id, correlation_id, 
                sizeof(g_logger->correlation_id) - 1);
        g_logger->correlation_id[sizeof(g_logger->correlation_id) - 1] = '\0';
    }
}

/* Get current correlation ID */
const char *tg_logger_get_correlation_id(void)
{
    return g_logger ? g_logger->correlation_id : "unknown";
}

/* Configure log rotation */
void tg_logger_set_rotation(size_t max_file_size, int max_files)
{
    if (g_logger) {
        g_logger->max_file_size = max_file_size;
        g_logger->max_files = max_files;
        tg_log(TG_LOG_DEBUG, "log rotation configured: max_size=%zu, max_files=%d",
               max_file_size, max_files);
    }
}

/* Check if log rotation is needed */
void tg_logger_check_rotation(void)
{
    struct stat file_stat;
    
    if (!g_logger || !g_logger->log_file || strlen(g_logger->log_path) == 0) {
        return;
    }
    
    /* Check current file size */
    if (fstat(fileno(g_logger->log_file), &file_stat) == 0) {
        if ((size_t)file_stat.st_size >= g_logger->max_file_size) {
            tg_logger_rotate_files();
        }
    }
}

/* Rotate log files */
void tg_logger_rotate_files(void)
{
    char old_path[300];
    char new_path[300];
    
    if (!g_logger || !g_logger->log_file) {
        return;
    }
    
    tg_log(TG_LOG_INFO, "rotating log files (current size: %llu bytes)", 
           g_logger->bytes_written);
    
    /* Close current file */
    fclose(g_logger->log_file);
    g_logger->log_file = NULL;
    
    /* Rotate existing files */
    for (int i = g_logger->max_files - 1; i > 0; i--) {
        snprintf(old_path, sizeof(old_path), "%s.%d", g_logger->log_path, i - 1);
        snprintf(new_path, sizeof(new_path), "%s.%d", g_logger->log_path, i);
        
        if (access(old_path, F_OK) == 0) {
            rename(old_path, new_path);
        }
    }
    
    /* Move current log to .0 */
    snprintf(new_path, sizeof(new_path), "%s.0", g_logger->log_path);
    rename(g_logger->log_path, new_path);
    
    /* Open new log file */
    g_logger->log_file = fopen(g_logger->log_path, "w");
    if (!g_logger->log_file) {
        fprintf(stderr, "[ERROR] Failed to create new log file: %s\n", 
                g_logger->log_path);
    } else {
        g_logger->bytes_written = 0;
        tg_log(TG_LOG_INFO, "log rotation completed");
    }
}

/* Get logging statistics */
void tg_logger_get_stats(struct tg_log_stats *stats)
{
    if (!g_logger || !stats) {
        return;
    }
    
    pthread_mutex_lock(&g_logger->log_mutex);
    
    stats->messages_logged = g_logger->messages_logged;
    stats->bytes_written = g_logger->bytes_written;
    stats->uptime_seconds = time(NULL) - g_logger->start_time;
    stats->current_level = g_logger->log_level;
    strncpy(stats->correlation_id, g_logger->correlation_id, 
            sizeof(stats->correlation_id) - 1);
    stats->correlation_id[sizeof(stats->correlation_id) - 1] = '\0';
    
    pthread_mutex_unlock(&g_logger->log_mutex);
}

/* Enable or disable console output */
void tg_logger_set_console_output(int enabled)
{
    if (g_logger) {
        g_logger->console_output = enabled;
        tg_log(TG_LOG_DEBUG, "console output %s", enabled ? "enabled" : "disabled");
    }
}

/* Log hexadecimal data */
void tg_log_hex(int level, const char *prefix, const void *data, size_t len)
{
    if (!g_logger || level < g_logger->log_level || !data || len == 0) {
        return;
    }
    
    const unsigned char *bytes = (const unsigned char *)data;
    char hex_buffer[1024];
    size_t pos = 0;
    
    /* Format hex data */
    for (size_t i = 0; i < len && pos < sizeof(hex_buffer) - 3; i++) {
        pos += snprintf(hex_buffer + pos, sizeof(hex_buffer) - pos, 
                       "%02x ", bytes[i]);
    }
    
    if (pos > 0) {
        hex_buffer[pos - 1] = '\0'; /* Remove trailing space */
    }
    
    tg_log(level, "%s [%zu bytes]: %s", prefix, len, hex_buffer);
}

/* Performance timer logging */
void tg_log_perf(const char *operation, uint64_t duration_us)
{
    if (duration_us < 1000) {
        tg_log(TG_LOG_DEBUG, "perf: %s completed in %llu μs", operation, duration_us);
    } else if (duration_us < 1000000) {
        tg_log(TG_LOG_DEBUG, "perf: %s completed in %.2f ms", 
               operation, duration_us / 1000.0);
    } else {
        tg_log(TG_LOG_DEBUG, "perf: %s completed in %.2f sec", 
               operation, duration_us / 1000000.0);
    }
}

/* Cleanup logging system */
void tg_logger_cleanup(void)
{
    if (!g_logger) {
        return;
    }
    
    tg_log(TG_LOG_INFO, "shutting down logger: %llu messages, %llu bytes written",
           g_logger->messages_logged, g_logger->bytes_written);
    
    /* Close log file */
    if (g_logger->log_file) {
        fclose(g_logger->log_file);
        g_logger->log_file = NULL;
    }
    
    /* Close syslog */
    if (g_logger->syslog_enabled) {
        closelog();
    }
    
    /* Destroy mutex */
    pthread_mutex_destroy(&g_logger->log_mutex);
    
    /* Free logger */
    flb_free(g_logger);
    g_logger = NULL;
}

/* Thread-local correlation ID support */
static __thread char thread_correlation_id[64] = {0};

void tg_logger_set_thread_correlation_id(const char *correlation_id)
{
    if (correlation_id) {
        strncpy(thread_correlation_id, correlation_id, sizeof(thread_correlation_id) - 1);
        thread_correlation_id[sizeof(thread_correlation_id) - 1] = '\0';
    } else {
        thread_correlation_id[0] = '\0';
    }
}

const char *tg_logger_get_thread_correlation_id(void)
{
    if (thread_correlation_id[0] != '\0') {
        return thread_correlation_id;
    }
    return tg_logger_get_correlation_id();
}