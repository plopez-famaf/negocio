/*  ThreatGuard Agent - Utility Functions
 *  Common utility functions for file operations, string handling, etc.
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"
#include <sys/stat.h>
#include <sys/time.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <ctype.h>

/* Check if a file exists */
int tg_utils_file_exists(const char *path)
{
    struct stat st;
    
    if (!path) {
        return 0;
    }
    
    return (stat(path, &st) == 0);
}

/* Check if a path is a directory */
int tg_utils_is_directory(const char *path)
{
    struct stat st;
    
    if (!path || stat(path, &st) != 0) {
        return 0;
    }
    
    return S_ISDIR(st.st_mode);
}

/* Create directory recursively */
int tg_utils_create_directory(const char *path)
{
    char tmp[256];
    char *p = NULL;
    size_t len;
    
    if (!path) {
        return -1;
    }
    
    snprintf(tmp, sizeof(tmp), "%s", path);
    len = strlen(tmp);
    
    if (tmp[len - 1] == '/') {
        tmp[len - 1] = '\0';
    }
    
    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = '\0';
            if (mkdir(tmp, 0755) != 0 && errno != EEXIST) {
                tg_log(TG_LOG_ERROR, "failed to create directory: %s", tmp);
                return -1;
            }
            *p = '/';
        }
    }
    
    if (mkdir(tmp, 0755) != 0 && errno != EEXIST) {
        tg_log(TG_LOG_ERROR, "failed to create directory: %s", tmp);
        return -1;
    }
    
    return 0;
}

/* Get file size */
long tg_utils_get_file_size(const char *path)
{
    struct stat st;
    
    if (!path || stat(path, &st) != 0) {
        return -1;
    }
    
    return st.st_size;
}

/* Read entire file into buffer */
char *tg_utils_read_file(const char *path, size_t *size)
{
    FILE *file;
    char *buffer;
    size_t file_size;
    size_t bytes_read;
    
    if (!path) {
        return NULL;
    }
    
    file = fopen(path, "rb");
    if (!file) {
        tg_log(TG_LOG_ERROR, "failed to open file: %s", path);
        return NULL;
    }
    
    /* Get file size */
    fseek(file, 0, SEEK_END);
    file_size = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    if (file_size == 0 || file_size > 100 * 1024 * 1024) { /* 100MB max */
        tg_log(TG_LOG_ERROR, "invalid file size: %zu", file_size);
        fclose(file);
        return NULL;
    }
    
    /* Allocate buffer */
    buffer = flb_malloc(file_size + 1);
    if (!buffer) {
        tg_log(TG_LOG_ERROR, "failed to allocate buffer for file: %zu bytes", file_size);
        fclose(file);
        return NULL;
    }
    
    /* Read file */
    bytes_read = fread(buffer, 1, file_size, file);
    buffer[bytes_read] = '\0';
    fclose(file);
    
    if (size) {
        *size = bytes_read;
    }
    
    return buffer;
}

/* Write buffer to file */
int tg_utils_write_file(const char *path, const void *data, size_t size)
{
    FILE *file;
    size_t bytes_written;
    
    if (!path || !data || size == 0) {
        return -1;
    }
    
    file = fopen(path, "wb");
    if (!file) {
        tg_log(TG_LOG_ERROR, "failed to open file for writing: %s", path);
        return -1;
    }
    
    bytes_written = fwrite(data, 1, size, file);
    fclose(file);
    
    if (bytes_written != size) {
        tg_log(TG_LOG_ERROR, "failed to write complete file: %zu/%zu bytes", 
               bytes_written, size);
        return -1;
    }
    
    return 0;
}

/* Get current timestamp in microseconds */
uint64_t tg_utils_get_timestamp_us(void)
{
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec * 1000000 + tv.tv_usec;
}

/* Get current timestamp in milliseconds */
uint64_t tg_utils_get_timestamp_ms(void)
{
    return tg_utils_get_timestamp_us() / 1000;
}

