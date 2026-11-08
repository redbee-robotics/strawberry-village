export type FirstPersonView = { yaw: number; pitch: number; zoom: number };
type Position = { x: number; y: number; z: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pitchLimit = Math.PI / 2 - 0.12;

export function readFirstPersonView(saved?: unknown): FirstPersonView {
  const value = saved as Partial<FirstPersonView> | null;
  return {
    yaw: Number.isFinite(value?.yaw) ? Math.atan2(Math.sin(value!.yaw!), Math.cos(value!.yaw!)) : Math.PI,
    pitch: Number.isFinite(value?.pitch) ? clamp(value!.pitch!, -pitchLimit, pitchLimit) : -0.12,
    zoom: Number.isFinite(value?.zoom) ? clamp(value!.zoom!, 0.6, 1.2) : 1,
  };
}

export function turnFirstPerson(view: FirstPersonView, dx: number, dy: number): FirstPersonView {
  return readFirstPersonView({ ...view, yaw: view.yaw - dx * 0.004, pitch: view.pitch - dy * 0.004 });
}

export function zoomFirstPerson(view: FirstPersonView, factor: number): FirstPersonView {
  return readFirstPersonView({ ...view, zoom: view.zoom * factor });
}

export function firstPersonForward(view: FirstPersonView) {
  return { x: Math.sin(view.yaw), z: Math.cos(view.yaw) };
}

export function firstPersonFrame(position: Position, posture: "stand" | "sit" | "lie", view: FirstPersonView, mobile: boolean) {
  const eye = { ...position, y: position.y + (posture === "stand" ? 1.55 : posture === "sit" ? 1.05 : 0.95) };
  const horizontal = Math.cos(view.pitch), forward = firstPersonForward(view);
  return {
    eye,
    target: { x: eye.x + forward.x * horizontal, y: eye.y + Math.sin(view.pitch), z: eye.z + forward.z * horizontal },
    fov: clamp((mobile ? 86 : 78) * view.zoom, 45, 95),
  };
}
