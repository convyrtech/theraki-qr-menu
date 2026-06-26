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
import {
  formatNumber,
  type MenuEntry,
  type RakiPreparation,
} from "@/data/menu";

// ----------------------------------------------------------------
// Фото-плейсхолдеры (реальных снимков ещё нет) — дуотон-градиенты
// по категориям, чтобы проверить читаемость скрима и атмосферу.
// ----------------------------------------------------------------
const PHOTO: Record<string, string> = {
  raki: "radial-gradient(130% 105% at 30% 16%, #2f6b58 0%, #173d3a 48%, #07181a 100%)",
  crab: "radial-gradient(130% 105% at 72% 18%, #9a4a32 0%, #45201a 46%, #160c0a 100%)",
  shrimp: "radial-gradient(130% 105% at 38% 22%, #b06a5c 0%, #5a2f2a 46%, #1a0f0d 100%)",
  mussels: "radial-gradient(130% 105% at 60% 20%, #3a6f74 0%, #1c4044 48%, #0a1e20 100%)",
  vongole: "radial-gradient(130% 105% at 42% 18%, #5e6f4f 0%, #2c3a2a 48%, #0e140c 100%)",
  mains: "radial-gradient(130% 105% at 50% 16%, #7a5a34 0%, #3a2a18 48%, #150f0a 100%)",
  desserts: "radial-gradient(130% 105% at 44% 18%, #8a5360 0%, #432530 48%, #160c11 100%)",
};
const PHOTO_FALLBACK =
  "radial-gradient(130% 105% at 40% 18%, #2a5258 0%, #143034 48%, #08181a 100%)";

export function photoStyle(id: string): CSSProperties {
  return { background: PHOTO[id] ?? PHOTO_FALLBACK };
}

