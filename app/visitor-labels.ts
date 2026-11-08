import type { Object3D, PerspectiveCamera } from "three";

export function createVisitorLabels(host: HTMLElement, camera: PerspectiveCamera) {
  const layer = document.createElement("div"); layer.className = "visitor-label-layer"; layer.setAttribute("aria-hidden", "true");
  (host.parentElement || host).appendChild(layer);
  const labels = new Map<Object3D, HTMLSpanElement>();
  function add(object: Object3D, name: string) {
    const label = document.createElement("span"); label.className = "visitor-name"; label.textContent = name;
    labels.set(object, label); layer.appendChild(label);
  }
  function update(scene: Object3D, isVisible: (object: Object3D) => boolean) {
    const width = host.clientWidth, height = host.clientHeight;
    labels.forEach((label, object) => {
      const point = object.getWorldPosition(camera.position.clone()); point.y += 2.15 * object.scale.y; point.project(camera);
      label.hidden = object.parent !== scene || !object.visible || !isVisible(object) || point.z <= -1 || point.z >= 1 || Math.abs(point.x) > 1.15 || Math.abs(point.y) > 1.15;
      if (label.hidden) return;
      const half = (label.offsetWidth || 110) / 2;
      label.style.left = `${Math.round(Math.max(half + 8, Math.min(width - half - 8, (point.x + 1) * width / 2)))}px`;
      label.style.top = `${Math.round(Math.max(30, Math.min(height - 20, (1 - point.y) * height / 2)))}px`;
    });
  }
  return { add, update, setName: (object: Object3D, name: string) => { const label = labels.get(object); if (label) label.textContent = name; }, remove: (object: Object3D) => { labels.get(object)?.remove(); labels.delete(object); }, dispose: () => { labels.clear(); layer.remove(); } };
}
