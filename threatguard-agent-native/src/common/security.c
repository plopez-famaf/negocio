/*  ThreatGuard Agent - Security Helpers
 *  Security utilities for input validation, sanitization, and cryptographic functions
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <ctype.h>

/* Input validation and sanitization */

/* Validate email address format */
int tg_security_validate_email(const char *email)
{
    const char *at_pos, *dot_pos;
    size_t len;
    
    if (!email) {
        return 0;
    }
    
    len = strlen(email);
    if (len < 5 || len > 254) { /* RFC 5321 limit */
        return 0;
    }
    
    /* Find @ symbol */
    at_pos = strchr(email, '@');
    if (!at_pos || at_pos == email || at_pos == email + len - 1) {
        return 0;
    }
    
    /* Find dot in domain part */
    dot_pos = strchr(at_pos + 1, '.');
    if (!dot_pos || dot_pos == at_pos + 1 || dot_pos == email + len - 1) {
        return 0;
    }
    
    /* Basic character validation */
    for (const char *p = email; *p; p++) {
        if (!isalnum(*p) && *p != '.' && *p != '-' && *p != '_' && *p != '@' && *p != '+') {
            return 0;
        }
    }
    
    return 1;
}

/* Validate hostname format */
int tg_security_validate_hostname(const char *hostname)
{
    size_t len;
    const char *p;
    
    if (!hostname) {
        return 0;
    }
    
    len = strlen(hostname);
    if (len == 0 || len > 253) { /* RFC 1035 limit */
        return 0;
    }
    
    /* Check for valid characters */
    for (p = hostname; *p; p++) {
        if (!isalnum(*p) && *p != '.' && *p != '-') {
            return 0;
        }
        
        /* Hyphen cannot be at the beginning or end of a label */
        if (*p == '-' && (p == hostname || *(p-1) == '.' || *(p+1) == '.' || *(p+1) == '\0')) {
            return 0;
        }
    }
    
    /* Cannot start or end with a dot */
    if (hostname[0] == '.' || hostname[len-1] == '.') {
        return 0;
    }
    
    return 1;
}

/* Validate IPv4 address format */
int tg_security_validate_ipv4(const char *ip)
{
    int octets[4];
    int count;
    
    if (!ip) {
        return 0;
    }
    
    count = sscanf(ip, "%d.%d.%d.%d", &octets[0], &octets[1], &octets[2], &octets[3]);
    if (count != 4) {
        return 0;
    }
    
    /* Validate each octet */
    for (int i = 0; i < 4; i++) {
        if (octets[i] < 0 || octets[i] > 255) {
            return 0;
        }
    }
    
    return 1;
}

/* Validate port number */
int tg_security_validate_port(int port)
{
    return (port > 0 && port <= 65535);
}

/* Sanitize string by removing dangerous characters */
char *tg_security_sanitize_string(const char *input, size_t max_len)
{
    char *output;
    size_t input_len, output_pos = 0;
    
    if (!input) {
        return NULL;
    }
    
    input_len = strlen(input);
    if (input_len > max_len) {
        input_len = max_len;
    }
    
    output = flb_malloc(input_len + 1);
    if (!output) {
        return NULL;
    }
    
    /* Remove or replace dangerous characters */
    for (size_t i = 0; i < input_len && output_pos < max_len; i++) {
        char c = input[i];
        
        /* Allow alphanumeric, spaces, and safe punctuation */
        if (isalnum(c) || c == ' ' || c == '.' || c == '-' || c == '_' || c == ':' || c == '/' || c == '@') {
            output[output_pos++] = c;
        } else if (iscntrl(c)) {
            /* Skip control characters */
            continue;
        } else {
            /* Replace other characters with underscore */
            output[output_pos++] = '_';
        }
    }
    
    output[output_pos] = '\0';
    return output;
}