// Каллиграфическое появление текста: буквы «пишутся» слева-направо чернилами
// (per-char opacity+blur), по фронту письма бежит золотой кончик-перо.
// Signature-эффект, единый чернильный нарратив с интро. reduced-motion → мгновенно.
export function InkText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const chars = Array.from(text);
  return (
    <span
      ref={ref}
      className={"ink" + (on ? " ink--on" : "") + (className ? " " + className : "")}
      aria-label={text}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          className="ink__ch"
          style={{ "--i": i } as CSSProperties}
          aria-hidden
        >
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

export function ChapterHead({
  title,
  origin,
}: {
  /** @deprecated номера глав убраны в гибрид-редизайне; проп больше не рендерится */
  numeral?: string;
  title: string;
  origin?: string;
}) {
  return (
    <div className="pt__chapter-head">
      <h2 className="pt__chapter-title">
        <InkText text={title} />
      </h2>
      {origin ? <span className="pt__chapter-origin">{origin}</span> : <span />}
    </div>
  );
}

// ----------------------------------------------------------------
// Размерная лестница раков: семантическая таблица (доступна
// скринридеру и для сравнения цен), кегль литеры растёт со ступенью.
// ----------------------------------------------------------------
type RakiSize = { tier: string; countPerKg: string; price: number };

// ----------------------------------------------------------------
// Detail sheet (тап по постеру/строке → подробности).
// ----------------------------------------------------------------
type SheetEntry = {
  name: string;
  note?: string;
  price?: number;
  unit?: string;
  variants?: { label: string; price: number }[];
};

const SheetContext = createContext<(e: SheetEntry) => void>(() => {});
export const useSheet = () => useContext(SheetContext);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<SheetEntry | null>(null);
  const open = useCallback((e: SheetEntry) => setEntry(e), []);
  const close = useCallback(() => setEntry(null), []);
  const sheetRef = useRef<HTMLDivElement>(null);

  // A11y: открыли — фокус в шторку + Esc закрывает; закрыли — вернуть фокус.
  useEffect(() => {
    if (!entry) return;
    const prev = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
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
    <SheetContext.Provider value={open}>
      {children}
      {entry ? (
        <div
          className="pt__sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={entry.name}
          onClick={close}
        >
          <div
            className="pt__sheet"
            ref={sheetRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt__sheet-grip" aria-hidden />
            <p className="pt__sheet-name">{entry.name}</p>
            {typeof entry.price === "number" ? (
              <p className="pt__sheet-price">
                {formatNumber(entry.price)}
                {entry.unit ? <small> /{entry.unit}</small> : null}
              </p>
            ) : null}
            {entry.note ? <p className="pt__sheet-note">{entry.note}</p> : null}
            {entry.variants?.length ? (
              <div className="pt__sheet-variants">
                {entry.variants.map((v) => (
                  <div className="pt__sheet-variant" key={v.label}>
                    <span>{v.label}</span>
                    <span>{formatNumber(v.price)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button type="button" className="pt__sheet-close" onClick={close}>
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </SheetContext.Provider>
  );
}

// ----------------------------------------------------------------
// Compact ledger row (хвост меню — быстрый список).
// ----------------------------------------------------------------
export function CompactRow({ entry }: { entry: MenuEntry }) {
  const open = useSheet();
  const expandable = Boolean(entry.note) || Boolean(entry.variants?.length);

  const detail = () =>
    open({
      name: entry.name,
      note: entry.note,
      price: entry.price,
      unit: entry.unit,
      variants: entry.variants,
    });

  // Блюдо с фото → крупная фото-карточка в стиле референса: фото во всю
  // ширину, под ним центрированно крупное имя, золотая цена с ₽, описание.
  if (entry.photo) {
    return (
      <button
        type="button"
        className="pt__food"
        onClick={detail}
        aria-haspopup={expandable ? "dialog" : undefined}
      >
        <span className="pt__food-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pt__food-img"
            src={entry.photo}
            alt={entry.name}
            loading="lazy"
          />
        </span>
        <span className="pt__food-name">
          {entry.name}
          {entry.signature ? <span className="pt__sig">◆</span> : null}
          {entry.spicy ? <span className="pt__spice" title="остро">остро</span> : null}
        </span>
        <span className="pt__food-price">{formatNumber(entry.price)}</span>
        {entry.unit ? <span className="pt__food-unit">{entry.unit}</span> : null}
        {entry.note ? <span className="pt__food-desc">{entry.note}</span> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="pt__row"
      onClick={detail}
      aria-haspopup={expandable ? "dialog" : undefined}
    >
      <span>
        <span className="pt__row-name">
          {entry.name}
          {entry.signature ? <span className="pt__sig">◆</span> : null}
          {entry.spicy ? <span className="pt__spice" title="остро">остро</span> : null}
        </span>
        {entry.note ? <span className="pt__row-sub">{entry.note}</span> : null}
      </span>
      <span className="pt__row-price">
        {formatNumber(entry.price)}
        {entry.unit ? <small>/{entry.unit}</small> : null}
      </span>
    </button>
  );
}

// Стили приготовления раков (отварные / жареные) — тап раскрывает рецепты.
export function RakiPreps({ preps }: { preps: RakiPreparation[] }) {
  const open = useSheet();
  const plural = (n: number) =>
    n % 10 === 1 && n % 100 !== 11 ? "рецепт" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "рецепта" : "рецептов";
  return (
    <div className="pt__rows">
      {preps.map((p) => (
        <button
          key={p.id}
          type="button"
          className="pt__row"
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
            <span className="pt__row-name">{p.title}</span>
            <span className="pt__row-sub">
              {p.recipes.length} {plural(p.recipes.length)}
            </span>
          </span>
          <span className="pt__row-price" aria-hidden>
            ＋
          </span>
        </button>
      ))}
    </div>
  );
}

// Гравюрный лайн-арт рака — текстура/герб (крафт без фотографий).
export function CrayfishMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 360"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* усы */}
      <path d="M90,96 C66,52 40,40 18,26" />
      <path d="M110,96 C134,52 160,40 182,26" />
      <path d="M93,98 C78,66 56,58 36,52" />
      <path d="M107,98 C122,66 144,58 164,52" />
      {/* рострум + панцирь */}
      <path d="M100,72 L100,98" />
      <path d="M100,98 C82,102 78,124 86,144 C92,158 108,158 114,144 C122,124 118,102 100,98 Z" />
      {/* клешни */}
      <path d="M90,116 C66,120 50,138 52,162" />
      <path d="M52,162 C44,170 42,188 52,198" />
      <path d="M52,162 C62,168 66,184 58,196" />
      <path d="M52,198 L58,196" />
      <path d="M110,116 C134,120 150,138 148,162" />
      <path d="M148,162 C156,170 158,188 148,198" />
      <path d="M148,162 C138,168 134,184 142,196" />
      <path d="M148,198 L142,196" />
      {/* сегменты брюшка */}
      <path d="M84,150 C92,160 108,160 116,150" />
      <path d="M85,170 C92,179 108,179 115,170" />
      <path d="M86,190 C93,198 107,198 114,190" />
      <path d="M88,210 C94,217 106,217 112,210" />
      <path d="M90,230 C95,236 105,236 110,230" />
      <path d="M92,250 C96,255 104,255 108,250" />
      <path d="M94,270 C97,274 103,274 106,270" />
      {/* лапки */}
      <path d="M88,150 L62,168" />
      <path d="M88,170 L60,192" />
      <path d="M90,192 L64,216" />
      <path d="M112,150 L138,168" />
      <path d="M112,170 L140,192" />
      <path d="M110,192 L136,216" />
      {/* хвостовой веер */}
      <path d="M100,272 L100,300" />
      <path d="M100,300 C92,316 86,330 84,344" />
      <path d="M100,300 C108,316 114,330 116,344" />
      <path d="M100,300 C96,318 92,334 92,348" />
      <path d="M100,300 C104,318 108,334 108,348" />
      <path d="M100,300 L100,350" />
      <path d="M84,344 C100,352 100,352 116,344" />
    </svg>
  );
}

// Крафт-пасс «Раки»: тёмная зернистая «бумага», виньетка, гравюрный рак,
// сериф-герой (размерная лестница со свечением), золото-ювелирка, воздух.
export function RakiHero({
  sizes,
  lede,
  preps,
}: {
  sizes: RakiSize[];
  lede?: string;
  preps: RakiPreparation[];
}) {
  return (
    <section id="pt-raki" className="pt__raki">
      <div className="pt__raki-engrave" aria-hidden />
      <div className="pt__grain" aria-hidden />
      <div className="pt__raki-vignette" aria-hidden />

      <div className="pt__raki-inner">
        <h2 className="pt__raki-title">Раки</h2>
        {lede ? <p className="pt__raki-lede">{lede}</p> : null}

        <p className="pt__raki-caption">Цена за килограмм · чем крупнее, тем меньше в кг</p>
        <table className="pt__ladder pt__ladder--hero">
          <tbody>
            {sizes.map((s, i) => (
              <tr key={s.tier}>
                <th
                  scope="row"
                  className="pt__tier"
                  style={{ "--s": i } as CSSProperties}
                >
                  {s.tier}
                </th>
                <td className="pt__count">{s.countPerKg} шт/кг</td>
                <td className="pt__price">{formatNumber(s.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <RakiPreps preps={preps} />
      </div>
      <WaveDivider edge="bottom" variant="hero" />
    </section>
  );
}

// Волнистая граница тёмное↔светлое (по мотивам мокапа владельца). Крем —
// базовый фон, тёмные секции — острова в нём, поэтому волна всегда кремовая
// и «подмывает» тёмный край. variant: hero (выраженная, гребень слева) —
// для главного стыка; soft (лёгкая) — для остальных. Анимация = SMIL-морфинг
// формы (дёшево, только d-атрибут, без layout).
const HERO_WAVES = [
  "M0,42 C180,2 380,0 560,30 C760,60 1010,78 1240,60 C1340,52 1400,48 1440,46 L1440,100 L0,100 Z",
  "M0,26 C200,22 420,16 600,42 C800,66 1020,56 1240,42 C1340,36 1400,52 1440,58 L1440,100 L0,100 Z",
  "M0,52 C180,10 360,6 540,26 C740,52 1000,74 1240,64 C1340,58 1400,44 1440,40 L1440,100 L0,100 Z",
];
const SOFT_WAVES = [
  "M0,64 C320,28 620,46 900,60 C1120,72 1300,58 1440,52 L1440,100 L0,100 Z",
  "M0,48 C320,54 620,28 900,46 C1120,66 1300,72 1440,60 L1440,100 L0,100 Z",
  "M0,58 C320,36 620,54 900,64 C1120,60 1300,50 1440,46 L1440,100 L0,100 Z",
];

export function WaveDivider({
  edge = "bottom",
  variant = "soft",
}: {
  edge?: "top" | "bottom";
  variant?: "hero" | "soft";
}) {
  const w = variant === "hero" ? HERO_WAVES : SOFT_WAVES;
  return (
    <svg
      className={`pt__wave pt__wave--${edge} pt__wave--${variant}`}
      viewBox="0 0 1440 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={w[0]} fill="var(--bg-cream)">
        <animate
          attributeName="d"
          dur="7s"
          repeatCount="indefinite"
          calcMode="spline"
          keyTimes="0;0.33;0.66;1"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
          values={`${w[0]};${w[1]};${w[2]};${w[0]}`}
        />
      </path>
    </svg>
  );
}

// Мидии — тёмная секция-близнец «Раки»: фото-соусы (сняты на чёрном студийном
// фоне → сливаются с #061f1e), под ними имя+цена. Тап → шторка с деталями.
// pos = фокус-точка кастрюли (у блю-чиз/зелень-томат она в левой половине,
// газета/хлеб справа), z = зум — приводим все три к «кастрюля крупно».
const MUSSEL_SAUCES = [
  { img: "/images/mussels-bluecheese.webp", label: "Блю-чиз", pos: "29% 50%", z: 1.5 },
  { img: "/images/mussels-tomyam.webp", label: "Том-ям", pos: "50% 54%", z: 1.12 },
  { img: "/images/mussels-greentomato.webp", label: "Зелень-томат", pos: "27% 44%", z: 1.65 },
];

export function MusselsDark({ entry }: { entry: MenuEntry }) {
  const open = useSheet();
  return (
    <section id="pt-mussels" className="pt__raki pt__mussels">
      <WaveDivider edge="top" variant="soft" />
      <div className="pt__raki-engrave" aria-hidden />
      <div className="pt__grain" aria-hidden />
      <div className="pt__raki-vignette" aria-hidden />

      <div className="pt__raki-inner">
        <h2 className="pt__raki-title">Мидии</h2>
        <p className="pt__raki-lede">Чили в створках 60/80.</p>

        <div className="pt__sauces">
          {MUSSEL_SAUCES.map((s) => (
            <figure className="pt__sauce" key={s.label}>
              <span className="pt__sauce-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="pt__sauce-img"
                  src={s.img}
                  alt={`Мидии в соусе ${s.label}`}
                  loading="lazy"
                  style={
                    {
                      objectPosition: s.pos,
                      transformOrigin: s.pos,
                      transform: `scale(${s.z})`,
                    } as CSSProperties
                  }
                />
              </span>
              <figcaption className="pt__sauce-cap">{s.label}</figcaption>
            </figure>
          ))}
        </div>

        <button
          type="button"
          className="pt__mussels-row"
          aria-haspopup="dialog"
          onClick={() =>
            open({
              name: entry.name,
              note: entry.note,
              price: entry.price,
              unit: entry.unit,
              variants: entry.variants,
            })
          }
        >
          <span className="pt__mussels-name">
            {entry.name}
            {entry.signature ? <span className="pt__sig">◆</span> : null}
          </span>
          <span className="pt__mussels-price">
            {formatNumber(entry.price)}
            {entry.unit ? <small> /{entry.unit}</small> : null}
          </span>
        </button>

        <p className="pt__raki-footnote">
          Соус песто — по запросу.
          {entry.variants?.[0]
            ? ` ${entry.variants[0].label} — ${formatNumber(entry.variants[0].price)}.`
            : ""}
        </p>
      </div>
      <WaveDivider edge="bottom" variant="soft" />
    </section>
  );
}

// Вонголе — светлая секция-зеркало мидий: те же 3 фото-соуса, но кадры на
// белом фоне → плитки на креме. Тарелка по центру, хлеб справа-сверху →
// кроп вниз-центр на ракушки.
const VONGOLE_SAUCES = [
  { img: "/images/vongole-arrabiata.webp", label: "Арабьята", pos: "44% 60%", z: 1.3 },
  { img: "/images/vongole-pesto.webp", label: "Песто", pos: "47% 58%", z: 1.3 },
  { img: "/images/vongole-cream.webp", label: "Сливки-чеснок", pos: "45% 58%", z: 1.3 },
];

export function VongoleLight({ entry }: { entry: MenuEntry }) {
  const open = useSheet();
  return (
    <section id="pt-vongole" className="pt__chapter pt__vongole">
      <ChapterHead title="Вонголе" />
      <p className="pt__chapter-lede">Ракушки.</p>

      <div className="pt__sauces">
        {VONGOLE_SAUCES.map((s) => (
          <figure className="pt__sauce" key={s.label}>
            <span className="pt__sauce-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="pt__sauce-img"
                src={s.img}
                alt={`Вонголе в соусе ${s.label}`}
                loading="lazy"
                style={
                  {
                    objectPosition: s.pos,
                    transformOrigin: s.pos,
                    transform: `scale(${s.z})`,
                  } as CSSProperties
                }
              />
            </span>
            <figcaption className="pt__sauce-cap">{s.label}</figcaption>
          </figure>
        ))}
      </div>

      <button
        type="button"
        className="pt__vongole-row"
        aria-haspopup="dialog"
        onClick={() =>
          open({
            name: entry.name,
            note: entry.note,
            price: entry.price,
            unit: entry.unit,
            variants: entry.variants,
          })
        }
      >
        <span className="pt__vongole-name">
          {entry.name}
          {entry.signature ? <span className="pt__sig">◆</span> : null}
          {entry.spicy ? (
            <span className="pt__spice" title="остро">
              остро
            </span>
          ) : null}
        </span>
        <span className="pt__vongole-price">
          {formatNumber(entry.price)}
          {entry.unit ? <small> /{entry.unit}</small> : null}
        </span>
      </button>
    </section>
  );
}

// Креветки — светлая секция-герой: два фото-подноса на льду (микс + медведка),
// под ними полный список позиций строками.
const SHRIMP_PHOTOS = [
  { img: "/images/shrimp-mix.webp", label: "Микс на льду", pos: "50% 52%", z: 1.08 },
  { img: "/images/shrimp-medvedka.webp", label: "Медведка", pos: "50% 52%", z: 1.08 },
];

export function ShrimpHero({
  title,
  lede,
  entries,
}: {
  title: string;
  lede?: string;
  entries: MenuEntry[];
}) {
  return (
    <section id="pt-shrimp" className="pt__chapter pt__vongole">
      <ChapterHead title={title} />
      {lede ? <p className="pt__chapter-lede">{lede}</p> : null}

      <div className="pt__sauces pt__sauces--duo">
        {SHRIMP_PHOTOS.map((s) => (
          <figure className="pt__sauce" key={s.label}>
            <span className="pt__sauce-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="pt__sauce-img"
                src={s.img}
                alt={`Креветки — ${s.label}`}
                loading="lazy"
                style={
                  {
                    objectPosition: s.pos,
                    transformOrigin: s.pos,
                    transform: `scale(${s.z})`,
                  } as CSSProperties
                }
              />
            </span>
            <figcaption className="pt__sauce-cap">{s.label}</figcaption>
          </figure>
        ))}
      </div>

      <div className="pt__rows">
        {entries.map((e) => (
          <CompactRow key={e.name} entry={e} />
        ))}
      </div>
    </section>
  );
}

// Интро: рак прорисовывается на тёмном → инкблот-ревил проявляет меню.
// Один раз за сессию, прерываемо, reduced-motion → мгновенно.
// Неровные чернильные кляксы (а не круги) — симметрично, как Роршах.
const BLOB_A =
  "M0,-9 C5,-10 11,-5 10,1 C9,7 4,11 -1,10 C-8,9 -11,2 -9,-3 C-8,-8 -4,-9 0,-9 Z";
const BLOB_B =
  "M0,-8 C6,-9 10,-3 8,3 C7,9 0,11 -4,9 C-10,7 -10,0 -8,-4 C-6,-8 -3,-8 0,-8 Z";
const BLOB_C =
  "M0,-10 C4,-11 7,-8 8,-3 C12,-2 12,4 7,6 C5,11 -2,12 -5,8 C-11,7 -11,-1 -8,-4 C-7,-9 -4,-9 0,-10 Z";

// Каждая клякса независима: своё место, своя задержка, своя скорость и размер.
const INK_BLOTS: {
  d: string;
  x: number;
  y: number;
  r: number;
  delay: number;
  dur: number;
  sc: number;
}[] = [
  // Разбросаны по всему экрану, мелкие, с широким разбросом по времени —
  // чернила проступают из РАЗНЫХ точек и лишь потом сливаются.
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

export function Intro() {
  const [done, setDone] = useState(false);
  const finish = useCallback(() => setDone(true), []);

  useEffect(() => {
    const seen =
      typeof sessionStorage !== "undefined" && sessionStorage.getItem("pt-intro");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      setDone(true);
      return;
    }
    const t = window.setTimeout(() => setDone(true), 2900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (done && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("pt-intro", "1");
    }
  }, [done]);

  if (done) return null;

  return (
    <div
      className="pt-intro"
      role="presentation"
      onPointerDown={finish}
      onWheel={finish}
      onTouchStart={finish}
    >
      <svg
        className="pt-intro__ink"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <mask id="pt-ink-mask">
            <rect x="-20" y="-20" width="140" height="140" fill="#fff" />
            <g className="pt-intro__blots" fill="#000">
              {INK_BLOTS.map((b, i) => (
                <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.r})`}>
                  <path
                    className="pt-intro__blot"
                    d={b.d}
                    style={
                      {
                        animationDelay: `${b.delay}ms`,
                        animationDuration: `${b.dur}ms`,
                        "--bs": b.sc,
                      } as CSSProperties
                    }
                  />
                </g>
              ))}
            </g>
          </mask>
        </defs>
        <rect x="-20" y="-20" width="140" height="140" fill="#06201f" mask="url(#pt-ink-mask)" />
      </svg>
      <div className="pt-intro__grain" aria-hidden />
      <div className="pt-intro__brand">
        <span className="pt-intro__eyebrow">Раковарня · Москва</span>
        <span className="pt-intro__word">
          The <em>Raki</em>
        </span>
      </div>
    </div>
  );
}

// Колофон — финальный блок с гравюрным раком.
export function Colophon() {
  return (
    <footer className="pt__colophon">
      <p className="pt__colophon-word">
        The <em>Raki</em>
      </p>
      <p className="pt__colophon-line">Заказ примет ваш официант.</p>
      <p className="pt__colophon-meta">
        Магадан · Камчатка
        <br />
        Цены в рублях · ◆ — фирменные позиции
      </p>
    </footer>
  );
}

// ----------------------------------------------------------------
// Editorial-карточка (вариант C, гибрид): язык .menu-card-editorial сайта.
// Кремовая панель → курсивный резон → фото 4:3 (плейсхолдер с водяным
// знаком, пока нет снимков) → имя + цена. View-only, тап → шторка.
// ----------------------------------------------------------------
export function EditorialCard({
  reason,
  name,
  price,
  unit,
  detail,
  signature,
  spicy,
  desc,
}: {
  reason?: string;
  name: ReactNode;
  price: number;
  unit?: string;
  detail: SheetEntry;
  signature?: boolean;
  spicy?: boolean;
  desc?: string;
}) {
  const open = useSheet();
  return (
    <button
      type="button"
      className="pt__ecard"
      onClick={() => open(detail)}
      aria-haspopup="dialog"
    >
      {reason ? <span className="pt__ecard-reason">—— {reason}</span> : null}
      <span className="pt__ecard-row">
        <span className="pt__ecard-name">
          {name}
          {signature ? <span className="pt__sig">◆</span> : null}
          {spicy ? (
            <span className="pt__spice" title="остро">
              остро
            </span>
          ) : null}
        </span>
        <span className="pt__ecard-price">
          {formatNumber(price)}
          {unit ? <small> /{unit}</small> : null}
        </span>
      </span>
      {desc ? <span className="pt__ecard-desc">{desc}</span> : null}
    </button>
  );
}

// ----------------------------------------------------------------
// Sticky chapter nav (вариант C).
// ----------------------------------------------------------------
export function ChapterNav({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  const [active, setActive] = useState(items[0]?.id);
  const navRef = useRef<HTMLElement>(null);

  // Scroll-spy: подсвечиваем главу, пересекающую верхнюю треть экрана.
  useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(`pt-${it.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (top) setActive(top.target.id.replace(/^pt-/, ""));
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [items]);

  // Активный чип всегда виден в горизонтальной ленте (16 глав).
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>("[data-active]");
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <nav className="pt__nav" aria-label="Разделы меню" ref={navRef}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <a
            key={it.id}
            href={`#pt-${it.id}`}
            className="pt__nav-link"
            data-active={on || undefined}
            aria-current={on ? "true" : undefined}
          >
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}

