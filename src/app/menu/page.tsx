"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { chapters, rakiChapter, formatNumber, type MenuEntry, type RakiPreparation } from "@/data/menu";
import "./menu.css";

// Раки — отдельная глава в menu.ts; вводим как секцию (размер → ₽/кг).
const RAKI_SECTION = {
  id: "raki",
  title: "Раки",
  lede: undefined as string | undefined,
  origin: undefined as string | undefined,
  entries: rakiChapter.sizes.map((s): MenuEntry => ({
    name: `Раки · ${s.tier}`,
    price: s.price,
    unit: "кг",
    note: `${s.countPerKg} шт/кг`,
    signature: false,
    spicy: false,
    group: undefined as string | undefined,
  })),
};

// «Напитки» — UI-слияние soft+tea+beer в одну категорию с под-группами.
// Контент дока НЕ трогаем: берём те же entries, пиву проставляем группу «Пиво».
const DRINK_IDS = ["soft", "tea", "beer"];
const DRINKS_SECTION = {
  id: "drinks",
  title: "Коллекция напитков",
  lede: undefined as string | undefined,
  origin: undefined as string | undefined,
  entries: DRINK_IDS.flatMap((id): MenuEntry[] => {
    const ch = chapters.find((c) => c.id === id);
    if (!ch) return [];
    // group уже есть у soft/tea (Воды/Газировки/Соки/Чай/Кофе); у пива нет — проставляем «Пиво»
    return ch.entries.map((e): MenuEntry => ({ ...e, group: e.group ?? "Пиво" }));
  }),
};
const MENU_ORDER = [
  "crab",
  "raki",
  "starters",
  "shrimp",
  "salads",
  "hot",
  "soups",
  "mussels",
  "mains",
  "garnish",
  "vongole",
  "sauces",
  "desserts",
  "drinks",
];

const RAW_SECTIONS = [
  RAKI_SECTION,
  ...chapters.filter((c) => !DRINK_IDS.includes(c.id)),
  DRINKS_SECTION,
];
const SECTIONS = MENU_ORDER
  .map((id) => RAW_SECTIONS.find((section) => section.id === id))
  .filter((section): section is NonNullable<typeof section> => Boolean(section));

// Категории-списки (без фото): напитки/соусы/гарниры — компактный текст, не карточки.
const LIST_CATEGORIES = new Set(["drinks", "sauces"]);

const LABEL: Record<string, string> = {
  crab: "Камчатский краб",
  raki: "Раки",
  starters: "Изысканные закуски",
  shrimp: "Креветки магаданская / медведка",
  salads: "Авторские салаты",
  hot: "Горячие акценты",
  soups: "Супы",
  mussels: "Мидии",
  mains: "Главный курс",
  garnish: "На гарнир",
  vongole: "Ракушки вонголе",
  sauces: "Соусы",
  desserts: "Сладкий аккорд",
  drinks: "Коллекция напитков",
};

function sectionTitle(section: { id: string; title: string }) {
  return LABEL[section.id] ?? section.title;
}

// Короткие ярлыки для ленты-пилюль (заголовки секций остаются полными, из дока)
const NAV_LABEL: Record<string, string> = {
  crab: "Краб", raki: "Раки", starters: "Закуски", shrimp: "Креветки",
  salads: "Салаты", hot: "Горячее", soups: "Супы", mussels: "Мидии",
  mains: "Основные", garnish: "Гарниры", vongole: "Вонголе", sauces: "Соусы",
  desserts: "Десерты", drinks: "Напитки",
};

// Тематический значок-орнамент у заголовка секции (прозрачные PNG художницы).
// Супу пока даём укроп — до появления ассета «суп/тарелка» от художницы.
const SECTION_ICON: Record<string, string> = {
  crab: "crab", raki: "crayfish-heraldic", shrimp: "shrimp",
  starters: "oyster-pearl", salads: "dill-flower", hot: "crayfish-blue",
  soups: "dill-coral", mussels: "mussel-blue", vongole: "clam",
  mains: "scallop", garnish: "dill-coral", sauces: "oyster-pearl",
  desserts: "scallop", drinks: "mussel-open",
};

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

