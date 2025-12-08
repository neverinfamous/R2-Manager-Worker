import type {
  Env,
  BulkJob,
  JobAuditEvent,
  JobOperationType,
  CreateJobParams,
  UpdateJobProgressParams,
  CompleteJobParams,
  LogJobEventParams,
  AuditLogEntry
} from '../types';
import { logInfo, logError } from '../utils/error-logger';

interface APIResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Operation types that exist in bulk_jobs table
const BULK_JOB_OPERATIONS = [
  'bulk_upload', 'bulk_download', 'bulk_delete', 'bucket_delete',
  'file_move', 'file_copy', 'folder_move', 'folder_copy', 'ai_search_sync'
] as const;

// Operation types that exist only in audit_log table
const AUDIT_ONLY_OPERATIONS = [
  'file_upload', 'file_download', 'file_delete', 'file_rename',
  'bucket_create', 'bucket_rename',
  'folder_create', 'folder_delete', 'folder_rename'
] as const;

/**
 * Convert an audit_log entry to a BulkJob-like format for unified display
 */
function auditEntryToJob(entry: AuditLogEntry): BulkJob {
  return {
    job_id: `audit-${entry.id}`,
    bucket_name: entry.bucket_name ?? 'N/A',
    operation_type: entry.operation_type as unknown as JobOperationType,
    status: entry.status === 'success' ? 'completed' : 'failed',
    total_items: 1,
    processed_items: entry.status === 'success' ? 1 : 0,
    error_count: entry.status === 'failed' ? 1 : 0,
    percentage: entry.status === 'success' ? 100 : 0,
    started_at: entry.timestamp,
    completed_at: entry.timestamp,
    user_email: entry.user_email,
    metadata: entry.metadata
  };
}

/**
 * Generate a unique job ID
 */
export function generateJobId(operationType: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${operationType}-${timestamp}-${random}`;
}

/**
 * Create a new job record
 */
export async function createJob(
  db: D1Database,
  params: CreateJobParams
): Promise<void> {
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO bulk_jobs (
      job_id, bucket_name, operation_type, status, 
      total_items, processed_items, error_count, percentage,
      started_at, user_email, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    params.jobId,
    params.bucketName,
    params.operationType,
    'running',
    params.totalItems ?? null,
    0,
    0,
    0,
    now,
    params.userEmail,
    params.metadata ? JSON.stringify(params.metadata) : null
  ).run();

  // Log the started event
  await logJobEvent(db, {
    jobId: params.jobId,
    eventType: 'started',
    userEmail: params.userEmail,
    details: { total: params.totalItems }
  });
}

/**
 * Update a job's progress
 */
export async function updateJobProgress(
  db: D1Database,
  params: UpdateJobProgressParams
): Promise<void> {
  const percentage = params.totalItems !== undefined && params.totalItems !== null && params.totalItems > 0
    ? (params.processedItems / params.totalItems) * 100
    : 0;

  await db.prepare(`
    UPDATE bulk_jobs SET
      processed_items = ?,
      error_count = COALESCE(?, error_count),
      percentage = ?
    WHERE job_id = ?
  `).bind(
    params.processedItems,
    params.errorCount ?? null,
    percentage,
    params.jobId
  ).run();
}

/**
 * Complete a job
 */
export async function completeJob(
  db: D1Database,
  params: CompleteJobParams
): Promise<void> {
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE bulk_jobs SET
      status = ?,
      completed_at = ?,
      processed_items = COALESCE(?, processed_items),
      error_count = COALESCE(?, error_count),
      percentage = CASE WHEN ? = 'completed' THEN 100 ELSE percentage END
    WHERE job_id = ?
  `).bind(
    params.status,
    now,
    params.processedItems ?? null,
    params.errorCount ?? null,
    params.status,
    params.jobId
  ).run();

  // Log the completion event
  await logJobEvent(db, {
    jobId: params.jobId,
    eventType: params.status,
    userEmail: params.userEmail,
    details: {
      processed: params.processedItems,
      errors: params.errorCount,
      error_message: params.errorMessage
    }
  });
}

