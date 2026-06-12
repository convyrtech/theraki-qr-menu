"use client";

import { useEffect, useRef, useState } from "react";

export type NavChapter = { id: string; label: string };

// Закреплённая навигация по главам со scroll-spy.
// Активная глава определяется по последнему заголовку, прошедшему
// верхнюю кромку, — устойчивее IntersectionObserver на длинных главах.
export function ChapterNav({ chapters }: { chapters: NavChapter[] }) {
  const [activeId, setActiveId] = useState(chapters[0]?.id ?? "");
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = (navRef.current?.offsetHeight ?? 48) + 96;
      let current = chapters[0]?.id ?? "";
      for (const chapter of chapters) {
        const el = document.getElementById(`ch-${chapter.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= probe) current = chapter.id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [chapters]);

  useEffect(() => {
    const active = navRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeId]);

  const jump = (id: string) => {
    const el = document.getElementById(`ch-${id}`);
    if (!el) return;
    const offset = (navRef.current?.offsetHeight ?? 48) + 8;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav className="nav" ref={navRef} aria-label="Главы меню">
      <div className="nav__inner">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            className="nav__link"
            data-active={activeId === chapter.id || undefined}
            onClick={() => jump(chapter.id)}
          >
            {chapter.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
