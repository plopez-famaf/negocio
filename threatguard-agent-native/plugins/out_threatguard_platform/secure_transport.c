/*  ThreatGuard Agent - Secure Transport Implementation
 *  TLS 1.3 secure communication with certificate validation
 *  Copyright (C) 2025 BG Threat AI
 */

#include "../../include/threatguard.h"
#include <openssl/ssl.h>
#include <openssl/err.h>
#include <openssl/x509v3.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>

/* TLS configuration structure */
struct tg_tls_config {
    SSL_CTX *ctx;
    SSL *ssl;
    int socket_fd;
    
    /* Certificate validation settings */
    int verify_certificates;
    int verify_hostname;
    char *ca_cert_path;
    char *client_cert_path;
    char *client_key_path;
    
    /* Security settings */
    char *cipher_suites;
    char *tls_version;
    int enable_sni;
    
    /* Connection state */
    int connected;
    time_t connect_time;
    uint64_t bytes_sent;
    uint64_t bytes_received;
};

/* Initialize secure transport system */
int tg_transport_init(struct tg_platform_ctx *ctx)
{
    if (!ctx) {
        tg_log(TG_LOG_ERROR, "platform context is NULL");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "initializing secure transport system");
    
    /* Initialize OpenSSL */
    SSL_library_init();
    SSL_load_error_strings();
    OpenSSL_add_all_algorithms();
    
    /* Create TLS configuration */
    ctx->tls_config = flb_calloc(1, sizeof(struct tg_tls_config));
    if (!ctx->tls_config) {
        tg_log(TG_LOG_ERROR, "failed to allocate TLS configuration");
        return -1;
    }
    
    struct tg_tls_config *tls = ctx->tls_config;
    
    /* Set default security settings */
    tls->verify_certificates = 1;
    tls->verify_hostname = 1;
    tls->cipher_suites = flb_strdup("TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256");
    tls->tls_version = flb_strdup("1.3");
    tls->enable_sni = 1;
    tls->socket_fd = -1;
    tls->connected = 0;
    
    /* Create SSL context */
    const SSL_METHOD *method = TLS_client_method();
    tls->ctx = SSL_CTX_new(method);
    if (!tls->ctx) {
        tg_log(TG_LOG_ERROR, "failed to create SSL context");
        tg_transport_cleanup_tls_config(tls);
        return -1;
    }
    
    /* Configure SSL context for maximum security */
    SSL_CTX_set_min_proto_version(tls->ctx, TLS1_3_VERSION);
    SSL_CTX_set_max_proto_version(tls->ctx, TLS1_3_VERSION);
    
    /* Set cipher suites */
    if (SSL_CTX_set_ciphersuites(tls->ctx, tls->cipher_suites) != 1) {
        tg_log(TG_LOG_WARN, "failed to set cipher suites, using defaults");
    }
    
    /* Configure certificate verification */
    if (tls->verify_certificates) {
        SSL_CTX_set_verify(tls->ctx, SSL_VERIFY_PEER, tg_transport_verify_certificate_callback);
        SSL_CTX_set_default_verify_paths(tls->ctx);
    } else {
        SSL_CTX_set_verify(tls->ctx, SSL_VERIFY_NONE, NULL);
    }
    
    /* Load CA certificates if specified */
    if (tls->ca_cert_path) {
        if (SSL_CTX_load_verify_locations(tls->ctx, tls->ca_cert_path, NULL) != 1) {
            tg_log(TG_LOG_ERROR, "failed to load CA certificates from %s", tls->ca_cert_path);
            tg_transport_cleanup_tls_config(tls);
            return -1;
        }
    }
    
    /* Load client certificate and key if specified */
    if (tls->client_cert_path && tls->client_key_path) {
        if (SSL_CTX_use_certificate_file(tls->ctx, tls->client_cert_path, SSL_FILETYPE_PEM) != 1) {
            tg_log(TG_LOG_ERROR, "failed to load client certificate from %s", tls->client_cert_path);
            tg_transport_cleanup_tls_config(tls);
            return -1;
        }
        
        if (SSL_CTX_use_PrivateKey_file(tls->ctx, tls->client_key_path, SSL_FILETYPE_PEM) != 1) {
            tg_log(TG_LOG_ERROR, "failed to load client key from %s", tls->client_key_path);
            tg_transport_cleanup_tls_config(tls);
            return -1;
        }
        
        /* Verify private key matches certificate */
        if (SSL_CTX_check_private_key(tls->ctx) != 1) {
            tg_log(TG_LOG_ERROR, "client certificate and private key do not match");
            tg_transport_cleanup_tls_config(tls);
            return -1;
        }
    }
    
    tg_log(TG_LOG_INFO, "secure transport system initialized with TLS %s", tls->tls_version);
    return 0;
}

