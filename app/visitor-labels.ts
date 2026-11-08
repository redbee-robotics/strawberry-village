import type { Object3D, PerspectiveCamera } from "three";

type Label = { root: HTMLSpanElement; name: HTMLSpanElement; bubble: HTMLSpanElement; line: SVGLineElement };
type Rect = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Rect, b: Rect) => a.left < b.right + 4 && a.right + 4 > b.left && a.top < b.bottom + 4 && a.bottom + 4 > b.top;
export function createVisitorLabels(host: HTMLElement, camera: PerspectiveCamera) {
  const layer = document.createElement("div"); layer.className = "visitor-label-layer"; layer.setAttribute("aria-hidden", "true");
  const links = document.createElementNS("http://www.w3.org/2000/svg", "svg"); links.setAttribute("class", "visitor-links"); layer.appendChild(links);
  (host.parentElement || host).appendChild(layer);
  const labels = new Map<Object3D, Label>();
  function add(object: Object3D, name: string) {
    const label = document.createElement("span"); label.className = "visitor-name";
    const text = document.createElement("span"); text.textContent = name;
    const bubble = document.createElement("span"); bubble.className = "visitor-speech"; bubble.hidden = true;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); line.style.display = "none"; links.appendChild(line);
    label.appendChild(text); label.appendChild(bubble); labels.set(object, { root: label, name: text, bubble, line }); layer.appendChild(label);
  }
  function update(scene: Object3D, isVisible: (object: Object3D) => boolean) {
    const width = host.clientWidth, height = host.clientHeight, bounds = host.getBoundingClientRect();
    const occupied: Rect[] = [...document.querySelectorAll<HTMLElement>(".place-label:not([hidden]), .inventory-cards, .village-map, .header-tools, .season-pill, .village-dock, .toast")].map((node) => node.getBoundingClientRect()).filter((box) => box.width && box.height).map((box) => ({ left: box.left - bounds.left, right: box.right - bounds.left, top: box.top - bounds.top, bottom: box.bottom - bounds.top }));
    labels.forEach(({ root: label, bubble, line }, object) => {
      const point = object.getWorldPosition(camera.position.clone()); point.y += 2.15 * object.scale.y; point.project(camera);
      label.hidden = object.parent !== scene || !object.visible || !isVisible(object) || point.z <= -1 || point.z >= 1 || Math.abs(point.x) > 1.15 || Math.abs(point.y) > 1.15;
      line.style.display = "none"; if (label.hidden) return;
      const boxWidth = Math.max(label.offsetWidth || 110, bubble.hidden ? 0 : bubble.offsetWidth), boxHeight = label.offsetHeight + (bubble.hidden ? 0 : bubble.offsetHeight + 7);
      const anchorX = (point.x + 1) * width / 2, anchorY = (1 - point.y) * height / 2;
      const clampX = (x: number) => Math.max(boxWidth / 2 + 8, Math.min(width - boxWidth / 2 - 8, x));
      const clampY = (y: number) => Math.max(boxHeight + 8, Math.min(height - 18, y));
      const candidates = [];
      for (let row = -10; row <= 10; row++) for (const column of [0, -1, 1]) {
        const x = clampX(anchorX + column * (boxWidth + 8)), y = clampY(anchorY + row * (boxHeight + 8));
        candidates.push({ x, y, distance: (x - anchorX) ** 2 + (y - anchorY) ** 2, rect: { left: x - boxWidth / 2, right: x + boxWidth / 2, top: y - boxHeight, bottom: y } });
      }
      candidates.sort((a, b) => a.distance - b.distance);
      const selected = candidates.find((candidate) => occupied.every((rect) => !overlaps(candidate.rect, rect))) || candidates[0];
      occupied.push(selected.rect); label.style.left = `${Math.round(selected.x)}px`; label.style.top = `${Math.round(selected.y)}px`;
      if (selected.distance > 14 ** 2) { line.style.display = ""; for (const [attribute, value] of Object.entries({ x1: selected.x, y1: selected.y, x2: anchorX, y2: anchorY })) line.setAttribute(attribute, String(value)); }
    });
  }
  return { add, update, setName: (object: Object3D, name: string) => { const label = labels.get(object); if (label) label.name.textContent = name; }, setSpeech: (object: Object3D, text: string) => { const label = labels.get(object); if (label) { label.bubble.textContent = text; label.bubble.hidden = !text; } }, remove: (object: Object3D) => { const label = labels.get(object); label?.root.remove(); label?.line.remove(); labels.delete(object); }, dispose: () => { labels.clear(); layer.remove(); } };
}
