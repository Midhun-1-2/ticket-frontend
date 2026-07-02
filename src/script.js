/* =========================================================================
   Ticket Management System — dashboard interactions (React-ready version)
   Usage: import { initApp } from './script.js' and call initApp() inside
   a useEffect (see App.jsx / Home.jsx).
   ========================================================================= */

var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------------
   Sidebar: off-canvas on mobile, collapse-to-rail on desktop
   ------------------------------------------------------------------- */
function initSidebar() {
  var menuBtn = document.querySelector("[data-menu-toggle]");
  var collapseBtn = document.querySelector("[data-collapse-toggle]");
  var scrim = document.querySelector("[data-scrim]");
  var body = document.body;

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      body.classList.toggle("sidebar-open");
    });
  }
  if (scrim) {
    scrim.addEventListener("click", function () {
      body.classList.remove("sidebar-open");
    });
  }
  if (collapseBtn) {
    collapseBtn.addEventListener("click", function () {
      body.classList.toggle("sidebar-collapsed");
    });
  }
  // Close mobile drawer when a nav link is tapped
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      body.classList.remove("sidebar-open");
    });
  });
}

/* ---------------------------------------------------------------------
   Animated count-up for the stat cards
   ------------------------------------------------------------------- */
function initCounters() {
  var counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  counters.forEach(function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduceMotion) {
      el.textContent = target.toLocaleString();
      return;
    }
    var start = null;
    var duration = 900;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ---------------------------------------------------------------------
   Ticket trend chart — lightweight hand-drawn line chart (no deps)
   ------------------------------------------------------------------- */
var TREND_DATA = {
  daily: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    opened: [14, 19, 12, 22, 17, 9, 6],
    resolved: [10, 15, 14, 18, 20, 11, 8]
  },
  weekly: {
    labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
    opened: [58, 71, 64, 80, 76, 69, 74],
    resolved: [52, 66, 70, 75, 78, 72, 71]
  },
  monthly: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    opened: [210, 244, 262, 231, 289, 305, 296],
    resolved: [198, 220, 250, 240, 270, 298, 300]
  }
};

function drawChart(canvas, dataset) {
  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  var w = rect.width, h = rect.height;
  var padL = 8, padR = 8, padT = 14, padB = 24;
  var plotW = w - padL - padR, plotH = h - padT - padB;

  ctx.clearRect(0, 0, w, h);

  var all = dataset.opened.concat(dataset.resolved);
  var max = Math.max.apply(null, all) * 1.15;
  var n = dataset.labels.length;
  var stepX = plotW / (n - 1);

  // gridlines
  ctx.strokeStyle = "#E5E2DA";
  ctx.lineWidth = 1;
  for (var g = 0; g <= 3; g++) {
    var y = padT + (plotH / 3) * g;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  function pathFor(values) {
    return values.map(function (v, i) {
      var x = padL + stepX * i;
      var y = padT + plotH - (v / max) * plotH;
      return [x, y];
    });
  }

  function drawLine(points, color, fill) {
    ctx.beginPath();
    points.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.25;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    if (fill) {
      var last = points[points.length - 1];
      var first = points[0];
      ctx.lineTo(last[0], padT + plotH);
      ctx.lineTo(first[0], padT + plotH);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    points.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  var openedPts = pathFor(dataset.opened);
  var resolvedPts = pathFor(dataset.resolved);

  drawLine(openedPts, "#C8791A", "rgba(200,121,26,0.07)");
  drawLine(resolvedPts, "#0F6E63", "rgba(15,110,99,0.09)");

  // x labels
  ctx.fillStyle = "#A6A297";
  ctx.font = "11px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  dataset.labels.forEach(function (label, i) {
    var x = padL + stepX * i;
    ctx.fillText(label, x, h - 6);
  });
}

function initTrendChart() {
  var canvas = document.getElementById("trendChart");
  if (!canvas) return;
  var tabs = document.querySelectorAll("[data-trend-tab]");
  var current = "daily";

  function render() {
    drawChart(canvas, TREND_DATA[current]);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      current = tab.getAttribute("data-trend-tab");
      render();
    });
  });

  render();
  window.addEventListener("resize", debounce(render, 150));
}

function debounce(fn, wait) {
  var t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

/* ---------------------------------------------------------------------
   Single entry point — call this from a useEffect in React
   ------------------------------------------------------------------- */
export function initApp() {
  initSidebar();
  initCounters();
  initTrendChart();
}
export { initCounters, initTrendChart };