/* Format timestamp as ISO 8601 string */
void tg_utils_format_timestamp(uint64_t timestamp_ms, char *buffer, size_t buffer_size)
{
    time_t seconds = timestamp_ms / 1000;
    uint64_t milliseconds = timestamp_ms % 1000;
    struct tm *tm_info = gmtime(&seconds);
    
    if (!buffer || buffer_size < 25) {
        return;
    }
    
    strftime(buffer, buffer_size - 5, "%Y-%m-%dT%H:%M:%S", tm_info);
    snprintf(buffer + strlen(buffer), 5, ".%03lluZ", milliseconds);
}

/* Generate UUID-like string */
void tg_utils_generate_uuid(char *buffer, size_t buffer_size)
{
    if (!buffer || buffer_size < 37) {
        return;
    }
    
    snprintf(buffer, buffer_size,
             "%08x-%04x-%04x-%04x-%012llx",
             (unsigned int)rand(),
             (unsigned int)(rand() & 0xFFFF),
             (unsigned int)((rand() & 0x0FFF) | 0x4000), /* Version 4 */
             (unsigned int)((rand() & 0x3FFF) | 0x8000), /* Variant bits */
             (unsigned long long)tg_utils_get_timestamp_us());
}

/* Trim whitespace from string */
char *tg_utils_trim_string(char *str)
{
    char *end;
    
    if (!str) {
        return NULL;
    }
    
    /* Trim leading space */
    while (isspace((unsigned char)*str)) {
        str++;
    }
    
    if (*str == 0) {
        return str;
    }
    
    /* Trim trailing space */
    end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) {
        end--;
    }
    
    end[1] = '\0';
    return str;
}

/* Convert string to lowercase */
void tg_utils_string_to_lower(char *str)
{
    if (!str) {
        return;
    }
    
    for (int i = 0; str[i]; i++) {
        str[i] = tolower((unsigned char)str[i]);
    }
}

/* Convert string to uppercase */
void tg_utils_string_to_upper(char *str)
{
    if (!str) {
        return;
    }
    
    for (int i = 0; str[i]; i++) {
        str[i] = toupper((unsigned char)str[i]);
    }
}

/* Safe string copy */
size_t tg_utils_strlcpy(char *dst, const char *src, size_t size)
{
    size_t src_len;
    
    if (!dst || !src || size == 0) {
        return 0;
    }
    
    src_len = strlen(src);
    
    if (src_len < size) {
        memcpy(dst, src, src_len + 1);
    } else {
        memcpy(dst, src, size - 1);
        dst[size - 1] = '\0';
    }
    
    return src_len;
}

/* Safe string concatenation */
size_t tg_utils_strlcat(char *dst, const char *src, size_t size)
{
    size_t dst_len;
    size_t src_len;
    
    if (!dst || !src || size == 0) {
        return 0;
    }
    
    dst_len = strnlen(dst, size);
    src_len = strlen(src);
    
    if (dst_len == size) {
        return dst_len + src_len;
    }
    
    if (src_len < size - dst_len) {
        memcpy(dst + dst_len, src, src_len + 1);
    } else {
        memcpy(dst + dst_len, src, size - dst_len - 1);
        dst[size - 1] = '\0';
    }
    
    return dst_len + src_len;
}

/* Check if string starts with prefix */
int tg_utils_string_starts_with(const char *str, const char *prefix)
{
    if (!str || !prefix) {
        return 0;
    }
    
    return strncmp(str, prefix, strlen(prefix)) == 0;
}

/* Check if string ends with suffix */
int tg_utils_string_ends_with(const char *str, const char *suffix)
{
    size_t str_len, suffix_len;
    
    if (!str || !suffix) {
        return 0;
    }
    
    str_len = strlen(str);
    suffix_len = strlen(suffix);
    
    if (suffix_len > str_len) {
        return 0;
    }
    
    return strcmp(str + str_len - suffix_len, suffix) == 0;
}

/* Split string by delimiter */
int tg_utils_string_split(const char *str, char delimiter, char **tokens, int max_tokens)
{
    char *temp_str;
    char *token;
    int count = 0;
    
    if (!str || !tokens || max_tokens <= 0) {
        return 0;
    }
    
    temp_str = flb_strdup(str);
    if (!temp_str) {
        return 0;
    }
    
    token = strtok(temp_str, &delimiter);
    while (token && count < max_tokens) {
        tokens[count] = flb_strdup(token);
        if (!tokens[count]) {
            /* Free previously allocated tokens */
            for (int i = 0; i < count; i++) {
                flb_free(tokens[i]);
            }
            flb_free(temp_str);
            return 0;
        }
        count++;
        token = strtok(NULL, &delimiter);
    }
    
    flb_free(temp_str);
    return count;
}

