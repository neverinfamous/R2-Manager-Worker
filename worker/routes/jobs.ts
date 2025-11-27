import type { 
  Env, 
  BulkJob, 
  JobAuditEvent, 
  JobOperationType,
  CreateJobParams,
  UpdateJobProgressParams,
  CompleteJobParams,
  LogJobEventParams
} from '../types';

interface APIResponse {
  success: boolean;
  result?: unknown;
  error?: string;
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
    console.log('[Jobs] Getting job list for user:', userEmail);

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
      // Build query with filters
      let query = 'SELECT * FROM bulk_jobs WHERE 1=1';
      const bindings: (string | number)[] = [];

      if (status) {
        query += ' AND status = ?';
        bindings.push(status);
      }

      if (operationType) {
        query += ' AND operation_type = ?';
        bindings.push(operationType);
      }

      if (bucketName) {
        query += ' AND bucket_name = ?';
        bindings.push(bucketName);
      }

      if (startDate) {
        query += ' AND started_at >= ?';
        bindings.push(startDate);
      }

      if (endDate) {
        query += ' AND started_at <= ?';
        bindings.push(endDate);
      }

      if (jobId) {
        query += ' AND job_id LIKE ?';
        bindings.push(`%${jobId}%`);
      }

      if (minErrors) {
        const minErrorsNum = parseInt(minErrors);
        if (!isNaN(minErrorsNum)) {
          query += ' AND error_count >= ?';
          bindings.push(minErrorsNum);
        }
      }

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['started_at', 'completed_at', 'total_items', 'error_count', 'percentage'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'started_at';
      const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      query += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
      bindings.push(limit, offset);

      const jobs = await db.prepare(query).bind(...bindings).all();

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM bulk_jobs WHERE 1=1';
      const countBindings: (string | number)[] = [];

      if (status) {
        countQuery += ' AND status = ?';
        countBindings.push(status);
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
      const total = countResult?.total ?? 0;

      const response: APIResponse = {
        success: true,
        result: {
          jobs: jobs.results ?? [],
          total,
          limit,
          offset
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      console.error('[Jobs] Error listing jobs:', error);
      
      // Check if this is a "table doesn't exist" error - return empty list instead of error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('no such table') || errorMessage.includes('bulk_jobs')) {
        console.log('[Jobs] bulk_jobs table does not exist yet - returning empty list');
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

    console.log('[Jobs] Getting status for job:', requestedJobId);

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
      console.error('[Jobs] Error getting job:', error);
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

    console.log('[Jobs] Getting events for job:', requestedJobId);

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
      console.error('[Jobs] Error getting job events:', error);
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

