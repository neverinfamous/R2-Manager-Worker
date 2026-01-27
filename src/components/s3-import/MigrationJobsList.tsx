import { type JSX } from "react";
import type { S3ImportJob } from "../../services/api";

interface MigrationJobsListProps {
  jobs: S3ImportJob[];
  showAbort: boolean;
  onAbortJob?: (jobId: string) => void;
  onRefresh: () => void;
  emptyMessage: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function getStatusClass(status: S3ImportJob["status"]): string {
  switch (status) {
    case "complete":
      return "s3-status-success";
    case "error":
      return "s3-status-error";
    case "aborted":
      return "s3-status-warning";
    case "running":
      return "s3-status-running";
    case "pending":
      return "s3-status-pending";
    default:
      return "";
  }
}

function getStatusLabel(status: S3ImportJob["status"]): string {
  switch (status) {
    case "complete":
      return "Completed";
    case "error":
      return "Failed";
    case "aborted":
      return "Aborted";
    case "running":
      return "Running";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

export function MigrationJobsList({
  jobs,
  showAbort,
  onAbortJob,
  onRefresh,
  emptyMessage,
}: MigrationJobsListProps): JSX.Element {
  if (jobs.length === 0) {
    return (
      <div className="s3-jobs-empty">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="s3-jobs-list">
      <div className="s3-jobs-header">
        <span className="s3-jobs-count">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </span>
        <button
          className="s3-jobs-refresh"
          onClick={onRefresh}
          aria-label="Refresh jobs"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="s3-job-card">
          <div className="s3-job-header">
            <div className="s3-job-buckets">
              <span className="s3-job-source">{job.source.bucket}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span className="s3-job-destination">
                {job.destination.bucket}
              </span>
            </div>
            <span className={`s3-job-status ${getStatusClass(job.status)}`}>
              {getStatusLabel(job.status)}
            </span>
          </div>

          {job.progress && (
            <div className="s3-job-progress">
              {job.status === "running" && (
                <div className="s3-progress-bar">
                  <div
                    className="s3-progress-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (job.progress.objects_copied /
                          (job.progress.objects_copied +
                            job.progress.objects_skipped +
                            job.progress.objects_failed +
                            1)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              )}
              <div className="s3-job-stats">
                <span className="s3-stat">
                  <strong>
                    {job.progress.objects_copied.toLocaleString()}
                  </strong>{" "}
                  copied
                </span>
                {job.progress.objects_skipped > 0 && (
                  <span className="s3-stat s3-stat-skipped">
                    <strong>
                      {job.progress.objects_skipped.toLocaleString()}
                    </strong>{" "}
                    skipped
                  </span>
                )}
                {job.progress.objects_failed > 0 && (
                  <span className="s3-stat s3-stat-failed">
                    <strong>
                      {job.progress.objects_failed.toLocaleString()}
                    </strong>{" "}
                    failed
                  </span>
                )}
                <span className="s3-stat s3-stat-bytes">
                  {formatBytes(job.progress.bytes_copied)}
                </span>
              </div>
            </div>
          )}

          <div className="s3-job-meta">
            <span className="s3-job-id" title={job.id}>
              ID: {job.id.slice(0, 8)}...
            </span>
            {job.source.region && (
              <span className="s3-job-region">{job.source.region}</span>
            )}
            <span className="s3-job-date">
              Started: {formatDate(job.created_at)}
            </span>
            {job.completed_at && (
              <span className="s3-job-date">
                Finished: {formatDate(job.completed_at)}
              </span>
            )}
          </div>

          {job.error && (
            <div className="s3-job-error">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{job.error}</span>
            </div>
          )}

          {showAbort &&
            (job.status === "pending" || job.status === "running") &&
            onAbortJob && (
              <div className="s3-job-actions">
                <button
                  className="s3-btn-abort"
                  onClick={() => onAbortJob(job.id)}
                >
                  Abort
                </button>
              </div>
            )}
        </div>
      ))}
    </div>
  );
}
