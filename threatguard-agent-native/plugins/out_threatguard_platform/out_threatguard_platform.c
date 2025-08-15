/*  ThreatGuard Agent - Platform Output Plugin
 *  Secure transmission to ThreatGuard platform with batching and compression
 *  Copyright (C) 2025 BG Threat AI
 */

#include <fluent-bit/flb_output.h>
#include <fluent-bit/flb_config.h>
#include <fluent-bit/flb_pack.h>
#include <fluent-bit/flb_log.h>
#include <fluent-bit/flb_mem.h>
#include <fluent-bit/flb_time.h>
#include <fluent-bit/flb_http_client.h>
#include <fluent-bit/flb_upstream.h>

#include "../../include/threatguard.h"

/* Default configuration values */
#define TG_DEFAULT_HOST           "api.bg-threat.com"
#define TG_DEFAULT_PORT           443
#define TG_DEFAULT_URI            "/api/agents/ingest"
#define TG_DEFAULT_BATCH_SIZE     1000
#define TG_DEFAULT_TIMEOUT        30
#define TG_DEFAULT_RETRY_LIMIT    3

/* Plugin configuration properties */
static struct flb_config_map config_map[] = {
    {
        FLB_CONFIG_MAP_STR, "host", TG_DEFAULT_HOST,
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, host),
        "ThreatGuard platform hostname"
    },
    {
        FLB_CONFIG_MAP_INT, "port", "443",
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, port),
        "ThreatGuard platform port"
    },
    {
        FLB_CONFIG_MAP_STR, "uri", TG_DEFAULT_URI,
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, uri),
        "ThreatGuard platform ingestion URI"
    },
    {
        FLB_CONFIG_MAP_STR, "api_key", NULL,
        0, FLB_FALSE, 0,
        "ThreatGuard platform API key"
    },
    {
        FLB_CONFIG_MAP_INT, "batch_size", "1000",
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, batch_size),
        "Maximum events per batch"
    },
    {
        FLB_CONFIG_MAP_INT, "timeout", "30",
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, timeout),
        "Network timeout in seconds"
    },
    {
        FLB_CONFIG_MAP_INT, "retry_limit", "3",
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, retry_limit),
        "Maximum retry attempts"
    },
    {
        FLB_CONFIG_MAP_BOOL, "compress", "true",
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, compress),
        "Enable gzip compression"
    },
    {
        FLB_CONFIG_MAP_BOOL, "tls_verify", "true",
        0, FLB_TRUE, offsetof(struct tg_platform_ctx, tls_verify),
        "Verify TLS certificates"
    },
    /* Sentinel */
    {0}
};

/* Extended platform context structure */
struct tg_platform_ctx {
    struct flb_output_instance *ins;
    struct flb_upstream *upstream;
    
    /* Configuration */
    char *host;
    int port;
    char *uri;
    char *api_key;
    int batch_size;
    int timeout;
    int retry_limit;
    int compress;
    int tls_verify;
    
    /* Connection state */
    int connected;
    time_t last_connect_attempt;
    int current_retry_count;
    
    /* Batching state */
    msgpack_sbuffer batch_buffer;
    int batch_count;
    time_t batch_start_time;
    int batch_max_wait_time;
    
    /* Statistics */
    uint64_t events_sent;
    uint64_t events_failed;
    uint64_t bytes_sent;
    uint64_t batches_sent;
    uint64_t connection_errors;
    uint64_t http_errors;
    
    /* Health monitoring */
    time_t last_success;
    time_t last_error;
    int consecutive_failures;
};

static int tg_platform_init(struct flb_output_instance *ins,
                           struct flb_config *config, void *data)
{
    struct tg_platform_ctx *ctx;
    const char *api_key;
    int ret;
    
    flb_plg_info(ins, "initializing ThreatGuard platform output v%s", TG_VERSION);
    
    /* Allocate plugin context */
    ctx = flb_calloc(1, sizeof(struct tg_platform_ctx));
    if (!ctx) {
        flb_plg_error(ins, "failed to allocate context");
        return -1;
    }
    
    ctx->ins = ins;
    
    /* Get API key */
    api_key = flb_output_get_property("api_key", ins);
    if (!api_key) {
        flb_plg_error(ins, "api_key is required but not provided");
        flb_free(ctx);
        return -1;
    }
    
    ctx->api_key = flb_strdup(api_key);
    if (!ctx->api_key) {
        flb_plg_error(ins, "failed to allocate API key");
        flb_free(ctx);
        return -1;
    }
    
