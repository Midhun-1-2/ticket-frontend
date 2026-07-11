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

// Fallback mock data — only used when a page calls initTrendChart() with no
// dataset, e.g. a page that hasn't been wired up to real tickets yet.
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

var DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d) {
  var x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  var x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay()); // back to Sunday
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Ticket status values treated as "resolved" for trend purposes — matches
// how Dashboard.jsx / the role dashboards already group Resolved + Closed.
var RESOLVED_STATUSES = ["Resolved", "Closed"];

// Converts a flat list of tickets into the { daily, weekly, monthly } shape drawChart() expects.
function buildTrendData(tickets) {
  tickets = tickets || [];

  // --- Daily: last 7 days ---
  var dayStarts = [];
  for (var d = 6; d >= 0; d--) {
    var s = startOfDay(new Date());
    s.setDate(s.getDate() - d);
    dayStarts.push(s);
  }
  var daily = dayStarts.map(function (s) {
    return { start: s, label: DAY_LABELS[s.getDay()], opened: 0, resolved: 0 };
  });

  // --- Weekly: last 7 weeks ---
  var weekStarts = [];
  for (var w = 6; w >= 0; w--) {
    var ws = startOfWeek(new Date());
    ws.setDate(ws.getDate() - w * 7);
    weekStarts.push(ws);
  }
  var weekly = weekStarts.map(function (s, i) {
    return { start: s, label: "W" + (i + 1), opened: 0, resolved: 0 };
  });

  // --- Monthly: last 7 months ---
  var monthStarts = [];
  for (var m = 6; m >= 0; m--) {
    var base = new Date();
    var ms = new Date(base.getFullYear(), base.getMonth() - m, 1);
    monthStarts.push(ms);
  }
  var monthly = monthStarts.map(function (s) {
    return { start: s, label: MONTH_LABELS[s.getMonth()], opened: 0, resolved: 0 };
  });

  function bucketIndexFor(rows, date, rowStartFn) {
    for (var i = rows.length - 1; i >= 0; i--) {
      if (date >= rows[i].start) return i;
    }
    return -1;
  }

  tickets.forEach(function (t) {
    var isResolved = RESOLVED_STATUSES.indexOf(t.status) !== -1;
    var openedAt = t.created_at ? new Date(t.created_at) : null;
    var resolvedAt = isResolved && t.updated_at ? new Date(t.updated_at) : null;

    if (openedAt) {
      var di = bucketIndexFor(daily, startOfDay(openedAt));
      if (di !== -1 && di < daily.length && openedAt >= daily[0].start) daily[di].opened++;

      var wi = bucketIndexFor(weekly, startOfWeek(openedAt));
      if (wi !== -1 && openedAt >= weekly[0].start) weekly[wi].opened++;

      var mi = bucketIndexFor(monthly, startOfMonth(openedAt));
      if (mi !== -1 && openedAt >= monthly[0].start) monthly[mi].opened++;
    }

    if (resolvedAt) {
      var rdi = bucketIndexFor(daily, startOfDay(resolvedAt));
      if (rdi !== -1 && resolvedAt >= daily[0].start) daily[rdi].resolved++;

      var rwi = bucketIndexFor(weekly, startOfWeek(resolvedAt));
      if (rwi !== -1 && resolvedAt >= weekly[0].start) weekly[rwi].resolved++;

      var rmi = bucketIndexFor(monthly, startOfMonth(resolvedAt));
      if (rmi !== -1 && resolvedAt >= monthly[0].start) monthly[rmi].resolved++;
    }
  });

  function toSeries(rows) {
    return {
      labels: rows.map(function (r) { return r.label; }),
      opened: rows.map(function (r) { return r.opened; }),
      resolved: rows.map(function (r) { return r.resolved; })
    };
  }

  return {
    daily: toSeries(daily),
    weekly: toSeries(weekly),
    monthly: toSeries(monthly)
  };
}

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
  var max = Math.max.apply(null, all.concat([1])) * 1.15;
  var n = dataset.labels.length;
  var stepX = n > 1 ? plotW / (n - 1) : plotW;

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

// Renders the ticket trend chart; uses customDataset if given, else falls back to mock TREND_DATA.
function initTrendChart(customDataset) {
  var canvas = document.getElementById("trendChart");
  if (!canvas) return;
  var tabs = document.querySelectorAll("[data-trend-tab]");
  var data = customDataset || TREND_DATA;
  var current = "daily";

  function render() {
    drawChart(canvas, data[current]);
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
export { initCounters, initTrendChart, buildTrendData };