function drinkLogo(entry: MenuEntry): { kind: string; src: string } | null {
  const n = entry.name.toLowerCase();
  if (n.includes("айингер")) return { kind: "ayinger", src: "/images/drink-logos/ayinger.webp" };
  if (n.includes("коникс")) return { kind: "konix", src: "/images/drink-logos/konix.webp" };
  if (n.includes("штигель")) return { kind: "stiegl", src: "/images/drink-logos/stiegl.webp" };
  if (n.includes("шпатен")) return { kind: "spaten", src: "/images/drink-logos/spaten.webp" };
  if (n.includes("клаусталлер")) return { kind: "clausthaler", src: "/images/drink-logos/clausthaler.webp" };
  if (n.includes("абрау")) return { kind: "abrau", src: "/images/drink-logos/abrau4.webp" };
  if (n.includes("сан бенедетто")) return { kind: "sanbenedetto", src: "/images/drink-logos/sanbenedetto.webp" };
  if (n.includes("боржоми")) return { kind: "borjomi", src: "/images/drink-logos/borjomi.webp" };
  if (n.includes("zero")) return { kind: "cola-zero", src: "/images/drink-logos/cola-zero.webp" };
  if (n.includes("кока")) return { kind: "cola", src: "/images/drink-logos/cola.webp" };
  if (n.includes("фанта")) return { kind: "fanta", src: "/images/drink-logos/fanta.webp" };
  if (n.includes("yoga")) return { kind: "yoga", src: "/images/drink-logos/yoga.webp" };
  return null;
}