/* Sanitize filename by removing path traversal attempts */
char *tg_security_sanitize_filename(const char *filename)
{
    char *sanitized;
    size_t len;
    char *p;
    
    if (!filename) {
        return NULL;
    }
    
    /* Remove path components */
    const char *basename = strrchr(filename, '/');
    if (basename) {
        basename++; /* Skip the slash */
    } else {
        basename = filename;
    }
    
    /* Also handle Windows paths */
    const char *winpath = strrchr(basename, '\\');
    if (winpath) {
        basename = winpath + 1;
    }
    
    len = strlen(basename);
    if (len == 0 || len > 255) {
        return NULL;
    }
    
    sanitized = flb_malloc(len + 1);
    if (!sanitized) {
        return NULL;
    }
    
    strcpy(sanitized, basename);
    
    /* Remove or replace dangerous characters */
    for (p = sanitized; *p; p++) {
        if (!isalnum(*p) && *p != '.' && *p != '-' && *p != '_') {
            *p = '_';
        }
    }
    
    /* Prevent dot-files and relative paths */
    if (sanitized[0] == '.') {
        sanitized[0] = '_';
    }
    
    return sanitized;
}

/* Check if string contains SQL injection patterns */
int tg_security_check_sql_injection(const char *input)
{
    const char *dangerous_patterns[] = {
        "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
        "UNION", "JOIN", "WHERE", "ORDER BY", "GROUP BY", "HAVING",
        "--", "/*", "*/", "xp_", "sp_", "@@", "@@version",
        "1=1", "1 = 1", "' OR '", "\" OR \"", "'; DROP", "\"; DROP",
        NULL
    };
    
    if (!input) {
        return 0;
    }
    
    /* Convert to uppercase for case-insensitive matching */
    char *upper_input = flb_strdup(input);
    if (!upper_input) {
        return 0;
    }
    tg_utils_string_to_upper(upper_input);
    
    /* Check for dangerous patterns */
    for (int i = 0; dangerous_patterns[i]; i++) {
        if (strstr(upper_input, dangerous_patterns[i])) {
            flb_free(upper_input);
            return 1; /* Potential SQL injection detected */
        }
    }
    
    flb_free(upper_input);
    return 0;
}

/* Check if string contains XSS patterns */
int tg_security_check_xss(const char *input)
{
    const char *dangerous_patterns[] = {
        "<script", "</script>", "javascript:", "onload=", "onerror=", "onclick=",
        "onmouseover=", "onfocus=", "onblur=", "onchange=", "onsubmit=",
        "<iframe", "<object", "<embed", "<link", "<meta", "<style",
        "vbscript:", "data:", "eval(", "expression(", "url(",
        NULL
    };
    
    if (!input) {
        return 0;
    }
    
    /* Convert to lowercase for case-insensitive matching */
    char *lower_input = flb_strdup(input);
    if (!lower_input) {
        return 0;
    }
    tg_utils_string_to_lower(lower_input);
    
    /* Check for dangerous patterns */
    for (int i = 0; dangerous_patterns[i]; i++) {
        if (strstr(lower_input, dangerous_patterns[i])) {
            flb_free(lower_input);
            return 1; /* Potential XSS detected */
        }
    }
    
    flb_free(lower_input);
    return 0;
}

/* Cryptographic functions */

/* Generate secure random bytes */
int tg_security_random_bytes(unsigned char *buffer, int num_bytes)
{
    if (!buffer || num_bytes <= 0) {
        return -1;
    }
    
    if (RAND_bytes(buffer, num_bytes) != 1) {
        tg_log(TG_LOG_ERROR, "failed to generate random bytes");
        return -1;
    }
    
    return 0;
}

/* Generate secure random string */
int tg_security_random_string(char *buffer, size_t length, int include_symbols)
{
    const char *charset;
    unsigned char *random_data;
    size_t charset_len;
    
    if (!buffer || length == 0) {
        return -1;
    }
    
    if (include_symbols) {
        charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    } else {
        charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    }
    charset_len = strlen(charset);
    
    random_data = flb_malloc(length);
    if (!random_data) {
        return -1;
    }
    
    if (tg_security_random_bytes(random_data, length) != 0) {
        flb_free(random_data);
        return -1;
    }
    
    for (size_t i = 0; i < length; i++) {
        buffer[i] = charset[random_data[i] % charset_len];
    }
    buffer[length] = '\0';
    
    flb_free(random_data);
    return 0;
}

