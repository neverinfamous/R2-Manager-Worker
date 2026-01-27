import type {
  Env,
  CloudflareApiResponse,
  S3ImportJob,
  S3ImportJobsListResponse,
  CreateS3ImportJobBody,
  S3ImportJobResponse,
} from "../types";
import { CF_API } from "../types";
import { type CorsHeaders } from "../utils/cors";
import { getCloudflareHeaders } from "../utils/helpers";
import { logInfo, logError, logWarning } from "../utils/error-logger";
import { SUPPORT_EMAIL } from "../utils/error-response";

// Cloudflare Super Slurper API response types
interface SlurperJobApiResponse {
  id: string;
  source: {
    provider: string;
    bucket: string;
    region?: string;
    endpoint?: string;
    prefix?: string;
  };
  destination: {
    bucket: string;
  };
  status: string;
  progress?: {
    objects_copied: number;
    objects_skipped: number;
    objects_failed: number;
    bytes_copied: number;
  };
  overwrite_objects?: boolean;
  created: string;
  finished?: string;
  error?: string;
}

interface SlurperJobsListApiResponse {
  jobs: SlurperJobApiResponse[];
  cursor?: string;
}

function mapProviderToType(provider: string): "aws" | "gcs" | "s3_compatible" {
  if (
    provider === "aws" ||
    provider === "gcs" ||
    provider === "s3_compatible"
  ) {
    return provider;
  }
  return "aws"; // Default fallback
}

function mapStatusToType(
  status: string,
): "pending" | "running" | "complete" | "error" | "aborted" {
  if (
    status === "pending" ||
    status === "running" ||
    status === "complete" ||
    status === "error" ||
    status === "aborted"
  ) {
    return status;
  }
  return "pending"; // Default fallback
}

function mapApiJobToS3ImportJob(apiJob: SlurperJobApiResponse): S3ImportJob {
  return {
    id: apiJob.id,
    source: {
      provider: mapProviderToType(apiJob.source.provider),
      bucket: apiJob.source.bucket,
      region: apiJob.source.region,
      endpoint: apiJob.source.endpoint,
      prefix: apiJob.source.prefix,
    },
    destination: {
      bucket: apiJob.destination.bucket,
    },
    status: mapStatusToType(apiJob.status),
    progress: apiJob.progress,
    overwrite_objects: apiJob.overwrite_objects,
    created_at: apiJob.created,
    completed_at: apiJob.finished,
    error: apiJob.error,
  };
}

// S3 Import Error Codes
const S3_ERROR_CODES = {
  LIST_FAILED: "S3_LIST_JOBS_FAILED",
  CREATE_FAILED: "S3_CREATE_JOB_FAILED",
  GET_STATUS_FAILED: "S3_GET_STATUS_FAILED",
  ABORT_FAILED: "S3_ABORT_JOB_FAILED",
  RATE_LIMITED: "S3_RATE_LIMITED",
} as const;

/**
 * Delay helper for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry and exponential backoff for rate limits (429/503/504)
 * Retry pattern: 2s → 4s → 8s (max 3 attempts)
 */
async function fetchWithRetryBackend(
  url: string,
  options: RequestInit,
  env: Env,
  isLocalDev: boolean,
  context: { operation: string; code: string },
): Promise<Response> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;

      // Check for retryable status codes
      if (
        response.status === 429 ||
        response.status === 503 ||
        response.status === 504
      ) {
        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 8000);

          // Get Retry-After header if available
          const retryAfter = response.headers.get("Retry-After");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : backoffMs;

          logWarning(
            `[${S3_ERROR_CODES.RATE_LIMITED}] Rate limited (${response.status}), retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})`,
            {
              module: "s3-import",
              operation: context.operation,
            },
          );

          await delay(waitMs);
          continue;
        }
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
        logWarning(
          `[${context.code}] Network error, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`,
          {
            module: "s3-import",
            operation: context.operation,
          },
        );
        await delay(backoffMs);
        continue;
      }
    }
  }

  // If we have a response, return it even if it failed
  if (lastResponse) {
    return lastResponse;
  }

  // Log and throw the last error
  await logError(
    env,
    lastError ?? new Error("Request failed after retries"),
    {
      module: "s3-import",
      operation: context.operation,
    },
    isLocalDev,
  );

  throw lastError ?? new Error("Request failed after retries");
}