/* Free string array */
void tg_utils_free_string_array(char **strings, int count)
{
    if (!strings) {
        return;
    }
    
    for (int i = 0; i < count; i++) {
        if (strings[i]) {
            flb_free(strings[i]);
        }
    }
}

/* Calculate simple hash of string */
uint32_t tg_utils_hash_string(const char *str)
{
    uint32_t hash = 5381;
    int c;
    
    if (!str) {
        return 0;
    }
    
    while ((c = *str++)) {
        hash = ((hash << 5) + hash) + c; /* hash * 33 + c */
    }
    
    return hash;
}

/* Format bytes as human readable string */
void tg_utils_format_bytes(uint64_t bytes, char *buffer, size_t buffer_size)
{
    const char *units[] = {"B", "KB", "MB", "GB", "TB"};
    double size = bytes;
    int unit_index = 0;
    
    if (!buffer || buffer_size < 16) {
        return;
    }
    
    while (size >= 1024.0 && unit_index < 4) {
        size /= 1024.0;
        unit_index++;
    }
    
    if (unit_index == 0) {
        snprintf(buffer, buffer_size, "%llu %s", bytes, units[unit_index]);
    } else {
        snprintf(buffer, buffer_size, "%.1f %s", size, units[unit_index]);
    }
}

/* Format duration as human readable string */
void tg_utils_format_duration(uint64_t seconds, char *buffer, size_t buffer_size)
{
    uint64_t days, hours, minutes;
    
    if (!buffer || buffer_size < 32) {
        return;
    }
    
    days = seconds / 86400;
    hours = (seconds % 86400) / 3600;
    minutes = (seconds % 3600) / 60;
    seconds = seconds % 60;
    
    if (days > 0) {
        snprintf(buffer, buffer_size, "%llud %lluh %llum %llus", days, hours, minutes, seconds);
    } else if (hours > 0) {
        snprintf(buffer, buffer_size, "%lluh %llum %llus", hours, minutes, seconds);
    } else if (minutes > 0) {
        snprintf(buffer, buffer_size, "%llum %llus", minutes, seconds);
    } else {
        snprintf(buffer, buffer_size, "%llus", seconds);
    }
}

/* Get process memory usage in KB */
long tg_utils_get_memory_usage(void)
{
    FILE *file;
    char line[256];
    long memory_kb = -1;
    
    file = fopen("/proc/self/status", "r");
    if (!file) {
        return -1;
    }
    
    while (fgets(line, sizeof(line), file)) {
        if (strncmp(line, "VmRSS:", 6) == 0) {
            sscanf(line, "VmRSS: %ld kB", &memory_kb);
            break;
        }
    }
    
    fclose(file);
    return memory_kb;
}

/* Get process CPU usage percentage */
double tg_utils_get_cpu_usage(void)
{
    static long last_total_time = 0;
    static long last_process_time = 0;
    static time_t last_check = 0;
    
    FILE *stat_file, *proc_file;
    char line[256];
    long total_time, process_time;
    time_t current_time;
    double cpu_percent = 0.0;
    
    current_time = time(NULL);
    
    /* Only check every second */
    if (current_time == last_check) {
        return -1.0;
    }
    
    /* Get system CPU time */
    stat_file = fopen("/proc/stat", "r");
    if (stat_file) {
        if (fgets(line, sizeof(line), stat_file)) {
            long user, nice, system, idle;
            sscanf(line, "cpu %ld %ld %ld %ld", &user, &nice, &system, &idle);
            total_time = user + nice + system + idle;
        }
        fclose(stat_file);
    }
    
    /* Get process CPU time */
    proc_file = fopen("/proc/self/stat", "r");
    if (proc_file) {
        if (fgets(line, sizeof(line), proc_file)) {
            long utime, stime;
            sscanf(line, "%*d %*s %*c %*d %*d %*d %*d %*d %*u %*u %*u %*u %*u %ld %ld", 
                   &utime, &stime);
            process_time = utime + stime;
        }
        fclose(proc_file);
    }
    
    /* Calculate CPU percentage */
    if (last_check > 0) {
        long total_delta = total_time - last_total_time;
        long process_delta = process_time - last_process_time;
        
        if (total_delta > 0) {
            cpu_percent = (double)process_delta / total_delta * 100.0;
        }
    }
    
    last_total_time = total_time;
    last_process_time = process_time;
    last_check = current_time;
    
    return cpu_percent;
}

