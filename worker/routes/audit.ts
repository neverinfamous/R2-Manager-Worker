import type {
  Env,
  AuditLogEntry,
  AuditOperationType,
  LogAuditEventParams,
} from '../types';

interface APIResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Log an audit event for a single operation
 */
export async function logAuditEvent(
  db: D1Database,
  params: LogAuditEventParams
): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_log (
      operation_type, bucket_name, object_key, user_email, 
      status, metadata, size_bytes, destination_bucket, destination_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    params.operationType,
    params.bucketName ?? null,
    params.objectKey ?? null,
    params.userEmail,
    params.status ?? 'success',
    params.metadata ? JSON.stringify(params.metadata) : null,
    params.sizeBytes ?? null,
    params.destinationBucket ?? null,
    params.destinationKey ?? null
  ).run();
}

/**
 * Handle audit log routes
 */
export async function handleAuditRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean,
  _userEmail: string
): Promise<Response | null> {
  const db = env.METADATA;

  // GET /api/audit - List audit log entries with filtering
  if (url.pathname === '/api/audit' && request.method === 'GET') {
    console.log('[Audit] Getting audit log entries');

    const limit = parseInt(url.searchParams.get('limit') ?? '50');
    const offset = parseInt(url.searchParams.get('offset') ?? '0');
    const operationType = url.searchParams.get('operation_type');
    const bucketName = url.searchParams.get('bucket_name');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const userEmail = url.searchParams.get('user_email');
    const sortBy = url.searchParams.get('sort_by') ?? 'timestamp';
    const sortOrder = url.searchParams.get('sort_order') ?? 'desc';

    if (isLocalDev || !db) {
      // Return mock audit log entries for local dev
      const mockEntries: AuditLogEntry[] = [
        {
          id: 1,
          operation_type: 'file_upload',
          bucket_name: 'dev-bucket',
          object_key: 'documents/report.pdf',
          user_email: 'dev@localhost',
          status: 'success',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          metadata: null,
          size_bytes: 1024000,
          destination_bucket: null,
          destination_key: null
        },
        {
          id: 2,
          operation_type: 'file_delete',
          bucket_name: 'dev-bucket',
          object_key: 'temp/old-file.txt',
          user_email: 'dev@localhost',
          status: 'success',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          metadata: null,
          size_bytes: null,
          destination_bucket: null,
          destination_key: null
        },
        {
          id: 3,
          operation_type: 'bucket_create',
          bucket_name: 'new-bucket',
          object_key: null,
          user_email: 'dev@localhost',
          status: 'success',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          metadata: null,
          size_bytes: null,
          destination_bucket: null,
          destination_key: null
        },
        {
          id: 4,
          operation_type: 'file_move',
          bucket_name: 'dev-bucket',
          object_key: 'source/file.txt',
          user_email: 'dev@localhost',
          status: 'success',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          metadata: null,
          size_bytes: 2048,
          destination_bucket: 'archive-bucket',
          destination_key: 'archived/file.txt'
        }
      ];

      const response: APIResponse = {
        success: true,
        result: {
          entries: mockEntries,
          total: mockEntries.length,
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
      let query = 'SELECT * FROM audit_log WHERE 1=1';
      const bindings: (string | number)[] = [];

      if (operationType) {
        query += ' AND operation_type = ?';
        bindings.push(operationType);
      }

      if (bucketName) {
        query += ' AND bucket_name = ?';
        bindings.push(bucketName);
      }

      if (status) {
        query += ' AND status = ?';
        bindings.push(status);
      }

      if (startDate) {
        query += ' AND timestamp >= ?';
        bindings.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        bindings.push(endDate);
      }

      if (userEmail) {
        query += ' AND user_email = ?';
        bindings.push(userEmail);
      }

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['timestamp', 'operation_type', 'bucket_name', 'size_bytes'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'timestamp';
      const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      query += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
      bindings.push(limit, offset);

      const entries = await db.prepare(query).bind(...bindings).all();

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM audit_log WHERE 1=1';
      const countBindings: (string | number)[] = [];

      if (operationType) {
        countQuery += ' AND operation_type = ?';
        countBindings.push(operationType);
      }

      if (bucketName) {
        countQuery += ' AND bucket_name = ?';
        countBindings.push(bucketName);
      }

      if (status) {
        countQuery += ' AND status = ?';
        countBindings.push(status);
      }

      if (startDate) {
        countQuery += ' AND timestamp >= ?';
        countBindings.push(startDate);
      }

      if (endDate) {
        countQuery += ' AND timestamp <= ?';
        countBindings.push(endDate);
      }

      if (userEmail) {
        countQuery += ' AND user_email = ?';
        countBindings.push(userEmail);
      }

      const countResult = await db.prepare(countQuery).bind(...countBindings).first<{ total: number }>();
      const total = countResult?.total ?? 0;

      const response: APIResponse = {
        success: true,
        result: {
          entries: entries.results ?? [],
          total,
          limit,
          offset
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      console.error('[Audit] Error listing audit entries:', error);

      // Check if this is a "table doesn't exist" error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('no such table') || errorMessage.includes('audit_log')) {
        console.log('[Audit] audit_log table does not exist yet - returning empty list');
        const response: APIResponse = {
          success: true,
          result: {
            entries: [],
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
        JSON.stringify({ success: false, error: 'Failed to list audit entries' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // GET /api/audit/summary - Get operation counts by type
  if (url.pathname === '/api/audit/summary' && request.method === 'GET') {
    console.log('[Audit] Getting audit summary');

    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const bucketName = url.searchParams.get('bucket_name');

    if (isLocalDev || !db) {
      const mockSummary = [
        { operation_type: 'file_upload' as AuditOperationType, count: 25, success_count: 24, failed_count: 1 },
        { operation_type: 'file_delete' as AuditOperationType, count: 10, success_count: 10, failed_count: 0 },
        { operation_type: 'bucket_create' as AuditOperationType, count: 3, success_count: 3, failed_count: 0 },
        { operation_type: 'file_move' as AuditOperationType, count: 5, success_count: 4, failed_count: 1 }
      ];

      const response: APIResponse = {
        success: true,
        result: { summary: mockSummary }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      let query = `
        SELECT 
          operation_type,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
        FROM audit_log
        WHERE 1=1
      `;
      const bindings: string[] = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        bindings.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        bindings.push(endDate);
      }

      if (bucketName) {
        query += ' AND bucket_name = ?';
        bindings.push(bucketName);
      }

      query += ' GROUP BY operation_type ORDER BY count DESC';

      const summary = await db.prepare(query).bind(...bindings).all();

      const response: APIResponse = {
        success: true,
        result: { summary: summary.results ?? [] }
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      console.error('[Audit] Error getting audit summary:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('no such table') || errorMessage.includes('audit_log')) {
        const response: APIResponse = {
          success: true,
          result: { summary: [] }
        };
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get audit summary' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // Not an audit route
  return null;
}

