"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

const CAT_ICON: ReactNode = (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 4v16M5 9c4 3 10 3 14 0" /></svg>
);

// маркеры из дока: чили — острота, помидор — рецепт «Дон с помидором». Отрисованы вручную, выверены по пикселям.
const ChiliIcon: ReactNode = (
  <svg className="mn__glyph mn__glyph--chili" viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M15.6 5.4c2.9 1.3 3.7 5.5 1.2 9.7c-1.9 3.2-4.9 5.2-7 4.1c-1.5-.8-1.5-2.7.3-4.4c2.8-2.6 4.1-5.8 2.9-8.7c-.3-.8 1.3-1.2 2.6-.7z" />
    <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M14.6 4.9c-.6-1.7-2.4-2.3-4-1.5" />
  </svg>
);
const TomatoIcon: ReactNode = (
  <svg className="mn__glyph mn__glyph--tomato" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="14.6" r="6.4" fill="currentColor" />
    <path fill="currentColor" d="M12 9.2c-.9-1.9-2.7-2.9-4.7-2.6c1 .9 1.2 2 .6 3.2c1.3-.7 2.8-.6 4.1.2c1.3-.8 2.8-.9 4.1-.2c-.6-1.2-.4-2.3.6-3.2c-2-.3-3.8.7-4.7 2.6z" />
    <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 8.4V5.4" />
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

export default function Menu() {
  const [active, setActive] = useState("raki");
  const [open, setOpen] = useState(false); // оверлей-колесо категорий
  const [detail, setDetail] = useState<MenuEntry | null>(null); // крупная карточка блюда
  const [past, setPast] = useState(false); // прокрутили за hero → показать FAB

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

  // FAB-кнопка категорий прячется над hero, выезжает после прокрутки в меню
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setPast(window.scrollY > window.innerHeight * 0.62); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // блокируем фоновый скролл, пока открыт оверлей или карточка блюда
  useEffect(() => {
    document.body.style.overflow = open || detail ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, detail]);

  const pick = (id: string) => {
    setOpen(false);
    setActive(id);
    requestAnimationFrame(() => {
      document.getElementById(`mn-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="mn">
      <section className="mn__hero" aria-label="The Raki — раковарня">
        <div className="mn__hero-grain" aria-hidden />
        <div className="mn__hero-glow" aria-hidden />
        <div className="mn__hero-inner">
          <span className="mn__hero-eyebrow">Раковарня · Москва</span>
          <h1 className="mn__hero-brand">The <em>Raki</em></h1>
          <span className="mn__hero-sub">Карта раковарни</span>
          <div className="mn__hero-thread" aria-hidden />
        </div>
        <div className="mn__hero-hint" aria-hidden>
          <span>меню</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v13M6 12l6 6 6-6" /></svg>
        </div>
        <svg className="mn__hero-wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
          <path fill="#f2e8d5" d="M0,42 C240,82 480,12 720,42 C960,72 1200,16 1440,46 L1440,90 L0,90 Z">
            <animate attributeName="d" dur="8s" repeatCount="indefinite"
              values="M0,42 C240,82 480,12 720,42 C960,72 1200,16 1440,46 L1440,90 L0,90 Z;
                      M0,48 C240,14 480,78 720,40 C960,10 1200,72 1440,38 L1440,90 L0,90 Z;
                      M0,42 C240,82 480,12 720,42 C960,72 1200,16 1440,46 L1440,90 L0,90 Z" />
          </path>
        </svg>
      </section>

      <main>
        {SECTIONS.map((sec) => (
          <section className="mn__section" id={`mn-${sec.id}`} key={sec.id}>
            <h2 className="mn__ch">{sec.title}</h2>
            {sec.lede ? <span className="mn__ch-lede">{sec.lede}</span> : null}
            <div className="mn__rule" />
            {sec.id === "raki" ? (
              <RakiBlock />
            ) : (
              sec.entries.map((e) => {
                const photo = DISH_PHOTO[e.name];
                return (
                  <button
                    className={"mn__dish" + (photo ? " has-photo" : "")}
                    key={e.name}
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
                );
              })
            )}
          </section>
        ))}
      </main>

      {/* кнопка категорий — приподнята над кромкой Safari */}
      <button className={"mn__catbtn" + (past ? " is-shown" : "")} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3.5" y="3.5" width="7.4" height="7.4" rx="1.6" />
          <rect x="13.1" y="3.5" width="7.4" height="7.4" rx="1.6" />
          <rect x="3.5" y="13.1" width="7.4" height="7.4" rx="1.6" />
          <rect x="13.1" y="13.1" width="7.4" height="7.4" rx="1.6" />
        </svg>
        <span className="mn__catbtn-label">{LABEL[active] ?? "Категории"}</span>
        <span className="mn__catbtn-hint">меню</span>
      </button>

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
