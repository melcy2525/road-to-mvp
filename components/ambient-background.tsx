"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

const preferenceKey = "road-to-mvp-background-paused";

export default function AmbientBackground() {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      setPaused(localStorage.getItem(preferenceKey) === "true");
    } catch {
      // The switch still works when browser storage is unavailable.
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function toggle() {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem(preferenceKey, String(next));
    } catch {
      // Only this visual preference is stored locally; no personal data.
    }
  }

  return (
    <>
      <div className="ambient-background" data-paused={paused || reducedMotion} aria-hidden="true">
        <div className="ambient-glow ambient-gold" />
        <div className="ambient-glow ambient-blue" />
        <div className="ambient-glow ambient-soft" />
      </div>
      {!reducedMotion && (
        <button
          className="ambient-toggle"
          type="button"
          onClick={toggle}
          aria-label={paused ? "背景の動きを再開" : "背景の動きを止める"}
          title={paused ? "背景の動きを再開" : "背景の動きを止める"}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
          <span>背景{paused ? "を動かす" : "を止める"}</span>
        </button>
      )}
    </>
  );
}
