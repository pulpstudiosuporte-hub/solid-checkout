import { useEffect } from "react";
import { sendChromaSenseEvents } from "./api";

const coordinate = (value, maximum) =>
  Math.round(Math.min(1, Math.max(0, value / Math.max(1, maximum))) * 10_000) /
  10_000;
const pagePoint = (event) => ({
  x: coordinate(event.clientX, window.innerWidth),
  y: coordinate(
    event.clientY + window.scrollY,
    Math.max(document.documentElement.scrollHeight, window.innerHeight),
  ),
});
const deviceType = () =>
  window.innerWidth < 640
    ? "mobile"
    : window.innerWidth < 1024
      ? "tablet"
      : "desktop";
const safeClass = (element) =>
  [...(element?.classList || [])]
    .filter((name) => /^[a-zA-Z][\w-]{0,48}$/.test(name))
    .slice(0, 2)
    .join(".");
const describeTarget = (rawTarget) => {
  const target = rawTarget instanceof Element ? rawTarget : null;
  if (!target)
    return {
      target: "unknown",
      targetLabel: "Área do checkout",
      interactive: false,
    };
  const control = target.closest(
    'button,a,input,select,textarea,label,[role="button"],[data-chroma-label]',
  );
  const element = control || target;
  const tag = element.tagName.toLowerCase();
  const classes = safeClass(element);
  const identifier =
    element.getAttribute("data-chroma-label") ||
    element.getAttribute("name") ||
    element.getAttribute("role") ||
    "";
  const targetName =
    `${tag}${identifier ? `[${identifier.slice(0, 60)}]` : ""}${classes ? `.${classes}` : ""}`.slice(
      0,
      160,
    );
  const accessible =
    element.getAttribute("aria-label") ||
    element.getAttribute("data-chroma-label") ||
    element.getAttribute("name") ||
    (["BUTTON", "A"].includes(element.tagName) ? element.textContent : "") ||
    tag;
  return {
    target: targetName,
    targetLabel: accessible.replace(/\s+/g, " ").trim().slice(0, 120),
    interactive: Boolean(control),
  };
};

export function useChromaSense(sessionId, token) {
  useEffect(() => {
    if (!sessionId || !token) return undefined;
    let queue = [{ type: "VIEW" }];
    let sending = false;
    let lastMoveAt = 0;
    let lastScrollAt = 0;
    let lastPoint = { x: 0.5, y: 0.25 };
    const recentClicks = [];
    const payload = (events) => ({
      events,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      device: deviceType(),
      pageKey: "checkout",
    });
    const flush = async (keepalive) => {
      if (sending || !queue.length) return;
      const events = queue.splice(0, 100);
      sending = true;
      try {
        await sendChromaSenseEvents(
          sessionId,
          token,
          payload(events),
          keepalive,
        );
      } catch {
        queue = [...events, ...queue].slice(-200);
      } finally {
        sending = false;
      }
    };
    const enqueue = (event) => {
      queue.push(event);
      if (queue.length >= 50) void flush(false);
    };
    const onClick = (event) => {
      const point = pagePoint(event);
      lastPoint = point;
      const described = describeTarget(event.target);
      const now = Date.now();
      recentClicks.push({ at: now, target: described.target });
      while (recentClicks.length && recentClicks[0].at < now - 1600)
        recentClicks.shift();
      const rage =
        recentClicks.filter((click) => click.target === described.target)
          .length >= 3;
      enqueue({ type: "CLICK", ...point, ...described, rage });
    };
    const onMove = (event) => {
      const now = Date.now();
      lastPoint = pagePoint(event);
      if (now - lastMoveAt < 900) return;
      lastMoveAt = now;
      enqueue({ type: "MOVE", ...lastPoint });
    };
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScrollAt < 700) return;
      lastScrollAt = now;
      const available = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      enqueue({
        type: "SCROLL",
        scrollPercent: Math.round(
          Math.min(100, Math.max(0, (window.scrollY / available) * 100)),
        ),
      });
    };
    const attention = window.setInterval(() => {
      if (document.visibilityState === "visible")
        enqueue({ type: "ATTENTION", ...lastPoint, durationMs: 5000 });
    }, 5000);
    const interval = window.setInterval(() => void flush(false), 5000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    const onPageHide = () => void flush(true);
    document.addEventListener("click", onClick, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    void flush(false);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(attention);
      window.clearInterval(interval);
      void flush(true);
    };
  }, [sessionId, token]);
}
