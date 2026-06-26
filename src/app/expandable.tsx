"use client";

import { Fragment, useId, useState } from "react";
import {
  formatNumber,
  type MenuEntry,
  type RakiPreparation,
} from "@/data/menu";

// Тап-модель плотности: по умолчанию видно только название · размер · цена.
// Описание и доп. форматы — под раскрытие. Анимация высоты через
// grid-template-rows 0fr→1fr (Safari 16+; иначе мгновенно, контент не теряется).

// Русская плюрализация: 1 рецепт · 2–4 рецепта · 5+ рецептов.
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function Toggle({ open }: { open: boolean }) {
  return (
    <span className="led__toggle" data-open={open || undefined} aria-hidden>
      <span className="led__toggle-h" />
      <span className="led__toggle-v" />
    </span>
  );
}

export function ExpandRow({ entry }: { entry: MenuEntry }) {
  const detailId = useId();
  const [open, setOpen] = useState(false);
  const expandable = Boolean(entry.note) || Boolean(entry.variants?.length);

  const summary = (
    <>
      {expandable ? <Toggle open={open} /> : <span className="led__toggle-spacer" />}
      <span className="led__row-name">
        {entry.name}
        {entry.signature ? (
          <span className="led__sig" title="Фирменная позиция">
            ◆
          </span>
        ) : null}
      </span>
      <span className="led__leader" aria-hidden />
      <span className="led__price">
        {formatNumber(entry.price)}
        {entry.unit ? <span className="led__unit">{entry.unit}</span> : null}
      </span>
    </>
  );

  if (!expandable) {
    return (
      <div className="led__row">
        <div className="led__row-summary led__row-summary--static">{summary}</div>
      </div>
    );
  }

  return (
    <div className="led__row" data-open={open || undefined}>
      <button
        type="button"
        className="led__row-summary"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
      >
        {summary}
      </button>
      <div className="led__detail" id={detailId} role="region">
        <div className="led__detail-inner">
          {entry.note ? <p className="led__note">{entry.note}</p> : null}
          {entry.variants?.length ? (
            <div className="led__variants">
              {entry.variants.map((v) => (
                <span key={v.label}>
                  {v.label} — {formatNumber(v.price)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RakiPrepRow({ prep }: { prep: RakiPreparation }) {
  const detailId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="led__row led__prep-row" data-open={open || undefined}>
      <button
        type="button"
        className="led__row-summary"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
      >
        <Toggle open={open} />
        <span className="led__row-name led__prep-name">{prep.title}</span>
        <span className="led__leader" aria-hidden />
        <span className="led__prep-count">
          {prep.recipes.length}{" "}
          {plural(prep.recipes.length, "рецепт", "рецепта", "рецептов")}
        </span>
      </button>
      <div className="led__detail" id={detailId} role="region">
        <div className="led__detail-inner">
          <span className="led__recipes-label">{prep.recipesLabel}</span>
          <p className="led__recipes">
            {prep.recipes.map((recipe, index) => (
              <Fragment key={recipe.name}>
                <span className="led__recipe-unit">
                  {recipe.name}
                  {recipe.extra ? (
                    <>
                      {" "}
                      <span className="led__recipe-extra">
                        +{formatNumber(recipe.extra)}
                      </span>
                    </>
                  ) : null}
                  {index < prep.recipes.length - 1 ? (
                    <span className="led__sep"> ·</span>
                  ) : null}
                </span>{" "}
              </Fragment>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
