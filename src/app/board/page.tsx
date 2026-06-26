"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { chapters, rakiChapter, formatNumber } from "@/data/menu";
import "./board.css";

// Раки — отдельная глава в menu.ts; вводим как секцию (размер → ₽/кг).
const RAKI_SECTION = {
  id: "raki",
  title: "Раки",
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

// Короткие ярлыки категорий для нижней ленты.
const LABEL: Record<string, string> = {
  raki: "Раки", crab: "Краб", shrimp: "Креветки", starters: "Закуски",
  salads: "Салаты", hot: "Горячее", soups: "Супы", mussels: "Мидии",
  vongole: "Вонголе", mains: "Основные", garnish: "Гарниры", sauces: "Соусы",
  desserts: "Десерты", tea: "Чай", soft: "Воды", beer: "Пиво",
};

// Фото-«лицо» категории (cutout). Где нет — гравюрный значок.
const CAT_FACE: Record<string, string> = {
  shrimp: "/images/cutout/shrimp-mix.webp",
  starters: "/images/cutout/starter-potato.webp",
  hot: "/images/cutout/hot-hotdog.webp",
  soups: "/images/cutout/soup-port.webp",
  mussels: "/images/cutout/mussels-tomyam.webp",
  vongole: "/images/cutout/vongole-arrabiata.webp",
};

const CAT_ICON: ReactNode = (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 4v16M5 9c4 3 10 3 14 0" /></svg>
);

// Фото блюда в списке (по имени) — где есть cutout.
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

export default function Board() {
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const catRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastFocus = useRef(-1);
  const [active, setActive] = useState("raki");
  const [scrolled, setScrolled] = useState(false);
  // нижнее колесо-дуга: rot = позиция в «единицах категорий» (единый контроллер)
  const rot = useRef(0);
  const vel = useRef(0);
  const dialing = useRef(false);
  const driving = useRef(false);       // дуга ведёт список (драг/инерция/тап) до доводки
  const manualUntil = useRef(0);       // до этого ms списком рулит палец, не дуга
  const lastX = useRef(0);

  // только сжатие masthead при скролле (лента-навигация всегда видна снизу)
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // НИЖНЕЕ КОЛЕСО-ДУГА — ЕДИНЫЙ контроллер (без гонки со scroll-spy):
  //   • крутишь дугу / тап     → дуга ведёт список (плавно догоняет фокус), потом доводка
  //   • листаешь список руками → дуга следует за списком
  //   • покой                  → ничего не трогаем (список стоит где читаешь)
  useEffect(() => {
    const N = SECTIONS.length, N1 = N - 1;
    const STEP = 0.52, SPREAD_F = 0.34, LIFT = 72, TOPOFF = 80;
    const clamp = (v: number) => Math.max(0, Math.min(N1, v));
    let moved = false;

    const place = () => {
      const vw = window.innerWidth;
      const cx = vw / 2, SPREAD = vw * SPREAD_F;
      for (let i = 0; i < N; i++) {
        const el = catRefs.current[i];
        if (!el) continue;
        const a = (i - rot.current) * STEP;
        const aa = Math.abs(a);
        const tx = cx + Math.sin(a) * SPREAD - 48;
        const ty = -(LIFT * Math.cos(a)) + 10; // центр (a=0) выше, края ниже
        const s = Math.max(0.42, 0.6 + 0.4 * Math.cos(a)); // центр крупнее
        const op = aa > 1.6 ? 0 : Math.max(0, 1.15 - aa * 0.5);
        el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(3)})`;
        el.style.opacity = op.toFixed(2);
        el.style.zIndex = String(100 - Math.round(aa * 10));
        el.classList.toggle("is-active", aa < 0.3);
      }
    };

    // секция, что сейчас «вверху» под masthead (для режима ручного скролла)
    const focusFromScroll = () => {
      let idx = 0;
      for (let i = 0; i < N; i++) {
        const sec = document.getElementById(`bd-${SECTIONS[i].id}`);
        if (!sec) continue;
        if (sec.getBoundingClientRect().top - TOPOFF <= 4) idx = i; else break;
      }
      return idx;
    };
    // список плавно подтягивается к секции fi.
    // behavior:"instant" ОБЯЗАТЕЛЕН — глобальный CSS scroll-behavior:smooth иначе
    // анимирует каждый кадровый scrollTo и lerp захлёбывается (скролл встаёт на полпути).
    const followList = (fi: number) => {
      const sec = document.getElementById(`bd-${SECTIONS[fi].id}`);
      if (!sec) return;
      const target = sec.getBoundingClientRect().top + window.scrollY - TOPOFF;
      window.scrollTo({ top: window.scrollY + (target - window.scrollY) * 0.2, behavior: "instant" as ScrollBehavior });
    };
    const setFocus = (fi: number) => {
      if (fi !== lastFocus.current) { lastFocus.current = fi; setActive(SECTIONS[fi].id); }
    };

    let raf = 0;
    const loop = () => {
      const manual = manualUntil.current > Date.now();
      let driveNow = false;

      if (dialing.current) {
        rot.current = clamp(rot.current);
        driveNow = true;
      } else if (manual) {
        // палец листает список → дуга догоняет
        rot.current += (focusFromScroll() - rot.current) * 0.2;
      } else if (driving.current) {
        // инерция (короткий выбег) + мягкий снап к целой категории
        rot.current = clamp(rot.current + vel.current);
        vel.current *= 0.80;
        if (Math.abs(vel.current) < 0.0025) rot.current += (Math.round(rot.current) - rot.current) * 0.2;
        driveNow = true;
      }

      const fi = clamp(Math.round(rot.current));
      if (driveNow) {
        const before = window.scrollY;
        followList(fi);
        const movedPx = Math.abs(window.scrollY - before);
        // доводка завершена: дуга снапнулась И список доехал/упёрся в край
        if (!dialing.current && Math.abs(vel.current) < 0.0025
            && Math.abs(rot.current - fi) < 0.01 && movedPx < 0.5) {
          rot.current = fi; driving.current = false;
        }
      }
      setFocus(fi);
      place();
      raf = requestAnimationFrame(loop);
    };
    place();
    raf = requestAnimationFrame(loop);

    // ВРАЩЕНИЕ ДУГИ (драг по самой ленте)
    const rail = railRef.current;
    const onDown = (e: PointerEvent) => {
      dialing.current = true; driving.current = true; moved = false;
      lastX.current = e.clientX; vel.current = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!dialing.current) return;
      const dx = e.clientX - lastX.current;
      if (Math.abs(dx) > 0.5) {
        const d = -dx / 90;
        rot.current = clamp(rot.current + d);
        vel.current = Math.max(-0.6, Math.min(0.6, d)); // кап выбега: флинг ≈ до 3 категорий
        lastX.current = e.clientX;
        if (Math.abs(dx) > 2) moved = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!dialing.current) return;
      dialing.current = false;
      if (!moved) {
        // ТАП по категории — дуга прыгает на неё (доводка списка в loop)
        const b = (e.target as HTMLElement)?.closest(".bd__cat");
        const di = b?.getAttribute("data-i");
        if (di != null) { rot.current = clamp(Number(di)); vel.current = 0; }
      }
      driving.current = true; // ведём список до выбранной категории
    };
    rail?.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // РУЧНОЙ СКРОЛЛ СПИСКА (касание/колесо ВНЕ ленты) → дуга следует за списком,
    // followList не вмешивается. Жест на самой ленте — не считается ручным скроллом.
    const markManual = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".bd__rail")) return;
      manualUntil.current = Date.now() + 500;
      driving.current = false; // палец перебивает доводку дуги
    };
    // ЛЮБОЙ пользовательский скролл (в т.ч. iOS momentum-инерция) продлевает ручной режим,
    // иначе followList перехватывает список посреди инерции → залипание на iPhone.
    const onUserScroll = () => {
      if (!dialing.current && !driving.current) manualUntil.current = Date.now() + 300;
    };
    window.addEventListener("touchstart", markManual, { passive: true });
    window.addEventListener("touchmove", markManual, { passive: true });
    window.addEventListener("wheel", markManual, { passive: true });
    window.addEventListener("scroll", onUserScroll, { passive: true });
    window.addEventListener("resize", place);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      rail?.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchstart", markManual);
      window.removeEventListener("touchmove", markManual);
      window.removeEventListener("wheel", markManual);
      window.removeEventListener("scroll", onUserScroll);
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <div className={"bd" + (scrolled ? " is-scrolled" : "")} ref={rootRef}>
      <header className="bd__top">
        <span className="bd__brand">
          The <em>Raki</em>
        </span>
        <span className="bd__active-cat">{LABEL[active] ?? "Меню"}</span>
      </header>

      <main>
        {SECTIONS.map((sec) => (
          <section className="bd__section" id={`bd-${sec.id}`} key={sec.id}>
            <h2 className="bd__ch">{sec.title}</h2>
            {sec.origin ? <span className="bd__ch-origin">{sec.origin}</span> : null}
            <div className="bd__rule" />
            {sec.entries.map((e) => {
              const photo = DISH_PHOTO[e.name];
              return (
                <button
                  className={"bd__dish" + (photo ? " has-photo" : "")}
                  key={e.name}
                  type="button"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="bd__dish-photo" src={photo} alt={e.name} loading="lazy" />
                  ) : null}
                  <span className="bd__dish-name">
                    {e.name}
                    {e.signature ? <span className="bd__sig">◆</span> : null}
                  </span>
                  <span className="bd__dish-price">
                    {formatNumber(e.price)} ₽
                  </span>
                  {e.note ? <span className="bd__dish-desc">{e.note}</span> : null}
                </button>
              );
            })}
          </section>
        ))}
      </main>

      {/* нижнее колесо-дуга категорий */}
      <nav className="bd__rail" ref={railRef} aria-label="Категории">
        <div className="bd__rail-arc" aria-hidden />
        {SECTIONS.map((sec, i) => {
          const face = CAT_FACE[sec.id];
          return (
            <button
              className="bd__cat"
              key={sec.id}
              data-i={i}
              ref={(el) => { catRefs.current[i] = el; }}
              type="button"
            >
              <span className="bd__cat-face">
                {face ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={face} alt="" loading="lazy" draggable={false} />
                ) : (
                  CAT_ICON
                )}
              </span>
              <span className="bd__cat-label">{LABEL[sec.id]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
