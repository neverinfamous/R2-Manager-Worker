// Custom types for the worker - Cloudflare types are provided by @cloudflare/workers-types

export interface Env {
  R2: R2Bucket
  ASSETS: Fetcher
  CF_EMAIL: string
  API_KEY: string
  ACCOUNT_ID: string
  REGISTRATION_CODE: string
  URL_SIGNING_KEY: string
  TEAM_DOMAIN: string
  POLICY_AUD: string
  RATE_LIMITER_READ: RateLimit
  RATE_LIMITER_WRITE: RateLimit
  RATE_LIMITER_DELETE: RateLimit
  AI?: Ai
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
