"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { chapters, rakiChapter, formatNumber, type MenuEntry } from "@/data/menu";
import "./menu.css";
import "../wheel/wheel.css"; // переиспользуем готовое боковое колесо (.cat*) с анимациями

// Раки — отдельная глава в menu.ts; вводим как секцию (размер → ₽/кг).
const RAKI_SECTION = {
  id: "raki",
  title: "Раки",
  lede: undefined as string | undefined,
  origin: undefined as string | undefined,
  entries: rakiChapter.sizes.map((s) => ({
    name: `Раки · ${s.tier}`,
    price: s.price,
    unit: "кг",
    note: `${s.countPerKg} шт/кг`,
    signature: false,
    spicy: false,
    group: undefined as string | undefined,
  })),
};

const SECTIONS = [RAKI_SECTION, ...chapters];

const LABEL: Record<string, string> = {
  raki: "Раки", crab: "Краб", shrimp: "Креветки", starters: "Закуски",
  salads: "Салаты", hot: "Горячее", soups: "Супы", mussels: "Мидии",
  vongole: "Вонголе", mains: "Основные", garnish: "Гарниры", sauces: "Соусы",
  desserts: "Десерты", tea: "Чай", soft: "Воды", beer: "Пиво",
};

const CAT_FACE: Record<string, string> = {
  shrimp: "/images/cutout/shrimp-mix.webp",
  starters: "/images/cutout/starter-potato.webp",
  hot: "/images/cutout/hot-hotdog.webp",
  soups: "/images/cutout/soup-port.webp",
  mussels: "/images/cutout/mussels-tomyam.webp",
  vongole: "/images/cutout/vongole-arrabiata.webp",
  salads: "/images/cutout/salads.webp",
  mains: "/images/cutout/mains.webp",
};

// эмблема-плейсхолдер для категорий без фото — волна (морской мотив, как hero),
// читается как задумка, а не «недогруженное фото». Заменяется на фото по номерам владельца.
const CAT_ICON: ReactNode = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 14.2c2-2.5 3.8-2.5 5.6 0s3.6 2.5 5.6 0 3.8-2.5 5.2-0.8" />
    <path d="M5 9.6c1.7-2.1 3.1-2.1 4.6 0s2.9 2.1 4.6 0 3.1-2.1 4.3-0.7" />
  </svg>
);

// маркеры из дока: чили — острота, помидор — рецепт «Дон с помидором». Отрисованы вручную, выверены по пикселям.
const ChiliIcon: ReactNode = (
  <svg className="mn__glyph mn__glyph--chili" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15.6 5.6c2.7 1.4 3.4 5.4 1.2 9.4c-1.9 3.2-4.9 5.2-7 4.1c-1.5-.8-1.5-2.7.3-4.4c2.7-2.5 4-5.6 3-8.5" />
    <path d="M14.7 5.1c-.6-1.7-2.4-2.3-4-1.5" />
  </svg>
);
const TomatoIcon: ReactNode = (
  <svg className="mn__glyph mn__glyph--tomato" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="14.4" r="6.1" />
    <path d="M12 8.3V5.3M12 8.3c-1.1-.1-2.1-1-2.5-2.2M12 8.3c1.1-.1 2.1-1 2.5-2.2" />
  </svg>
);

const DISH_PHOTO: Record<string, string> = {
  "Микс на льду: магаданская и медведка 70/90": "/images/cutout/shrimp-mix.webp",
  "Медведка на льду 70/90": "/images/cutout/shrimp-medvedka.webp",
  "Мидии в соусе": "/images/cutout/mussels-tomyam.webp",
  "Вонголе в соусе": "/images/cutout/vongole-arrabiata.webp",
  "Фиш-энд-краб": "/images/cutout/hot-fishcrab.webp",
  "Гурмэ хот-дог с крабом и авокадо": "/images/cutout/hot-hotdog.webp",
  "Хрустящие бородинские гренки с донским укропом": "/images/cutout/hot-grenki.webp",
  "Золотистый бейби-картофель с балтийской килькой": "/images/cutout/starter-potato.webp",
  "Португальский суп с раковыми шейками": "/images/cutout/soup-port.webp",
};

