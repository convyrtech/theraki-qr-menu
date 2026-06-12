"use client";

import { useEffect, useRef, useState } from "react";
import { MENU_URL } from "@/data/menu";

// Печатный лист карточек для столов: A4, две карточки A6 (105x148 мм).
// QR ~40 мм — уверенное сканирование с 30-45 см за столом при вечернем свете.
// Стилизованные модули (скруглённые точки, мягкие «глаза») вместо дефолтных
// квадратов; контраст остаётся чернила-по-крему — сканируемость не страдает.
// ?url=https://... переопределяет адрес без пересборки.

const QR_STYLE = {
  width: 600,
  height: 600,
  type: "svg" as const,
  margin: 0,
  qrOptions: { errorCorrectionLevel: "Q" as const },
  dotsOptions: { type: "rounded" as const, color: "#101c1e" },
  cornersSquareOptions: { type: "extra-rounded" as const, color: "#101c1e" },
  cornersDotOptions: { type: "dot" as const, color: "#101c1e" },
  backgroundOptions: { color: "transparent" },
};

function StyledQr({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const node = ref.current;
    if (!node) return;
    // qr-code-styling трогает DOM/canvas — грузим только в браузере.
    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (disposed || !node) return;
      node.replaceChildren();
      const qr = new QRCodeStyling({ ...QR_STYLE, data: url });
      qr.append(node);
      const svg = node.querySelector("svg");
      if (svg) {
        svg.removeAttribute("width");
        svg.removeAttribute("height");
      }
    });
    return () => {
      disposed = true;
      node?.replaceChildren();
    };
  }, [url]);

  return (
    <div
      ref={ref}
      className="qr-card__code"
      role="img"
      aria-label={`QR-код меню: ${url}`}
    />
  );
}

export default function QrSheetPage() {
  const [url, setUrl] = useState(MENU_URL);

  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("url");
    if (override) setUrl(override);
  }, []);

  const shortUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const card = (
    <article className="qr-card">
      <header className="qr-card__head">
        <span className="qr-card__wordmark">
          The <em>Raki</em>
        </span>
        <span className="qr-card__rule" aria-hidden />
        <span className="qr-card__title">Меню</span>
      </header>
      <div className="qr-card__arch">
        <StyledQr url={url} />
        <span className="qr-card__url">{shortUrl}</span>
      </div>
      <p className="qr-card__hint">Наведите камеру, чтобы открыть меню</p>
    </article>
  );

  return (
    <div className="qr-page">
      <div className="qr-toolbar">
        <label className="qr-toolbar__label">
          Адрес меню
          <input
            className="qr-toolbar__input"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="qr-toolbar__print"
          onClick={() => window.print()}
        >
          Печать
        </button>
        <p className="qr-toolbar__note">
          Лист A4 — две карточки A6 под тейбл-тент. Матовая ламинация,
          печать из браузера в 100% масштабе (без «вписать в страницу»).
          Перед тиражом проверить скан с 30–40 см при вечернем свете.
        </p>
      </div>
      <div className="qr-sheet">
        {card}
        {card}
      </div>
    </div>
  );
}