/**
 * Log a job event
 */
export async function logJobEvent(
  db: D1Database,
  params: LogJobEventParams
): Promise<void> {
  await db.prepare(`
    INSERT INTO job_audit_events (job_id, event_type, user_email, details)
    VALUES (?, ?, ?, ?)
  `).bind(
    params.jobId,
    params.eventType,
    params.userEmail,
    params.details ? JSON.stringify(params.details) : null
  ).run();
}

/**
 * Handle job-related routes
 */
export async function handleJobRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean,
  userEmail: string
): Promise<Response | null> {
  const db = env.METADATA;

  // GET /api/jobs - Get list of user's jobs
  if (url.pathname === '/api/jobs' && request.method === 'GET') {
    logInfo('Getting job list for user', { module: 'jobs', operation: 'list_jobs', userId: userEmail });

    const limit = parseInt(url.searchParams.get('limit') ?? '50');
    const offset = parseInt(url.searchParams.get('offset') ?? '0');
    const status = url.searchParams.get('status');
    const operationType = url.searchParams.get('operation_type');
    const bucketName = url.searchParams.get('bucket_name');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const jobId = url.searchParams.get('job_id');
    const minErrors = url.searchParams.get('min_errors');
    const sortBy = url.searchParams.get('sort_by') ?? 'started_at';
    const sortOrder = url.searchParams.get('sort_order') ?? 'desc';

    if (isLocalDev || !db) {
      // Return mock jobs for local dev
      const mockJobs: BulkJob[] = [
        {
          job_id: 'bulk_upload-abc123-xyz',
          bucket_name: 'dev-bucket',
          operation_type: 'bulk_upload' as JobOperationType,
          status: 'completed',
          total_items: 5,
          processed_items: 5,
          error_count: 0,
          percentage: 100,
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date().toISOString(),
          user_email: 'dev@localhost',
          metadata: null
        },
        {
          job_id: 'bulk_download-def456-abc',
          bucket_name: 'test-bucket',
          operation_type: 'bulk_download' as JobOperationType,
          status: 'completed',
          total_items: 10,
          processed_items: 10,
          error_count: 0,
          percentage: 100,
          started_at: new Date(Date.now() - 7200000).toISOString(),
          completed_at: new Date(Date.now() - 7000000).toISOString(),
          user_email: 'dev@localhost',
          metadata: null
        },
        {
          job_id: 'bulk_delete-ghi789-def',
          bucket_name: 'dev-bucket',
          operation_type: 'bulk_delete' as JobOperationType,
          status: 'completed',
          total_items: 3,
          processed_items: 3,
          error_count: 0,
          percentage: 100,
          started_at: new Date(Date.now() - 86400000).toISOString(),
          completed_at: new Date(Date.now() - 86300000).toISOString(),
          user_email: 'dev@localhost',
          metadata: null
        },
        {
          job_id: 'file_move-jkl012-ghi',
          bucket_name: 'dev-bucket',
          operation_type: 'file_move' as JobOperationType,
          status: 'failed',
          total_items: 5,
          processed_items: 3,
          error_count: 2,
          percentage: 60,
          started_at: new Date(Date.now() - 172800000).toISOString(),
          completed_at: new Date(Date.now() - 172700000).toISOString(),
          user_email: 'dev@localhost',
          metadata: null
        }
      ];

      const response: APIResponse = {
        success: true,
        result: {
          jobs: mockJobs,
          total: mockJobs.length,
          limit,
          offset
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      // Determine which tables to query based on operation type filter
      const isAuditOnlyOperation: boolean = operationType !== null && (AUDIT_ONLY_OPERATIONS as readonly string[]).includes(operationType);
      const isBulkJobOperation: boolean = operationType !== null && (BULK_JOB_OPERATIONS as readonly string[]).includes(operationType);
      const queryBoth: boolean = operationType === null; // Query both tables if no operation type filter

      let allJobs: BulkJob[] = [];
      let totalBulkJobs = 0;
      let totalAuditEntries = 0;

      // Query bulk_jobs table (unless filtering for audit-only operations)
      if (!isAuditOnlyOperation) {
        let bulkQuery = 'SELECT * FROM bulk_jobs WHERE 1=1';
        const bulkBindings: (string | number)[] = [];

        if (status) {
          // Map audit status to bulk_jobs status
          if (status === 'success') {
            bulkQuery += ' AND status = ?';
            bulkBindings.push('completed');
          } else if (status === 'failed') {
            bulkQuery += ' AND status = ?';
            bulkBindings.push('failed');
          } else {
            bulkQuery += ' AND status = ?';
            bulkBindings.push(status);
          }
        }

        if (operationType) {
          bulkQuery += ' AND operation_type = ?';
          bulkBindings.push(operationType);
        }

        if (bucketName) {
          bulkQuery += ' AND bucket_name = ?';
          bulkBindings.push(bucketName);
        }

        if (startDate) {
          bulkQuery += ' AND started_at >= ?';
          bulkBindings.push(startDate);
        }

        if (endDate) {
          bulkQuery += ' AND started_at <= ?';
          bulkBindings.push(endDate);
        }

        if (jobId) {
          bulkQuery += ' AND job_id LIKE ?';
          bulkBindings.push(`%${jobId}%`);
        }

        if (minErrors) {
          const minErrorsNum = parseInt(minErrors);
          if (!isNaN(minErrorsNum)) {
            bulkQuery += ' AND error_count >= ?';
            bulkBindings.push(minErrorsNum);
          }
        }

        // Validate sort column
        const validSortColumns = ['started_at', 'completed_at', 'total_items', 'error_count', 'percentage'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'started_at';
        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // Get bulk jobs with adjusted pagination
        const bulkLimit = queryBoth ? limit * 2 : limit; // Fetch more if querying both
        bulkQuery += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
        bulkBindings.push(bulkLimit, queryBoth ? 0 : offset);

        try {
          const bulkJobs = await db.prepare(bulkQuery).bind(...bulkBindings).all<BulkJob>();
          allJobs = bulkJobs.results ?? [];

          // Get total count for bulk_jobs
          let countQuery = 'SELECT COUNT(*) as total FROM bulk_jobs WHERE 1=1';
          const countBindings: (string | number)[] = [];

          if (status) {
            if (status === 'success') {
              countQuery += ' AND status = ?';
              countBindings.push('completed');
            } else if (status === 'failed') {
              countQuery += ' AND status = ?';
              countBindings.push('failed');
            } else {
              countQuery += ' AND status = ?';
              countBindings.push(status);
            }
          }
          if (operationType) {
            countQuery += ' AND operation_type = ?';
            countBindings.push(operationType);
          }
          if (bucketName) {
            countQuery += ' AND bucket_name = ?';
            countBindings.push(bucketName);
          }
          if (startDate) {
            countQuery += ' AND started_at >= ?';
            countBindings.push(startDate);
          }
          if (endDate) {
            countQuery += ' AND started_at <= ?';
            countBindings.push(endDate);
          }
          if (jobId) {
            countQuery += ' AND job_id LIKE ?';
            countBindings.push(`%${jobId}%`);
          }
          if (minErrors) {
            const minErrorsNum = parseInt(minErrors);
            if (!isNaN(minErrorsNum)) {
              countQuery += ' AND error_count >= ?';
              countBindings.push(minErrorsNum);
            }
          }

          const countResult = await db.prepare(countQuery).bind(...countBindings).first<{ total: number }>();
          totalBulkJobs = countResult?.total ?? 0;
        } catch (bulkError) {
          const errorMsg = bulkError instanceof Error ? bulkError.message : String(bulkError);
          if (!errorMsg.includes('no such table')) {
            throw bulkError;
          }
          // Table doesn't exist yet, continue with empty results
          logInfo('bulk_jobs table does not exist yet', { module: 'jobs', operation: 'list_jobs' });
        }
      }

      // Query audit_log table (unless filtering for bulk-job-only operations)
      if (!isBulkJobOperation) {
        let auditQuery = 'SELECT * FROM audit_log WHERE 1=1';
        const auditBindings: (string | number)[] = [];

        if (status) {
          // Map status for audit_log
          if (status === 'completed') {
            auditQuery += ' AND status = ?';
            auditBindings.push('success');
          } else if (status === 'failed') {
            auditQuery += ' AND status = ?';
            auditBindings.push('failed');
          }
          // Skip other statuses for audit_log (it only has success/failed)
        }

        if (operationType) {
          auditQuery += ' AND operation_type = ?';
          auditBindings.push(operationType);
        }

        if (bucketName) {
          auditQuery += ' AND bucket_name = ?';
          auditBindings.push(bucketName);
        }

        if (startDate) {
          auditQuery += ' AND timestamp >= ?';
          auditBindings.push(startDate);
        }

        if (endDate) {
          auditQuery += ' AND timestamp <= ?';
          auditBindings.push(endDate);
        }

        // Note: minErrors doesn't apply to audit_log (each entry is a single operation)

        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const auditLimit = queryBoth ? limit * 2 : limit;
        auditQuery += ` ORDER BY timestamp ${sortDirection} LIMIT ? OFFSET ?`;
        auditBindings.push(auditLimit, queryBoth ? 0 : offset);

        try {
          const auditEntries = await db.prepare(auditQuery).bind(...auditBindings).all<AuditLogEntry>();
          const convertedEntries = (auditEntries.results ?? []).map(auditEntryToJob);
          allJobs = [...allJobs, ...convertedEntries];

          // Get total count for audit_log
          let auditCountQuery = 'SELECT COUNT(*) as total FROM audit_log WHERE 1=1';
          const auditCountBindings: (string | number)[] = [];

          if (status) {
            if (status === 'completed') {
              auditCountQuery += ' AND status = ?';
              auditCountBindings.push('success');
            } else if (status === 'failed') {
              auditCountQuery += ' AND status = ?';
              auditCountBindings.push('failed');
            }
          }
          if (operationType) {
            auditCountQuery += ' AND operation_type = ?';
            auditCountBindings.push(operationType);
          }
          if (bucketName) {
            auditCountQuery += ' AND bucket_name = ?';
            auditCountBindings.push(bucketName);
          }
          if (startDate) {
            auditCountQuery += ' AND timestamp >= ?';
            auditCountBindings.push(startDate);
          }
          if (endDate) {
            auditCountQuery += ' AND timestamp <= ?';
            auditCountBindings.push(endDate);
          }

          const auditCountResult = await db.prepare(auditCountQuery).bind(...auditCountBindings).first<{ total: number }>();
          totalAuditEntries = auditCountResult?.total ?? 0;
        } catch (auditError) {
          const errorMsg = auditError instanceof Error ? auditError.message : String(auditError);
          if (!errorMsg.includes('no such table')) {
            throw auditError;
          }
          // Table doesn't exist yet, continue with existing results
          logInfo('audit_log table does not exist yet', { module: 'jobs', operation: 'list_jobs' });
        }
      }

      // Sort combined results by timestamp
      allJobs.sort((a, b) => {
        const aTime = new Date(a.started_at).getTime();
        const bTime = new Date(b.started_at).getTime();
        return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
      });

      // Apply pagination to combined results
      const paginatedJobs = allJobs.slice(offset, offset + limit);
      const total = totalBulkJobs + totalAuditEntries;

      const response: APIResponse = {
        success: true,
        result: {
          jobs: paginatedJobs,
          total,
          limit,
          offset
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      await logError(env, error instanceof Error ? error : String(error), { module: 'jobs', operation: 'list_jobs' }, isLocalDev);

      // Check if this is a "table doesn't exist" error - return empty list instead of error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('no such table') || errorMessage.includes('bulk_jobs')) {
        logInfo('bulk_jobs table does not exist yet - returning empty list', { module: 'jobs', operation: 'list_jobs' });
        const response: APIResponse = {
          success: true,
          result: {
            jobs: [],
            total: 0,
            limit,
            offset
          }
        };
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to list jobs' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // GET /api/jobs/:jobId - Get job status
  const jobRegex = /^\/api\/jobs\/([^/]+)$/;
  const jobMatch = jobRegex.exec(url.pathname);
  if (jobMatch !== null && request.method === 'GET') {
    const requestedJobId = jobMatch[1];
    if (!requestedJobId) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid job ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    logInfo('Getting status for job', { module: 'jobs', operation: 'get_job', metadata: { jobId: requestedJobId } });

    if (isLocalDev || !db) {
      const response: APIResponse = {
        success: true,
        result: {
          job_id: requestedJobId,
          bucket_name: 'dev-bucket',
          operation_type: 'bulk_upload',
          status: 'completed',
          total_items: 5,
          processed_items: 5,
          error_count: 0,
          percentage: 100,
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date().toISOString(),
          user_email: 'dev@localhost',
          metadata: null
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      const job = await db.prepare(
        'SELECT * FROM bulk_jobs WHERE job_id = ?'
      ).bind(requestedJobId).first();

      if (!job) {
        return new Response(JSON.stringify({ success: false, error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const response: APIResponse = {
        success: true,
        result: job
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      await logError(env, error instanceof Error ? error : String(error), { module: 'jobs', operation: 'get_job', metadata: { jobId: requestedJobId } }, isLocalDev);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If table doesn't exist, return 404 instead of 500
      if (errorMessage.includes('no such table') || errorMessage.includes('bulk_jobs')) {
        return new Response(JSON.stringify({ success: false, error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get job status' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // GET /api/jobs/:jobId/events - Get job audit events
  const eventsRegex = /^\/api\/jobs\/([^/]+)\/events$/;
  const eventsMatch = eventsRegex.exec(url.pathname);
  if (eventsMatch !== null && request.method === 'GET') {
    const requestedJobId = eventsMatch[1];
    if (!requestedJobId) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid job ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    logInfo('Getting events for job', { module: 'jobs', operation: 'get_job_events', metadata: { jobId: requestedJobId } });

    if (isLocalDev || !db) {
      // Return mock events for local dev
      const mockEvents: JobAuditEvent[] = [
        {
          id: 1,
          job_id: requestedJobId,
          event_type: 'started',
          user_email: 'dev@localhost',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          details: JSON.stringify({ total: 5 })
        },
        {
          id: 2,
          job_id: requestedJobId,
          event_type: 'progress',
          user_email: 'dev@localhost',
          timestamp: new Date(Date.now() - 3500000).toISOString(),
          details: JSON.stringify({ processed: 2, percentage: 40 })
        },
        {
          id: 3,
          job_id: requestedJobId,
          event_type: 'progress',
          user_email: 'dev@localhost',
          timestamp: new Date(Date.now() - 3400000).toISOString(),
          details: JSON.stringify({ processed: 4, percentage: 80 })
        },
        {
          id: 4,
          job_id: requestedJobId,
          event_type: 'completed',
          user_email: 'dev@localhost',
          timestamp: new Date().toISOString(),
          details: JSON.stringify({ processed: 5, errors: 0, percentage: 100 })
        }
      ];

      const response: APIResponse = {
        success: true,
        result: {
          job_id: requestedJobId,
          events: mockEvents
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      const events = await db.prepare(
        'SELECT * FROM job_audit_events WHERE job_id = ? ORDER BY timestamp ASC'
      ).bind(requestedJobId).all();

      const response: APIResponse = {
        success: true,
        result: {
          job_id: requestedJobId,
          events: events.results ?? []
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      await logError(env, error instanceof Error ? error : String(error), { module: 'jobs', operation: 'get_job_events', metadata: { jobId: requestedJobId } }, isLocalDev);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If table doesn't exist, return empty events list
      if (errorMessage.includes('no such table') || errorMessage.includes('job_audit_events')) {
        const response: APIResponse = {
          success: true,
          result: {
            job_id: requestedJobId,
            events: []
          }
        };
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get job events' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // Not a job route
  return null;
}