    /* Initialize batching */
    msgpack_sbuffer_init(&ctx->batch_buffer);
    ctx->batch_count = 0;
    ctx->batch_start_time = 0;
    ctx->batch_max_wait_time = 30; /* 30 seconds max batch wait */
    
    /* Initialize connection state */
    ctx->connected = 0;
    ctx->last_connect_attempt = 0;
    ctx->current_retry_count = 0;
    
    /* Initialize statistics */
    ctx->events_sent = 0;
    ctx->events_failed = 0;
    ctx->bytes_sent = 0;
    ctx->batches_sent = 0;
    ctx->connection_errors = 0;
    ctx->http_errors = 0;
    ctx->last_success = 0;
    ctx->last_error = 0;
    ctx->consecutive_failures = 0;
    
    /* Create upstream connection */
    if (ctx->port == 443) {
        ctx->upstream = flb_upstream_create(config, ctx->host, ctx->port,
                                           FLB_IO_TLS, NULL);
    } else {
        ctx->upstream = flb_upstream_create(config, ctx->host, ctx->port,
                                           FLB_IO_TCP, NULL);
    }
    
    if (!ctx->upstream) {
        flb_plg_error(ins, "failed to create upstream connection to %s:%d",
                      ctx->host, ctx->port);
        flb_free(ctx->api_key);
        flb_free(ctx);
        return -1;
    }
    
    /* Configure TLS if enabled */
    if (ctx->port == 443) {
        ret = tg_platform_configure_tls(ctx);
        if (ret != 0) {
            flb_plg_error(ins, "failed to configure TLS");
            flb_upstream_destroy(ctx->upstream);
            flb_free(ctx->api_key);
            flb_free(ctx);
            return -1;
        }
    }
    
    /* Set plugin context */
    flb_output_set_context(ins, ctx);
    
    flb_plg_info(ins, "ThreatGuard platform output initialized: %s:%d%s",
                 ctx->host, ctx->port, ctx->uri);
    return 0;
}

static void tg_platform_flush(struct flb_event_chunk *event_chunk,
                             struct flb_output_flush *out_flush,
                             struct flb_input_instance *ins, void *out_context,
                             struct flb_config *config)
{
    struct tg_platform_ctx *ctx = out_context;
    const char *data = event_chunk->data;
    size_t bytes = event_chunk->size;
    msgpack_unpacked result;
    msgpack_object root;
    size_t off = 0;
    int events_processed = 0;
    int ret;
    
    if (!ctx) {
        FLB_OUTPUT_RETURN(FLB_ERROR);
    }
    
    flb_plg_debug(ctx->ins, "processing %zu bytes of data", bytes);
    
    /* Process incoming events */
    msgpack_unpacked_init(&result);
    
    while (msgpack_unpack_next(&result, data, bytes, &off) == MSGPACK_UNPACK_SUCCESS) {
        root = result.data;
        events_processed++;
        
        /* Add event to batch */
        ret = tg_platform_add_to_batch(ctx, &root);
        if (ret != 0) {
            flb_plg_error(ctx->ins, "failed to add event to batch");
            continue;
        }
        
        /* Check if batch is ready to send */
        if (tg_platform_should_flush_batch(ctx)) {
            ret = tg_platform_flush_batch(ctx);
            if (ret != 0) {
                flb_plg_error(ctx->ins, "failed to flush batch");
                ctx->events_failed += ctx->batch_count;
            } else {
                ctx->events_sent += ctx->batch_count;
                ctx->batches_sent++;
                ctx->last_success = time(NULL);
                ctx->consecutive_failures = 0;
            }
            
            /* Reset batch */
            tg_platform_reset_batch(ctx);
        }
    }
    
    msgpack_unpacked_destroy(&result);
    
    flb_plg_debug(ctx->ins, "processed %d events", events_processed);
    FLB_OUTPUT_RETURN(FLB_OK);
}

static int tg_platform_exit(void *data, struct flb_config *config)
{
    struct tg_platform_ctx *ctx = data;
    
    if (!ctx) {
        return 0;
    }
    
    flb_plg_info(ctx->ins, "shutting down ThreatGuard platform output");
    
    /* Flush remaining batch */
    if (ctx->batch_count > 0) {
        flb_plg_info(ctx->ins, "flushing final batch of %d events", ctx->batch_count);
        tg_platform_flush_batch(ctx);
    }
    
    /* Log final statistics */
    flb_plg_info(ctx->ins, "final stats: %llu events sent, %llu batches, %llu bytes",
                 (unsigned long long)ctx->events_sent,
                 (unsigned long long)ctx->batches_sent,
                 (unsigned long long)ctx->bytes_sent);
    
    /* Cleanup */
    if (ctx->upstream) {
        flb_upstream_destroy(ctx->upstream);
    }
    
    if (ctx->api_key) {
        flb_free(ctx->api_key);
    }
    
    msgpack_sbuffer_destroy(&ctx->batch_buffer);
    flb_free(ctx);
    
    return 0;
}