function DrinkBadge({ entry }: { entry: MenuEntry }) {
  const logo = drinkLogo(entry);
  if (!logo) return null;

  return (
    <span className={`mn__drink-logo mn__drink-logo--${logo.kind}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="" loading="lazy" />
    </span>
  );
}

// Полные фото с БЕЛЫМ студийным фоном (НЕ cutout) — ложатся под object-fit:cover карточек.
const DISH_PHOTO: Record<string, string> = {
  "Микс на льду: магаданская и медведка 70/90": "/images/menu-shrimp-mix.webp",
  "Медведка на льду 70/90": "/images/menu-shrimp-medvedka.webp",
  "Магаданская на льду 70/90": "/images/menu-shrimp-mix.webp",
  "Магаданская обжаренная в азиатском стиле 70/90": "/images/menu-shrimp-hot-asian.webp",
  "Магаданская на льду 50/70": "/images/menu-shrimp-mix.webp",
  "Золотистый бейби-картофель с балтийской килькой": "/images/menu-starter-potato.webp",
  "Хрустящие битые огурцы в пикантном маринаде": "/images/menu-starter-cucumbers.webp",
  "Сет гурманских дипов с хрустящим хлебом": "/images/menu-starter-dips.webp",
  "Карпаччо из мраморной говядины с соусом чимичурри": "/images/menu-starter-carpaccio.webp",
  "Пряная закуска из маринованных черри и моцареллы": "/images/menu-starter-cherry-mozzarella.webp",
  "Салат с раковыми шейками по рецепту мистера Оливье": "/images/menu-salad-olivier.webp",
  "Тропический салат с камчатским крабом, манго и личи": "/images/menu-salad-crab.webp",
  "Салат с ростбифом из мраморной говядины и вялеными томатами": "/images/menu-salad-roastbeef.webp",
  "Салат с хрустящими баклажанами и сочными томатами": "/images/menu-salad-eggplant.webp",
  "Классический греческий салат": "/images/menu-salad-greek.webp",
  "Гурмэ хот-дог с крабом и авокадо": "/images/menu-hot-hotdog.webp",
  "Фиш-энд-краб": "/images/menu-hot-fishcrab.webp",
  "Куриные крылья с соусом на выбор": "/images/menu-hot-wings.webp",
  "Острые куриные крылья": "/images/menu-hot-wings.webp",
  "Хрустящие бородинские гренки с донским укропом": "/images/menu-hot-grenki.webp",
  "Крафтовые куриные наггетсы": "/images/menu-hot-nuggets.webp",
  "Португальский суп с раковыми шейками": "/images/menu-soup-port.webp",
  "Домашняя куриная лапша": "/images/menu-soup-chicken-noodle.webp",
  "Том-ям с раковыми шейками": "/images/menu-soup-tomyam.webp",
  "Мидии в соусе": "/images/menu-mussels-tomyam.webp",
  "Вонголе в соусе": "/images/menu-vongole-arrabiata.webp",
  "Авторская паста с камчатским крабом и нори в кокосовом соусе": "/images/menu-main-crab-pasta.webp",
  "Бифштекс под соусом из раковых шеек": "/images/menu-main-beefsteak.webp",
  "Фетучини с раковыми шейками и молодым шпинатом": "/images/menu-main-fettuccine.webp",
  "Картофель фри": "/images/menu-garnish-fries.webp",
  "Батат фри": "/images/menu-garnish-sweet-potato.webp",
  "Десерт THE RAKI": "/images/menu-dessert-the-raki.webp",
  "Малина или вишня в молочном шоколаде": "/images/menu-dessert-raspberry-chocolate.webp",
};

const RAKI_FROM = Math.min(...rakiChapter.sizes.map((s) => s.price));

/* ---------- РАКИ: 2 карточки (отварные/жареные); размеры+рецепты — в детали по тапу ---------- */
function RakiBlock({ onOpen }: { onOpen: (p: RakiPreparation) => void }) {
  return (
    <div className="mn__cards">
      {rakiChapter.preparations.map((p, i) => (
        <button
          key={p.id}
          className="mn__card has-photo"
          type="button"
          style={{ animationDelay: `${i * 55}ms` }}
          onClick={() => onOpen(p)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="mn__card-photo"
            src={p.id === "boiled" ? "/images/menu-raki-boiled.webp" : "/images/menu-raki-fried.webp"}
            alt={"Раки " + p.title.toLowerCase()}
            loading="lazy"
          />
          <div className="mn__card-body">
            <h3 className="mn__card-name">Раки {p.title.toLowerCase()}</h3>
            <span className="mn__card-price">от {formatNumber(RAKI_FROM)} ₽</span>
            <span className="mn__card-meta">за кг · размеры S–XXL</span>
            <p className="mn__card-note">{p.recipes.map((r) => r.name).join(" · ")}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- РАКИ деталь: доска размеров S–XXL + рецепты выбранного способа ---------- */
function RakiDetail({ prep, onClose }: { prep: RakiPreparation; onClose: () => void }) {
  const photo = prep.id === "boiled" ? "/images/menu-raki-boiled.webp" : "/images/menu-raki-fried.webp";
  return (
    <div className="mn__detail" role="dialog" aria-modal="true">
      <button className="mn__detail-bg" type="button" aria-label="Закрыть" onClick={onClose} />
      <div className="mn__detail-card">
        <button className="mn__detail-x" type="button" aria-label="Закрыть" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mn__detail-photo" src={photo} alt={"Раки " + prep.title.toLowerCase()} />
        <h3 className="mn__detail-name">Раки {prep.title.toLowerCase()}</h3>
        <div className="mn__raki-board">
          <div className="mn__raki-head">
            <span>Размер</span>
            <span>шт / кг</span>
            <span>1 кг</span>
            <span>0,5 кг</span>
          </div>
          {rakiChapter.sizes.map((s, idx) => (
            <div className="mn__raki-size" key={s.tier}>
              <span className="mn__raki-tier" style={{ fontSize: `${20 + idx * 3}px` }}>{s.tier}</span>
              <span className="mn__raki-pieces">{s.countPerKg}</span>
              <span className="mn__raki-price">{formatNumber(s.price) + " ₽"}</span>
              <span className="mn__raki-price">{formatNumber(s.price / 2) + " ₽"}</span>
            </div>
          ))}
        </div>
        <div className="mn__prep-head mn__prep-head--detail">
          <span className="mn__prep-title">{prep.recipesLabel}</span>
        </div>
        <div className="mn__recipes">
          {prep.recipes.map((r) => (
            <span className={"mn__recipe" + (r.spicy ? " is-spicy" : "")} key={r.name}>
              {r.name}
              {r.spicy ? <span className="mn__mark" title="остро">{ChiliIcon}</span> : null}
              {!r.spicy && r.name.toLowerCase().includes("помидор")
                ? <span className="mn__mark" title="томат">{TomatoIcon}</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
/* ---------- ИНТРО: белый «лист» с лого и каракулями → прожиг пятнами Роршаха ----------
   Пятна расширяются каждое из своей точки (края первыми, центр с лого — последним),
   по фронту бежит тонкая гжель-кобальтовая линия и гаснет, едва фронт прошёл.
   Меню УЖЕ лежит под листом и наводится на резкость из лёгкого расфокуса.
   Играет при КАЖДОМ открытии (без sessionStorage), тап/скролл — пропустить. */

// Три лопастных формы клякс (радиус ~65..112 в локальных единицах, центр 0,0);
// турбулентность фильтра дорисовывает рваные языки поверх лопастей.
const INK_SHAPES: Record<string, string> = {
  a: "M0,-100 C50,-108 96,-84 100,-44 C103,-16 68,-6 64,16 C60,44 88,58 74,84 C58,106 18,96 -8,100 C-44,106 -76,84 -84,52 C-94,24 -70,6 -74,-22 C-78,-52 -56,-84 -24,-94 C-14,-98 -8,-99 0,-100 Z",
  b: "M-6,-88 C34,-96 70,-78 84,-46 C96,-18 62,0 70,30 C80,64 74,94 38,92 C10,90 0,64 -24,70 C-54,78 -92,64 -96,30 C-100,-2 -78,-20 -82,-48 C-84,-72 -60,-84 -34,-90 C-24,-92 -14,-90 -6,-88 Z",
  c: "M8,-96 C40,-104 64,-80 58,-52 C90,-60 108,-30 96,-4 C86,16 60,16 58,38 C76,58 66,92 36,94 C12,96 4,74 -20,82 C-48,90 -76,74 -78,44 C-80,20 -60,10 -66,-16 C-72,-44 -92,-54 -84,-76 C-76,-94 -48,-88 -28,-84 C-12,-94 -2,-92 8,-96 Z",
};

// Очаги в дизайн-пространстве 390×844 (масштабируется под реальный вьюпорт).
// Края/углы первыми, центр (лого) — последним; иерархия размеров; ритм капель кластерами;
// у каждой кляксы свои длительность и поворот — рост живой, не хоровой.
type InkFocus = { x: number; y: number; r: number; d: number; rot: number; s: string; dur: number };
const INK_FOCI: InkFocus[] = [
  { x: 40, y: 60, r: 150, d: 0.00, rot: 0, s: "a", dur: 1.45 },
  { x: 360, y: 130, r: 195, d: 0.20, rot: 130, s: "b", dur: 1.55 },
  { x: 30, y: 500, r: 170, d: 0.26, rot: 255, s: "c", dur: 1.45 },
  { x: 380, y: 430, r: 135, d: 0.50, rot: 40, s: "a", dur: 1.30 },
  { x: 170, y: 805, r: 215, d: 0.56, rot: 200, s: "b", dur: 1.50 },
  { x: 8, y: 255, r: 110, d: 0.60, rot: 320, s: "c", dur: 1.20 },
  { x: 362, y: 730, r: 130, d: 0.78, rot: 85, s: "c", dur: 1.25 },
  { x: 300, y: 290, r: 100, d: 0.84, rot: 170, s: "b", dur: 1.15 },
  { x: 195, y: 430, r: 205, d: 1.02, rot: 15, s: "a", dur: 1.15 },
];
// Микро-брызги: мелкие капли рядом с крупными кляксами, чуть позже родителя.
const INK_SPECKS: InkFocus[] = [
  { x: 330, y: 38, r: 15, d: 0.30, rot: 60, s: "c", dur: 0.90 },
  { x: 238, y: 206, r: 10, d: 0.52, rot: 220, s: "a", dur: 0.85 },
  { x: 62, y: 642, r: 13, d: 0.46, rot: 145, s: "b", dur: 0.90 },
  { x: 286, y: 604, r: 10, d: 0.76, rot: 305, s: "a", dur: 0.85 },
  { x: 106, y: 352, r: 9, d: 0.92, rot: 20, s: "c", dur: 0.80 },
];
const INK_ALL = [...INK_FOCI, ...INK_SPECKS];
const INK_START = 1.30; // лого + влёт каракулей, затем первый поджиг, с
const INK_STAGGER = 0.62;
const INTRO_TOTAL_MS = 3700; // конец прожига + короткий выдох

// Композиция каракулей на заставке — рамкой вокруг центрального лого.
// Хореография: СНАЧАЛА лого, затем каракули ВЛЕТАЮТ из-за экрана с тех сторон,
// где стоят (fx/fy — вектор влёта, px), встают на места — и лишь потом поджиг.
const INTRO_ORNAMENTS: { src: string; x: number; y: number; w: number; r: number; d: number; fx: number; fy: number }[] = [
  { src: "dill-flower", x: 16, y: 13, w: 132, r: -12, d: 450, fx: -150, fy: -110 },
  { src: "shrimp", x: 84, y: 15, w: 150, r: 8, d: 520, fx: 150, fy: -110 },
  { src: "mussel-blue", x: 4, y: 34, w: 116, r: 16, d: 590, fx: -160, fy: 0 },
  { src: "oyster-pearl", x: 97, y: 36, w: 118, r: -14, d: 660, fx: 160, fy: 0 },
  { src: "scallop", x: 19, y: 82, w: 128, r: -8, d: 730, fx: -150, fy: 120 },
  { src: "crab", x: 82, y: 84, w: 150, r: 10, d: 800, fx: 150, fy: 120 },
  { src: "dill-coral", x: 50, y: 95, w: 150, r: 4, d: 870, fx: 0, fy: 150 },
];

// Амбиентные иллюстрации меню: рассыпаны по краям ВСЕЙ страницы в разнобой (как хотела
// художница — «паттерн по всему меню»), приглушены, дрейфуют при скролле (параллакс
// относительно центра вьюпорта). top — % высоты всей ленты; side — край; speed — множитель.
const MENU_ORNAMENTS: { src: string; side: "left" | "right"; top: number; w: number; r: number; speed: number }[] = [
  { src: "shrimp", side: "right", top: 3, w: 150, r: 8, speed: 0.05 },
  { src: "dill-coral", side: "left", top: 9, w: 152, r: -10, speed: -0.04 },
  { src: "oyster-pearl", side: "right", top: 16, w: 128, r: 12, speed: 0.06 },
  { src: "scallop", side: "left", top: 23, w: 140, r: -8, speed: -0.05 },
  { src: "mussel-blue", side: "right", top: 31, w: 138, r: 14, speed: 0.045 },
  { src: "clam", side: "left", top: 39, w: 132, r: -12, speed: -0.04 },
  { src: "dill-flower", side: "right", top: 47, w: 142, r: 6, speed: 0.05 },
  { src: "crayfish-blue", side: "left", top: 55, w: 150, r: 10, speed: -0.045 },
  { src: "oyster-pearl", side: "right", top: 63, w: 124, r: -14, speed: 0.06 },
  { src: "mussel-open", side: "left", top: 71, w: 150, r: 8, speed: -0.035 },
  { src: "scallop", side: "right", top: 79, w: 134, r: -10, speed: 0.05 },
  { src: "dill-coral", side: "left", top: 87, w: 150, r: 12, speed: -0.04 },
  { src: "crab", side: "right", top: 94, w: 150, r: -8, speed: 0.05 },
];

// Один элемент-клякса для маски: растёт из своей точки; в режиме line дополнительно
// гаснет (вторая анимация), едва фронт прошёл — статичных линий не остаётся.
function InkBlob({ f, mode }: { f: InkFocus; mode: "fill" | "cut" | "line" }) {
  const delay = INK_START + f.d * INK_STAGGER;
  const factor = mode === "cut" ? 0.95 : mode === "line" ? 0.992 : 1;
  const style: CSSProperties =
    mode === "line"
      ? { animationDelay: `${delay.toFixed(3)}s, ${(delay + f.dur * 0.85).toFixed(3)}s`, animationDuration: `${f.dur}s, 0.35s` }
      : { animationDelay: `${delay.toFixed(3)}s`, animationDuration: `${f.dur}s` };
  return (
    <g transform={`translate(${f.x} ${f.y}) rotate(${f.rot}) scale(${((f.r / 100) * factor).toFixed(4)})`}>
      <path
        className={"mn-intro__blot" + (mode === "line" ? " mn-intro__blot--line" : "")}
        d={INK_SHAPES[f.s]}
        {...(mode === "line"
          ? { fill: "none", stroke: "#fff", strokeWidth: 1.6, vectorEffect: "non-scaling-stroke" as const }
          : { fill: "#000" })}
        style={style}
      />
    </g>
  );
}

function MenuIntro({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(false);
  // дизайн-пространство клякс 390×844 → масштабируем под реальный вьюпорт.
  // Первый рендер ВСЕГДА 390×844 (SSR = клиент, иначе hydration mismatch);
  // реальный размер подставляется в useEffect до старта первого поджига (0.75s).
  const [vp, setVp] = useState({ w: 390, h: 844 });

  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finish = () => { setDone(true); onDone(); };
    if (reduce) { finish(); return; }
    const t = window.setTimeout(finish, INTRO_TOTAL_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { setDone(true); onDone(); };

  if (done) return null;

  const sx = (vp.w / 390).toFixed(4);
  const sy = (vp.h / 844).toFixed(4);
  const scale = `scale(${sx} ${sy})`;

  return (
    <div className="mn-intro" role="presentation" onPointerDown={skip} onWheel={skip} onTouchStart={skip}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          {/* форма прожига: лёгкое слияние соседей + крупно-лопастное искажение края */}
          <filter id="mn-goo" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.012" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="goo" in2="noise" scale="30" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* линия: то же поле шума (кромка следует за краем дыры), без слипания */}
          <filter id="mn-gooline" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.012" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="30" xChannelSelector="R" yChannelSelector="G" result="disp" />
            <feGaussianBlur in="disp" stdDeviation="0.4" />
          </filter>
          <mask id="mn-paper-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={vp.w} height={vp.h}>
            <rect x="0" y="0" width={vp.w} height={vp.h} fill="#fff" />
            <g transform={scale} filter="url(#mn-goo)">
              {INK_ALL.map((f, i) => <InkBlob key={i} f={f} mode="fill" />)}
            </g>
          </mask>
          {/* линия = обводка МИНУС выгоревшее ядро → остаётся только фронт прожига */}
          <mask id="mn-line-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={vp.w} height={vp.h}>
            <rect x="0" y="0" width={vp.w} height={vp.h} fill="#000" />
            <g transform={scale} filter="url(#mn-gooline)">
              {INK_ALL.map((f, i) => <InkBlob key={i} f={f} mode="line" />)}
            </g>
            <g transform={scale} filter="url(#mn-goo)">
              {INK_ALL.map((f, i) => <InkBlob key={i} f={f} mode="cut" />)}
            </g>
          </mask>
        </defs>
      </svg>

      {/* белый лист: лого + каракули НА листе — сгорают вместе с ним */}
      <div className="mn-intro__paper">
        <div className="mn-intro__grain" aria-hidden />
        <div className="mn-intro__scatter" aria-hidden>
          {INTRO_ORNAMENTS.map((o, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={`/ornaments/${o.src}.png`}
              alt=""
              className="mn-intro__orn"
              style={{ "--x": o.x, "--y": o.y, "--w": o.w, "--r": `${o.r}deg`, "--d": `${o.d}ms`, "--fx": `${o.fx}px`, "--fy": `${o.fy}px` } as CSSProperties}
            />
          ))}
        </div>
        <div className="mn-intro__brand">
          <span className="mn-intro__eyebrow">Раковарня · Москва</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mn-intro__logo" src="/ornaments/logo-black.png" alt="The Raki" />
          <span className="mn-intro__sub">Карта раковарни</span>
        </div>
      </div>

      {/* тонкая гжель-кобальтовая линия по фронту прожига */}
      <div className="mn-intro__edge" aria-hidden />
    </div>
  );
}

export default function Menu() {
  const [detail, setDetail] = useState<MenuEntry | null>(null); // крупная карточка блюда
  const [rakiPrep, setRakiPrep] = useState<RakiPreparation | null>(null); // деталь раков (способ)
  const [introDone, setIntroDone] = useState(false); // интро растворилось
  const [subGroup, setSubGroup] = useState<string | null>(null); // под-группа «Напитков» для липкого под-бара
  const [active, setActive] = useState("crab"); // текущая секция для ленты-пилюль
  const ambientRef = useRef<HTMLDivElement | null>(null); // слой амбиентных иллюстраций (параллакс)
  const tabsRef = useRef<HTMLElement | null>(null); // лента-пилюли (автоцентрируем активную)
  const handleIntroDone = useCallback(() => setIntroDone(true), []);

  // scroll-spy: подсветка текущей секции в ленте-пилюлях
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
      { rootMargin: "-18% 0px -70% 0px", threshold: 0 },
    );
    secs.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // активная пилюля всегда в кадре ленты. Автоцентр НАМЕРЕННО instant:
  // второй одновременный smooth-скролл гасит smooth-прыжок страницы к секции (Chromium).
  useEffect(() => {
    const strip = tabsRef.current;
    const el = strip?.querySelector<HTMLElement>(".mn__tab.is-active");
    if (!strip || !el) return;
    strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2 });
  }, [active]);

  const pick = useCallback((id: string) => {
    setActive(id);
    document.getElementById(`mn-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Параллакс амбиентного слоя: каждый орнамент дрейфует translateY = scrollY * speed.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const layer = ambientRef.current;
    if (!layer) return;
    const items = Array.from(layer.querySelectorAll<HTMLElement>(".mn__amb"));
    let raf = 0;
    const apply = () => {
      raf = 0;
      const vpMid = window.scrollY + window.innerHeight / 2;
      for (const el of items) {
        const sp = parseFloat(el.dataset.speed || "0");
        const center = el.offsetTop + el.offsetHeight / 2; // позиция орнамента на ленте
        const drift = (vpMid - center) * sp;               // дрейф относительно центра экрана (ограничен)
        el.style.transform = `translate3d(0, ${drift.toFixed(1)}px, 0) rotate(var(--r))`;
      }
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(apply); };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // блокируем фоновый скролл: пока идёт интро или открыта карточка блюда/деталь раков
  useEffect(() => {
    document.body.style.overflow = detail || rakiPrep || !introDone ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [detail, rakiPrep, introDone]);

  // §3A: плавное появление карточек/строк/заголовков при входе во вьюпорт (как на сайте).
  // Scroll-sweep (надёжнее IntersectionObserver, который пропускает при быстром скролле):
  // на кадр скролла проявляем всё, что пересекло линию экрана — ничего не залипнет скрытым.
  // Прогрессивно: класс .reveal-on вешается только при активном JS, без него контент виден.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    document.querySelector(".mn")?.classList.add("reveal-on");
    let els = Array.from(document.querySelectorAll<HTMLElement>(".mn__card, .mn__row, .mn__ch"));
    let raf = 0;
    const sweep = () => {
      raf = 0;
      const line = window.innerHeight * 0.92;
      els = els.filter((el) => {
        if (el.getBoundingClientRect().top < line) { el.classList.add("is-in"); return false; }
        return true;
      });
      if (!els.length) stop();
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(sweep); };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    sweep();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return stop;
  }, []);

  // Липкий под-бар «Напитков»: пока секция «Напитки» у верха — показываем текущую
  // под-группу (Воды/Соки/Пиво…), отслеживая, какой под-заголовок пересёк линию панели.
  useEffect(() => {
    const sec = document.getElementById("mn-drinks");
    if (!sec) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      // линия = нижняя кромка панели (учитывает safe-area/чёлку), а не хардкод
      const bar = document.querySelector<HTMLElement>(".mn__top");
      const line = (bar?.getBoundingClientRect().bottom ?? 48) + 24;
      const r = sec.getBoundingClientRect();
      if (r.top > line || r.bottom < line) { setSubGroup(null); return; }
      const groups = Array.from(sec.querySelectorAll<HTMLElement>(".mn__group"));
      let cur: string | null = null; // пока ни один под-заголовок не дошёл до панели — под-бар скрыт
      for (const g of groups) { if (g.getBoundingClientRect().top <= line) cur = g.textContent; }
      setSubGroup(cur);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={"mn" + (introDone ? " mn--introdone" : "")}>
      <MenuIntro onDone={handleIntroDone} />

      {/* Амбиентный слой иллюстраций (ironhill-стиль): по краям, приглушённо,
          с лёгким параллакс-дрейфом при скролле — за контентом, не перекрывает. */}
      <div className="mn__ambient" aria-hidden ref={ambientRef}>
        {MENU_ORNAMENTS.map((o, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`/ornaments/${o.src}.png`}
            alt=""
            className={"mn__amb mn__amb--" + o.side}
            data-speed={o.speed}
            style={{ "--top": o.top, "--w": `${o.w}px`, "--r": `${o.r}deg` } as CSSProperties}
          />
        ))}
      </div>

      <header className={"mn__top" + (introDone ? " is-shown" : "")}>
        <div className="mn__top-row">
          <span className="mn__brand">The <em>Raki</em></span>
          {subGroup ? (
            <span className="mn__top-sub" aria-live="polite">{subGroup}</span>
          ) : null}
        </div>
        <nav className="mn__tabs" aria-label="Разделы меню" ref={tabsRef}>
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              className={"mn__tab" + (active === sec.id ? " is-active" : "")}
              onClick={() => pick(sec.id)}
            >
              {NAV_LABEL[sec.id] ?? sectionTitle(sec)}
            </button>
          ))}
        </nav>
      </header>

      <main className={introDone ? undefined : "is-veiled"}>
        {SECTIONS.map((sec) => (
          <section className="mn__section" id={`mn-${sec.id}`} key={sec.id}>
            <h2 className="mn__ch">
              <span className="mn__ch-text">{sectionTitle(sec)}</span>
              {SECTION_ICON[sec.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="mn__ch-icon" src={`/ornaments/${SECTION_ICON[sec.id]}.png`} alt="" aria-hidden />
              ) : null}
            </h2>
            {sec.lede ? <span className="mn__ch-lede">{sec.lede}</span> : null}
            <div className="mn__rule" />
            {sec.id === "raki" ? (
              <RakiBlock onOpen={setRakiPrep} />
            ) : LIST_CATEGORIES.has(sec.id) ? (
              <div className={"mn__list" + (sec.id === "drinks" ? " mn__list--badges" : "")}>
                {sec.entries.map((e, i) => {
                  const showGroup = e.group && e.group !== sec.entries[i - 1]?.group;
                  const hasDrinkLogo = sec.id === "drinks" && Boolean(drinkLogo(e));
                  return (
                    <Fragment key={e.name}>
                      {showGroup ? <div className="mn__group">{e.group}</div> : null}
                      <div className={"mn__row" + (hasDrinkLogo ? " mn__row--with-badge" : "")}>
                        {hasDrinkLogo ? <DrinkBadge entry={e} /> : null}
                        <span className="mn__row-name">
                          {e.name}
                          {e.spicy ? <span className="mn__mark" title="остро">{ChiliIcon}</span> : null}
                        </span>
                        <span className="mn__row-price">
                          {formatNumber(e.price) + " ₽"}
                          {e.unit ? <i className="mn__row-unit">{e.unit}</i> : null}
                        </span>
                        {e.note ? <span className="mn__row-note">{e.note}</span> : null}
                        {e.variants?.length ? (
                          <span className="mn__row-variants">
                            {e.variants.map((v) => v.label + " — " + formatNumber(v.price) + " ₽").join("  ·  ")}
                          </span>
                        ) : null}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="mn__cards">
                {sec.entries.map((e, i) => {
                const photo = DISH_PHOTO[e.name];
                const showGroup = e.group && e.group !== sec.entries[i - 1]?.group;
                return (
                  <Fragment key={e.name}>
                  {showGroup ? <div className="mn__group">{e.group}</div> : null}
                  <button
                    className={"mn__card" + (photo ? " has-photo" : "")}
                    type="button"
                    style={{ animationDelay: `${Math.min(i, 4) * 55}ms` }}
                    onClick={() => setDetail(e)}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="mn__card-photo" src={photo} alt={e.name} loading="lazy" />
                    ) : (
                      <div className="mn__card-ph" aria-hidden>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/ornaments/${SECTION_ICON[sec.id] ?? "oyster-pearl"}.png`} alt="" />
                      </div>
                    )}
                    <div className="mn__card-body">
                      <h3 className="mn__card-name">
                        {e.name}
                        {e.spicy ? <span className="mn__mark" title="остро">{ChiliIcon}</span> : null}
                      </h3>
                    <span className="mn__card-price">{formatNumber(e.price) + " ₽"}</span>
                      {e.unit ? <span className="mn__card-meta">{e.unit}</span> : null}
                      {e.note ? <p className="mn__card-note">{e.note}</p> : null}
                    </div>
                  </button>
                  </Fragment>
                );
                })}
              </div>
            )}
          </section>
        ))}
      </main>

      {detail ? <DishDetail entry={detail} onClose={() => setDetail(null)} /> : null}

      {rakiPrep ? <RakiDetail prep={rakiPrep} onClose={() => setRakiPrep(null)} /> : null}
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
