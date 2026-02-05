import { useCallback, useEffect, useState, type JSX } from "react";
import { api, type JobEvent, type JobEventDetails } from "../../services/api";

// Icons
const LoaderIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckCircleIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

const AlertCircleIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const PlayIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" fill="none" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

const CircleIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="6" />
  </svg>
);

const BanIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

interface JobHistoryDialogProps {
  open: boolean;
  jobId: string;
  onClose: () => void;
}

export function JobHistoryDialog({
  open,
  jobId,
  onClose,
}: JobHistoryDialogProps): JSX.Element | null {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getJobEvents(jobId);
      setEvents(data.events);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load job events",
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open && jobId) {
      void loadEvents();
    }
  }, [open, jobId, loadEvents]);

  const getEventIcon = (eventType: string): JSX.Element => {
    switch (eventType) {
      case "started":
        return <PlayIcon />;
      case "progress":
        return <CircleIcon />;
      case "completed":
        return <CheckCircleIcon />;
      case "failed":
        return <XCircleIcon />;
      case "cancelled":
        return <BanIcon />;
      default:
        return <AlertCircleIcon />;
    }
  };

  const getEventLabel = (eventType: string): string => {
    switch (eventType) {
      case "started":
        return "Started";
      case "progress":
        return "Progress Update";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      default:
        return eventType;
    }
  };

  const formatTimestamp = (
    timestamp: string,
  ): { relative: string; absolute: string } => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 1) relative = "just now";
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays < 7) relative = `${diffDays}d ago`;
    else relative = date.toLocaleDateString();

    const absolute = date.toLocaleString();
    return { relative, absolute };
  };

  const parseDetails = (details: string | null): JobEventDetails => {
    if (!details) return {};
    try {
      return JSON.parse(details) as JobEventDetails;
    } catch {
      return {};
    }
  };

  const renderEventDetails = (event: JobEvent): string | null => {
    const details = parseDetails(event.details);
    const items: string[] = [];

    if (details.total !== undefined) {
      items.push(`Total: ${details.total.toLocaleString()}`);
    }
    if (details.processed !== undefined) {
      items.push(`Processed: ${details.processed.toLocaleString()}`);
    }
    if (details.errors !== undefined && details.errors > 0) {
      items.push(`Errors: ${details.errors.toLocaleString()}`);
    }
    if (details.percentage !== undefined) {
      items.push(`${details.percentage.toFixed(1)}%`);
    }
    if (details.error_message) {
      items.push(`Error: ${details.error_message}`);
    }

    return items.length > 0 ? items.join(" • ") : null;
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="job-dialog-overlay" onClick={handleOverlayClick}>
      <div className="job-dialog">
        <div className="job-dialog-header">
          <h3>Job Event History</h3>
          <div className="job-dialog-job-id">Job ID: {jobId}</div>
        </div>

        <div className="job-dialog-content">
          {loading ? (
            <div className="job-dialog-loading">
              <LoaderIcon />
            </div>
          ) : error ? (
            <div className="job-dialog-error">
              <p>Error:</p>
              <p>{error}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="job-dialog-empty">No events found for this job</div>
          ) : (
            <div className="job-timeline">
              {events.map((event) => {
                const time = formatTimestamp(event.timestamp);
                const details = renderEventDetails(event);
                const isTerminal = [
                  "completed",
                  "failed",
                  "cancelled",
                ].includes(event.event_type);

                return (
                  <div key={event.id} className="job-timeline-event">
                    <div className={`job-timeline-icon ${event.event_type}`}>
                      {getEventIcon(event.event_type)}
                    </div>
                    <div
                      className={`job-timeline-content ${isTerminal ? "terminal" : ""}`}
                    >
                      <div className="job-timeline-header">
                        <span className="job-timeline-label">
                          {getEventLabel(event.event_type)}
                        </span>
                        <span
                          className="job-timeline-time"
                          title={time.absolute}
                        >
                          {time.relative}
                        </span>
                      </div>
                      {details && (
                        <div className="job-timeline-details">{details}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="job-dialog-actions">
          <button className="job-dialog-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
