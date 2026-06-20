"use client";

import { useEffect, useState } from "react";
import { formatTimestampUtc } from "./format";

function relativePhrase(time: number, now: number) {
  const diff = Math.max(0, now - time);
  if (diff < 10) return "just now";
  if (diff < 60) return `${Math.floor(diff)} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Renders a relative "x ago" age that ticks up after mount, so freshness
 * visibly decays. `now` is the server's render time, passed in so the first
 * client render matches SSR exactly (no hydration mismatch); the effect then
 * switches to live wall-clock time.
 */
export function RelativeTime({ time, now }: { time: number | null | undefined; now: number }) {
  const [current, setCurrent] = useState(now);

  useEffect(() => {
    if (time == null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const tick = () => setCurrent(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [time]);

  if (time == null || !Number.isFinite(time)) {
    return <span className="subtle">unknown</span>;
  }

  return (
    <time dateTime={new Date(time * 1000).toISOString()} title={formatTimestampUtc(time)}>
      {relativePhrase(time, current)}
    </time>
  );
}
