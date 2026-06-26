"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { formatNumber, type MenuEntry, type RakiPreparation } from "@/data/menu";

// Фото героя (используется внутри клиентского модуля — границу не пересекает).
export const HERO_PHOTO = "/images/hero-main.webp";

const price = (n: number, unit?: string) => (
  <>
    {formatNumber(n)} ₽{unit ? <small>/{unit}</small> : null}
  </>
);

// ----------------------------------------------------------------
// Detail sheet (тап по карточке/строке → полное описание + варианты)
// ----------------------------------------------------------------
type SheetEntry = {
  name: string;
  note?: string;
  price?: number;
  unit?: string;
  variants?: { label: string; price: number }[];
};
const SheetCtx = createContext<(e: SheetEntry) => void>(() => {});
export const useSheet = () => useContext(SheetCtx);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<SheetEntry | null>(null);
  const open = useCallback((e: SheetEntry) => setEntry(e), []);
  const close = useCallback(() => setEntry(null), []);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entry) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [entry, close]);

  return (
    <SheetCtx.Provider value={open}>
      {children}
      {entry ? (
        <div
          className="mn__sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={entry.name}
          onClick={close}
        >
          <div
            className="mn__sheet"
            ref={ref}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mn__sheet-grip" aria-hidden />
            <p className="mn__sheet-name">{entry.name}</p>
            {typeof entry.price === "number" ? (
              <p className="mn__sheet-price">{price(entry.price, entry.unit)}</p>
            ) : null}
            {entry.note ? <p className="mn__sheet-note">{entry.note}</p> : null}
            {entry.variants?.length ? (
              <div className="mn__sheet-variants">
                {entry.variants.map((v) => (
                  <div className="mn__sheet-variant" key={v.label}>
                    <span>{v.label}</span>
                    <span>{formatNumber(v.price)} ₽</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button type="button" className="mn__sheet-close" onClick={close}>
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </SheetCtx.Provider>
  );
}

// ----------------------------------------------------------------
// Фото-герой с волной
// ----------------------------------------------------------------
export function MenuHero() {
  return (
    <header className="mn__hero">
      <img className="mn__hero-img" src={HERO_PHOTO} alt="" aria-hidden />
      <div className="mn__hero-top">
        <p className="mn__wordmark">
          The <em>Raki</em>
        </p>
        <p className="mn__hero-eyebrow">Раковарня · Москва</p>
      </div>
      <h1 className="mn__hero-title">
        Карта
        <br />
        раковарни
        <svg
          className="mn__hero-flourish"
          viewBox="0 0 38 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M1 5 C 7 1, 12 1, 19 4 S 31 7, 37 3" />
        </svg>
      </h1>
      <svg
        className="mn__wave"
        viewBox="0 0 390 46"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 46 V20 C 70 2, 150 2, 210 14 C 280 28, 330 22, 390 8 V46 Z"
          fill="currentColor"
        />
      </svg>
    </header>
  );
}

// Большой фото-баннер секции-героя
export function Banner({ photo, alt = "" }: { photo: string; alt?: string }) {
  return (
    <div className="mn__banner">
      <img src={photo} alt={alt} loading="lazy" />
    </div>
  );
}

// ----------------------------------------------------------------
// Фото-карточка блюда
// ----------------------------------------------------------------
export function PhotoCard({
  photo,
  num,
  name,
  priceValue,
  unit,
  desc,
  detail,
  signature,
  spicy,
}: {
  photo: string;
  num?: string;
  name: ReactNode;
  priceValue: number;
  unit?: string;
  desc?: string;
  detail: SheetEntry;
  signature?: boolean;
  spicy?: boolean;
}) {
  const open = useSheet();
  return (
    <button
      type="button"
      className="mn__card"
      onClick={() => open(detail)}
      aria-haspopup="dialog"
    >
      <span className="mn__card-figure">
        <img className="mn__card-img" src={photo} alt="" aria-hidden />
        {num ? <span className="mn__card-num">{num}</span> : null}
      </span>
      <span className="mn__card-body" style={{ position: "relative", display: "block" }}>
        <span className="mn__card-name">
          {name}
          {signature ? <span className="mn__sig">◆</span> : null}
          {spicy ? <span className="mn__spice">остро</span> : null}
        </span>
        <span className="mn__price" style={{ display: "block" }}>
          {price(priceValue, unit)}
        </span>
        {desc ? <span className="mn__card-desc">{desc}</span> : null}
        <span className="mn__card-more" aria-hidden>
          →
        </span>
      </span>
    </button>
  );
}

// ----------------------------------------------------------------
// Компактная строка без фото (хвостовые главы)
// ----------------------------------------------------------------
export function MenuRow({ entry }: { entry: MenuEntry }) {
  const open = useSheet();
  return (
    <button
      type="button"
      className="mn__row"
      onClick={() =>
        open({
          name: entry.name,
          note: entry.note,
          price: entry.price,
          unit: entry.unit,
          variants: entry.variants,
        })
      }
      aria-haspopup={entry.note || entry.variants?.length ? "dialog" : undefined}
    >
      <span>
        <span className="mn__row-name">
          {entry.name}
          {entry.signature ? <span className="mn__sig">◆</span> : null}
          {entry.spicy ? <span className="mn__spice">остро</span> : null}
        </span>
        {entry.note ? <span className="mn__row-sub">{entry.note}</span> : null}
      </span>
      <span className="mn__row-price">{price(entry.price, entry.unit)}</span>
    </button>
  );
}

// ----------------------------------------------------------------
// Блок «Раки»: фото-карточка + размерная лестница + стили варки
// ----------------------------------------------------------------
type RakiSize = { tier: string; countPerKg: string; price: number };

export function RakiBlock({
  sizes,
  preps,
}: {
  sizes: RakiSize[];
  preps: RakiPreparation[];
}) {
  const open = useSheet();
  return (
    <>
      <table className="mn__ladder">
        <caption>Цена за килограмм · чем крупнее, тем меньше в кг</caption>
        <tbody>
          {sizes.map((s, i) => (
            <tr key={s.tier}>
              <th
                scope="row"
                className="mn__tier"
                style={{ "--s": i } as CSSProperties}
              >
                {s.tier}
              </th>
              <td className="mn__count">{s.countPerKg} шт/кг</td>
              <td className="mn__pr">{formatNumber(s.price)} ₽</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8 }}>
        {preps.map((p) => (
          <button
            key={p.id}
            type="button"
            className="mn__row"
            aria-haspopup="dialog"
            onClick={() =>
              open({
                name: p.title,
                note:
                  p.recipesLabel +
                  ": " +
                  p.recipes
                    .map((r) => r.name + (r.spicy ? " (остро)" : ""))
                    .join(" · ") +
                  ".",
              })
            }
          >
            <span>
              <span className="mn__row-name">{p.title}</span>
              <span className="mn__row-sub">{p.recipes.length} рец.</span>
            </span>
            <span className="mn__row-price" aria-hidden>
              ＋
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Нижняя таб-навигация (5 вкладок, scroll-spy)
// ----------------------------------------------------------------
type Tab = { id: string; label: string; icon: ReactNode };

const ICON = {
  raki: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4c-1.4 0-2.2 1.3-2.2 2.8 0 2 1 3.2 2.2 3.2s2.2-1.2 2.2-3.2C14.2 5.3 13.4 4 12 4Z" />
      <path d="M9.8 9.5 7 7M14.2 9.5 17 7M12 10v9" />
      <path d="M9 12c-2 .3-3.3 1.8-3 3.6M15 12c2 .3 3.3 1.8 3 3.6" />
      <path d="M12 19c-1.4 1.2-2 2.3-2 3.2M12 19c1.4 1.2 2 2.3 2 3.2" />
      <path d="M10.5 13.5h3M10.7 16h2.6" />
    </svg>
  ),
  crab: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="12" cy="13" rx="5" ry="3.4" />
      <path d="M8 11c-1.8-1.2-2.4-2.6-2-4.2M16 11c1.8-1.2 2.4-2.6 2-4.2" />
      <path d="M6 6.8 4.6 5.6M18 6.8l1.4-1.2" />
      <path d="M7.5 14.5 4.5 16M7.5 13 4 13M16.5 14.5 19.5 16M16.5 13 20 13" />
      <path d="M10 16l-1.5 2.5M14 16l1.5 2.5" />
    </svg>
  ),
  shrimp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6c-5 0-9 3.4-9 8 0 2.6 1.8 4.6 4.4 4.6 2.2 0 3.6-1.4 3.6-3.2" />
      <path d="M18 6c1.6 1 2 2.6 1.4 4.2" />
      <path d="M9 13.5c-2.4-.2-4 .8-4.6 2.6M9.6 16c-2 .4-3.2 1.6-3.4 3.2" />
      <path d="M13 12.5c.8 0 1.4.6 1.4 1.4" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h16c0 4-3.6 7-8 7s-8-3-8-7Z" />
      <path d="M3.5 11h17" />
      <path d="M9 7.5c0-1 .8-1.5.8-2.5M12 7.2c0-1 .8-1.5.8-2.5M15 7.5c0-1 .8-1.5.8-2.5" />
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12l-5 7v6M6 4l5 7M13 17h4M13 17H9" />
      <path d="M6 4 5 3M18 4l1-1" />
    </svg>
  ),
};

export function BottomNav() {
  const tabs: Tab[] = [
    { id: "raki", label: "Раки", icon: ICON.raki },
    { id: "crab", label: "Краб", icon: ICON.crab },
    { id: "shrimp", label: "Креветки", icon: ICON.shrimp },
    { id: "starters", label: "Меню", icon: ICON.menu },
    { id: "beer", label: "Бар", icon: ICON.bar },
  ];
  const [active, setActive] = useState("raki");

  useEffect(() => {
    // карта: какой раздел подсвечивает какую вкладку (Меню/Бар — группы)
    const groupOf = (id: string) => {
      if (["raki", "crab", "shrimp"].includes(id)) return id;
      if (["beer", "soft", "tea"].includes(id)) return "beer";
      return "starters";
    };
    const secs = Array.from(
      document.querySelectorAll<HTMLElement>("[data-mn-section]"),
    );
    if (!secs.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) {
          setActive(groupOf(top.target.getAttribute("data-mn-section") || ""));
        }
      },
      { rootMargin: "-10% 0px -75% 0px", threshold: 0 },
    );
    secs.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="mn__tabbar" aria-label="Разделы меню">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={`#mn-${t.id}`}
          className="mn__tab"
          data-active={t.id === active || undefined}
          aria-current={t.id === active ? "true" : undefined}
        >
          {t.icon}
          <span className="mn__tab-label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
