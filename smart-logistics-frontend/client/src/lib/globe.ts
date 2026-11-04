export const globePoint = (lat: number, lng: number) => {
  const p = (lat * Math.PI) / 180,
    l = (lng * Math.PI) / 180;
  return [
    Math.cos(p) * Math.sin(l),
    Math.sin(p),
    Math.cos(p) * Math.cos(l),
  ] as const;
};
export function rotatePoint(
  point: readonly number[],
  yaw: number,
  pitch: number
) {
  const [x, y, z] = point,
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    a = x * c + z * s,
    b = -x * s + z * c;
  return [
    a,
    y * Math.cos(pitch) - b * Math.sin(pitch),
    y * Math.sin(pitch) + b * Math.cos(pitch),
  ] as const;
}
export function projectPoint(
  point: readonly number[],
  yaw: number,
  pitch: number,
  distance: number,
  width: number,
  height: number
) {
  const [x, y, z] = rotatePoint(point, yaw, pitch),
    f = 1 / Math.tan(Math.PI / 8),
    depth = distance - z;
  return {
    x: width / 2 + (x * f * height) / (2 * depth),
    y: height / 2 - (y * f * height) / (2 * depth),
    visible: z > 1 / distance,
  };
}
