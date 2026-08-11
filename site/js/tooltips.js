export function initTooltips(doc) {
  if (doc.__asTooltips) return;
  doc.__asTooltips = true;

  const tip = doc.createElement("div");
  tip.className = "tooltip-float";
  tip.setAttribute("role", "tooltip");
  doc.body.appendChild(tip);

  let current = null;

  function hide() {
    current = null;
    tip.classList.remove("visible");
  }

  function position(x, y) {
    const pad = 10;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = x + 14;
    let top = y + 14;
    if (left + w > doc.defaultView.innerWidth - pad) left = x - w - 14;
    if (top + h > doc.defaultView.innerHeight - pad) top = y - h - 14;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function show(el, x, y) {
    current = el;
    tip.textContent = el.dataset.tip || "";
    tip.classList.add("visible");
    position(x, y);
  }

  doc.addEventListener("mouseover", e => {
    const el = e.target.closest(".tip");
    if (el) show(el, e.clientX, e.clientY);
  });

  doc.addEventListener("mouseout", e => {
    if (current && current.contains(e.relatedTarget)) return;
    hide();
  });

  doc.addEventListener("mousemove", e => {
    if (!current) return;
    position(e.clientX, e.clientY);
  });

  doc.addEventListener("touchstart", e => {
    const el = e.target.closest(".tip");
    if (el) {
      e.preventDefault();
      show(el, e.touches[0].clientX, e.touches[0].clientY);
    } else {
      hide();
    }
  }, { passive: false });

  doc.addEventListener("scroll", hide, true);
}
