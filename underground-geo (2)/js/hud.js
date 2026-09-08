// Subtle cursor-follow dot/arrow. Desktop only, respects reduced-motion, never blocks clicks.
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch devices

  const dot = document.createElement('div');
  dot.id = 'ugHudCursor';
  dot.style.cssText = `
    position:fixed; top:0; left:0; width:22px; height:22px; border-radius:50%;
    border:1.5px solid var(--accent); pointer-events:none; z-index:9999;
    transform:translate(-50%,-50%); transition:width .15s,height .15s,border-color .15s,opacity .2s;
    opacity:0; mix-blend-mode:difference;
  `;
  document.body.appendChild(dot);

  let tx=0, ty=0, x=0, y=0, shown=false;
  document.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!shown) { dot.style.opacity = '1'; shown = true; }
    const hot = e.target.closest('a, button, .card, input, textarea, select');
    dot.style.width = hot ? '30px' : '22px';
    dot.style.height = hot ? '30px' : '22px';
    dot.style.borderColor = hot ? 'var(--accent-2)' : 'var(--accent)';
  });
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; shown = false; });

  (function loop(){
    x += (tx-x)*0.18; y += (ty-y)*0.18;
    dot.style.left = x+'px'; dot.style.top = y+'px';
    requestAnimationFrame(loop);
  })();
})();