/* Configure TLS settings */
int tg_platform_configure_tls(struct tg_platform_ctx *ctx)
{
    if (!ctx || !ctx->upstream) {
        return -1;
    }
    
    /* Enable TLS verification if requested */
    if (ctx->tls_verify) {
        flb_upstream_set(ctx->upstream, FLB_IO_OPT_TLS_VERIFY, FLB_TRUE, 0);
        flb_upstream_set(ctx->upstream, FLB_IO_OPT_TLS_VERIFY_HOSTNAME, FLB_TRUE, 0);
    }
    
    /* Set TLS version */
    flb_upstream_set(ctx->upstream, FLB_IO_OPT_TLS_VERSION, "1.3", 0);
    
    /* Set cipher suites for security */
    flb_upstream_set(ctx->upstream, FLB_IO_OPT_TLS_CIPHERS, 
                     "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256", 0);
    
    flb_plg_debug(ctx->ins, "TLS configured: verify=%s, version=1.3",
                  ctx->tls_verify ? "enabled" : "disabled");
    
    return 0;
}

/* Add event to batch */
int tg_platform_add_to_batch(struct tg_platform_ctx *ctx, msgpack_object *event)
{
    if (!ctx || !event) {
        return -1;
    }
    
    /* Initialize batch if empty */
    if (ctx->batch_count == 0) {
        msgpack_sbuffer_clear(&ctx->batch_buffer);
        
        /* Start JSON array for batch */
        msgpack_packer packer;
        msgpack_packer_init(&packer, &ctx->batch_buffer, msgpack_sbuffer_write);
        msgpack_pack_array(&packer, ctx->batch_size);
        
        ctx->batch_start_time = time(NULL);
    }
    
    /* Add event to batch */
    msgpack_packer packer;
    msgpack_packer_init(&packer, &ctx->batch_buffer, msgpack_sbuffer_write);
    msgpack_pack_object(&packer, *event);
    
    ctx->batch_count++;
    
    return 0;
}

/* Check if batch should be flushed */
int tg_platform_should_flush_batch(struct tg_platform_ctx *ctx)
{
    if (!ctx || ctx->batch_count == 0) {
        return 0;
    }
    
    /* Flush if batch is full */
    if (ctx->batch_count >= ctx->batch_size) {
        return 1;
    }
    
    /* Flush if batch has been waiting too long */
    if (time(NULL) - ctx->batch_start_time >= ctx->batch_max_wait_time) {
        return 1;
    }
    
    return 0;
}

