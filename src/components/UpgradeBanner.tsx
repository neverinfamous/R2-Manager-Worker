/**
 * UpgradeBanner Component
 *
 * Displays a banner when database migrations are pending.
 * Allows users to click to apply migrations.
 */

import { useState, useEffect, useCallback, type JSX } from "react";
import { api } from "../services/api";
import { logger } from "../services/logger";
import "./UpgradeBanner.css";

interface MigrationStatus {
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: { version: number; name: string; description: string }[];
  isUpToDate: boolean;
  legacy?: {
    isLegacy: boolean;
    existingTables: string[];
    suggestedVersion: number;
  };
}

interface MigrationResult {
  success: boolean;
  migrationsApplied: number;
  currentVersion: number;
  errors: string[];
}

export function UpgradeBanner(): JSX.Element | null {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Check migration status on mount
  useEffect(() => {
    async function checkStatus(): Promise<void> {
      try {
        const response = await api.getMigrationStatus();
        setStatus(response);
      } catch (err) {
        logger.error("UpgradeBanner", "Failed to check migration status", err);
        // Don't show error - just hide the banner if we can't check
      } finally {
        setIsLoading(false);
      }
    }
    void checkStatus();
  }, []);

  const handleUpgrade = useCallback(async (): Promise<void> => {
    setIsUpgrading(true);
    setError(null);

    try {
      // If this is a legacy installation, first mark existing migrations as applied
      if (status?.legacy?.isLegacy && status.legacy.suggestedVersion > 0) {
        await api.markLegacyMigrations(status.legacy.suggestedVersion);
      }

      // Then apply any pending migrations
      const result: MigrationResult = await api.applyMigrations();

      if (result.success) {
        // Refresh status
        const newStatus = await api.getMigrationStatus();
        setStatus(newStatus);
        logger.info(
          "UpgradeBanner",
          `Applied ${result.migrationsApplied} migrations`,
        );
      } else {
        setError(result.errors.join(", "));
      }
    } catch (err) {
      logger.error("UpgradeBanner", "Failed to apply migrations", err);
      setError(
        err instanceof Error ? err.message : "Failed to apply migrations",
      );
    } finally {
      setIsUpgrading(false);
    }
  }, [status]);

  // Don't render if loading, dismissed, or up-to-date
  if (isLoading || dismissed || !status || status.isUpToDate) {
    return null;
  }

  const pendingCount = status.pendingMigrations.length;
  const isLegacy = status.legacy?.isLegacy ?? false;

  return (
    <div className="upgrade-banner" role="alert">
      <div className="upgrade-banner-content">
        <div className="upgrade-banner-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 16 16 12 12 8" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <div className="upgrade-banner-text">
          <strong>Database Upgrade Available</strong>
          <span>
            {isLegacy
              ? `Legacy installation detected. ${pendingCount} new migration${pendingCount !== 1 ? "s" : ""} available.`
              : `${pendingCount} migration${pendingCount !== 1 ? "s" : ""} pending.`}
          </span>
        </div>
      </div>

      <div className="upgrade-banner-actions">
        {error && <span className="upgrade-banner-error">{error}</span>}
        <button
          type="button"
          className="upgrade-banner-button primary"
          onClick={() => void handleUpgrade()}
          disabled={isUpgrading}
        >
          {isUpgrading ? "Upgrading..." : "Upgrade Now"}
        </button>
        <button
          type="button"
          className="upgrade-banner-button secondary"
          onClick={() => setDismissed(true)}
          disabled={isUpgrading}
          aria-label="Dismiss upgrade banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}