export async function handleS3ImportRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  logInfo("Handling S3 Import operation", {
    module: "s3-import",
    operation: "handle_request",
  });

  const cfHeaders = getCloudflareHeaders(env);

  const dashboardUrl = `https://dash.cloudflare.com/?to=/:account/r2/slurper`;

  try {
    // POST /api/s3-import/jobs - Create a new migration job
    if (request.method === "POST" && url.pathname === "/api/s3-import/jobs") {
      const body = (await request.json()) as CreateS3ImportJobBody;
      logInfo(
        `Creating migration job for source bucket: ${body.sourceBucketName}`,
        {
          module: "s3-import",
          operation: "create_job",
          bucketName: body.sourceBucketName,
        },
      );

      // Validate required fields
      if (
        !body.sourceBucketName ||
        !body.sourceAccessKeyId ||
        !body.sourceSecretAccessKey ||
        !body.destinationBucketName
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Missing required fields: sourceBucketName, sourceAccessKeyId, sourceSecretAccessKey, destinationBucketName",
            support: SUPPORT_EMAIL,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      if (isLocalDev) {
        // Return mock data for local development
        const mockJob: S3ImportJob = {
          id: "mock-job-" + Date.now(),
          source: {
            provider: body.sourceProvider ?? "aws",
            bucket: body.sourceBucketName,
            region: body.sourceRegion ?? "us-east-1",
            prefix: body.bucketSubpath,
          },
          destination: {
            bucket: body.destinationBucketName,
          },
          status: "pending",
          progress: {
            objects_copied: 0,
            objects_skipped: 0,
            objects_failed: 0,
            bytes_copied: 0,
          },
          overwrite_objects: body.overwriteExisting ?? false,
          created_at: new Date().toISOString(),
        };
        return new Response(
          JSON.stringify({
            success: true,
            job: mockJob,
          } as S3ImportJobResponse),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // Create job via Cloudflare Super Slurper API
      try {
        const response = await fetchWithRetryBackend(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/slurper/jobs`,
          {
            method: "POST",
            headers: cfHeaders,
            body: JSON.stringify({
              source: {
                provider: body.sourceProvider ?? "aws",
                bucket: body.sourceBucketName,
                access_key_id: body.sourceAccessKeyId,
                secret_access_key: body.sourceSecretAccessKey,
                region: body.sourceRegion ?? "us-east-1",
                endpoint: body.sourceEndpoint,
                prefix: body.bucketSubpath,
              },
              destination: {
                bucket: body.destinationBucketName,
              },
              overwrite_objects: body.overwriteExisting ?? false,
            }),
          },
          env,
          isLocalDev,
          { operation: "create_job", code: S3_ERROR_CODES.CREATE_FAILED },
        );

        if (!response.ok) {
          const errorText = await response.text();
          await logError(
            env,
            new Error(`Failed to create job: ${response.status} ${errorText}`),
            { module: "s3-import", operation: "create_job" },
            isLocalDev,
          );
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Failed to create migration job. Try using Cloudflare Dashboard instead.",
              dashboardUrl,
              support: SUPPORT_EMAIL,
            } as S3ImportJobResponse),
            {
              status: response.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const data =
          (await response.json()) as CloudflareApiResponse<SlurperJobApiResponse>;
        if (data.result) {
          return new Response(
            JSON.stringify({
              success: true,
              job: mapApiJobToS3ImportJob(data.result),
            } as S3ImportJobResponse),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: "Unexpected API response",
            dashboardUrl,
            support: SUPPORT_EMAIL,
          } as S3ImportJobResponse),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "s3-import", operation: "create_job" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create migration job",
            dashboardUrl,
            support: SUPPORT_EMAIL,
          } as S3ImportJobResponse),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // GET /api/s3-import/jobs - List all migration jobs
    if (request.method === "GET" && url.pathname === "/api/s3-import/jobs") {
      logInfo("Listing migration jobs", {
        module: "s3-import",
        operation: "list_jobs",
      });

      if (isLocalDev) {
        // Return mock data for local development
        const mockJobs: S3ImportJob[] = [
          {
            id: "mock-job-running",
            source: {
              provider: "aws",
              bucket: "my-s3-bucket",
              region: "us-east-1",
            },
            destination: { bucket: "my-r2-bucket" },
            status: "running",
            progress: {
              objects_copied: 150,
              objects_skipped: 5,
              objects_failed: 2,
              bytes_copied: 52428800,
            },
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "mock-job-complete",
            source: {
              provider: "aws",
              bucket: "old-bucket",
              region: "eu-west-1",
            },
            destination: { bucket: "new-r2-bucket" },
            status: "complete",
            progress: {
              objects_copied: 1000,
              objects_skipped: 0,
              objects_failed: 0,
              bytes_copied: 1073741824,
            },
            created_at: new Date(Date.now() - 86400000).toISOString(),
            completed_at: new Date(Date.now() - 82800000).toISOString(),
          },
        ];
        return new Response(
          JSON.stringify({ jobs: mockJobs } as S3ImportJobsListResponse),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      try {
        const response = await fetchWithRetryBackend(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/slurper/jobs`,
          { headers: cfHeaders },
          env,
          isLocalDev,
          { operation: "list_jobs", code: S3_ERROR_CODES.LIST_FAILED },
        );

        if (!response.ok) {
          logWarning(`Failed to list jobs: ${response.status}`, {
            module: "s3-import",
            operation: "list_jobs",
          });
          return new Response(
            JSON.stringify({
              jobs: [],
              error:
                "Failed to fetch migration jobs. Check Cloudflare Dashboard.",
              dashboardUrl,
              support: SUPPORT_EMAIL,
            }),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const data =
          (await response.json()) as CloudflareApiResponse<SlurperJobsListApiResponse>;
        const jobs = (data.result?.jobs ?? []).map(mapApiJobToS3ImportJob);

        return new Response(
          JSON.stringify({
            jobs,
            has_more: Boolean(data.result?.cursor),
          } as S3ImportJobsListResponse),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "s3-import", operation: "list_jobs" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            jobs: [],
            error: "Failed to fetch migration jobs",
            support: SUPPORT_EMAIL,
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // GET /api/s3-import/jobs/:jobId - Get job status
    const jobStatusRegex = /^\/api\/s3-import\/jobs\/([^/]+)$/;
    const jobStatusMatch = jobStatusRegex.exec(url.pathname);
    if (request.method === "GET" && jobStatusMatch?.[1] !== undefined) {
      const jobId = decodeURIComponent(jobStatusMatch[1]);
      logInfo(`Getting job status: ${jobId}`, {
        module: "s3-import",
        operation: "get_job_status",
        metadata: { jobId },
      });

      if (isLocalDev) {
        const mockJob: S3ImportJob = {
          id: jobId,
          source: {
            provider: "aws",
            bucket: "mock-source",
            region: "us-east-1",
          },
          destination: { bucket: "mock-destination" },
          status: "running",
          progress: {
            objects_copied: 50,
            objects_skipped: 0,
            objects_failed: 0,
            bytes_copied: 10485760,
          },
          created_at: new Date().toISOString(),
        };
        return new Response(
          JSON.stringify({
            success: true,
            job: mockJob,
          } as S3ImportJobResponse),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      try {
        const response = await fetchWithRetryBackend(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/slurper/jobs/${jobId}`,
          { headers: cfHeaders },
          env,
          isLocalDev,
          {
            operation: "get_job_status",
            code: S3_ERROR_CODES.GET_STATUS_FAILED,
          },
        );

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to get job status",
              support: SUPPORT_EMAIL,
            } as S3ImportJobResponse),
            {
              status: response.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const data =
          (await response.json()) as CloudflareApiResponse<SlurperJobApiResponse>;
        if (data.result) {
          return new Response(
            JSON.stringify({
              success: true,
              job: mapApiJobToS3ImportJob(data.result),
            } as S3ImportJobResponse),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: "Job not found",
            support: SUPPORT_EMAIL,
          } as S3ImportJobResponse),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          {
            module: "s3-import",
            operation: "get_job_status",
            metadata: { jobId },
          },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to get job status",
            support: SUPPORT_EMAIL,
          } as S3ImportJobResponse),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // POST /api/s3-import/jobs/:jobId/abort - Abort a running job
    const abortJobRegex = /^\/api\/s3-import\/jobs\/([^/]+)\/abort$/;
    const abortJobMatch = abortJobRegex.exec(url.pathname);
    if (request.method === "POST" && abortJobMatch?.[1] !== undefined) {
      const jobId = decodeURIComponent(abortJobMatch[1]);
      logInfo(`Aborting job: ${jobId}`, {
        module: "s3-import",
        operation: "abort_job",
        metadata: { jobId },
      });

      if (isLocalDev) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        const response = await fetchWithRetryBackend(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/slurper/jobs/${jobId}/abort`,
          { method: "POST", headers: cfHeaders },
          env,
          isLocalDev,
          { operation: "abort_job", code: S3_ERROR_CODES.ABORT_FAILED },
        );

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to abort job",
              support: SUPPORT_EMAIL,
            }),
            {
              status: response.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "s3-import", operation: "abort_job", metadata: { jobId } },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to abort job",
            support: SUPPORT_EMAIL,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // GET /api/s3-import/dashboard-url - Get the Cloudflare dashboard URL
    if (
      request.method === "GET" &&
      url.pathname === "/api/s3-import/dashboard-url"
    ) {
      return new Response(
        JSON.stringify({
          url: dashboardUrl,
          accountId: isLocalDev ? "local-dev" : env.ACCOUNT_ID,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }
  } catch (err) {
    await logError(
      env,
      err instanceof Error ? err : String(err),
      { module: "s3-import", operation: "handle_request" },
      isLocalDev,
    );
    return new Response(
      JSON.stringify({
        error: "S3 Import operation failed",
        support: SUPPORT_EMAIL,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}