/* Flush current batch to platform */
int tg_platform_flush_batch(struct tg_platform_ctx *ctx)
{
    struct flb_http_client *client;
    struct flb_connection *connection;
    char *compressed_data = NULL;
    size_t compressed_size = 0;
    const char *data_to_send;
    size_t data_size;
    int ret;
    
    if (!ctx || ctx->batch_count == 0) {
        return -1;
    }
    
    flb_plg_debug(ctx->ins, "flushing batch of %d events (%zu bytes)",
                  ctx->batch_count, ctx->batch_buffer.size);
    
    /* Get upstream connection */
    connection = flb_upstream_conn_get(ctx->upstream);
    if (!connection) {
        flb_plg_error(ctx->ins, "failed to get upstream connection");
        ctx->connection_errors++;
        ctx->consecutive_failures++;
        ctx->last_error = time(NULL);
        return -1;
    }
    
    /* Prepare data for transmission */
    data_to_send = ctx->batch_buffer.data;
    data_size = ctx->batch_buffer.size;
    
    /* Compress data if enabled */
    if (ctx->compress) {
        ret = tg_platform_compress_data(ctx->batch_buffer.data, ctx->batch_buffer.size,
                                       &compressed_data, &compressed_size);
        if (ret == 0 && compressed_size < data_size) {
            data_to_send = compressed_data;
            data_size = compressed_size;
            flb_plg_debug(ctx->ins, "compressed %zu -> %zu bytes (%.1f%% reduction)",
                          ctx->batch_buffer.size, compressed_size,
                          ((double)(ctx->batch_buffer.size - compressed_size) / ctx->batch_buffer.size) * 100.0);
        }
    }
    
    /* Create HTTP client */
    client = flb_http_client(connection, FLB_HTTP_POST, ctx->uri,
                            data_to_send, data_size,
                            ctx->host, ctx->port, NULL, 0);
    
    if (!client) {
        flb_plg_error(ctx->ins, "failed to create HTTP client");
        flb_upstream_conn_release(connection);
        if (compressed_data) {
            flb_free(compressed_data);
        }
        return -1;
    }
    
    /* Set headers */
    flb_http_add_header(client, "User-Agent", 10, "ThreatGuard-Agent/2.0.1", 21);
    flb_http_add_header(client, "Content-Type", 12, "application/msgpack", 19);
    
    if (ctx->compress && compressed_data) {
        flb_http_add_header(client, "Content-Encoding", 16, "gzip", 4);
    }
    
    /* Add authentication */
    char auth_header[512];
    snprintf(auth_header, sizeof(auth_header), "Bearer %s", ctx->api_key);
    flb_http_add_header(client, "Authorization", 13, auth_header, strlen(auth_header));
    
    /* Add metadata headers */
    flb_http_add_header(client, "X-ThreatGuard-Agent-Version", 27, TG_VERSION, strlen(TG_VERSION));
    flb_http_add_header(client, "X-ThreatGuard-Batch-Size", 24, 
                        flb_utils_size_to_buffer(ctx->batch_count), 
                        strlen(flb_utils_size_to_buffer(ctx->batch_count)));
    
    /* Set timeout */
    flb_http_client_timeout(client, ctx->timeout);
    
    /* Send request */
    ret = flb_http_do(client, &connection);
    
    /* Process response */
    if (ret == 0) {
        if (client->resp.status == 200 || client->resp.status == 202) {
            /* Success */
            ctx->bytes_sent += data_size;
            flb_plg_debug(ctx->ins, "batch sent successfully: HTTP %d", client->resp.status);
        } else {
            /* HTTP error */
            flb_plg_error(ctx->ins, "HTTP error %d: %.*s", client->resp.status,
                          (int)client->resp.payload_size, client->resp.payload);
            ctx->http_errors++;
            ctx->consecutive_failures++;
            ctx->last_error = time(NULL);
            ret = -1;
        }
    } else {
        /* Network error */
        flb_plg_error(ctx->ins, "network error during batch transmission");
        ctx->connection_errors++;
        ctx->consecutive_failures++;
        ctx->last_error = time(NULL);
    }
    
    /* Cleanup */
    flb_http_client_destroy(client);
    flb_upstream_conn_release(connection);
    
    if (compressed_data) {
        flb_free(compressed_data);
    }
    
    return ret;
}

/* Reset batch state */
void tg_platform_reset_batch(struct tg_platform_ctx *ctx)
{
    if (!ctx) {
        return;
    }
    
    msgpack_sbuffer_clear(&ctx->batch_buffer);
    ctx->batch_count = 0;
    ctx->batch_start_time = 0;
}

/* Compress data using gzip */
int tg_platform_compress_data(const char *input, size_t input_size,
                             char **output, size_t *output_size)
{
    /* This would implement gzip compression */
    /* For now, return uncompressed data */
    *output = flb_malloc(input_size);
    if (!*output) {
        return -1;
    }
    
    memcpy(*output, input, input_size);
    *output_size = input_size;
    
    return 0;
}

/* Get health status */
int tg_platform_get_health_status(struct tg_platform_ctx *ctx, char *buffer, size_t buffer_size)
{
    if (!ctx || !buffer) {
        return -1;
    }
    
    const char *status;
    if (ctx->consecutive_failures == 0) {
        status = "healthy";
    } else if (ctx->consecutive_failures < 3) {
        status = "degraded";
    } else {
        status = "unhealthy";
    }
    
    snprintf(buffer, buffer_size,
             "Status: %s, Events: %llu sent, %llu failed, Batches: %llu, "
             "Bytes: %llu, Failures: %d consecutive",
             status,
             (unsigned long long)ctx->events_sent,
             (unsigned long long)ctx->events_failed,
             (unsigned long long)ctx->batches_sent,
             (unsigned long long)ctx->bytes_sent,
             ctx->consecutive_failures);
    
    return 0;
}

/* Plugin definition */
struct flb_output_plugin out_threatguard_platform_plugin = {
    .name         = "threatguard_platform",
    .description  = "ThreatGuard platform secure transmission with batching",
    .cb_init      = tg_platform_init,
    .cb_flush     = tg_platform_flush,
    .cb_exit      = tg_platform_exit,
    .config_map   = config_map,
    .flags        = FLB_OUTPUT_NET | FLB_IO_OPT_TLS
};

struct flb_output_plugin *tg_platform_plugin_register(void)
{
    return &out_threatguard_platform_plugin;
}