import { useState, useCallback } from "react";
import { useModelStore } from "../store/useModelStore";
import MeasurementDisplay from "./MeasurementDisplay";
import FeatureNameDialog from "./FeatureNameDialog";

export default function FeaturesPanel() {
  const [showDialog, setShowDialog] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const isLoaded = useModelStore((s) => s.isLoaded);
  const selectedFaces = useModelStore((s) => s.selectedFaces);
  const facesMetadata = useModelStore((s) => s.facesMetadata);
  const features = useModelStore((s) => s.features);
  const createFeature = useModelStore((s) => s.createFeature);
  const deleteFeature = useModelStore((s) => s.deleteFeature);

  const handleCreateFeature = useCallback(
    (name: string) => {
      const result = createFeature(name);
      if (result.success) {
        setShowDialog(false);
      } else {
        alert(result.error);
      }
    },
    [createFeature]
  );

  const handleFeatureClick = useCallback(
    (name: string) => {
      const store = useModelStore.getState();
      const feature = store.features[name];
      if (!feature) return;
      const newSet = new Set(feature.faces.map((m) => m.face_id));
      useModelStore.setState({ selectedFaces: newSet });
    },
    []
  );

  if (!isLoaded) {
    return (
      <div className="features-panel">
        <p className="panel-placeholder">Import a STEP file to begin</p>
      </div>
    );
  }

  // Selection info
  const selArray = Array.from(selectedFaces);
  const selMeta = selArray
    .map((id) => facesMetadata.find((f) => f.id === id))
    .filter(Boolean);
  const typeSet = new Set(selMeta.map((m) => m!.surface_type));

  return (
    <div className="features-panel">
      {/* Selection info */}
      <div className="section">
        <div className="section-title">Selection</div>
        {selArray.length === 0 ? (
          <p className="section-hint">Click faces to select</p>
        ) : (
          <>
            <p>
              {selArray.length} face{selArray.length !== 1 ? "s" : ""} selected
              {typeSet.size > 0 && (
                <span className="type-list">
                  {" "}({Array.from(typeSet).join(", ")})
                </span>
              )}
            </p>
            <MeasurementDisplay />
            <button
              className="panel-btn"
              onClick={() => setShowDialog(true)}
            >
              Create Feature
            </button>
          </>
        )}
      </div>

      {/* Features list */}
      <div className="section">
        <div className="section-title">
          Features ({Object.keys(features).length})
        </div>
        {Object.entries(features).map(([name, feat]) => (
          <div key={name} className="feature-item">
            <div
              className="feature-header"
              onClick={() =>
                setExpandedFeature(expandedFeature === name ? null : name)
              }
            >
              <span
                className="feature-swatch"
                style={{
                  backgroundColor: `rgb(${feat.color.map((c) => Math.round(c * 255)).join(",")})`,
                }}
              />
              <span
                className="feature-name"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFeatureClick(name);
                }}
              >
                {name}
              </span>
              <span className="feature-count">{feat.faces.length}</span>
              <button
                className="feature-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFeature(name);
                }}
                title="Delete feature"
              >
                x
              </button>
            </div>
            {expandedFeature === name && (
              <div className="feature-members">
                {feat.faces.map((m) => {
                  const meta = facesMetadata.find((f) => f.id === m.face_id);
                  return (
                    <div key={m.face_id} className="feature-member">
                      <span className="member-id">#{m.face_id}</span>
                      {m.sub_name && (
                        <span className="member-sub">{m.sub_name}</span>
                      )}
                      {meta && (
                        <span className={`type-badge type-${meta.surface_type}`}>
                          {meta.surface_type}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {showDialog && (
        <FeatureNameDialog
          faceCount={selectedFaces.size}
          onConfirm={handleCreateFeature}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
