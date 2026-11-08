import { BedDouble, Coffee, House, Mountain, Package } from "lucide-react";
import { HOUSE_CENTERS, PADDY_PLOTS } from "./locations";
import { MAP_BOUNDS } from "./terrain";

const position = (x: number, z: number) => ({ left: `${(x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * 100}%`, top: `${(z - MAP_BOUNDS.minZ) / (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) * 100}%` });
export default function VillageMap() {
  return <div className="map-art map-landscape" aria-hidden="true">
    <span className="map-mountain" />
    {PADDY_PLOTS.map((plot, i) => <span key={i} className={`map-plot ${plot.gold ? "gold" : ""}`} style={{ ...position(plot.x, plot.z), width: `${plot.width / 140 * 100}%`, height: `${plot.depth / 142 * 100}%` }} />)}
    {[-19, 1].map((z) => <span key={z} className="map-marker map-house-pair" title="딸기 하우스" style={position(0, z)}><House /><House /></span>)}
    {HOUSE_CENTERS.filter(([x]) => Math.abs(x) > 10).map(([x, z]) => <span key={x} className="map-marker" title="딸기 하우스" style={position(x, z)}><House /></span>)}
    <span className="map-marker" title="딸기 카페" style={position(24, -.7)}><Coffee /></span>
    <span className="map-marker" title="딸기 선별장" style={position(0, 20)}><Package /></span>
    <span className="map-marker" title="뒷산 정상" style={position(0, -66)}><Mountain /></span>
    <span className="map-marker" title="평상" style={position(-33, 19.2)}><BedDouble /></span>
  </div>;
}
