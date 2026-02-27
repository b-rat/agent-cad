import { useMemo } from "react";
import { useModelStore } from "../store/useModelStore";
import type { FaceMetadata } from "../types";

function dot(a: number[], b: number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

function mag(v: number[]): number {
  return Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!);
}

function sub(a: number[], b: number[]): number[] {
  return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
}

function scale(v: number[], s: number): number[] {
  return [v[0]! * s, v[1]! * s, v[2]! * s];
}

function computeMeasurement(
  faces: FaceMetadata[],
  lengthScale: number,
  lengthUnit: string
): string | null {
  if (faces.length === 1) {
    const f = faces[0]!;
    if (f.surface_type === "cylindrical" && f.radius != null && f.arc_angle != null) {
      if (f.arc_angle >= 180) {
        const d = f.radius * 2 * lengthScale;
        return `Diameter: ${d.toFixed(3)} ${lengthUnit}`;
      } else {
        const r = f.radius * lengthScale;
        return `Radius: ${r.toFixed(3)} ${lengthUnit}`;
      }
    }
    return null;
  }

  if (faces.length === 2) {
    const f1 = faces[0]!;
    const f2 = faces[1]!;

    // Two planar faces
    if (f1.surface_type === "planar" && f2.surface_type === "planar") {
      const n1 = f1.normal;
      const n2 = f2.normal;
      const dotVal = Math.abs(dot(n1, n2));

      if (dotVal > 0.999) {
        const d = sub(f2.centroid, f1.centroid);
        const dist = Math.abs(dot(n1, d)) * lengthScale;
        return `Distance: ${dist.toFixed(3)} ${lengthUnit}`;
      } else {
        const angle = Math.acos(Math.min(1, Math.abs(dot(n1, n2))));
        return `Angle: ${((angle * 180) / Math.PI).toFixed(2)}deg`;
      }
    }

    // Two cylindrical faces
    if (f1.surface_type === "cylindrical" && f2.surface_type === "cylindrical") {
      if (!f1.axis_direction || !f2.axis_direction || !f1.axis_point || !f2.axis_point)
        return null;

      const d1 = f1.axis_direction;
      const d2 = f2.axis_direction;
      const axisDot = Math.abs(dot(d1, d2));

      if (axisDot > 0.999) {
        const v = sub(f2.axis_point, f1.axis_point);
        const proj = dot(v, d1);
        const perp = sub(v, scale(d1, proj));
        const dist = mag(perp) * lengthScale;
        return `Center distance: ${dist.toFixed(3)} ${lengthUnit}`;
      } else {
        const angle = Math.acos(Math.min(1, axisDot));
        return `Axis angle: ${((angle * 180) / Math.PI).toFixed(2)}deg`;
      }
    }

    // Cylindrical + planar
    const cyl =
      f1.surface_type === "cylindrical" ? f1 : f2.surface_type === "cylindrical" ? f2 : null;
    const pln =
      f1.surface_type === "planar" ? f1 : f2.surface_type === "planar" ? f2 : null;

    if (cyl && pln && cyl.axis_direction && cyl.axis_point) {
      const axisDot = Math.abs(dot(cyl.axis_direction, pln.normal));

      if (axisDot < 0.01) {
        const v = sub(cyl.axis_point, pln.centroid);
        const dist = Math.abs(dot(pln.normal, v)) * lengthScale;
        return `Axis-to-plane: ${dist.toFixed(3)} ${lengthUnit}`;
      } else {
        const angle = Math.asin(Math.min(1, axisDot));
        return `Axis-to-plane angle: ${((angle * 180) / Math.PI).toFixed(2)}deg`;
      }
    }
  }

  return null;
}

export default function MeasurementDisplay() {
  const selectedFaces = useModelStore((s) => s.selectedFaces);
  const facesMetadata = useModelStore((s) => s.facesMetadata);
  const modelInfo = useModelStore((s) => s.modelInfo);

  const measurement = useMemo(() => {
    if (!modelInfo || selectedFaces.size === 0 || selectedFaces.size > 2) return null;
    const faces = Array.from(selectedFaces)
      .map((id) => facesMetadata.find((f) => f.id === id))
      .filter((f): f is FaceMetadata => f !== undefined);
    if (faces.length === 0) return null;
    return computeMeasurement(
      faces,
      modelInfo.length_scale,
      modelInfo.length_unit
    );
  }, [selectedFaces, facesMetadata, modelInfo]);

  if (!measurement) return null;

  return <div className="measurement">{measurement}</div>;
}
