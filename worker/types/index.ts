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
