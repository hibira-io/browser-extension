// The pointer, tap rings and frames another person (a support agent in
// co-browsing) or the console assistant draws over a page. They live in a
// shadow root that ignores the pointer, so the page works as usual under
// them.

export function makeMarks(uiClass: string, agent: string, nonce: string | undefined, color: string) {
  const host = document.createElement('div');
  host.className = uiClass;
  // Themes like Dawn hide div:empty, and a shadow host has no light children.
  host.style.cssText = 'display:block !important;position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden';
  const root = host.attachShadow({ mode: 'open' });
  const st = document.createElement('style');
  if (nonce) st.nonce = nonce;
  st.textContent =
    ':host{all:initial;--c:' + color + '}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.p{position:absolute;left:0;top:0;transition:transform .12s linear,opacity .3s;opacity:0;will-change:transform}' +
    '.p svg{display:block;color:var(--c);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}' +
    '.p span{position:absolute;left:16px;top:18px;background:var(--c);color:#fff;font-size:12px;line-height:1;padding:4px 7px;border-radius:6px;white-space:nowrap}' +
    '.h{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid var(--c);background:color-mix(in srgb,var(--c) 15%,transparent);animation:h 1.6s ease-out forwards}' +
    '@keyframes h{0%{transform:scale(.3);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.25);opacity:0}}' +
    '.f{position:absolute;border:2px solid var(--c);border-radius:8px;background:color-mix(in srgb,var(--c) 8%,transparent);box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 18%,transparent);transition:opacity .4s}' +
    '@media (prefers-reduced-motion:reduce){.p{transition:none}.h{animation-duration:2.4s;animation-timing-function:steps(1,end)}}';
  root.appendChild(st);
  const p = document.createElement('div');
  p.className = 'p';
  p.innerHTML = "<svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M4 2l16 9-7 2-3 7z' fill='currentColor' stroke='#fff' stroke-width='1.5' stroke-linejoin='round'/></svg><span></span>";
  (p.querySelector('span') as HTMLElement).textContent = agent || '';
  if (!agent) (p.querySelector('span') as HTMLElement).hidden = true;
  root.appendChild(p);
  document.documentElement.appendChild(host);
  let idle = 0;
  return {
    pointer(x: number, y: number) {
      p.style.transform = `translate(${x}px,${y}px)`;
      p.style.opacity = '1';
      clearTimeout(idle);
      idle = window.setTimeout(() => (p.style.opacity = '0'), 4000);
    },
    highlight(x: number, y: number) {
      const h = document.createElement('div');
      h.className = 'h';
      h.style.left = x + 'px';
      h.style.top = y + 'px';
      root.appendChild(h);
      setTimeout(() => h.remove(), 2600);
      this.pointer(x, y);
    },
    /** Draws a frame around a box (viewport coordinates) for ms, with the pointer on it. */
    frame(r: { left: number; top: number; width: number; height: number }, ms = 2600) {
      const f = document.createElement('div');
      f.className = 'f';
      f.style.left = r.left - 4 + 'px';
      f.style.top = r.top - 4 + 'px';
      f.style.width = r.width + 8 + 'px';
      f.style.height = r.height + 8 + 'px';
      root.appendChild(f);
      setTimeout(() => (f.style.opacity = '0'), ms);
      setTimeout(() => f.remove(), ms + 400);
      this.pointer(r.left + Math.min(r.width / 2, 40), r.top + Math.min(r.height / 2, 20));
    },
    hide() {
      p.style.opacity = '0';
    },
    /** Takes away every frame now. */
    clearFrames() {
      root.querySelectorAll('.f').forEach((f) => f.remove());
    },
    remove() {
      clearTimeout(idle);
      host.remove();
    },
  };
}

export type Marks = ReturnType<typeof makeMarks>;