/* ---------- РАКИ: доска размеров + рецепты (отварные/жареные), read-only ---------- */
function RakiBlock() {
  return (
    <div className="mn__raki">
      <div className="mn__raki-board">
        <div className="mn__raki-head">
          <span>Размер</span>
          <span>шт / кг</span>
          <span>цена за кг</span>
        </div>
        {rakiChapter.sizes.map((s, i) => (
          <div className="mn__raki-size" key={s.tier}>
            <span className="mn__raki-tier" style={{ fontSize: `${24 + i * 6}px` }}>{s.tier}</span>
            <span className="mn__raki-pieces">{s.countPerKg}</span>
            <span className="mn__raki-price">
              {formatNumber(s.price) + " ₽"}            </span>
          </div>
        ))}
      </div>

      <div className="mn__preps">
        {rakiChapter.preparations.map((p) => (
          <div className="mn__prep" key={p.id}>
            <div className="mn__prep-head">
              <span className="mn__prep-title">{p.title}</span>
              <span className="mn__prep-label">{p.recipesLabel}</span>
            </div>
            <div className="mn__recipes">
              {p.recipes.map((r) => (
                <span className={"mn__recipe" + (r.spicy ? " is-spicy" : "")} key={r.name}>
                  {r.name}
                  {r.spicy ? <span className="mn__mark" title="остро">{ChiliIcon}</span> : null}
                  {!r.spicy && r.name.toLowerCase().includes("помидор")
                    ? <span className="mn__mark" title="томат">{TomatoIcon}</span> : null}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {rakiChapter.footnotes?.map((f) => (
        <p className="mn__footnote" key={f}>{f}</p>
      ))}
    </div>
  );
}

/* ---------- ИНТРО: экран приветствия «The Raki» → растворение Роршахом ----------
   Зелёный (наш hero-градиент) дают только маскируемый svg-rect + кляксы, которые
   растут из разных точек и прорезают зелёный → проступает кремовое меню под оверлеем.
   Играет при КАЖДОМ открытии (без sessionStorage), тап/скролл — пропустить. */
const BLOB_A = "M0,-9 C5,-10 11,-5 10,1 C9,7 4,11 -1,10 C-8,9 -11,2 -9,-3 C-8,-8 -4,-9 0,-9 Z";
const BLOB_B = "M0,-8 C6,-9 10,-3 8,3 C7,9 0,11 -4,9 C-10,7 -10,0 -8,-4 C-6,-8 -3,-8 0,-8 Z";
const BLOB_C = "M0,-10 C4,-11 7,-8 8,-3 C12,-2 12,4 7,6 C5,11 -2,12 -5,8 C-11,7 -11,-1 -8,-4 C-7,-9 -4,-9 0,-10 Z";

const INK_BLOTS: { d: string; x: number; y: number; r: number; delay: number; dur: number; sc: number }[] = [
  { d: BLOB_C, x: 50, y: 54, r: 0, delay: 1100, dur: 900, sc: 4.6 },
  { d: BLOB_A, x: 31, y: 62, r: 30, delay: 1180, dur: 850, sc: 4.2 },
  { d: BLOB_A, x: 69, y: 62, r: -30, delay: 1240, dur: 850, sc: 4.2 },
  { d: BLOB_B, x: 50, y: 86, r: 10, delay: 1220, dur: 900, sc: 4.4 },
  { d: BLOB_B, x: 28, y: 82, r: 45, delay: 1340, dur: 850, sc: 4.0 },
  { d: BLOB_B, x: 72, y: 82, r: -45, delay: 1380, dur: 850, sc: 4.0 },
  { d: BLOB_C, x: 14, y: 50, r: 70, delay: 1460, dur: 800, sc: 3.8 },
  { d: BLOB_C, x: 86, y: 50, r: -70, delay: 1520, dur: 800, sc: 3.8 },
  { d: BLOB_A, x: 27, y: 30, r: 120, delay: 1560, dur: 800, sc: 3.8 },
  { d: BLOB_A, x: 73, y: 30, r: -120, delay: 1500, dur: 800, sc: 3.8 },
  { d: BLOB_B, x: 50, y: 20, r: 0, delay: 1700, dur: 760, sc: 3.6 },
  { d: BLOB_C, x: 16, y: 76, r: 200, delay: 1640, dur: 780, sc: 3.6 },
  { d: BLOB_C, x: 84, y: 76, r: 160, delay: 1680, dur: 780, sc: 3.6 },
  { d: BLOB_A, x: 50, y: 38, r: 90, delay: 1840, dur: 720, sc: 3.4 },
  { d: BLOB_B, x: 38, y: 14, r: 250, delay: 1960, dur: 700, sc: 3.2 },
  { d: BLOB_B, x: 62, y: 14, r: 280, delay: 2010, dur: 700, sc: 3.2 },
];

function MenuIntro({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finish = () => { setDone(true); onDone(); };
    if (reduce) { finish(); return; }
    const t = window.setTimeout(finish, 3000); // совпадает с завершением растворения
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { setDone(true); onDone(); };

  if (done) return null;

  return (
    <div className="mn-intro" role="presentation" onPointerDown={skip} onWheel={skip} onTouchStart={skip}>
      <svg className="mn-intro__ink" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id="mn-intro-green" cx="50%" cy="6%" r="120%">
            <stop offset="0%" stopColor="#11454c" />
            <stop offset="52%" stopColor="#0b3237" />
            <stop offset="100%" stopColor="#07262a" />
          </radialGradient>
          <mask id="mn-intro-mask">
            <rect x="-20" y="-20" width="140" height="140" fill="#fff" />
            <g fill="#000">
              {INK_BLOTS.map((b, i) => (
                <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.r})`}>
                  <path
                    className="mn-intro__blot"
                    d={b.d}
                    style={{ animationDelay: `${b.delay}ms`, animationDuration: `${b.dur}ms`, "--bs": b.sc } as CSSProperties}
                  />
                </g>
              ))}
            </g>
          </mask>
        </defs>
        <rect x="-20" y="-20" width="140" height="140" fill="url(#mn-intro-green)" mask="url(#mn-intro-mask)" />
      </svg>
      <div className="mn-intro__glow" aria-hidden />
      <div className="mn-intro__grain" aria-hidden />
      <div className="mn-intro__brand">
        <span className="mn-intro__eyebrow">Раковарня · Москва</span>
        <span className="mn-intro__word">The <em>Raki</em></span>
        <span className="mn-intro__sub">Карта раковарни</span>
      </div>
    </div>
  );
}

export default function Menu() {
  const [active, setActive] = useState("raki");
  const [open, setOpen] = useState(false); // оверлей-колесо категорий
  const [detail, setDetail] = useState<MenuEntry | null>(null); // крупная карточка блюда
  const [introDone, setIntroDone] = useState(false); // интро растворилось
  const handleIntroDone = useCallback(() => setIntroDone(true), []);

  // scroll-spy: подсветка текущей категории в masthead/кнопке (без гонки — просто active)
  useEffect(() => {
    const secs = SECTIONS
      .map((s) => document.getElementById(`mn-${s.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!secs.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.replace(/^mn-/, ""));
      },
      { rootMargin: "-12% 0px -76% 0px", threshold: 0 },
    );
    secs.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // блокируем фоновый скролл: пока идёт интро, открыт оверлей или карточка блюда
  useEffect(() => {
    document.body.style.overflow = open || detail || !introDone ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, detail, introDone]);

  const pick = (id: string) => {
    setOpen(false);
    setActive(id);
    requestAnimationFrame(() => {
      document.getElementById(`mn-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="mn">
      <MenuIntro onDone={handleIntroDone} />

      <header className={"mn__top" + (introDone ? " is-shown" : "")}>
        <span className="mn__brand">The <em>Raki</em></span>
        <button className="mn__top-menu" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <span className="mn__burger" aria-hidden><span /><span /><span /></span>
          <span>Меню</span>
        </button>
      </header>

      <main>
        {SECTIONS.map((sec) => (
          <section className="mn__section" id={`mn-${sec.id}`} key={sec.id}>
            <h2 className="mn__ch">{sec.title}</h2>
            {sec.lede ? <span className="mn__ch-lede">{sec.lede}</span> : null}
            <div className="mn__rule" />
            {sec.id === "raki" ? (
              <RakiBlock />
            ) : (
              sec.entries.map((e, i) => {
                const photo = DISH_PHOTO[e.name];
                const showGroup = e.group && e.group !== sec.entries[i - 1]?.group;
                return (
                  <Fragment key={e.name}>
                  {showGroup ? <div className="mn__group">{e.group}</div> : null}
                  <button
                    className={"mn__dish" + (photo ? " has-photo" : "")}
                    type="button"
                    onClick={() => setDetail(e)}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="mn__dish-photo" src={photo} alt={e.name} loading="lazy" />
                    ) : null}
                    <span className="mn__dish-name">
                      {e.name}
                      {e.spicy ? <span className="mn__mark" title="остро">{ChiliIcon}</span> : null}
                    </span>
                    <span className="mn__dish-price">{formatNumber(e.price) + " ₽"}</span>
                    {e.note ? <span className="mn__dish-desc">{e.note}</span> : null}
                  </button>
                  </Fragment>
                );
              })
            )}
          </section>
        ))}
      </main>

      {open ? (
        <CategoryWheel active={active} onPick={pick} onClose={() => setOpen(false)} />
      ) : null}

      {detail ? <DishDetail entry={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

/* ---------- КРУПНАЯ КАРТОЧКА БЛЮДА (тап по позиции) ---------- */
function DishDetail({ entry, onClose }: { entry: MenuEntry; onClose: () => void }) {
  const photo = DISH_PHOTO[entry.name];
  return (
    <div className="mn__detail" role="dialog" aria-modal="true">
      <button className="mn__detail-bg" type="button" aria-label="Закрыть" onClick={onClose} />
      <div className="mn__detail-card">
        <button className="mn__detail-x" type="button" aria-label="Закрыть" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mn__detail-photo" src={photo} alt={entry.name} />
        ) : null}
        <h3 className="mn__detail-name">
          {entry.name}
          {entry.spicy ? <span className="mn__mark" title="остро">{ChiliIcon}</span> : null}
        </h3>
        {entry.note ? <p className="mn__detail-desc">{entry.note}</p> : null}
        <div className="mn__detail-foot">
          <span className="mn__detail-price">{formatNumber(entry.price) + " ₽"}</span>
          {entry.unit ? <span className="mn__detail-unit">за {entry.unit}</span> : null}
        </div>
        {entry.variants?.length ? (
          <div className="mn__detail-variants">
            {entry.variants.map((v) => (
              <span className="mn__detail-variant" key={v.label}>
                {v.label} — {formatNumber(v.price) + " ₽"}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- ОВЕРЛЕЙ = ГОТОВОЕ БОКОВОЕ КОЛЕСО /wheel (.cat*), наполненное КАТЕГОРИЯМИ ----------
   Та же геометрия/анимации, что и на /wheel: дуга справа, фокус крупнее,
   подпись сбоку, инерция + snap, появление текста карточки. Тап медальона
   или «Открыть» → выбор категории (закрыть + прыжок списка). */
function CategoryWheel({
  active, onPick, onClose,
}: { active: string; onPick: (id: string) => void; onClose: () => void }) {
  const railRef = useRef<HTMLDivElement>(null);
  const dishRefs = useRef<(HTMLDivElement | null)[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);
  const startIdx = Math.max(0, SECTIONS.findIndex((s) => s.id === active));
  const [focus, setFocus] = useState(startIdx);

  const rot = useRef(startIdx);
  const vel = useRef(0);
  const dragging = useRef(false);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const focusRef = useRef(-1);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const N = SECTIONS.length;
    const STEP = (40 * Math.PI) / 180;
    const DISC = 116;
    const vh = () => window.innerHeight;
    const vw = () => window.innerWidth;
    const geom = () => ({ cx: vw() * 1.33, cy: vh() * 0.46, R: vw() * 0.62 });

    const placeRail = () => {
      const { cx, cy, R } = geom();
      const el = railRef.current;
      if (!el) return;
      el.style.width = `${2 * R}px`; el.style.height = `${2 * R}px`;
      el.style.left = `${cx - R}px`; el.style.top = `${cy - R}px`;
    };

    const render = () => {
      const { cx, cy, R } = geom();
      let nearest = 0, nd = 99;
      for (let i = 0; i < N; i++) {
        const el = dishRefs.current[i];
        if (!el) continue;
        const a = (i - rot.current) * STEP;
        const aa = Math.abs(a);
        if (aa < nd) { nd = aa; nearest = i; }
        const X = cx - Math.cos(a) * R;
        const Y = cy + Math.sin(a) * R;
        const op = aa > 1.75 ? 0 : Math.max(0, 1.25 - aa * 0.62);
        el.style.transform = `translate3d(${(X - DISC / 2).toFixed(1)}px, ${(Y - DISC / 2).toFixed(1)}px, 0)`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(100 - Math.round(aa * 20));
        el.classList.toggle("is-focus", aa < 0.35);
        el.classList.toggle("show-label", aa > 0.35 && aa < 1.25); // подпись и верхним соседям, не только нижним
      }
      if (nearest !== focusRef.current) {
        focusRef.current = nearest; setFocus(nearest);
        navigator.vibrate?.(8); // тик на каждую категорию (барабан-фидбэк; Android, iOS Safari игнорит)
      }
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
          const t = Math.max(0, Math.min(max, Math.round(rot.current)));
          rot.current += (t - rot.current) * 0.16;
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    placeRail();
    render();
    if (!reduce) raf = requestAnimationFrame(loop);

    let moved = false, startX = 0, startY = 0;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      // не крутить только на интерактиве (карточка/кнопки/шапка); мёртвой зоны больше нет
      if (t && t.closest(".cat__detail, .cat__close, .cat__header")) return;
      dragging.current = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      lastY.current = e.clientY; lastT.current = e.timeStamp; vel.current = 0;
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dy = e.clientY - lastY.current;
      const dt = Math.max(1, e.timeStamp - lastT.current);
      const dRot = -dy / 130;
      rot.current += dRot;
      vel.current = dRot * (16 / dt);
      lastY.current = e.clientY; lastT.current = e.timeStamp;
      // тап vs драг — по 2D-смещению от старта (диагональ по дуге больше не ложный тап)
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 6) moved = true;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (!moved) {
        const b = (e.target as HTMLElement)?.closest(".cat__dish");
        const di = b?.getAttribute("data-i");
        if (di != null) onPick(SECTIONS[Math.max(0, Math.min(N - 1, Number(di)))].id);
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); rot.current += e.deltaY / 380; vel.current = 0; };
    const onResize = () => { placeRail(); render(); };

    const surf = railRef.current?.parentElement ?? window;
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
  }, [onPick]);

  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    el.removeAttribute("data-anim");
    void el.offsetWidth;
    el.setAttribute("data-anim", "1");
  }, [focus]);

  const c = SECTIONS[focus];

  return (
    <div className="cat cat--overlay" role="dialog" aria-modal="true">
      <header className="cat__header">
        <div className="cat__brand">
          <span className="cat__eyebrow">Раковарня · Москва</span>
          The <em>Raki</em>
        </div>
        <button className="cat__close" type="button" aria-label="Закрыть" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div className="cat__rail" ref={railRef} aria-hidden />

      <div className="cat__stage">
        {SECTIONS.map((sec, i) => {
          const face = CAT_FACE[sec.id];
          return (
            <div className="cat__dish" key={sec.id} data-i={i} ref={(el) => { dishRefs.current[i] = el; }}>
              <span className="cat__dish-label">
                <span className="cat__dish-lname">{LABEL[sec.id]}</span>
              </span>
              <div className="cat__disc">
                {face ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={face} alt={LABEL[sec.id]} draggable={false} />
                ) : (
                  <span className="cat__disc-icon">{CAT_ICON}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cat__detail" ref={detailRef} data-anim="1">
        <span className="cat__d-eyebrow">Категория</span>
        <h1 className="cat__d-name">{LABEL[c.id] ?? c.title}</h1>
        <div className="cat__d-actions">
          <button className="cat__d-more" type="button" onClick={() => onPick(c.id)}>
            Открыть
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div className="cat__hint">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.1" /><path d="M12 6.4V3.2M12 20.8v-3.2M9.4 5l2.6-2.6L14.6 5M9.4 19l2.6 2.6 2.6-2.6" /></svg>
        Прокрутите колесо
      </div>
    </div>
  );
}
