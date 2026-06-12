"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { MENU_URL } from "@/data/menu";

// Печатный лист карточек для столов: A4, две карточки A6 (105x148 мм).
// QR ~40 мм — уверенное сканирование с 30-45 см за столом при вечернем свете.
// ?url=https://... переопределяет адрес без пересборки.
export default function QrSheetPage() {
  const [url, setUrl] = useState(MENU_URL);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("url");
    if (override) setUrl(override);
  }, []);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 0,
      color: { dark: "#101c1e", light: "#0000" },
    })
      .then((code) => {
        if (!cancelled) setSvg(code);
      })
      .catch(() => setSvg(""));
    return () => {
      cancelled = true;
    };
  }, [url]);

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
        <div
          className="qr-card__code"
          aria-label={`QR-код меню: ${url}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
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
        </p>
      </div>
      <div className="qr-sheet">
        {card}
        {card}
      </div>
    </div>
  );
}
