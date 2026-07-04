"use client";

// Error boundary страницы меню: если рендер упадёт (битые данные из БД/jsonb,
// неожиданное значение), гость за столом видит спокойный экран с кнопкой, а НЕ
// белый экран Next по умолчанию. Ошибка логируется на сервере Vercel.
import { useEffect } from "react";

export default function MenuError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[menu] ошибка рендера страницы меню:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
        textAlign: "center",
        background: "#fff",
        color: "#17313d",
        fontFamily: "var(--font-golos, system-ui, sans-serif)",
      }}
    >
      <div style={{ fontFamily: '"Fraunces", "Cormorant Garamond", serif', fontStyle: "italic", fontSize: 26 }}>
        Меню сейчас обновляется
      </div>
      <p style={{ fontSize: 15, color: "#6b8494", maxWidth: 320, lineHeight: 1.5 }}>
        Секунду — обновите страницу. Если не поможет, позовите официанта, он всё подскажет.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          appearance: "none",
          border: "none",
          cursor: "pointer",
          background: "#17313d",
          color: "#fff",
          borderRadius: 999,
          padding: "14px 28px",
          fontFamily: "var(--font-golos, system-ui, sans-serif)",
          fontSize: 15,
          letterSpacing: ".03em",
        }}
      >
        Обновить
      </button>
    </div>
  );
}
