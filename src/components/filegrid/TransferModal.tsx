import { type JSX } from "react";

interface TransferModalProps {
  show: boolean;
  mode: "move" | "copy";
  bucketName: string;
  currentPath: string;
  selectedCount: number;
  targetBucket: string | null;
  targetPath: string;
  isTransferring: boolean;
  infoMessage: string;
  availableBuckets?: string[];
  onClose: () => void;
  onTargetBucketChange: (bucket: string | null) => void;
  onTargetPathChange: (path: string) => void;
  onSubmit: () => void;
}

export const TransferModal = ({
  show,
  mode,
  bucketName,
  currentPath,
  selectedCount,
  targetBucket,
  targetPath,
  isTransferring,
  infoMessage,
  availableBuckets,
  onClose,
  onTargetBucketChange,
  onTargetPathChange,
  onSubmit,
}: TransferModalProps): JSX.Element | null => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={() => !isTransferring && onClose()}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>
          {mode === "move" ? "Move" : "Copy"} {selectedCount} Item(s)
        </h2>
        <p>
          From bucket: <strong>{bucketName}</strong>
        </p>
        {currentPath && (
          <p>
            From folder: <strong>{currentPath}</strong>
          </p>
        )}

        <div className="bucket-selector">
          <label htmlFor="destination-bucket-select">
            Select destination bucket:
          </label>
          <select
            id="destination-bucket-select"
            value={targetBucket || ""}
            onChange={(e) => onTargetBucketChange(e.target.value || null)}
            disabled={isTransferring}
          >
            <option value="">-- Choose a bucket --</option>
            {availableBuckets?.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </div>

        <div className="bucket-selector">
          <label htmlFor="destination-path-input">
            Destination folder path (optional):
          </label>
          <input
            id="destination-path-input"
            type="text"
            value={targetPath}
            onChange={(e) => onTargetPathChange(e.target.value)}
            disabled={isTransferring}
            placeholder="e.g., images/thumbnails or leave empty for root"
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: "1px solid #444",
              borderRadius: "4px",
              backgroundColor: "#2a2a2a",
              color: "#fff",
            }}
          />
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
            Leave empty to transfer to the root folder. End with / for folders.
          </p>
        </div>

        {isTransferring && (
          <div className="move-progress">
            <p>{infoMessage}</p>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button
            className="modal-button cancel"
            onClick={onClose}
            disabled={isTransferring}
          >
            Cancel
          </button>
          <button
            className={`modal-button ${mode === "move" ? "move" : "copy"}`}
            onClick={onSubmit}
            disabled={!targetBucket || isTransferring}
          >
            {isTransferring
              ? mode === "move"
                ? "Moving..."
                : "Copying..."
              : mode === "move"
                ? "Move Files"
                : "Copy Files"}
          </button>
        </div>
      </div>
    </div>
  );
};
