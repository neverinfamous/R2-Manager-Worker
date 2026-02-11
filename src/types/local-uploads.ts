/**
 * Local Uploads Types for R2 Manager Frontend
 *
 * Types for managing R2 bucket local uploads setting.
 * Local uploads improve upload performance by writing object data
 * to storage infrastructure near the client.
 *
 * API endpoint: /accounts/{id}/r2/buckets/{name}/local-uploads
 */

/**
 * Local uploads status
 */
export interface LocalUploadsStatus {
  /** Whether local uploads is enabled for the bucket */
  enabled: boolean;
}

/**
 * API response for local uploads status
 */
export interface LocalUploadsResponse {
  success: boolean;
  result?: LocalUploadsStatus;
  error?: string;
}
