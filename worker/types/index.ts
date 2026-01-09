// Custom types for the worker - Cloudflare types are provided by @cloudflare/workers-types

export interface Env {
  R2: R2Bucket
  ASSETS: Fetcher
  CF_EMAIL: string
  API_KEY: string
  ACCOUNT_ID: string
  REGISTRATION_CODE: string
  URL_SIGNING_KEY?: string  // Optional - auto-generated in local dev
  TEAM_DOMAIN: string
  POLICY_AUD: string
  RATE_LIMITER_READ: RateLimit
  RATE_LIMITER_WRITE: RateLimit
  RATE_LIMITER_DELETE: RateLimit
  AI?: Ai
  METADATA?: D1Database
}

export const CF_API = 'https://api.cloudflare.com/client/v4';

// API Response types for typed JSON parsing
export interface CloudflareApiResponse<T = unknown> {
  success: boolean;
  result?: T;
  result_info?: {
    cursor?: string;
    is_truncated?: boolean;
    delimited?: string[];
  };
  errors?: { message: string; code?: number }[];
}

export interface BucketInfo {
  name: string;
  creation_date?: string;
  size?: number;
  objectCount?: number;
}

export interface BucketsListResult {
  buckets: BucketInfo[];
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  uploaded: string;
  etag?: string;
  httpEtag?: string;
  version?: string;
  checksums?: Record<string, string>;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

export interface CreateBucketBody {
  name: string;
}

export interface RenameBucketBody {
  newName: string;
}

export interface TransferBody {
  destinationBucket: string;
  destinationPath?: string;
}

export interface RenameFileBody {
  newKey: string;
}

export interface RenameFolderBody {
  oldPath: string;
  newPath: string;
}

export interface CreateFolderBody {
  folderName: string;
}

export interface BatchDeleteBody {
  files: string[];
}

// AI Search Types
export interface AISearchInstance {
  name: string;
  description?: string;
  created_at?: string;
  modified_at?: string;
  status?: 'active' | 'indexing' | 'paused' | 'error';
  data_source?: {
    type: 'r2' | 'website';
    bucket_name?: string;
    domain?: string;
  };
  vectorize_index?: string;
  embedding_model?: string;
  generation_model?: string;
}

export interface AISearchInstancesListResult {
  rags: AISearchInstance[];
}

export interface AISearchCompatibility {
  bucketName: string;
  totalFiles: number;
  indexableFiles: number;
  nonIndexableFiles: number;
  totalSize: number;
  indexableSize: number;
  files: {
    indexable: AISearchFileInfo[];
    nonIndexable: AISearchFileInfo[];
  };
  supportedExtensions: string[];
}

export interface AISearchFileInfo {
  key: string;
  size: number;
  extension: string;
  reason?: string;
}

export interface AISearchQueryRequest {
  query: string;
  rewrite_query?: boolean;
  max_num_results?: number;
  score_threshold?: number;
  reranking?: {
    enabled: boolean;
    model?: string;
  };
  stream?: boolean;
}

export interface AISearchResult {
  file_id: string;
  filename: string;
  score: number;
  attributes?: {
    modified_date?: number;
    folder?: string;
  };
  content: {
    id: string;
    type: string;
    text: string;
  }[];
}

// ============================================
// R2 Metrics Types (GraphQL Analytics API)
// ============================================

/**
 * Time range for metrics queries
 */
export type MetricsTimeRange = '24h' | '7d' | '30d';

/**
 * Raw metrics data point from GraphQL API
 */
export interface MetricsDataPoint {
  date: string;
  bucketName: string;
  readOperations: number;
  writeOperations: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  classAOperations: number;
  classBOperations: number;
}

/**
 * Storage metrics from GraphQL API
 */
export interface StorageDataPoint {
  date: string;
  bucketName: string;
  storageBytes: number;
}

/**
 * Aggregated metrics for a bucket
 */
export interface BucketMetricsSummary {
  bucketName: string;
  totalReadOperations: number;
  totalWriteOperations: number;
  totalBytesUploaded: number;
  totalBytesDownloaded: number;
  classAOperations: number;
  classBOperations: number;
  currentStorageBytes?: number | undefined;
}

/**
 * Account-wide metrics summary
 */
export interface MetricsSummary {
  timeRange: MetricsTimeRange;
  startDate: string;
  endDate: string;
  totalReadOperations: number;
  totalWriteOperations: number;
  totalBytesUploaded: number;
  totalBytesDownloaded: number;
  totalStorageBytes: number;
  bucketCount: number;
}

/**
 * Full metrics response
 */
export interface MetricsResponse {
  summary: MetricsSummary;
  byBucket: BucketMetricsSummary[];
  timeSeries: MetricsDataPoint[];
  storageSeries: StorageDataPoint[];
}

/**
 * GraphQL API response structure
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: {
    message: string;
    path?: string[];
    extensions?: Record<string, unknown>;
  }[];
}

/**
 * R2 Analytics GraphQL query result
 */
export interface R2AnalyticsResult {
  viewer: {
    accounts: {
      r2OperationsAdaptiveGroups?: {
        sum: {
          requests: number;
        };
        dimensions: {
          date: string;
          bucketName: string;
          actionType: string;
        };
      }[];
      r2StorageAdaptiveGroups?: {
        max: {
          metadataSize: number;
          payloadSize: number;
        };
        dimensions: {
          date: string;
          bucketName: string;
        };
      }[];
    }[];
  };
}


export interface AISearchResponse {
  response?: string;
  data: AISearchResult[];
  has_more: boolean;
  next_page: string | null;
}

export interface CreateAISearchBody {
  name: string;
  bucketName: string;
  description?: string;
  embeddingModel?: string;
  generationModel?: string;
}

export interface AISearchSyncResponse {
  success: boolean;
  message?: string;
  job_id?: string;
}

// Job History Types
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type JobOperationType =
  | 'bulk_upload'
  | 'bulk_download'
  | 'bulk_delete'
  | 'bucket_delete'
  | 'file_move'
  | 'file_copy'
  | 'folder_move'
  | 'folder_copy'
  | 'ai_search_sync';

export interface BulkJob {
  job_id: string;
  bucket_name: string;
  operation_type: JobOperationType;
  status: JobStatus;
  total_items: number | null;
  processed_items: number | null;
  error_count: number | null;
  percentage: number;
  started_at: string;
  completed_at: string | null;
  user_email: string;
  metadata: string | null;
}

export interface JobAuditEvent {
  id: number;
  job_id: string;
  event_type: string;
  user_email: string;
  timestamp: string;
  details: string | null;
}

export interface JobListResponse {
  jobs: BulkJob[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobEventsResponse {
  job_id: string;
  events: JobAuditEvent[];
}

export interface CreateJobParams {
  jobId: string;
  bucketName: string;
  operationType: JobOperationType;
  totalItems?: number;
  userEmail: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateJobProgressParams {
  jobId: string;
  processedItems: number;
  totalItems?: number;
  errorCount?: number;
}

export interface CompleteJobParams {
  jobId: string;
  status: 'completed' | 'failed' | 'cancelled';
  processedItems?: number;
  errorCount?: number;
  userEmail: string;
  errorMessage?: string;
}

export interface LogJobEventParams {
  jobId: string;
  eventType: string;
  userEmail: string;
  details?: Record<string, unknown>;
}

// Audit Log Types - for tracking individual user actions
export type AuditOperationType =
  | 'file_upload'
  | 'file_download'
  | 'file_delete'
  | 'file_rename'
  | 'file_move'
  | 'file_copy'
  | 'bucket_create'
  | 'bucket_delete'
  | 'bucket_rename'
  | 'folder_create'
  | 'folder_delete'
  | 'folder_rename'
  | 'folder_move'
  | 'folder_copy';

export type AuditStatus = 'success' | 'failed';

export interface AuditLogEntry {
  id: number;
  operation_type: AuditOperationType;
  bucket_name: string | null;
  object_key: string | null;
  user_email: string;
  status: AuditStatus;
  timestamp: string;
  metadata: string | null;
  size_bytes: number | null;
  destination_bucket: string | null;
  destination_key: string | null;
}

export interface LogAuditEventParams {
  operationType: AuditOperationType;
  bucketName?: string | undefined;
  objectKey?: string | undefined;
  userEmail: string;
  status?: AuditStatus | undefined;
  metadata?: Record<string, unknown> | undefined;
  sizeBytes?: number | undefined;
  destinationBucket?: string | undefined;
  destinationKey?: string | undefined;
}

export interface AuditLogListResponse {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogSummary {
  operation_type: AuditOperationType;
  count: number;
  success_count: number;
  failed_count: number;
}

// S3 Import Types (Super Slurper)
export type S3ImportJobStatus = 'pending' | 'running' | 'complete' | 'error' | 'aborted';

export type S3ImportProvider = 'aws' | 'gcs' | 's3_compatible';

export interface S3ImportJobProgress {
  objects_copied: number;
  objects_skipped: number;
  objects_failed: number;
  bytes_copied: number;
}

export interface S3ImportJob {
  id: string;
  source: {
    provider: S3ImportProvider;
    bucket: string;
    region?: string | undefined;
    endpoint?: string | undefined;
    prefix?: string | undefined;
  };
  destination: {
    bucket: string;
  };
  status: S3ImportJobStatus;
  progress?: S3ImportJobProgress | undefined;
  overwrite_objects?: boolean | undefined;
  created_at: string;
  completed_at?: string | undefined;
  error?: string | undefined;
}

export interface CreateS3ImportJobBody {
  sourceBucketName: string;
  sourceAccessKeyId: string;
  sourceSecretAccessKey: string;
  sourceRegion?: string;
  sourceEndpoint?: string;
  sourceProvider?: S3ImportProvider;
  destinationBucketName: string;
  bucketSubpath?: string;
  overwriteExisting?: boolean;
}

export interface S3ImportJobsListResponse {
  jobs: S3ImportJob[];
  has_more?: boolean;
}

export interface S3ImportJobResponse {
  success: boolean;
  job?: S3ImportJob;
  error?: string;
  dashboardUrl?: string;
}

// ============================================
// Webhook Types
// ============================================

/**
 * Webhook event types for R2 operations
 */
export type WebhookEventType =
  | 'file_upload'
  | 'file_download'
  | 'file_delete'
  | 'file_move'
  | 'file_copy'
  | 'file_rename'
  | 'bucket_create'
  | 'bucket_delete'
  | 'bucket_rename'
  | 'folder_create'
  | 'folder_delete'
  | 'bulk_download_complete'
  | 's3_import_complete'
  | 'job_failed'
  | 'job_completed';

/**
 * Webhook configuration stored in database
 */
export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string; // JSON array of WebhookEventType
  enabled: number; // SQLite boolean (0 or 1)
  created_at: string;
  updated_at: string;
}

/**
 * Webhook create/update request body
 */
export interface WebhookInput {
  name: string;
  url: string;
  secret?: string | null;
  events: WebhookEventType[];
  enabled?: boolean;
}

/**
 * Webhook test result
 */
export interface WebhookTestResult {
  success: boolean;
  message: string;
  statusCode?: number;
  error?: string;
}

/**
 * Webhook payload sent to endpoints
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Result from sending a webhook
 */
export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * API response types
 */
export interface WebhooksResponse {
  webhooks: Webhook[];
}

export interface WebhookResponse {
  webhook: Webhook;
}

// ============================================
// Error Logging Types
// ============================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Context for structured error logging
 */
export interface ErrorContext {
  module: string;          // e.g., 'buckets', 'files', 'jobs'
  operation: string;       // e.g., 'create', 'delete', 'upload'
  entityId?: string;       // e.g., bucket name, file key, job ID
  bucketName?: string;
  fileName?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Structured error for logging and webhook payloads
 */
export interface StructuredError {
  timestamp: string;
  level: ErrorSeverity;
  code: string;            // e.g., 'BKT_CREATE_FAILED', 'FILE_UPLOAD_FAILED'
  message: string;
  context: ErrorContext;
  stack?: string | undefined;
}