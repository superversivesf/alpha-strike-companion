import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { initTooltips } from "../site/js/tooltips.js";

function setup() {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  const tip = document.createElement("span");
  tip.className = "tip";
  tip.dataset.tip = "Tooltip text";
  document.body.append(tip);
  return { window, document };
}

function mouseover(doc, el, x = 100, y = 100) {
  el.dispatchEvent(new doc.defaultView.MouseEvent("mouseover", { bubbles: true, clientX: x, clientY: y }));
}

function mouseout(doc, el, related = null) {
  el.dispatchEvent(new doc.defaultView.MouseEvent("mouseout", { bubbles: true, relatedTarget: related }));
}

function mousemove(doc, x, y) {
  doc.dispatchEvent(new doc.defaultView.MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));
}

function tooltipEl(doc) {
  return doc.querySelector(".tooltip-float");
}

test("initTooltips creates a hidden tooltip element", () => {
  const { document } = setup();
  initTooltips(document);
  const tip = tooltipEl(document);
  assert.ok(tip, "tooltip element must exist");
  assert.equal(tip.getAttribute("role"), "tooltip");
  assert.ok(!tip.classList.contains("visible"));
});

test("initTooltips is idempotent — no duplicate tooltip elements", () => {
  const { document } = setup();
  initTooltips(document);
  initTooltips(document);
  assert.equal(document.querySelectorAll(".tooltip-float").length, 1);
});

test("mouseover shows the tooltip with the data-tip text", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  mouseover(document, el, 100, 100);
  const tip = tooltipEl(document);
  assert.ok(tip.classList.contains("visible"));
  assert.equal(tip.textContent, "Tooltip text");
});

test("mouseover on a non-tip element does not show the tooltip", () => {
  const { document } = setup();
  initTooltips(document);
  const plain = document.createElement("div");
  document.body.append(plain);
  mouseover(document, plain, 100, 100);
  assert.ok(!tooltipEl(document).classList.contains("visible"));
});

test("mouseout hides the tooltip", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  mouseover(document, el, 100, 100);
  mouseout(document, el);
  assert.ok(!tooltipEl(document).classList.contains("visible"));
});

test("mouseout to a related target inside the tip keeps the tooltip visible", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  mouseover(document, el, 100, 100);
  mouseout(document, el, el);
  assert.ok(tooltipEl(document).classList.contains("visible"));
});

test("mousemove repositions the tooltip", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  mouseover(document, el, 100, 100);
  mousemove(document, 200, 150);
  const tip = tooltipEl(document);
  assert.equal(tip.style.left, "214px");
  assert.equal(tip.style.top, "164px");
});

test("mousemove without a visible tooltip does nothing", () => {
  const { document } = setup();
  initTooltips(document);
  mousemove(document, 200, 150);
  const tip = tooltipEl(document);
  assert.equal(tip.style.left, "");
  assert.equal(tip.style.top, "");
});

test("touchstart on a tip shows the tooltip and prevents default", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  let defaultPrevented = false;
  el.dispatchEvent(new document.defaultView.TouchEvent("touchstart", {
    bubbles: true,
    cancelable: true,
    touches: [{ clientX: 50, clientY: 60 }],
  }));
  const tip = tooltipEl(document);
  assert.ok(tip.classList.contains("visible"));
  assert.equal(tip.textContent, "Tooltip text");
  assert.ok(defaultPrevented === false || tip.classList.contains("visible"));
});

test("touchstart outside a tip hides the tooltip", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  mouseover(document, el, 100, 100);
  assert.ok(tooltipEl(document).classList.contains("visible"));
  document.body.dispatchEvent(new document.defaultView.TouchEvent("touchstart", {
    bubbles: true,
    cancelable: true,
    touches: [{ clientX: 10, clientY: 10 }],
  }));
  assert.ok(!tooltipEl(document).classList.contains("visible"));
});

test("scroll hides the tooltip", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  mouseover(document, el, 100, 100);
  assert.ok(tooltipEl(document).classList.contains("visible"));
  document.dispatchEvent(new document.defaultView.Event("scroll", { bubbles: true }));
  assert.ok(!tooltipEl(document).classList.contains("visible"));
});

test("tooltip flips left when it would overflow the right edge", () => {
  const { document, window } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  const tip = tooltipEl(document);
  Object.defineProperty(tip, "offsetWidth", { value: 200, configurable: true });
  Object.defineProperty(tip, "offsetHeight", { value: 40, configurable: true });
  window.innerWidth = 500;
  window.innerHeight = 500;
  mouseover(document, el, 480, 100);
  assert.equal(tip.style.left, "266px");
});

test("tooltip flips up when it would overflow the bottom edge", () => {
  const { document, window } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  const tip = tooltipEl(document);
  Object.defineProperty(tip, "offsetWidth", { value: 200, configurable: true });
  Object.defineProperty(tip, "offsetHeight", { value: 40, configurable: true });
  window.innerWidth = 500;
  window.innerHeight = 500;
  mouseover(document, el, 100, 480);
  assert.equal(tip.style.top, "426px");
});

test("tooltip stays at the cursor offset when near the top-left", () => {
  const { document, window } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  const tip = tooltipEl(document);
  Object.defineProperty(tip, "offsetWidth", { value: 200, configurable: true });
  Object.defineProperty(tip, "offsetHeight", { value: 40, configurable: true });
  window.innerWidth = 500;
  window.innerHeight = 500;
  mouseover(document, el, 0, 0);
  assert.equal(tip.style.left, "14px");
  assert.equal(tip.style.top, "14px");
});

test("tooltip clamps to the padding edge when flipped position would overflow", () => {
  const { document, window } = setup();
  initTooltips(document);
  const el = document.querySelector(".tip");
  const tip = tooltipEl(document);
  Object.defineProperty(tip, "offsetWidth", { value: 200, configurable: true });
  Object.defineProperty(tip, "offsetHeight", { value: 40, configurable: true });
  window.innerWidth = 100;
  window.innerHeight = 100;
  mouseover(document, el, 5, 5);
  assert.equal(tip.style.left, "10px");
  assert.equal(tip.style.top, "19px");
});

test("missing data-tip shows an empty tooltip", () => {
  const { document } = setup();
  initTooltips(document);
  const el = document.createElement("span");
  el.className = "tip";
  document.body.append(el);
  mouseover(document, el, 100, 100);
  assert.equal(tooltipEl(document).textContent, "");
});
