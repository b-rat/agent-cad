import { useState, useCallback, useRef, useEffect } from "react";

interface FeatureNameDialogProps {
  faceCount: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function FeatureNameDialog({
  faceCount,
  onConfirm,
  onCancel,
}: FeatureNameDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
      setError("Use snake_case (e.g., mounting_boss)");
      return;
    }
    onConfirm(trimmed);
  }, [name, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") onCancel();
    },
    [handleConfirm, onCancel]
  );

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Create Feature</div>
        <div className="dialog-body">
          <p>{faceCount} face{faceCount !== 1 ? "s" : ""} selected</p>
          <input
            ref={inputRef}
            type="text"
            className="dialog-input"
            placeholder="feature_name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
          />
          {error && <p className="dialog-error">{error}</p>}
        </div>
        <div className="dialog-actions">
          <button className="dialog-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn-primary" onClick={handleConfirm}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