/* Performance timer functions */
struct tg_perf_timer {
    uint64_t start_time;
    const char *name;
};

/* Start performance timer */
struct tg_perf_timer *tg_utils_perf_start(const char *name)
{
    struct tg_perf_timer *timer;
    
    timer = flb_malloc(sizeof(struct tg_perf_timer));
    if (!timer) {
        return NULL;
    }
    
    timer->start_time = tg_utils_get_timestamp_us();
    timer->name = name;
    
    return timer;
}

/* Stop performance timer and log result */
void tg_utils_perf_end(struct tg_perf_timer *timer)
{
    uint64_t end_time, duration;
    
    if (!timer) {
        return;
    }
    
    end_time = tg_utils_get_timestamp_us();
    duration = end_time - timer->start_time;
    
    tg_log_perf(timer->name, duration);
    flb_free(timer);
}

/* Base64 encoding */
static const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

int tg_utils_base64_encode(const unsigned char *input, size_t input_len, 
                          char *output, size_t output_len)
{
    size_t encoded_len;
    size_t i, j;
    
    if (!input || !output || input_len == 0) {
        return -1;
    }
    
    encoded_len = 4 * ((input_len + 2) / 3);
    if (encoded_len >= output_len) {
        return -1;
    }
    
    for (i = 0, j = 0; i < input_len;) {
        uint32_t octet_a = i < input_len ? input[i++] : 0;
        uint32_t octet_b = i < input_len ? input[i++] : 0;
        uint32_t octet_c = i < input_len ? input[i++] : 0;
        uint32_t triple = (octet_a << 0x10) + (octet_b << 0x08) + octet_c;
        
        output[j++] = base64_chars[(triple >> 3 * 6) & 0x3F];
        output[j++] = base64_chars[(triple >> 2 * 6) & 0x3F];
        output[j++] = base64_chars[(triple >> 1 * 6) & 0x3F];
        output[j++] = base64_chars[(triple >> 0 * 6) & 0x3F];
    }
    
    /* Add padding */
    for (i = 0; i < (3 - input_len % 3) % 3; i++) {
        output[encoded_len - 1 - i] = '=';
    }
    
    output[encoded_len] = '\0';
    return encoded_len;
}

/* Convert hex string to bytes */
int tg_utils_hex_to_bytes(const char *hex_string, unsigned char *bytes, size_t max_bytes)
{
    size_t hex_len;
    size_t byte_count = 0;
    
    if (!hex_string || !bytes || max_bytes == 0) {
        return -1;
    }
    
    hex_len = strlen(hex_string);
    if (hex_len % 2 != 0) {
        return -1; /* Hex string must have even length */
    }
    
    if (hex_len / 2 > max_bytes) {
        return -1; /* Not enough space in output buffer */
    }
    
    for (size_t i = 0; i < hex_len; i += 2) {
        char hex_byte[3] = {hex_string[i], hex_string[i + 1], '\0'};
        bytes[byte_count++] = (unsigned char)strtol(hex_byte, NULL, 16);
    }
    
    return byte_count;
}

/* Convert bytes to hex string */
void tg_utils_bytes_to_hex(const unsigned char *bytes, size_t byte_count, 
                          char *hex_string, size_t hex_string_size)
{
    if (!bytes || !hex_string || hex_string_size < (byte_count * 2 + 1)) {
        return;
    }
    
    for (size_t i = 0; i < byte_count; i++) {
        snprintf(hex_string + (i * 2), 3, "%02x", bytes[i]);
    }
}