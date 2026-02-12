import { useState, useCallback, useRef, useEffect, type JSX } from "react";
import { api } from "../../services/api";
import { logger } from "../../services/logger";
import "./local-uploads.css";

interface LocalUploadsToggleProps {
  /** Bucket name to manage local uploads for */
  bucketName: string;
}

/**
 * Inline toggle component for R2 Local Uploads.
 *
 * Renders as a compact switch with a label.
 * Fetches status on mount with a small random delay to stagger
 * requests when many buckets are displayed simultaneously.
 */
export function LocalUploadsToggle({
  bucketName,
}: LocalUploadsToggleProps): JSX.Element {
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track current enabled value for use in async callbacks
  const enabledRef = useRef(false);

  // Fetch status on mount with a staggered delay to avoid rate limiting
  useEffect(() => {
    let cancelled = false;
    const delay = Math.random() * 2000; // 0-2s random stagger

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await api.getLocalUploadsStatus(bucketName);
          if (!cancelled) {
            const value = response.result?.enabled ?? false;
            enabledRef.current = value;
            setEnabled(value);
          }
        } catch (err) {
          if (!cancelled) {
            const message =
              err instanceof Error ? err.message : "Failed to fetch status";
            setError(message);
            logger.error("LocalUploadsToggle", "Failed to fetch status", {
              bucketName,
              error: message,
            });
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bucketName]);

  const handleToggle = useCallback(async () => {
    if (isUpdating || isLoading) return;

    const currentValue = enabledRef.current;
    const newValue = !currentValue;

    // Optimistic update
    enabledRef.current = newValue;
    setEnabled(newValue);
    setIsUpdating(true);
    setError(null);

    try {
      await api.setLocalUploadsStatus(bucketName, newValue);
      logger.info("LocalUploadsToggle", "Local uploads updated", {
        bucketName,
        enabled: newValue,
      });
    } catch (err) {
      // Revert optimistic update
      enabledRef.current = currentValue;
      setEnabled(currentValue);
      const message = err instanceof Error ? err.message : "Failed to update";
      setError(message);
      logger.error("LocalUploadsToggle", "Failed to update", {
        bucketName,
        error: message,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [bucketName, isUpdating, isLoading]);

  return (
    <div className="local-uploads-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-disabled={isUpdating || isLoading}
        aria-label={`Local uploads ${enabled ? "enabled" : "disabled"} for ${bucketName}`}
        className="local-uploads-switch"
        onClick={() => void handleToggle()}
        disabled={isUpdating || isLoading}
        title={
          isLoading
            ? "Loading local uploads status…"
            : enabled
              ? "Local uploads enabled — uploads write to nearby storage"
              : "Local uploads disabled — click to enable faster uploads"
        }
      />
      <span className="local-uploads-label" onClick={() => void handleToggle()}>
        Local Uploads
      </span>
      {error !== null && (
        <span className="local-uploads-error" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}