/* Calculate SHA-256 hash */
int tg_security_sha256(const void *data, size_t data_len, unsigned char *hash)
{
    EVP_MD_CTX *ctx;
    const EVP_MD *md;
    unsigned int hash_len;
    
    if (!data || !hash || data_len == 0) {
        return -1;
    }
    
    md = EVP_sha256();
    ctx = EVP_MD_CTX_new();
    if (!ctx) {
        return -1;
    }
    
    if (EVP_DigestInit_ex(ctx, md, NULL) != 1 ||
        EVP_DigestUpdate(ctx, data, data_len) != 1 ||
        EVP_DigestFinal_ex(ctx, hash, &hash_len) != 1) {
        EVP_MD_CTX_free(ctx);
        return -1;
    }
    
    EVP_MD_CTX_free(ctx);
    return hash_len;
}

/* Calculate HMAC-SHA256 */
int tg_security_hmac_sha256(const void *data, size_t data_len,
                           const void *key, size_t key_len,
                           unsigned char *hmac)
{
    unsigned int hmac_len;
    
    if (!data || !key || !hmac || data_len == 0 || key_len == 0) {
        return -1;
    }
    
    if (!HMAC(EVP_sha256(), key, key_len, data, data_len, hmac, &hmac_len)) {
        return -1;
    }
    
    return hmac_len;
}

/* Constant-time memory comparison */
int tg_security_constant_time_memcmp(const void *a, const void *b, size_t len)
{
    const unsigned char *pa = (const unsigned char *)a;
    const unsigned char *pb = (const unsigned char *)b;
    unsigned char result = 0;
    
    if (!a || !b) {
        return -1;
    }
    
    for (size_t i = 0; i < len; i++) {
        result |= pa[i] ^ pb[i];
    }
    
    return result;
}

/* Secure memory clearing */
void tg_security_memzero(void *ptr, size_t len)
{
    if (!ptr || len == 0) {
        return;
    }
    
    /* Use OpenSSL's secure memory clearing */
    OPENSSL_cleanse(ptr, len);
}

/* Password strength validation */
int tg_security_validate_password_strength(const char *password)
{
    size_t len;
    int has_upper = 0, has_lower = 0, has_digit = 0, has_special = 0;
    int score = 0;
    
    if (!password) {
        return 0;
    }
    
    len = strlen(password);
    
    /* Length requirements */
    if (len < 8) {
        return 0; /* Too short */
    }
    if (len >= 12) {
        score += 2;
    } else if (len >= 10) {
        score += 1;
    }
    
    /* Character variety */
    for (const char *p = password; *p; p++) {
        if (isupper(*p)) has_upper = 1;
        else if (islower(*p)) has_lower = 1;
        else if (isdigit(*p)) has_digit = 1;
        else if (ispunct(*p)) has_special = 1;
    }
    
    score += has_upper + has_lower + has_digit + has_special;
    
    /* Check for common weak patterns */
    if (strstr(password, "123") || strstr(password, "abc") || 
        strstr(password, "password") || strstr(password, "admin")) {
        score -= 2;
    }
    
    /* Score interpretation: 0-3 weak, 4-6 medium, 7+ strong */
    return score;
}

/* Generate API key */
int tg_security_generate_api_key(char *api_key, size_t api_key_size)
{
    unsigned char random_bytes[32]; /* 256 bits */
    
    if (!api_key || api_key_size < 65) { /* 64 hex chars + null terminator */
        return -1;
    }
    
    if (tg_security_random_bytes(random_bytes, sizeof(random_bytes)) != 0) {
        return -1;
    }
    
    /* Convert to hexadecimal */
    for (int i = 0; i < 32; i++) {
        snprintf(api_key + (i * 2), 3, "%02x", random_bytes[i]);
    }
    
    return 0;
}

