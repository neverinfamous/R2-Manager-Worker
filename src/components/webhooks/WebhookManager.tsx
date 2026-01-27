/**
 * WebhookManager Component
 *
 * Provides a UI for managing webhook configurations.
 * Supports creating, editing, deleting, and testing webhooks.
 */

import { useState, useEffect, useCallback, type ReactElement } from "react";
import { webhookApi } from "../../services/webhookApi";
import type {
  Webhook,
  WebhookEventType,
  WebhookInput,
} from "../../types/webhook";
import {
  ALL_WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_DESCRIPTIONS,
} from "../../types/webhook";
import "../../styles/webhooks.css";

// Icons as inline SVGs for accessibility
const RefreshIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const EditIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

const CheckCircleIcon = ({
  className,
}: {
  className?: string;
}): ReactElement => (
  <svg
    className={className}
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

const XCircleIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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

const LoaderIcon = ({ className }: { className?: string }): ReactElement => (
  <svg
    className={className}
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
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export function WebhookManager(): ReactElement {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [deletingWebhook, setDeletingWebhook] = useState<Webhook | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadWebhooks = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      const data = await webhookApi.list();
      setWebhooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const resetForm = (): void => {
    setFormName("");
    setFormUrl("");
    setFormSecret("");
    setFormEvents([]);
    setFormEnabled(true);
  };

  const openCreateDialog = (): void => {
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (webhook: Webhook): void => {
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormSecret(webhook.secret ?? "");
    try {
      setFormEvents(JSON.parse(webhook.events) as WebhookEventType[]);
    } catch {
      setFormEvents([]);
    }
    setFormEnabled(webhook.enabled === 1);
    setEditingWebhook(webhook);
  };

  const handleCreateWebhook = async (): Promise<void> => {
    if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      return;
    }

    setSubmitting(true);
    try {
      const input: WebhookInput = {
        name: formName.trim(),
        url: formUrl.trim(),
        secret: formSecret.trim() || null,
        events: formEvents,
        enabled: formEnabled,
      };
      await webhookApi.create(input);
      setShowCreateDialog(false);
      resetForm();
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateWebhook = async (): Promise<void> => {
    if (
      !editingWebhook ||
      !formName.trim() ||
      !formUrl.trim() ||
      formEvents.length === 0
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const input: Partial<WebhookInput> = {
        name: formName.trim(),
        url: formUrl.trim(),
        secret: formSecret.trim() || null,
        events: formEvents,
        enabled: formEnabled,
      };
      await webhookApi.update(editingWebhook.id, input);
      setEditingWebhook(null);
      resetForm();
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update webhook");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (): Promise<void> => {
    if (!deletingWebhook) return;

    setSubmitting(true);
    try {
      await webhookApi.delete(deletingWebhook.id);
      setDeletingWebhook(null);
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestWebhook = async (webhookId: string): Promise<void> => {
    setTestingWebhook(webhookId);
    setTestResult(null);
    try {
      const result = await webhookApi.test(webhookId);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleToggleEnabled = async (webhook: Webhook): Promise<void> => {
    try {
      await webhookApi.update(webhook.id, { enabled: webhook.enabled !== 1 });
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle webhook");
    }
  };

  const toggleEvent = (event: WebhookEventType): void => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const parseEvents = (eventsJson: string): WebhookEventType[] => {
    try {
      return JSON.parse(eventsJson) as WebhookEventType[];
    } catch {
      return [];
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="webhook-manager-container">
      {/* Header */}
      <div className="webhook-header">
        <div className="webhook-header-content">
          <h2>Webhooks</h2>
          <p>Configure HTTP notifications for R2 bucket and file events</p>
        </div>
        <div className="webhook-header-actions">
          <button
            className="webhook-btn webhook-btn-secondary"
            onClick={() => void loadWebhooks()}
            disabled={loading}
          >
            <RefreshIcon className={loading ? "spinning" : ""} />
            Refresh
          </button>
          <button
            className="webhook-btn webhook-btn-primary"
            onClick={openCreateDialog}
          >
            <PlusIcon />
            Add Webhook
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="webhook-error">
          {error}
          <button
            onClick={() => setError("")}
            style={{
              marginLeft: "1rem",
              textDecoration: "underline",
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={`webhook-test-result ${testResult.success ? "success" : "error"}`}
        >
          {testResult.success ? <CheckCircleIcon /> : <XCircleIcon />}
          {testResult.message}
          <button
            onClick={() => setTestResult(null)}
            style={{
              marginLeft: "auto",
              textDecoration: "underline",
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="webhook-loading">
          <LoaderIcon />
        </div>
      )}

      {/* Empty State */}
      {!loading && webhooks.length === 0 && (
        <div className="webhook-empty">
          <BellIcon />
          <h3>No webhooks configured</h3>
          <p>Add a webhook to receive notifications when R2 events occur</p>
          <button
            className="webhook-btn webhook-btn-primary"
            onClick={openCreateDialog}
          >
            <PlusIcon />
            Add Your First Webhook
          </button>
        </div>
      )}

      {/* Webhook List */}
      {!loading && webhooks.length > 0 && (
        <div className="webhook-list">
          {webhooks.map((webhook) => {
            const events = parseEvents(webhook.events);
            return (
              <div
                key={webhook.id}
                className={`webhook-card ${webhook.enabled === 0 ? "disabled" : ""}`}
              >
                <div className="webhook-card-header">
                  <div className="webhook-card-title-area">
                    <div className="webhook-icon">
                      <BellIcon />
                    </div>
                    <div className="webhook-card-info">
                      <h4>
                        {webhook.name}
                        {webhook.secret && (
                          <span
                            className="webhook-secure-badge"
                            title="HMAC signature enabled"
                          >
                            <ShieldIcon />
                          </span>
                        )}
                      </h4>
                      <div className="webhook-card-url" title={webhook.url}>
                        {webhook.url}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`webhook-status-badge ${webhook.enabled === 1 ? "enabled" : "disabled"}`}
                  >
                    {webhook.enabled === 1 ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="webhook-events">
                  {events.map((event) => (
                    <span
                      key={event}
                      className="webhook-event-tag"
                      title={WEBHOOK_EVENT_DESCRIPTIONS[event]}
                    >
                      {WEBHOOK_EVENT_LABELS[event]}
                    </span>
                  ))}
                </div>
                <div className="webhook-card-footer">
                  <span className="webhook-card-meta">
                    Updated: {formatDate(webhook.updated_at)}
                  </span>
                  <div className="webhook-card-actions">
                    <button
                      className={`webhook-action-btn ${testingWebhook === webhook.id ? "testing" : ""}`}
                      onClick={() => void handleTestWebhook(webhook.id)}
                      disabled={testingWebhook === webhook.id}
                    >
                      {testingWebhook === webhook.id ? (
                        <LoaderIcon />
                      ) : (
                        <PlayIcon />
                      )}
                      Test
                    </button>
                    <button
                      className="webhook-action-btn"
                      onClick={() => void handleToggleEnabled(webhook)}
                    >
                      {webhook.enabled === 1 ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="webhook-action-btn"
                      onClick={() => openEditDialog(webhook)}
                    >
                      <EditIcon />
                      Edit
                    </button>
                    <button
                      className="webhook-action-btn delete"
                      onClick={() => setDeletingWebhook(webhook)}
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreateDialog || editingWebhook !== null) && (
        <div
          className="webhook-dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateDialog(false);
              setEditingWebhook(null);
              resetForm();
            }
          }}
        >
          <div className="webhook-dialog">
            <div className="webhook-dialog-header">
              <h3>{editingWebhook ? "Edit Webhook" : "Add Webhook"}</h3>
              <p>Configure a webhook endpoint to receive event notifications</p>
            </div>
            <div className="webhook-dialog-body">
              <div className="webhook-form-group">
                <label htmlFor="webhook-name">Name</label>
                <input
                  id="webhook-name"
                  type="text"
                  className="webhook-form-input"
                  placeholder="My Webhook"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <span className="webhook-form-hint">
                  A descriptive name for this webhook
                </span>
              </div>
              <div className="webhook-form-group">
                <label htmlFor="webhook-url">URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  className="webhook-form-input"
                  placeholder="https://example.com/webhook"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
                <span className="webhook-form-hint">
                  The endpoint that will receive webhook POST requests
                </span>
              </div>
              <div className="webhook-form-group">
                <label htmlFor="webhook-secret">Secret (optional)</label>
                <input
                  id="webhook-secret"
                  type="password"
                  className="webhook-form-input"
                  placeholder="For HMAC signature verification"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                />
                <span className="webhook-form-hint">
                  If set, requests will include an X-Webhook-Signature header
                </span>
              </div>
              <div className="webhook-form-group">
                <label>Events</label>
                <div className="webhook-events-grid">
                  {ALL_WEBHOOK_EVENTS.map((event) => (
                    <div key={event} className="webhook-checkbox-wrapper">
                      <input
                        id={`event-${event}`}
                        type="checkbox"
                        className="webhook-checkbox"
                        checked={formEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                      />
                      <label
                        htmlFor={`event-${event}`}
                        className="webhook-checkbox-label"
                      >
                        {WEBHOOK_EVENT_LABELS[event]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="webhook-checkbox-wrapper">
                <input
                  id="webhook-enabled"
                  type="checkbox"
                  className="webhook-checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                />
                <label
                  htmlFor="webhook-enabled"
                  className="webhook-checkbox-label"
                >
                  Enabled
                </label>
              </div>
            </div>
            <div className="webhook-dialog-actions">
              <button
                className="webhook-btn webhook-btn-secondary"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingWebhook(null);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button
                className="webhook-btn webhook-btn-primary"
                onClick={() =>
                  void (editingWebhook
                    ? handleUpdateWebhook()
                    : handleCreateWebhook())
                }
                disabled={
                  submitting ||
                  !formName.trim() ||
                  !formUrl.trim() ||
                  formEvents.length === 0
                }
              >
                {submitting && <LoaderIcon className="spinning" />}
                {editingWebhook ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingWebhook !== null && (
        <div
          className="webhook-dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeletingWebhook(null);
            }
          }}
        >
          <div className="webhook-dialog">
            <div className="webhook-dialog-header">
              <h3>Delete Webhook</h3>
              <p>
                Are you sure you want to delete "{deletingWebhook.name}"? This
                action cannot be undone.
              </p>
            </div>
            <div className="webhook-dialog-actions">
              <button
                className="webhook-btn webhook-btn-secondary"
                onClick={() => setDeletingWebhook(null)}
              >
                Cancel
              </button>
              <button
                className="webhook-btn webhook-action-btn delete"
                onClick={() => void handleDeleteWebhook()}
                disabled={submitting}
                style={{ padding: "0.5rem 1rem" }}
              >
                {submitting && <LoaderIcon className="spinning" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