/* Establish secure connection */
int tg_transport_connect(struct tg_platform_ctx *ctx)
{
    struct tg_tls_config *tls;
    struct sockaddr_in server_addr;
    struct hostent *server_host;
    int ret;
    
    if (!ctx || !ctx->tls_config) {
        tg_log(TG_LOG_ERROR, "invalid context for secure connection");
        return -1;
    }
    
    tls = ctx->tls_config;
    
    if (tls->connected) {
        tg_log(TG_LOG_DEBUG, "already connected to %s:%d", ctx->host, ctx->port);
        return 0;
    }
    
    tg_log(TG_LOG_DEBUG, "establishing secure connection to %s:%d", ctx->host, ctx->port);
    
    /* Create socket */
    tls->socket_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (tls->socket_fd < 0) {
        tg_log(TG_LOG_ERROR, "failed to create socket: %s", strerror(errno));
        return -1;
    }
    
    /* Set socket timeout */
    struct timeval timeout;
    timeout.tv_sec = ctx->timeout;
    timeout.tv_usec = 0;
    
    setsockopt(tls->socket_fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    setsockopt(tls->socket_fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
    
    /* Resolve hostname */
    server_host = gethostbyname(ctx->host);
    if (!server_host) {
        tg_log(TG_LOG_ERROR, "failed to resolve hostname: %s", ctx->host);
        close(tls->socket_fd);
        tls->socket_fd = -1;
        return -1;
    }
    
    /* Set up server address */
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(ctx->port);
    memcpy(&server_addr.sin_addr.s_addr, server_host->h_addr, server_host->h_length);
    
    /* Connect to server */
    ret = connect(tls->socket_fd, (struct sockaddr*)&server_addr, sizeof(server_addr));
    if (ret < 0) {
        tg_log(TG_LOG_ERROR, "failed to connect to %s:%d: %s", ctx->host, ctx->port, strerror(errno));
        close(tls->socket_fd);
        tls->socket_fd = -1;
        return -1;
    }
    
    /* Create SSL connection */
    tls->ssl = SSL_new(tls->ctx);
    if (!tls->ssl) {
        tg_log(TG_LOG_ERROR, "failed to create SSL connection");
        close(tls->socket_fd);
        tls->socket_fd = -1;
        return -1;
    }
    
    /* Set socket file descriptor */
    SSL_set_fd(tls->ssl, tls->socket_fd);
    
    /* Enable SNI if requested */
    if (tls->enable_sni) {
        SSL_set_tlsext_host_name(tls->ssl, ctx->host);
    }
    
    /* Perform SSL handshake */
    ret = SSL_connect(tls->ssl);
    if (ret != 1) {
        int ssl_error = SSL_get_error(tls->ssl, ret);
        char error_str[256];
        ERR_error_string_n(ERR_get_error(), error_str, sizeof(error_str));
        tg_log(TG_LOG_ERROR, "SSL handshake failed: %s (error %d)", error_str, ssl_error);
        
        SSL_free(tls->ssl);
        tls->ssl = NULL;
        close(tls->socket_fd);
        tls->socket_fd = -1;
        return -1;
    }
    
    /* Verify certificate if enabled */
    if (tls->verify_certificates) {
        ret = tg_transport_verify_peer_certificate(tls, ctx->host);
        if (ret != 0) {
            tg_log(TG_LOG_ERROR, "certificate verification failed");
            SSL_free(tls->ssl);
            tls->ssl = NULL;
            close(tls->socket_fd);
            tls->socket_fd = -1;
            return -1;
        }
    }
    
    /* Log connection details */
    const char *cipher = SSL_get_cipher(tls->ssl);
    const char *version = SSL_get_version(tls->ssl);
    
    tls->connected = 1;
    tls->connect_time = time(NULL);
    
    tg_log(TG_LOG_INFO, "secure connection established: %s with %s", version, cipher);
    return 0;
}

/* Send data over secure connection */
int tg_transport_send_batch(struct tg_platform_ctx *ctx, const char *data, size_t len)
{
    struct tg_tls_config *tls;
    int bytes_sent;
    int total_sent = 0;
    
    if (!ctx || !ctx->tls_config || !data || len == 0) {
        tg_log(TG_LOG_ERROR, "invalid parameters for secure send");
        return -1;
    }
    
    tls = ctx->tls_config;
    
    if (!tls->connected || !tls->ssl) {
        tg_log(TG_LOG_ERROR, "not connected to server");
        return -1;
    }
    
    tg_log(TG_LOG_DEBUG, "sending %zu bytes over secure connection", len);
    
    /* Send data in chunks if necessary */
    while (total_sent < len) {
        bytes_sent = SSL_write(tls->ssl, data + total_sent, len - total_sent);
        
        if (bytes_sent <= 0) {
            int ssl_error = SSL_get_error(tls->ssl, bytes_sent);
            
            if (ssl_error == SSL_ERROR_WANT_WRITE || ssl_error == SSL_ERROR_WANT_READ) {
                /* Non-blocking operation would block, retry */
                continue;
            } else {
                char error_str[256];
                ERR_error_string_n(ERR_get_error(), error_str, sizeof(error_str));
                tg_log(TG_LOG_ERROR, "SSL_write failed: %s (error %d)", error_str, ssl_error);
                return -1;
            }
        }
        
        total_sent += bytes_sent;
        tls->bytes_sent += bytes_sent;
    }
    
    tg_log(TG_LOG_DEBUG, "successfully sent %d bytes", total_sent);
    return total_sent;
}

/* Receive data over secure connection */
int tg_transport_receive_data(struct tg_platform_ctx *ctx, char *buffer, size_t buffer_size)
{
    struct tg_tls_config *tls;
    int bytes_received;
    
    if (!ctx || !ctx->tls_config || !buffer || buffer_size == 0) {
        return -1;
    }
    
    tls = ctx->tls_config;
    
    if (!tls->connected || !tls->ssl) {
        return -1;
    }
    
    bytes_received = SSL_read(tls->ssl, buffer, buffer_size);
    
    if (bytes_received <= 0) {
        int ssl_error = SSL_get_error(tls->ssl, bytes_received);
        
        if (ssl_error == SSL_ERROR_WANT_READ || ssl_error == SSL_ERROR_WANT_WRITE) {
            /* Non-blocking operation would block */
            return 0;
        } else if (ssl_error == SSL_ERROR_ZERO_RETURN) {
            /* Connection closed */
            tg_log(TG_LOG_INFO, "secure connection closed by peer");
            return 0;
        } else {
            char error_str[256];
            ERR_error_string_n(ERR_get_error(), error_str, sizeof(error_str));
            tg_log(TG_LOG_ERROR, "SSL_read failed: %s (error %d)", error_str, ssl_error);
            return -1;
        }
    }
    
    tls->bytes_received += bytes_received;
    return bytes_received;
}

/* Disconnect secure connection */
void tg_transport_disconnect(struct tg_platform_ctx *ctx)
{
    struct tg_tls_config *tls;
    
    if (!ctx || !ctx->tls_config) {
        return;
    }
    
    tls = ctx->tls_config;
    
    if (!tls->connected) {
        return;
    }
    
    tg_log(TG_LOG_DEBUG, "disconnecting secure connection");
    
    /* Shutdown SSL connection */
    if (tls->ssl) {
        SSL_shutdown(tls->ssl);
        SSL_free(tls->ssl);
        tls->ssl = NULL;
    }
    
    /* Close socket */
    if (tls->socket_fd >= 0) {
        close(tls->socket_fd);
        tls->socket_fd = -1;
    }
    
    tls->connected = 0;
    
    tg_log(TG_LOG_INFO, "secure connection disconnected (sent: %llu bytes, received: %llu bytes)",
           (unsigned long long)tls->bytes_sent, (unsigned long long)tls->bytes_received);
}

/* Certificate verification callback */
int tg_transport_verify_certificate_callback(int preverify_ok, X509_STORE_CTX *ctx)
{
    char subject_name[256];
    char issuer_name[256];
    X509 *cert;
    int depth;
    int err;
    
    cert = X509_STORE_CTX_get_current_cert(ctx);
    depth = X509_STORE_CTX_get_error_depth(ctx);
    err = X509_STORE_CTX_get_error(ctx);
    
    /* Get certificate subject and issuer */
    X509_NAME_oneline(X509_get_subject_name(cert), subject_name, sizeof(subject_name));
    X509_NAME_oneline(X509_get_issuer_name(cert), issuer_name, sizeof(issuer_name));
    
    if (!preverify_ok) {
        tg_log(TG_LOG_ERROR, "certificate verification failed at depth %d: %s", depth, X509_verify_cert_error_string(err));
        tg_log(TG_LOG_ERROR, "certificate subject: %s", subject_name);
        tg_log(TG_LOG_ERROR, "certificate issuer: %s", issuer_name);
        return 0;
    }
    
    tg_log(TG_LOG_DEBUG, "certificate verified at depth %d: %s", depth, subject_name);
    return 1;
}

/* Verify peer certificate */
int tg_transport_verify_peer_certificate(struct tg_tls_config *tls, const char *hostname)
{
    X509 *cert;
    char common_name[256];
    int verify_result;
    
    if (!tls || !tls->ssl || !hostname) {
        return -1;
    }
    
    /* Get peer certificate */
    cert = SSL_get_peer_certificate(tls->ssl);
    if (!cert) {
        tg_log(TG_LOG_ERROR, "no peer certificate presented");
        return -1;
    }
    
    /* Verify certificate chain */
    verify_result = SSL_get_verify_result(tls->ssl);
    if (verify_result != X509_V_OK) {
        tg_log(TG_LOG_ERROR, "certificate chain verification failed: %s",
               X509_verify_cert_error_string(verify_result));
        X509_free(cert);
        return -1;
    }
    
    /* Verify hostname if enabled */
    if (tls->verify_hostname) {
        /* Get common name from certificate */
        X509_NAME *subject = X509_get_subject_name(cert);
        X509_NAME_get_text_by_NID(subject, NID_commonName, common_name, sizeof(common_name));
        
        /* Simple hostname verification */
        if (strcmp(hostname, common_name) != 0) {
            tg_log(TG_LOG_ERROR, "hostname verification failed: expected %s, got %s",
                   hostname, common_name);
            X509_free(cert);
            return -1;
        }
        
        tg_log(TG_LOG_DEBUG, "hostname verification passed: %s", hostname);
    }
    
    tg_log(TG_LOG_DEBUG, "peer certificate verified successfully");
    X509_free(cert);
    return 0;
}

/* Get connection statistics */
void tg_transport_get_stats(struct tg_platform_ctx *ctx, char *buffer, size_t buffer_size)
{
    struct tg_tls_config *tls;
    
    if (!ctx || !ctx->tls_config || !buffer) {
        return;
    }
    
    tls = ctx->tls_config;
    
    snprintf(buffer, buffer_size,
             "TLS Connection: %s, Version: %s, Cipher: %s, Sent: %llu bytes, Received: %llu bytes, Uptime: %ld sec",
             tls->connected ? "connected" : "disconnected",
             tls->ssl ? SSL_get_version(tls->ssl) : "none",
             tls->ssl ? SSL_get_cipher(tls->ssl) : "none",
             (unsigned long long)tls->bytes_sent,
             (unsigned long long)tls->bytes_received,
             tls->connected ? (time(NULL) - tls->connect_time) : 0);
}

/* Cleanup TLS configuration */
void tg_transport_cleanup_tls_config(struct tg_tls_config *tls)
{
    if (!tls) {
        return;
    }
    
    if (tls->ssl) {
        SSL_free(tls->ssl);
    }
    
    if (tls->ctx) {
        SSL_CTX_free(tls->ctx);
    }
    
    if (tls->socket_fd >= 0) {
        close(tls->socket_fd);
    }
    
    if (tls->cipher_suites) {
        flb_free(tls->cipher_suites);
    }
    
    if (tls->tls_version) {
        flb_free(tls->tls_version);
    }
    
    if (tls->ca_cert_path) {
        flb_free(tls->ca_cert_path);
    }
    
    if (tls->client_cert_path) {
        flb_free(tls->client_cert_path);
    }
    
    if (tls->client_key_path) {
        flb_free(tls->client_key_path);
    }
    
    flb_free(tls);
}