/* Verify API key format */
int tg_security_validate_api_key(const char *api_key)
{
    size_t len;
    
    if (!api_key) {
        return 0;
    }
    
    len = strlen(api_key);
    if (len != 64) { /* 256 bits as hex */
        return 0;
    }
    
    /* Check if all characters are hexadecimal */
    for (const char *p = api_key; *p; p++) {
        if (!isxdigit(*p)) {
            return 0;
        }
    }
    
    return 1;
}

/* Rate limiting structure */
struct tg_rate_limiter {
    time_t window_start;
    int window_size;    /* seconds */
    int max_requests;
    int current_count;
    char identifier[64];
};

/* Create rate limiter */
struct tg_rate_limiter *tg_security_rate_limiter_create(const char *identifier, 
                                                       int window_size, int max_requests)
{
    struct tg_rate_limiter *limiter;
    
    if (!identifier || window_size <= 0 || max_requests <= 0) {
        return NULL;
    }
    
    limiter = flb_calloc(1, sizeof(struct tg_rate_limiter));
    if (!limiter) {
        return NULL;
    }
    
    strncpy(limiter->identifier, identifier, sizeof(limiter->identifier) - 1);
    limiter->window_size = window_size;
    limiter->max_requests = max_requests;
    limiter->window_start = time(NULL);
    limiter->current_count = 0;
    
    return limiter;
}

/* Check rate limit */
int tg_security_rate_limiter_check(struct tg_rate_limiter *limiter)
{
    time_t current_time;
    
    if (!limiter) {
        return 0; /* Allow if no limiter */
    }
    
    current_time = time(NULL);
    
    /* Reset window if expired */
    if (current_time - limiter->window_start >= limiter->window_size) {
        limiter->window_start = current_time;
        limiter->current_count = 0;
    }
    
    /* Check if limit exceeded */
    if (limiter->current_count >= limiter->max_requests) {
        return 0; /* Rate limited */
    }
    
    limiter->current_count++;
    return 1; /* Allowed */
}

/* Destroy rate limiter */
void tg_security_rate_limiter_destroy(struct tg_rate_limiter *limiter)
{
    if (limiter) {
        flb_free(limiter);
    }
}

/* Security headers for HTTP responses */
void tg_security_add_headers(void *http_response)
{
    /* This would add security headers to HTTP responses */
    /* Implementation depends on the HTTP library being used */
    
    tg_log(TG_LOG_DEBUG, "adding security headers to HTTP response");
    
    /* Common security headers:
     * X-Content-Type-Options: nosniff
     * X-Frame-Options: DENY
     * X-XSS-Protection: 1; mode=block
     * Strict-Transport-Security: max-age=31536000
     * Content-Security-Policy: default-src 'self'
     * Referrer-Policy: strict-origin-when-cross-origin
     */
}

/* Log security event */
void tg_security_log_event(const char *event_type, const char *source, 
                          const char *details, int severity)
{
    char timestamp[32];
    uint64_t ts = tg_utils_get_timestamp_ms();
    
    tg_utils_format_timestamp(ts, timestamp, sizeof(timestamp));
    
    tg_log(severity, "SECURITY_EVENT: type=%s, source=%s, time=%s, details=%s",
           event_type ? event_type : "unknown",
           source ? source : "unknown", 
           timestamp,
           details ? details : "none");
}

/* Initialize security subsystem */
int tg_security_init(void)
{
    /* Initialize OpenSSL if not already done */
    if (RAND_status() != 1) {
        tg_log(TG_LOG_ERROR, "OpenSSL PRNG not properly seeded");
        return -1;
    }
    
    tg_log(TG_LOG_INFO, "security subsystem initialized");
    return 0;
}

/* Cleanup security subsystem */
void tg_security_cleanup(void)
{
    /* OpenSSL cleanup is handled by the main cleanup routine */
    tg_log(TG_LOG_DEBUG, "security subsystem cleaned up");
}