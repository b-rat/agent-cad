import { useCallback, useRef } from "react";
import { useModelStore } from "../store/useModelStore";
import type { UploadResponse } from "../types";

export default function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoaded = useModelStore((s) => s.isLoaded);
  const filename = useModelStore((s) => s.filename);
  const selectedFaces = useModelStore((s) => s.selectedFaces);
  const multiSelectMode = useModelStore((s) => s.multiSelectMode);
  const xrayMode = useModelStore((s) => s.xrayMode);
  const wireframeVisible = useModelStore((s) => s.wireframeVisible);
  const colorsVisible = useModelStore((s) => s.colorsVisible);
  const clipPlane = useModelStore((s) => s.clipPlane);
  const clipOffset = useModelStore((s) => s.clipOffset);
  const features = useModelStore((s) => s.features);

  const loadModel = useModelStore((s) => s.loadModel);
  const clearSelection = useModelStore((s) => s.clearSelection);
  const toggleMultiSelect = useModelStore((s) => s.toggleMultiSelect);
  const setXray = useModelStore((s) => s.setXray);
  const setWireframe = useModelStore((s) => s.setWireframe);
  const setColors = useModelStore((s) => s.setColors);
  const setClipPlane = useModelStore((s) => s.setClipPlane);
  const setClipOffset = useModelStore((s) => s.setClipOffset);
  const flipClip = useModelStore((s) => s.flipClip);
  const fitAll = useModelStore((s) => s.fitAll);

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data: UploadResponse = await res.json();
        if (data.success && data.mesh && data.faces && data.info && data.filename) {
          loadModel(data.mesh, data.faces, data.info, data.filename);
        } else {
          console.error("Upload failed:", data.error);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    },
    [loadModel]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file && /\.(step|stp)$/i.test(file.name)) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleExport = useCallback(async () => {
    const { features } = useModelStore.getState();
    const exportData: Record<string, { face_id: number; sub_name: string | null }[]> = {};
    for (const [name, feat] of Object.entries(features)) {
      exportData[name] = feat.faces;
    }

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: exportData }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition");
        const match = disposition?.match(/filename="?([^"]+)"?/);
        const fname = match?.[1] ?? "model_named.step";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export error:", err);
    }
  }, []);

  return (
    <>
      {/* Drag-drop zone */}
      <div
        className="viewer-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".step,.stp"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div className="viewer-toolbar">
        {/* Import */}
        <button className="tb-btn" onClick={() => fileInputRef.current?.click()} title="Import STEP file">
          Import
        </button>

        {filename && <span className="tb-filename">{filename}</span>}

        {isLoaded && (
          <>
            <span className="tb-divider" />

            {/* View */}
            <button className="tb-btn" onClick={fitAll} title="Fit model to view">
              Fit All
            </button>

            <span className="tb-divider" />

            {/* Selection */}
            <button className="tb-btn" onClick={clearSelection} title="Clear selection (Esc)"
              disabled={selectedFaces.size === 0}>
              Clear Sel
            </button>
            <button
              className={`tb-btn ${multiSelectMode ? "tb-active" : ""}`}
              onClick={toggleMultiSelect}
              title="Toggle multi-select"
            >
              Multi
            </button>

            <span className="tb-divider" />

            {/* Display */}
            <button
              className={`tb-btn ${xrayMode ? "tb-active" : ""}`}
              onClick={() => setXray(!xrayMode)}
              title="X-Ray mode (X)"
            >
              X-Ray
            </button>
            <button
              className={`tb-btn ${wireframeVisible ? "tb-active" : ""}`}
              onClick={() => setWireframe(!wireframeVisible)}
              title="Toggle wireframe"
            >
              Wire
            </button>
            <button
              className={`tb-btn ${colorsVisible ? "tb-active" : ""}`}
              onClick={() => setColors(!colorsVisible)}
              title="Toggle feature colors"
            >
              Colors
            </button>

            <span className="tb-divider" />

            {/* Clip */}
            {(["XY", "YZ", "XZ"] as const).map((p) => (
              <button
                key={`clip-${p}`}
                className={`tb-btn ${clipPlane === p ? "tb-active" : ""}`}
                onClick={() => setClipPlane(p)}
                title={`Clip ${p}`}
              >
                Clip{p}
              </button>
            ))}
            {clipPlane && (
              <>
                <button className="tb-btn" onClick={flipClip} title="Flip clipping direction">
                  Flip
                </button>
                <input
                  type="range"
                  className="tb-slider"
                  min={-100}
                  max={100}
                  value={clipOffset}
                  onChange={(e) => setClipOffset(Number(e.target.value))}
                  title="Clip offset"
                />
              </>
            )}

            {Object.keys(features).length > 0 && (
              <>
                <span className="tb-divider" />
                <button className="tb-btn" onClick={handleExport} title="Export named STEP">
                  Export
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
