"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Coffee, Droplets, Leaf, Package, Plus, ShoppingBasket } from "lucide-react";
import { PACK_SIZE, packBerryCount, cafeBerries, emptyPackSlots, gradeNames, movePackBerry, spendCafeBerries, packFromBasket, type FarmSave, type Grade, type PackSlots } from "./farm-state";
import type { Station } from "./village";

export function Fruit({ grade = "large", size = 64 }: { grade?: Grade; size?: number }) {
  return <svg width={size} height={size * 1.15} viewBox="0 0 80 92" aria-label={gradeNames[grade]} role="img">
    <defs><linearGradient id={`fruit-${grade}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#ea8a6c" /><stop offset="1" stopColor="#b83f37" /></linearGradient></defs>
    <path d="M14 35C13 16 68 15 67 35c-1 22-18 49-27 49S15 57 14 35Z" fill={`url(#fruit-${grade})`} />
    <path d="m40 29-21-9 16 1 5-17 5 17 17-1-22 9Z" fill="#668650" />
    <g fill="#f5d7a2">{[[25, 36], [40, 36], [55, 36], [30, 48], [48, 48], [25, 57], [40, 61], [53, 57], [36, 73]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="1.4" ry="2.4" transform={`rotate(${i % 2 ? 12 : -12},${x},${y})`} />)}</g>
    {grade === "processing" && <path d="M53 44c8 1 10 10 4 15-9 6-15-10-4-15Z" fill="#8b5143" opacity=".7" />}
  </svg>;
}

export function Inventory({ saved }: { saved: FarmSave }) {
  return <>
    <div className="inventory-summary"><ShoppingBasket size={24} /><strong>{saved.raw.length}<small>알</small></strong><span>바구니 속 딸기</span></div>
    <div className="carried-basket readonly-basket">{saved.raw.length ? saved.raw.map((berry) => <div className="basket-fruit" key={berry.id}><Fruit grade={berry.grade} size={43} /><span>{berry.weight}g</span></div>) : <div className="basket-empty"><ShoppingBasket size={30} /><span>아직 바구니가 비어 있어요.</span><small>하우스에서 딸기를 수확해 담아보세요.</small></div>}</div>
    <p className="inventory-instruction">선별장에 걸어 들어가면<br />딸기를 골라 팩에 담을 수 있어요.</p>
    <p className="basket-note">지금까지 {saved.harvested}알 수확 · {saved.watered}번 물 주기</p>
  </>;
}

export function Bag({ saved }: { saved: FarmSave }) {
  return <>
    <div className="inventory-summary"><Package size={25} /><strong>{saved.boxes}<small>팩</small></strong><span>가방에 담긴 딸기 팩</span></div>
    <div className="bag-packs">{saved.boxes ? Array.from({ length: Math.min(saved.boxes, 12) }, (_, i) => { const size = packBerryCount(saved, i); return <div className="bag-pack" key={i}><div className={`mini-punnet pack-size-${size}`}>{Array.from({ length: size }, (_, n) => <Fruit key={n} size={size > 4 ? 14 : 22} />)}</div><span>딸기 {size}알 · 1팩</span></div>; }) : <div className="basket-empty"><Package size={32} /><span>아직 포장한 팩이 없어요.</span><small>바구니의 딸기를 선별장에서 포장해 주세요.</small></div>}</div>
    {saved.boxes > 12 && <p className="basket-note">이 밖에도 {saved.boxes - 12}팩이 가방에 있어요.</p>}
    <p className="inventory-instruction">완성된 팩은 바구니에서 가방으로 옮겨져요.</p>
  </>;
}

type Props = {
  station: Station;
  saved: FarmSave;
  update: (updater: (state: FarmSave) => FarmSave) => void;
  notify: (text: string) => void;
  served: (name: string) => void;
};
const drinks = [
  { id: "latte", name: "딸기 라떼", english: "STRAWBERRY LATTE", cost: 2, description: "달콤한 딸기와 부드러운 우유", color: "#e8a496" },
  { id: "milk", name: "딸기 우유", english: "STRAWBERRY MILK", cost: 1, description: "과육이 톡톡, 시원한 한 잔", color: "#efc3b4" },
  { id: "tea", name: "딸기 차", english: "WARM STRAWBERRY TEA", cost: 1, description: "논길 바람을 녹이는 따뜻한 차", color: "#c77e61" },
];

export default function StationPanel({ station, saved, update, notify, served }: Props) {
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<PackSlots>(emptyPackSlots);
  type FruitDrag = { id: string; pointer: number; startX: number; startY: number; x: number; y: number; active: boolean };
  const dragRef = useRef<FruitDrag | null>(null);
  const dragScroller = useRef<HTMLElement | null>(null);
  const [drag, setDrag] = useState<FruitDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const ignoreClickUntil = useRef(0);
  const [ordered, setOrdered] = useState<string | null>(null);
  const orderGuard = useRef(false);
  const selectedIds = selected.filter((id): id is string => id !== null);
  const selectedCount = selectedIds.length;
  const available = saved.raw.filter((berry) => !selected.includes(berry.id));
  const draggedBerry = drag && saved.raw.find((berry) => berry.id === drag.id);
  function putInSlot(id: string, index?: number) {
    if (!saved.raw.some((berry) => berry.id === id)) return;
    setSelected((slots) => movePackBerry(slots, id, index ?? slots.findIndex((value) => value === null)));
  }
  function dropAt(x: number, y: number) {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-packing-drop]")?.dataset.packingDrop || null;
  }
  function startDrag(event: React.PointerEvent<HTMLButtonElement>, id: string | null) {
    if (!id || event.button !== 0 || !event.isPrimary) return;
    ignoreClickUntil.current = 0;
    dragScroller.current = event.currentTarget.closest<HTMLElement>(".modal");
    dragRef.current = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointer !== event.pointerId || (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 7)) return;
    event.preventDefault();
    current.active = true; current.x = event.clientX; current.y = event.clientY;
    setDrag({ ...current }); setDropTarget(dropAt(event.clientX, event.clientY));
  }
  function endDrag(event: React.PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = dragRef.current;
    if (!current || current.pointer !== event.pointerId) return;
    dragRef.current = null; setDrag(null); setDropTarget(null);
    if (!current.active) return;
    event.preventDefault(); ignoreClickUntil.current = performance.now() + 400;
    if (cancelled) return;
    const target = dropAt(event.clientX, event.clientY);
    if (target === "basket") setSelected((slots) => movePackBerry(slots, current.id, null));
    else if (target?.startsWith("slot-")) putInSlot(current.id, Number(target.slice(5)));
  }
  useEffect(() => {
    if (!drag?.active) return;
    let frame = 0;
    const scroll = () => {
      const panel = dragScroller.current;
      if (panel) {
        const bounds = panel.getBoundingClientRect(), before = panel.scrollTop;
        if (drag.y > bounds.bottom - 48) panel.scrollTop += 9;
        else if (drag.y < bounds.top + 48) panel.scrollTop -= 9;
        if (panel.scrollTop !== before) setDropTarget(dropAt(drag.x, drag.y));
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [drag?.active, drag?.x, drag?.y]);
  const canClick = (event: React.MouseEvent) => event.detail === 0 || performance.now() >= ignoreClickUntil.current;
  function pack() {
    const next = packFromBasket(saved, selectedIds);
    if (!next) return;
    update(() => next); setSelected(emptyPackSlots());
    setFeedback("바구니의 딸기 12알을 한 팩으로 포장했어요."); notify("포장한 딸기 1팩을 가방에 넣었어요.");
  }
  function order(drink: typeof drinks[number]) {
    if (orderGuard.current) return;
    const next = spendCafeBerries(saved, drink.cost);
    if (!next) { setFeedback("수확한 딸기가 조금 더 필요해요."); return; }
    orderGuard.current = true;
    update(() => next); setOrdered(drink.name); setFeedback(""); notify(`${drink.name} 한 잔이 준비됐어요.`);
  }
  return <>
    {station !== "cafe" && <>
      <p className="modal-intro">바구니에서 딸기 12알을 골라주세요.<br />선별을 완료하면 포장된 팩이 가방에 들어가요.</p>
      <div className="basket-packing-heading"><span><ShoppingBasket size={18} />바구니</span><strong>{available.length}알</strong></div>
      <div className={`carried-basket packing-drop-basket ${dropTarget === "basket" ? "drop-highlight" : ""}`} data-packing-drop="basket" aria-label="가져온 바구니 속 딸기">
        {available.length ? available.map((berry) => <button key={berry.id} className={`berry-draggable ${drag?.id === berry.id ? "drag-source" : ""}`} onPointerDown={(event) => startDrag(event, berry.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={(event) => endDrag(event, true)} onClick={(event) => { if (canClick(event)) putInSlot(berry.id); }} aria-label={`${berry.weight}g 딸기 팩에 담기`}><Fruit grade={berry.grade} size={berry.grade === "regular" ? 41 : 49} /><span>{berry.weight}g</span></button>) : <div className="basket-empty"><ShoppingBasket size={30} /><span>{selectedCount ? "고른 딸기가 팩에 담겼어요." : "바구니가 비어 있어요."}</span><small>{selectedCount ? "팩 속 딸기를 바구니로 드래그하거나 눌러 되돌려요." : "하우스에서 딸기를 수확해 가져와 주세요."}</small></div>}
      </div>
      <div className="punnet" aria-label={`딸기 팩, ${PACK_SIZE}칸 중 ${selectedCount}칸 채움`}>
        <div className="punnet-lid" aria-hidden="true" />
        <div className="punnet-slots">{selected.map((id, i) => { const berry = saved.raw.find((item) => item.id === id); return <button key={i} className={`tray-slot ${berry ? "filled berry-draggable" : ""} ${dropTarget === `slot-${i}` ? "drop-highlight" : ""} ${drag?.id === id ? "drag-source" : ""}`} data-packing-drop={`slot-${i}`} onPointerDown={(event) => startDrag(event, id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={(event) => endDrag(event, true)} onClick={(event) => { if (id && canClick(event)) setSelected((slots) => movePackBerry(slots, id, null)); }} aria-label={berry ? `${i + 1}번 칸 딸기 바구니로 돌려놓기` : `${i + 1}번 빈 칸`}>{berry ? <Fruit grade={berry.grade} size={54} /> : <span>{i + 1}</span>}</button>; })}</div>
      </div>
      <div className="packing-total"><span>포장한 딸기</span><strong>{saved.boxes}팩</strong><span>{selectedCount} / {PACK_SIZE}알</span></div>
      <button className="primary-button" onClick={pack} disabled={selectedCount !== PACK_SIZE}>선별 완료 · 1팩 만들기<Package size={18} /></button>
      {feedback && <p className="station-feedback" role="status">{feedback}</p>}
      {draggedBerry && createPortal(<div className="berry-drag-preview" aria-hidden="true" style={{ left: drag!.x, top: drag!.y }}><Fruit grade={draggedBerry.grade} size={50} /><span>{draggedBerry.weight}g</span></div>, document.body)}
    </>}
    {station === "cafe" && <>
      <p className="modal-intro">어서 오세요. 딸기 카페입니다.<br />수확한 딸기로 주문해 주세요. 한 잔 정성껏 만들어드릴게요.</p>
      <div className="cafe-balance"><Leaf size={16} /><span>주문에 쓸 수 있는 딸기</span><strong>{cafeBerries(saved)}알</strong></div>
      <p className="cafe-stock-note">바구니와 가방의 딸기를 합산해요. 팩을 열어 쓰고 남은 딸기는 바구니에 담겨요.</p>
      {ordered ? <div className="order-ready"><div className="cafe-cup large-cup"><span /><i /></div><h3>{ordered}가 준비됐어요.</h3><p>논밭을 바라보며 즐겨주세요.</p><button className="primary-button" onClick={() => served(ordered)}>음료 받기<Coffee size={18} /></button></div> : <div className="cafe-menu">{drinks.map((drink) => <button key={drink.id} onClick={() => order(drink)} aria-label={`${drink.name}, 딸기 ${drink.cost}알로 주문하기`}><div className={`cafe-cup ${drink.id}`} style={{ "--drink-color": drink.color } as React.CSSProperties}><span /><i /></div><span className="drink-description"><small>{drink.english}</small><strong>{drink.name}</strong><span>{drink.description}</span></span><span className="drink-price">딸기 <b>{drink.cost}알</b><Plus size={16} /></span></button>)}</div>}
      {feedback && <p className="station-feedback wrong" role="status">{feedback}</p>}
    </>}
  </>;
}
