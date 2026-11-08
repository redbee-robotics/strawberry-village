export type FollowView = { yaw: number; pitch: number; distance: number };
type Position = { x: number; y: number; z: number };
export type CameraBounds = { min: Position; max: Position };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function readFollowView(saved?: unknown): FollowView {
  const value = saved as Partial<FollowView> | null;
  return {
    yaw: Number.isFinite(value?.yaw) ? Math.atan2(Math.sin(value!.yaw!), Math.cos(value!.yaw!)) : Math.PI,
    pitch: Number.isFinite(value?.pitch) ? clamp(value!.pitch!, -1.05, -0.12) : -0.38,
    distance: Number.isFinite(value?.distance) ? clamp(value!.distance!, 3, 18) : 7.5,
  };
}

export function turnFollowView(view: FollowView, dx: number, dy: number): FollowView {
  return readFollowView({ ...view, yaw: view.yaw - dx * 0.004, pitch: view.pitch - dy * 0.004 });
}

export function zoomFollowView(view: FollowView, factor: number): FollowView {
  return readFollowView({ ...view, distance: view.distance * factor });
}

export function followForward(view: FollowView) {
  return { x: Math.sin(view.yaw), z: Math.cos(view.yaw) };
}

export function followFrame(position: Position, posture: "stand" | "sit" | "lie", view: FollowView, mobile: boolean, indoors: boolean | "cafe" = false) {
  const cafe = indoors === "cafe";
  const target = { ...position, y: position.y + (posture === "stand" ? (cafe ? 1.35 : 1.1) : posture === "sit" ? 0.85 : 0.75) };
  const distance = cafe ? clamp(view.distance, 6, 16) : Math.min(view.distance, indoors ? 8 : 18);
  const pitch = cafe ? Math.max(view.pitch, -0.38) : view.pitch;
  const horizontal = Math.cos(pitch) * distance, forward = followForward(view);
  return {
    target,
    eye: { x: target.x - forward.x * horizontal, y: target.y - Math.sin(pitch) * distance, z: target.z - forward.z * horizontal },
    fov: cafe ? (mobile ? 74 : 70) + (distance - 6) * 2 : mobile ? 65 : 60,
  };
}

// Shorten the orbit before solid geometry or rising terrain; never move its anchor.
export function constrainFollowEye(target: Position, eye: Position, blockers: CameraBounds[], ground?: (x: number, z: number) => number): Position {
  const delta = { x: eye.x - target.x, y: eye.y - target.y, z: eye.z - target.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  if (length < 0.001) return { ...eye };
  let fraction = 1;
  const axes = ["x", "y", "z"] as const;
  for (const bounds of blockers) {
    // A seated character can be inside the bounds of its own bench.
    if (axes.every((axis) => target[axis] >= bounds.min[axis] - 0.18 && target[axis] <= bounds.max[axis] + 0.18)) continue;
    let enter = 0, exit = fraction;
    for (const axis of axes) {
      const min = bounds.min[axis] - 0.18, max = bounds.max[axis] + 0.18;
      if (Math.abs(delta[axis]) < 1e-8) {
        if (target[axis] < min || target[axis] > max) { exit = -1; break; }
      } else {
        const a = (min - target[axis]) / delta[axis], b = (max - target[axis]) / delta[axis];
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (enter <= exit && exit >= 0) fraction = Math.min(fraction, Math.max(0, enter - 0.02 / length));
  }
  if (ground) {
    const steps = Math.ceil(length * fraction / 0.1);
    for (let i = 1; i <= steps; i++) {
      const t = fraction * i / steps;
      if (target.y + delta.y * t < ground(target.x + delta.x * t, target.z + delta.z * t) + 0.2) {
        fraction = fraction * (i - 1) / steps; break;
      }
    }
  }
  return { x: target.x + delta.x * fraction, y: target.y + delta.y * fraction, z: target.z + delta.z * fraction };
}
