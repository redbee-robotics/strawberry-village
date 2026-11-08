"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, Check, ChevronRight, Compass, Droplets, Footprints,
  HelpCircle, MessageCircle, Leaf, Minus, Moon, Plus, RotateCcw, Package, Coffee, ArrowDownWideNarrow, House, Users, Backpack, Armchair, BedDouble, Search, Cloud, CloudRain, Snowflake, CloudLightning,
  ShoppingBasket, SlidersHorizontal, Sun, Volume2, VolumeX, Wind, X,
} from "lucide-react";
import type { FarmWorld, FarmAction, FarmPlace, FarmAccess } from "./world";
import { blankSave, pickedBerry, readSave, totalBerries, type FarmSave } from "./farm-state";
import ConversationPanel from "./conversation";
import { emptyConversation } from "./chat";
import VillageMap from "./village-map";
import StationPanel, { Inventory, Bag } from "./stations";
import type { Station, RoomId } from "./village";
import { connectVillage } from "./presence";
import { watchNonsanWeather, type VillageWeather } from "./weather";

function Berry({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 36" fill="none" {...props}>
    <path d="M5 14C6 7 26 7 27 14c2 9-7 19-11 19S3 23 5 14Z" stroke="currentColor" strokeWidth="1.6" />
    <path d="m16 12-8-5 6 1 2-6 2 6 6-1-8 5Z" fill="currentColor" />
    <path d="m10 17 .5 1m5.5-2v1m5 0-.5 1m-8 4 .5 1m5-1-.5 1m-2 4v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>;
}

type Modal = "help" | "settings" | "basket" | "bag" | Station | null;

const storageKey = "strawberry-garden-v1";

export default function Farm() {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<FarmWorld | null>(null);
  const villageConnection = useRef<ReturnType<typeof connectVillage> | null>(null);
  const audio = useRef<{ context: AudioContext; stop: () => void } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropPress = useRef<{ x: number; y: number } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const actionToken = useRef(0);
  const [showChat, setShowChat] = useState(false);
  const [conversation, setConversation] = useState(emptyConversation);
  const [nearby, setNearby] = useState<{ id: string; name: string }[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [showZoomControls, setShowZoomControls] = useState(false);
  const [ready, setReady] = useState(false);
  const [worldVersion, setWorldVersion] = useState(0);
  const [bedAccess, setBedAccess] = useState<FarmAccess>({ water: false, harvest: false, sit: false, lie: false, posture: "stand", inspect: false, inspecting: false });
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [sound, setSound] = useState(false);
  const [weather, setWeather] = useState<VillageWeather | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const period = weather?.phase || "day";
  const [reducedMotion, setReducedMotion] = useState(false);
  const [active, setActive] = useState<FarmAction>("walk");
  const [place, setPlace] = useState<FarmPlace>("yard");
  const [room, setRoom] = useState<RoomId>("outside");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameFeedback, setNicknameFeedback] = useState("");
  const [activeDrink, setActiveDrink] = useState("");
  const [saved, setSaved] = useState<FarmSave>(blankSave);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("가고 싶은 곳을 클릭하거나 터치해 보세요.");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (stored) setSaved(readSave(stored));
      const drink = localStorage.getItem("strawberry-held-drink-v1");
      if (drink && ["딸기 라떼", "딸기 우유", "딸기 차"].includes(drink)) setActiveDrink(drink);
      setShowZoomControls(localStorage.getItem("strawberry-show-zoom-controls") === "true");
    } catch { /* A private session can still enjoy the farm. */ }
    setLoaded(true);
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let disposed = false;
    import("./world").then(({ createFarmWorld }) => {
      if (!mount.current || disposed) return;
      const world = createFarmWorld(mount.current, (text) => setMessage(text), (station) => { setModal(station); setPlace(station); setMessage(station === "cafe" ? "딸기 카페에 도착했어요." : "딸기 선별장에 도착했어요."); }, setBedAccess, setRoom);
      if (disposed) world.dispose();
      else { engine.current = world; setReady(true); setWorldVersion((version) => version + 1); }
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; engine.current?.dispose(); engine.current = null; };
  }, []);

  useEffect(() => {
    if (loaded) try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Storage is optional. */ }
  }, [saved, loaded]);
  useEffect(() => {
    if (loaded) try { localStorage.setItem("strawberry-show-zoom-controls", String(showZoomControls)); } catch { /* Storage is optional. */ }
  }, [showZoomControls, loaded]);
  useEffect(() => watchNonsanWeather((data) => { setWeather(data); setWeatherFailed(false); }, () => setWeatherFailed(true)), []);
  useEffect(() => { if (weather) engine.current?.setWeather(weather); }, [weather, ready, worldVersion]);
  useEffect(() => { engine.current?.setReducedMotion(reducedMotion); }, [reducedMotion, ready, worldVersion]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3800);
    return () => window.clearTimeout(timeout);
  }, [message]);
  useEffect(() => {
    if (!ready || !engine.current) return;
    const connection = connectVillage(engine.current, setOnline, (name) => { setNickname(name); setNicknameDraft(name); }, setConversation);
    villageConnection.current = connection;
    return () => { connection(); villageConnection.current = null; };
  }, [ready, worldVersion]);
  useEffect(() => {
    if (!ready) return;
    const refresh = () => { const next = engine.current?.nearbyVisitors() || []; setNearby((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); };
    refresh(); const timer = window.setInterval(refresh, 250);
    return () => window.clearInterval(timer);
  }, [ready, worldVersion]);
  useEffect(() => { engine.current?.setBasket(saved.raw.length); engine.current?.setBag(saved.boxes); }, [saved.raw.length, saved.boxes, ready, worldVersion]);
  useEffect(() => { engine.current?.setDrink(!!activeDrink); if (loaded) try { if (activeDrink) localStorage.setItem("strawberry-held-drink-v1", activeDrink); else localStorage.removeItem("strawberry-held-drink-v1"); } catch {} }, [activeDrink, ready, worldVersion, loaded]);
  useEffect(() => { engine.current?.setPaused(!!modal); }, [modal, ready, worldVersion]);
  useEffect(() => {
    if (!modal) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const panel = modalRef.current;
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setModal(null); return; }
      if (e.key !== "Tab" || !panel) return;
      const buttons = Array.from(panel.querySelectorAll<HTMLElement>("button, input, textarea, [tabindex='0']"));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); previousFocus.current?.focus(); };
  }, [modal]);
  useEffect(() => () => { const playing = audio.current; audio.current = null; if (playing && playing.context.state !== "closed") { playing.stop(); void playing.context.close(); } }, []);

  const notify = (text: string) => setMessage(text);

  async function toggleSound() {
    if (sound) { await audio.current?.context.suspend(); setSound(false); return; }
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const master = context.createGain(); master.gain.value = 0.075; master.connect(context.destination);
        const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
        const data = buffer.getChannelData(0); let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * 0.018) / 1.02; data[i] = last * 4; }
        const wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true;
        const lowpass = context.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.frequency.value = 1100;
        wind.connect(lowpass); lowpass.connect(master); wind.start();
        const chirp = () => {
          if (context.state !== "running") return;
          const t = context.currentTime, oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = "sine"; oscillator.frequency.setValueAtTime(1800 + Math.random() * 800, t);
          oscillator.frequency.exponentialRampToValueAtTime(3600, t + 0.08);
          oscillator.frequency.exponentialRampToValueAtTime(2200, t + 0.2);
          gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.12, t + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          oscillator.connect(gain); gain.connect(master); oscillator.start(t); oscillator.stop(t + 0.3);
        };
        const interval = window.setInterval(chirp, 4800);
        audio.current = { context, stop: () => { window.clearInterval(interval); wind.stop(); } };
      }
      await audio.current.context.resume(); setSound(true);
    } catch { notify("이 브라우저에서는 소리를 켤 수 없어요."); }
  }

  async function doAction(type: FarmAction) {
    if (!engine.current || (type !== "walk" && busy)) return;
    if (type === "drink" && !activeDrink) return;
    const token = ++actionToken.current;
    setActive(type);
    if (type === "walk") {
      engine.current.cancel(); setBusy(false);
      notify("가고 싶은 곳을 클릭하거나 터치해 보세요.");
      return;
    }
    setBusy(true); setMessage(type === "drink" ? `${activeDrink}를 마시는 중이에요.` : type === "water" ? "딸기에 물을 주는 중이에요." : "잘 익은 딸기를 수확하는 중이에요.");
    const result = await engine.current.perform(type);
    if (token !== actionToken.current) return;
    setBusy(false);
    if (result === "cancelled") { setActive("walk"); return; }
    if (result === "far") { setActive("walk"); notify("하우스의 딸기 재배대 가까이를 클릭하거나 터치해 이동해 주세요."); return; }
    if (result === "empty") { setActive("walk"); notify(type === "drink" ? "먼저 카페에서 음료를 받아 주세요." : "딸기가 다시 익을 때까지 물을 주며 기다려볼까요?"); return; }
    if (type === "drink") { try { localStorage.removeItem("strawberry-held-drink-v1"); } catch {} setActiveDrink(""); engine.current?.setDrink(false); setActive("walk"); notify("음료를 다 마셨어요."); return; }
    if (type === "water") {
      setSaved((s) => ({ ...s, watered: s.watered + 1 })); notify("촉촉한 흙 냄새. 딸기가 한 뼘 더 자랐어요.");
    } else {
      setSaved((s) => ({ ...s, raw: [...s.raw, pickedBerry(s.harvested)], harvested: s.harvested + 1 })); notify("빨갛게 익은 딸기 한 알을 수확했어요.");
    }
  }

  function served(name: string) { setModal(null); setActiveDrink(name); engine.current?.setDrink(true); notify(`${name}를 받았어요. 마시기를 눌러 즐겨보세요.`); }
  type VisibleAction = "water" | "harvest" | "sit" | "lie" | "inspect" | "talk" | "drink";
  const contextActions: VisibleAction[] = room.startsWith("house-") ? ["water", "harvest"] : [];
  if (bedAccess.sit) contextActions.push("sit");
  if (bedAccess.lie) contextActions.push("lie");
  if (bedAccess.inspect) contextActions.push("inspect");
  if (nearby.length) contextActions.push("talk");
  if (activeDrink) contextActions.push("drink");
  const contextKey = (action: VisibleAction) => contextActions.indexOf(action) + 1;
  function triggerAction(action: VisibleAction) {
    if (action === "talk") { if (nearby.length) setShowChat(true); }
    else if (action === "inspect") engine.current?.inspectBed();
    else if (action === "sit" || action === "lie") engine.current?.pose(action);
    else if (!busy) void doAction(action);
  }
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (modal || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const action = contextActions[Number(event.key) - 1];
      if (action) { event.preventDefault(); triggerAction(action); }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [modal, ready, busy, place, bedAccess, room, nearby, activeDrink]);

  const WeatherIcon = weather?.snow ? Snowflake : weather && weather.code >= 95 ? CloudLightning : weather && weather.precipitation > 0 ? CloudRain : weather && weather.cloud > 50 ? Cloud : weather && !weather.isDay ? Moon : Sun;

  return <main className={`farm-app follow-camera ${period} ${room !== "outside" ? "interior" : ""} ${reducedMotion ? "reduce-motion" : ""}`}>
    <div ref={mount} className="world" aria-label="논밭과 딸기 하우스, 작업장과 카페가 있는 3D 농장 마을" />
    <div className="world-wash" aria-hidden="true" />

    <header className="topbar">

      <div className="season-pill"><span className="live-dot" /><Users size={15} /><span>{online === null ? "마을 연결 중" : `${online}명 접속 중`}</span><span className="pill-separator" /><WeatherIcon size={15} /><span>{weather ? `${weather.description} ${weather.temperature.toFixed(1)}°` : weatherFailed ? "날씨 확인 중" : "날씨 연결 중"}</span></div>
      <div className="header-tools">
        <button className={`icon-button ${sound ? "is-on" : ""}`} onClick={toggleSound} aria-label={sound ? "자연 소리 끄기" : "자연 소리 켜기"} aria-pressed={sound} title="자연 소리">{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        <button className="icon-button" onClick={() => setModal("help")} aria-label="농장 이용 안내" title="이용 안내"><HelpCircle size={19} /></button>
        <span className="tool-divider" />
        <button className="icon-button" onClick={() => setModal("settings")} aria-label="설정" title="설정"><SlidersHorizontal size={19} /></button>
      </div>
    </header>

    <h1 className="sr-only">온라인 딸기 농장</h1>
    {room === "outside" && <aside id="village-map" className={`village-map ${showMap ? "" : "is-minimized"}`} aria-label="마을 둘러보기">
      {!showMap ? <button className="map-minimized-button" onClick={() => setShowMap(true)} aria-label="마을 지도 펼치기" aria-expanded={false}><Compass size={16} /><strong>마을 지도</strong><Plus size={15} /></button> : <>
      <div className="map-heading"><Compass size={16} /><strong>마을 지도</strong><button className="icon-button map-minimize" onClick={() => setShowMap(false)} aria-label="마을 지도 최소화" aria-expanded={true} title="지도 최소화"><Minus size={16} /></button></div>
      <VillageMap />
      <div className="map-legend"><span><House size={15} />딸기 하우스</span><span><Package size={15} />딸기 선별장</span><span><Coffee size={15} />딸기 카페</span></div>
      </>}
    </aside>}

    {room !== "outside" && <div className="room-banner"><House size={20} /><h2>{room.startsWith("house") ? "딸기 하우스" : room === "cafe" ? "딸기 카페" : "딸기 선별장"}</h2></div>}
    {bedAccess.inspecting && <div className="inspection-title"><Search size={17} />고설 베드 살펴보기 <span>{contextKey("inspect")}번으로 돌아가기</span></div>}
    {showZoomControls && <aside className="right-rail" aria-label="화면 조절">
      <button className="icon-button" onClick={() => engine.current?.zoom(0.82)} aria-label="농장 확대" disabled={!ready}><Plus size={18} /></button>
      <span />
      <button className="icon-button" onClick={() => engine.current?.zoom(1.22)} aria-label="농장 축소" disabled={!ready}><Minus size={18} /></button>
    </aside>}

    <div className="inventory-cards">
      <button className="basket-card" onClick={() => setModal("basket")} aria-label={`바구니, 딸기 ${saved.raw.length}알`}>
        <span className="basket-illustration"><ShoppingBasket size={27} strokeWidth={1.35} /><span className="tiny-berry"><Berry size={14} /></span></span>
        <span className="basket-copy"><small>바구니</small><strong>{saved.raw.length}<span>알</span></strong></span>
        <ArrowUpRight size={15} className="basket-arrow" />
      </button>
      <button className="bag-card" onClick={() => setModal("bag")} aria-label={`가방, 딸기 ${saved.boxes}팩`}><Backpack size={28} strokeWidth={1.4} /><span><small>가방</small><strong>{saved.boxes}<span>팩</span></strong></span><ArrowUpRight size={15} /></button>
    </div>
    <footer className="bottom-bar">
      {contextActions.length > 0 && <nav className="action-dock village-dock" aria-label="농장에서 할 일">
        {room.startsWith("house-") && <button className={active === "water" ? "dock-action selected water" : "dock-action"} onClick={() => void doAction("water")} disabled={!ready || busy || !bedAccess.water} aria-pressed={active === "water"} title={bedAccess.water ? "베드에 물 주기" : "딸기 베드 가까이 이동해 주세요"}><Droplets size={23} /><span>{busy && active === "water" ? "물 주는 중" : "물 주기"}</span><i>{contextKey("water")}</i></button>}
        {room.startsWith("house-") && <button className={active === "harvest" ? "dock-action selected berry" : "dock-action"} onClick={() => void doAction("harvest")} disabled={!ready || busy || !bedAccess.harvest} aria-pressed={active === "harvest"} title={bedAccess.harvest ? "가까운 딸기 수확" : "잘 익은 딸기 가까이 이동해 주세요"}><Berry size={23} /><span>{busy && active === "harvest" ? "수확 중" : "수확"}</span><i>{contextKey("harvest")}</i></button>}
        {bedAccess.sit && <button className="dock-action context-action" aria-keyshortcuts={String(contextKey("sit"))} onClick={() => engine.current?.pose("sit")}><Armchair size={23} /><span>{bedAccess.posture === "sit" ? "일어나기" : "앉기"}</span><i>{contextKey("sit")}</i></button>}
        {bedAccess.lie && <button className="dock-action context-action" aria-keyshortcuts={String(contextKey("lie"))} onClick={() => engine.current?.pose("lie")}><BedDouble size={23} /><span>{bedAccess.posture === "lie" ? "일어나기" : "눕기"}</span><i>{contextKey("lie")}</i></button>}
        {bedAccess.inspect && <button className="dock-action context-action" aria-keyshortcuts={String(contextKey("inspect"))} onClick={() => engine.current?.inspectBed()}><Search size={23} /><span>{bedAccess.inspecting ? "돌아가기" : "살펴보기"}</span><i>{contextKey("inspect")}</i></button>}
        {nearby.length > 0 && <button className="dock-action context-action" aria-keyshortcuts={String(contextKey("talk"))} onClick={() => setShowChat(true)}><MessageCircle size={23} /><span>말 걸기</span><i>{contextKey("talk")}</i></button>}
        {activeDrink && <button className="dock-action context-action" disabled={!ready || busy} aria-keyshortcuts={String(contextKey("drink"))} aria-label={`${activeDrink} 마시기`} onClick={() => void doAction("drink")}><Coffee size={23} /><span>{busy && active === "drink" ? "마시는 중" : "마시기"}</span><i>{contextKey("drink")}</i></button>}
      </nav>}
      <div className="mouse-guide"><span>방향키 / 바닥 클릭 <b>걷기</b></span><span>드래그 <b>둘러보기</b></span><span>스페이스바 <b>점프</b></span><span>휠 <b>확대/축소</b></span></div>
    </footer>

    {showChat && !modal && <aside className="conversation-panel" aria-label="주변 대화" onKeyDown={(event) => { if (event.key === "Escape") { setShowChat(false); mount.current?.querySelector("canvas")?.focus(); } }}>
      <header><h2><MessageCircle size={17} />주변 대화</h2><button className="icon-button" aria-label="대화창 닫기" onClick={() => { setShowChat(false); mount.current?.querySelector("canvas")?.focus(); }}><X size={18} /></button></header>
      <ConversationPanel conversation={conversation} nearby={nearby.map((visitor) => visitor.name)} send={(text) => villageConnection.current?.say(text) || Promise.resolve({ ok: false, message: "지금은 대화에 연결할 수 없어요." })} />
    </aside>}
    {activeDrink && <span className="held-drink"><Coffee size={16} />{activeDrink}</span>}
    {message && <div className="toast" role="status" aria-live="polite"><Check size={15} />{message}</div>}

    {!ready && !error && <div className="loading-screen"><Berry size={44} /><span>초록빛 농장을 가꾸는 중</span><small>햇살이 들어올 자리를 만들고 있어요.</small><div className="loading-track"><i /></div></div>}
    {error && <div className="loading-screen"><Leaf size={36} /><h2>농장을 열지 못했어요.</h2><p>3D 화면을 지원하는 브라우저에서 다시 들어와 주세요.</p><button className="primary-button" onClick={() => window.location.reload()}>다시 들어가기 <RotateCcw size={15} /></button></div>}

    {modal && <div className="modal-backdrop" onPointerDownCapture={(event) => { backdropPress.current = event.isPrimary && event.target === event.currentTarget ? { x: event.clientX, y: event.clientY } : null; }} onPointerCancel={() => { backdropPress.current = null; }} onClick={(event) => { const start = backdropPress.current; backdropPress.current = null; if (start && event.target === event.currentTarget && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) setModal(null); }}>
      <div className={`modal ${modal === "sorting" || modal === "packing" || modal === "cafe" ? "station-modal" : ""}`} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="닫기"><X size={21} /></button>
        <span className="eyebrow"><span />{modal === "help" ? "WELCOME TO OUR LITTLE FARM" : modal === "settings" ? "MAKE YOURSELF AT HOME" : "LITTLE MOMENTS, LITTLE HARVEST"}</span>
        <h2 id="modal-title">{modal === "help" ? "딸기마을에서 보내는 시간" : modal === "settings" ? "설정" : modal === "sorting" ? "딸기 선별장" : modal === "packing" ? "딸기 선별장" : modal === "cafe" ? "딸기 카페" : modal === "bag" ? "가방" : "바구니"}</h2>
        {modal === "help" && <>
          <p className="modal-intro">정해진 순서도, 해야 할 일도 없어요.<br />당신의 속도로 머물러 주세요.</p>
          <div className="help-list">
            <div><Footprints /><span><strong>천천히 걸어요</strong><small>가고 싶은 곳을 클릭하거나 터치하면 그곳으로 걸어가요. 방향키로 걷고 스페이스바로 점프해요.</small></span></div>
            <div><Compass /><span><strong>내 캐릭터를 따라 둘러봐요</strong><small>가까운 3인칭 시점으로 내 캐릭터와 주변을 봐요. 드래그하면 캐릭터를 중심으로 회전하고, 걸으면 화면이 따라와요. 휠이나 핀치로 가까운 범위에서 확대·축소해요.</small></span></div>
            <div><Droplets /><span><strong>작은 마음을 나눠요</strong><small>딸기 베드 가까이 가면 물 주기와 수확 버튼이 켜져요. 낱알은 바구니에 담겨요.</small></span></div>
            <div><Package /><span><strong>바구니를 들고 선별장으로</strong><small>선별장에 걸어 들어가면 바구니 속 딸기를 팩에 담을 수 있어요.</small></span></div>
            <div><Coffee /><span><strong>카페도 걸어서 들어가요</strong><small>딸기 카페 안의 점원에게 음료를 주문하고, 받은 뒤 마시기 버튼이나 표시된 숫자키로 마실 수 있어요.</small></span></div>
          </div>
          <div className="help-contribute"><p>당신도 딸기마을에 기여할 수 있어요.</p><a href="https://github.com/redbee-robotics/strawberry-village" target="_blank" rel="noreferrer">github.com/redbee-robotics/strawberry-village <ArrowUpRight size={14} /></a></div>
        </>}
        {modal === "settings" && <>
          <form className="nickname-setting" onSubmit={(event) => { event.preventDefault(); const result = villageConnection.current?.changeName(nicknameDraft); setNicknameFeedback(result?.message || "마을에 연결된 뒤 다시 변경해 주세요."); }}>
            <label htmlFor="village-nickname">닉네임</label><div><input id="village-nickname" value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} maxLength={16} autoComplete="nickname" placeholder={nickname || "닉네임"} /><button type="submit">변경</button></div>
            {nicknameFeedback && <p role="status">{nicknameFeedback}</p>}
          </form>
          <div className="setting-row"><span><strong>자연의 소리</strong><small>잎을 스치는 바람과 작은 새소리</small></span><button className={`switch ${sound ? "checked" : ""}`} role="switch" aria-checked={sound} aria-label="자연의 소리" onClick={toggleSound}><span /></button></div>
          <div className="setting-row"><span><strong>확대·축소 버튼</strong><small>화면 오른쪽에 시점 조절 버튼 표시</small></span><button className={`switch ${showZoomControls ? "checked" : ""}`} role="switch" aria-checked={showZoomControls} aria-label="확대·축소 버튼" onClick={() => setShowZoomControls((shown) => !shown)}><span /></button></div>

        </>}
        {modal === "basket" && <Inventory saved={saved} />}
        {modal === "bag" && <Bag saved={saved} />}
        {(modal === "sorting" || modal === "packing" || modal === "cafe") && <StationPanel key={modal} station={modal} saved={saved} update={setSaved} notify={notify} served={served} heldDrink={activeDrink} />}

      </div>
    </div>}
  </main>;
}
