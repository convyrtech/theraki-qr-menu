"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./wheel.css";

type Dish = { img: string; name: string; desc: string; price: string; unit: string; full?: string; parts?: string };

const DISHES: Dish[] = [
  { img: "/images/cutout/shrimp-mix.webp", name: "Креветки на льду", desc: "Магаданская и медведка 70/90 в одной подаче, на колотом льду.", price: "6 000", unit: "кг", full: "Две северные креветки в одной подаче: сладковатая магаданская и шипастая медведка, калибр 70/90. На колотом льду, с лимоном и соусами на выбор.", parts: "Креветка магаданская, креветка-медведка, лёд, лимон, микрозелень." },
  { img: "/images/cutout/hot-fishcrab.webp", name: "Фиш-энд-краб", desc: "Филе белой рыбы и мясо краба в невесомом хрустящем кляре.", price: "2 800", unit: "400 г", full: "Наша роскошная версия мирового хита: нежное филе белой рыбы и деликатесное мясо краба в невесомом хрустящем кляре. Подаётся с соусом тартар.", parts: "Филе белой рыбы, мясо краба, кляр, соус тартар, розмарин." },
  { img: "/images/cutout/vongole-arrabiata.webp", name: "Вонголе арабьята", desc: "Ракушки вонголе в остром томатном соусе, с хрустящим хлебом.", price: "2 900", unit: "кг", full: "Ракушки вонголе, томлёные в остром томатном соусе арабьята с чесноком и чили. Подаются с хрустящим деревенским хлебом для соуса.", parts: "Вонголе, томаты, чеснок, чили, оливковое масло, хлеб." },
  { img: "/images/cutout/mussels-tomyam.webp", name: "Мидии том-ям", desc: "Мидии в кокосовом том-ям с чили и кинзой.", price: "2 900", unit: "кг", full: "Мидии в ароматном кокосовом том-ям с лемонграссом, чили и кинзой. Острый паназиатский бульон, в который просится хлеб.", parts: "Мидии, кокосовое молоко, лемонграсс, чили, кинза, лайм." },
  { img: "/images/cutout/hot-hotdog.webp", name: "Хот-дог с крабом", desc: "Мягкая бриошь, щедрая порция мяса краба и спелое авокадо.", price: "1 300", unit: "190 г", full: "Высокая кухня в формате стритфуда: мягкая бриошь до золотистой корочки, щедрая порция сладковатого мяса краба и нежная текстура спелого авокадо.", parts: "Булочка бриошь, мясо краба, авокадо, соус, микрозелень." },
  { img: "/images/cutout/starter-potato.webp", name: "Картофель с килькой", desc: "Молодой картофель с пряной рыбкой, красным луком и тартаром.", price: "650", unit: "180 г", full: "Обжаренный молодой картофель с пряной балтийской килькой, красным маринованным луком и соусом тартар. Тёплая закуска с северным характером.", parts: "Бейби-картофель, килька балтийская, красный лук, тартар." },
  { img: "/images/cutout/hot-grenki.webp", name: "Бородинские гренки", desc: "Хрустящие гренки с донским укропом.", price: "500", unit: "180 г", full: "Хрустящие бородинские гренки, натёртые чесноком, с донским укропом. Идеальная пара к пиву и к соусам из морепродуктов.", parts: "Бородинский хлеб, чеснок, укроп, масло, соль." },
];

