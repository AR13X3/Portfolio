// The camera for SiteScore → NASA Space Apps: from SiteScore's Parramatta hex map, up over
// New South Wales and back down over a classified target. Everything is placed in one
// equirectangular frame in kilometres, so each layer is a rectangle on it.
import { HEAT_GEO } from '../../chapters/sitescore/heat';

const LAT0 = -34.4;
const KX = Math.cos((LAT0 * Math.PI) / 180) * 111.32;
const KY = 110.57;

export interface Box {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

/** Kilometres east and south of 0°, -0°. */
export const project = (lon: number, lat: number): [number, number] => [lon * KX, -lat * KY];
export const unproject = (x: number, y: number): [number, number] => [x / KX, -y / KY];
export const boxKm = (b: Box) => {
  const [x0, y0] = project(b.lonMin, b.latMax);
  const [x1, y1] = project(b.lonMax, b.latMin);
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
};

// Imagery, each as fetched from NASA GIBS (EPSG:4326, so degrees map linearly to pixels).
/** NASA MODIS (Aqua) corrected reflectance, 11 Sep 2026: New South Wales, west of Sydney. */
export const NSW: Box = { lonMin: 145.8, lonMax: 152.2, latMin: -36.3, latMax: -32.7 };
/**
 * NASA HLS (Harmonized Landsat and Sentinel-2, 30 m) around the target: the per-pixel median of
 * the cloud-free passes from August to October 2026, so the ground reads clear at the end.
 */
export const TARGET: Box = { lonMin: 145.617, lonMax: 147.983, latMin: -33.983, latMax: -32.717 };
/** SiteScore's opportunity map. */
export const HEAT: Box = HEAT_GEO;

/** A camera: centre (km) and the span of the view's longer side (km). */
export type View = [number, number, number];

const heat = boxKm(HEAT);
/** Street level over Parramatta: the whole council map fills the frame. */
export const START: View = [heat.x0 + heat.w / 2, heat.y0 + heat.h / 2, heat.w * 0.92];
/**
 * Where the target box is drawn: an arbitrary inland point, deliberately unrelated to the
 * project, so the ground can be shown clearly.
 */
export const END: View = [...project(146.8, -33.35), 140];

/**
 * Smooth zoom and pan (van Wijk & Nuij 2003, as d3.interpolateZoom): the shortest-feeling
 * path between two views, zooming out over the distance and back in.
 */
export function zoomPath(p0: View, p1: View, rho = Math.SQRT2) {
  const [ux0, uy0, w0] = p0;
  const [ux1, uy1, w1] = p1;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  const d1 = Math.sqrt(d2);
  const r2 = rho * rho;
  const r4 = r2 * r2;
  const b0 = (w1 * w1 - w0 * w0 + r4 * d2) / (2 * w0 * r2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - r4 * d2) / (2 * w1 * r2 * d1);
  const q0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const q1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (q1 - q0) / rho;
  const at = (t: number): View => {
    const s = t * S;
    const c0 = Math.cosh(q0);
    const u = (w0 / (r2 * d1)) * (c0 * Math.tanh(rho * s + q0) - Math.sinh(q0));
    return [ux0 + u * dx, uy0 + u * dy, (w0 * c0) / Math.cosh(rho * s + q0)];
  };
  /** Where along the path the view is widest. */
  const peak = Math.min(1, Math.max(0, -q0 / rho / S));
  return { at, peak };
}
