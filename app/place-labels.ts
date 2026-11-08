import type { Object3D, PerspectiveCamera } from "three";
import type { GroundPoint } from "./navigation";

type Label = { object: Object3D; text: string };
type Rect = { x: number; y: number; w: number; h: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createPlaceLabels(host: HTMLElement, camera: PerspectiveCamera, labels: Label[], moveTo: (point: GroundPoint) => void) {
  const layer = document.createElement("div"); layer.className = "place-label-layer";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("aria-hidden", "true"); layer.appendChild(svg);
  const entries = labels.map(({ object, text }) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "place-label"; button.textContent = text;
    button.setAttribute("aria-label", `${text}로 이동`);
    button.addEventListener("click", () => moveTo(object.getWorldPosition(camera.position.clone())));
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); svg.appendChild(line); layer.appendChild(button);
    return { object, button, line };
  });
  (host.parentElement || host).appendChild(layer);
  let lastView = "", lastUpdate = 0;
  const observer = new ResizeObserver(() => { lastView = ""; });
  entries.forEach(({ button }) => observer.observe(button));
  void document.fonts.ready.then(() => { lastView = ""; });

  function update(visible: boolean) {
    layer.hidden = !visible;
    if (!visible) return;
    const width = host.clientWidth, height = host.clientHeight, mobile = width <= 760;
    const reserved = Array.from((host.parentElement || host).querySelectorAll<HTMLElement>(".right-rail,.inventory-cards,.village-map,.village-dock,.toast"))
      .map((element) => element.getBoundingClientRect()).filter((rect) => rect.width && rect.height)
      .map((rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height }));
    const view = [width, height, camera.fov, ...camera.position.toArray(), ...camera.quaternion.toArray(), ...reserved.flatMap((rect) => [rect.x, rect.y, rect.w, rect.h])].join(",");
    const now = performance.now();
    if (view === lastView || now - lastUpdate < 80) return;
    lastView = view; lastUpdate = now;
    const top = mobile ? 85 : 115, bottom = height - (mobile ? 155 : 120), placed: Rect[] = [...reserved];
    const sizes = entries.map(({ button }) => ({ w: button.offsetWidth || (mobile ? 100 : 110), h: button.offsetHeight || 30 }));
    entries.forEach(({ object, button, line }, index) => {
      const point = object.getWorldPosition(camera.position.clone()).project(camera);
      const onScreen = point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.25 && Math.abs(point.y) < 1.25;
      button.hidden = !onScreen; line.setAttribute("visibility", onScreen ? "visible" : "hidden");
      if (!onScreen) return;
      const { w, h } = sizes[index], anchorX = (point.x + 1) / 2 * width, anchorY = (1 - point.y) / 2 * height;
      const preferredX = clamp(anchorX, w / 2 + 12, width - w / 2 - 12), preferredY = clamp(anchorY, top + h / 2, bottom - h / 2);
      let position = { x: preferredX, y: preferredY, w, h }, best = Infinity;
      for (let row = -Math.ceil(height / (h + 7)); row <= Math.ceil(height / (h + 7)); row++) {
        for (let column = -Math.ceil(width / (w + 7)); column <= Math.ceil(width / (w + 7)); column++) {
          const x = clamp(preferredX + column * (w + 7), w / 2 + 12, width - w / 2 - 12);
          const y = clamp(preferredY + row * (h + 7), top + h / 2, bottom - h / 2);
          const cost = (x - preferredX) ** 2 + (y - preferredY) ** 2;
          if (cost >= best || placed.some((rect) => Math.abs(x - rect.x) < (w + rect.w) / 2 + 6 && Math.abs(y - rect.y) < (h + rect.h) / 2 + 6)) continue;
          best = cost; position = { x, y, w, h };
        }
      }
      placed.push(position);
      button.style.left = `${Math.round(position.x)}px`; button.style.top = `${Math.round(position.y)}px`;
      line.setAttribute("x1", String(anchorX)); line.setAttribute("y1", String(anchorY));
      line.setAttribute("x2", String(position.x)); line.setAttribute("y2", String(position.y));
    });
  }

  return { update, dispose: () => { observer.disconnect(); layer.remove(); } };
}
