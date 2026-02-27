import { useState, useCallback, useMemo } from "react";
import { useModelStore } from "../store/useModelStore";

export default function FaceListPanel() {
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"id" | "area">("id");

  const isLoaded = useModelStore((s) => s.isLoaded);
  const facesMetadata = useModelStore((s) => s.facesMetadata);
  const selectedFaces = useModelStore((s) => s.selectedFaces);
  const faceToFeature = useModelStore((s) => s.faceToFeature);
  const selectFace = useModelStore((s) => s.selectFace);
  const setHoveredFace = useModelStore((s) => s.setHoveredFace);

  // Unique surface types
  const surfaceTypes = useMemo(() => {
    const types = new Set(facesMetadata.map((f) => f.surface_type));
    return Array.from(types).sort();
  }, [facesMetadata]);

  // Filtered + sorted list
  const displayFaces = useMemo(() => {
    let list = facesMetadata;
    if (filterType !== "all") {
      list = list.filter((f) => f.surface_type === filterType);
    }
    if (sortBy === "area") {
      list = [...list].sort((a, b) => b.area - a.area);
    }
    return list;
  }, [facesMetadata, filterType, sortBy]);

  const handleClick = useCallback(
    (faceId: number, e: React.MouseEvent) => {
      selectFace(faceId, e.shiftKey);
    },
    [selectFace]
  );

  if (!isLoaded) {
    return (
      <div className="facelist-panel">
        <p className="panel-placeholder">No model loaded</p>
      </div>
    );
  }

  return (
    <div className="facelist-panel">
      {/* Filters */}
      <div className="facelist-filters">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="facelist-select"
        >
          <option value="all">All types</option>
          {surfaceTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "id" | "area")}
          className="facelist-select"
        >
          <option value="id">Sort by ID</option>
          <option value="area">Sort by Area</option>
        </select>
        <span className="facelist-count">{displayFaces.length} faces</span>
      </div>

      {/* Face rows */}
      <div className="facelist-rows">
        {displayFaces.map((face) => {
          const featureName = faceToFeature[face.id];
          const isSelected = selectedFaces.has(face.id);
          return (
            <div
              key={face.id}
              className={`face-row ${isSelected ? "face-row-selected" : ""}`}
              onClick={(e) => handleClick(face.id, e)}
              onMouseEnter={() => setHoveredFace(face.id)}
              onMouseLeave={() => setHoveredFace(-1)}
            >
              <span className="face-id">#{face.id}</span>
              <span className={`type-badge type-${face.surface_type}`}>
                {face.surface_type}
              </span>
              <span className="face-area">
                {face.area.toFixed(2)}
              </span>
              {featureName && (
                <span className="face-feature-tag">{featureName}</span>
              )}
              {face.step_name && !featureName && (
                <span className="face-step-tag">{face.step_name}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