const TABS: { label: string; icon: ReactNode }[] = [
  { label: "Закуски", icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4v16M8 8l8 8" /></> },
  { label: "Мидии", icon: <><path d="M4 9c4 7 12 7 16 0" /><path d="M12 9v7" /><path d="M4 9c2-3 14-3 16 0" /></> },
  { label: "Креветки", icon: <><path d="M5 8c6 0 10 3 13 8" /><path d="M18 16c-2-1-5-1-7 1" /><path d="M5 8c-1 4 1 7 4 8" /></> },
  { label: "Горячее", icon: <><path d="M12 3c2 3-1 4 0 7 1 2 3 0 3 3a3 3 0 0 1-6 0c0-2 2-3 3-10z" /><path d="M6 14a3 3 0 0 0 4 5" /></> },
  { label: "Десерты", icon: <><path d="M5 11h14l-2 9H7z" /><path d="M9 11a3 3 0 0 1 6 0" /><path d="M12 4v3" /></> },
];

export default function WheelCategory() {
  const railRef = useRef<HTMLDivElement>(null);
  const dishRefs = useRef<(HTMLDivElement | null)[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(2);
  const [detail, setDetail] = useState(false);
  const detModeRef = useRef(false);

  const rot = useRef(2);
  const vel = useRef(0);
  const dragging = useRef(false);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const focusRef = useRef(-1);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const N = DISHES.length;
    const STEP = (40 * Math.PI) / 180; // равный угловой шаг
    const DISC = 116;
    const vh = () => window.innerHeight;
    const vw = () => window.innerWidth;

    const geom = () => {
      const w = vw(), h = vh();
      return { cx: w * 1.33, cy: h * 0.46, R: w * 0.62 };
    };

    const placeRail = () => {
      const { cx, cy, R } = geom();
      const el = railRef.current;
      if (!el) return;
      el.style.width = `${2 * R}px`;
      el.style.height = `${2 * R}px`;
      el.style.left = `${cx - R}px`;
      el.style.top = `${cy - R}px`;
    };

    const render = () => {
      const { cx, cy, R } = geom();
      // деталь-режим: фокус-блюдо вырастает в крупное фото справа, прочие уходят
      if (detModeRef.current) {
        const fi = focusRef.current < 0 ? 0 : focusRef.current;
        for (let i = 0; i < N; i++) {
          const el = dishRefs.current[i];
          if (!el) continue;
          if (i === fi) {
            const X = vw() * 0.64, Y = vh() * 0.30;
            el.style.transform = `translate3d(${(X - DISC / 2).toFixed(1)}px, ${(Y - DISC / 2).toFixed(1)}px, 0)`;
            el.style.opacity = "1";
            el.style.zIndex = "120";
            el.classList.add("is-focus");
            el.classList.remove("show-label");
          } else {
            el.style.opacity = "0";
            el.classList.remove("show-label");
          }
        }
        return;
      }
      let nearest = 0, nd = 99;
      for (let i = 0; i < N; i++) {
        const el = dishRefs.current[i];
        if (!el) continue;
        const a = (i - rot.current) * STEP;
        const aa = Math.abs(a);
        if (aa < nd) { nd = aa; nearest = i; }
        const X = cx - Math.cos(a) * R; // блюдо ровно на радиусе дуги
        const Y = cy + Math.sin(a) * R;
        const op = aa > 1.75 ? 0 : Math.max(0, 1.25 - aa * 0.62);
        el.style.transform = `translate3d(${(X - DISC / 2).toFixed(1)}px, ${(Y - DISC / 2).toFixed(1)}px, 0)`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(100 - Math.round(aa * 20));
        el.classList.toggle("is-focus", aa < 0.35);
        // подпись — только у соседей НИЖЕ зоны карточки (иначе налезает на заголовок)
        el.classList.toggle("show-label", aa > 0.35 && aa < 1.25 && Y > vh() * 0.4);
      }
      if (nearest !== focusRef.current) { focusRef.current = nearest; setFocus(nearest); }
    };

    let raf = 0;
    const loop = () => {
      if (!dragging.current) {
        rot.current += vel.current;
        vel.current *= 0.9;
        const max = N - 1;
        if (rot.current < 0) { rot.current *= 0.8; vel.current = 0; }
        if (rot.current > max) { rot.current = max + (rot.current - max) * 0.8; vel.current = 0; }
        if (Math.abs(vel.current) < 0.0015) {
          const target = Math.max(0, Math.min(max, Math.round(rot.current)));
          rot.current += (target - rot.current) * 0.16;
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };

    placeRail();
    render();
    if (!reduce) raf = requestAnimationFrame(loop);

    const onDown = (e: PointerEvent) => {
      if (detModeRef.current) return;
      const t = e.target as HTMLElement | null;
      // не крутить на интерактиве (карточка/кнопки/табы/шапка) и в левой текст-зоне
      if (t && t.closest(".cat__detail, .cat__tabs, .cat__header")) return;
      if (e.clientX < window.innerWidth * 0.42) return; // хитбокс — только правая зона колеса
      dragging.current = true; lastY.current = e.clientY; lastT.current = e.timeStamp; vel.current = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || detModeRef.current) return;
      const dy = e.clientY - lastY.current;
      const dt = Math.max(1, e.timeStamp - lastT.current);
      const dRot = -dy / 130;
      rot.current += dRot;
      vel.current = dRot * (16 / dt);
      lastY.current = e.clientY; lastT.current = e.timeStamp;
    };
    const onUp = () => { dragging.current = false; };
    const onWheel = (e: WheelEvent) => { if (detModeRef.current) return; e.preventDefault(); rot.current += e.deltaY / 380; vel.current = 0; };
    const onResize = () => { placeRail(); render(); };

    const surf = railRef.current?.parentElement?.parentElement ?? window;
    surf.addEventListener("pointerdown", onDown as EventListener);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    surf.addEventListener("wheel", onWheel as EventListener, { passive: false });
    window.addEventListener("resize", onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      surf.removeEventListener("pointerdown", onDown as EventListener);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      surf.removeEventListener("wheel", onWheel as EventListener);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    el.removeAttribute("data-anim");
    void el.offsetWidth;
    el.setAttribute("data-anim", "1");
  }, [focus]);

  useEffect(() => { detModeRef.current = detail; }, [detail]);

  const d = DISHES[focus];

  return (
    <div className={"cat" + (detail ? " is-detail" : "")}>
      <header className="cat__header">
        <div className="cat__brand">
          <span className="cat__eyebrow">Раковарня · Москва</span>
          The <em>Raki</em>
        </div>
        <button className="cat__burger" aria-label="Меню"><span /><span /><span /></button>
      </header>

      {/* сплошная дуга-трасса */}
      <div className="cat__rail" ref={railRef} aria-hidden />

      {/* колесо */}
      <div className="cat__stage">
        {DISHES.map((dish, i) => (
          <div className="cat__dish" key={dish.name} ref={(el) => { dishRefs.current[i] = el; }}>
            <span className="cat__dish-label">
              <span className="cat__dish-lname">{dish.name}</span>
              <span className="cat__dish-lprice">{dish.price} ₽</span>
            </span>
            <div className="cat__disc">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dish.img} alt={dish.name} draggable={false} />
            </div>
          </div>
        ))}
      </div>

      {/* детальная карточка фокус-блюда */}
      <div className="cat__detail" ref={detailRef} data-anim="1">
        <h1 className="cat__d-name">{d.name}</h1>
        <div className="cat__d-rule" />
        <p className="cat__d-desc">{detail ? d.full ?? d.desc : d.desc}</p>
        {detail && d.parts ? (
          <div className="cat__d-parts">
            <span className="cat__d-parts-h">Состав</span>
            <p>{d.parts}</p>
          </div>
        ) : null}
        <p className="cat__d-price">{d.price} ₽<small> · {d.unit}</small></p>
        <div className="cat__d-actions">
          <button className="cat__d-more" onClick={() => setDetail((v) => !v)}>
            {detail ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
                Свернуть
              </>
            ) : (
              <>
                Подробнее
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* подсказка */}
      <div className="cat__hint">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M9 11V6a2 2 0 0 1 4 0v5" /><path d="M13 8a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4 2-1 2 3V8a2 2 0 0 1 4 0" /></svg>
        Прокрутите колесо
      </div>

      {/* таб-бар категорий */}
      <nav className="cat__tabs">
        {TABS.map((t, i) => (
          <button className={"cat__tab" + (i === 0 ? " is-active" : "")} key={t.label}>
            <svg viewBox="0 0 24 24">{t.icon}</svg>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
