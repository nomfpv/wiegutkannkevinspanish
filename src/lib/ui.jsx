import { useState, useEffect, useRef } from 'react';

/* Reveal-on-scroll — call once at the top of a page component.
   Observes any [data-reveal] elements currently mounted. */
export function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]:not(.in)');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

/* Animated count-up number, triggered when scrolled into view.
   Robustness: reduced-motion or a missing IntersectionObserver shows the final
   value immediately, so the number is never stuck at 0 (correct default, then
   the animation is a pure enhancement). */
export function CountUp({ to, suffix = '', dur = 1200 }) {
  const [n, setN] = useState(to);
  const ref = useRef(null);
  useEffect(() => {
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setN(to);
      return;
    }
    setN(0);
    let raf;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const start = performance.now();
          const step = (t) => {
            const p = Math.min((t - start) / dur, 1);
            setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
          io.disconnect();
        });
      },
      { threshold: 0.5 }
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref} className="tabular-nums">
      {n}
      {suffix}
    </span>
  );
}

/* Small helper: navigate a hash route. */
export function go(route) {
  window.location.hash = route;
}

/* Woher stammt ein Wort? Podcast-Wörter haben eine Folgennummer, Wörter, die
   nur in Kevins YouTube-Kanälen fielen, nicht. */
export function quelle(w) {
  return w.folge ? `Folge #${w.folge}` : 'YouTube';
}
