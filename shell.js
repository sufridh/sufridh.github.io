/* Geospatial Analysis — shared page shell.
   Injects the fixed top bar and the project switcher into every analysis page,
   so navigation looks and behaves identically across all of them.
   Usage: <script defer src="../assets/shell.js" data-project="jakarta-waste" data-layout="app"></script>
*/
(function () {
  "use strict";

  var PROJECTS = [
    {
      id: "jakarta-waste",
      file: "jakarta-waste.html",
      title: "Jakarta Waste Infrastructure",
      sub: "Collection points, coverage gaps, and haul distance"
    },
    {
      id: "jakarta-waste-methodology",
      file: "jakarta-waste-methodology.html",
      title: "Waste Dashboard — Methodology",
      sub: "Data sources and assumptions behind the dashboard"
    },
    {
      id: "perubahan-lahan-jawa",
      file: "perubahan-lahan-jawa.html",
      title: "Perubahan Tata Guna Lahan Jawa",
      sub: "Land use change across Java, 2000–2022"
    },
    {
      id: "pesisir-utara",
      file: "pesisir-utara.html",
      title: "Populasi Pesisir Utara",
      sub: "Coastal population by kecamatan and desa"
    },
    {
      id: "rusunawa",
      file: "rusunawa.html",
      title: "Rusunawa Nasional",
      sub: "Public housing units and cost efficiency, 2019–2022"
    },
    {
      id: "gaza-food-security",
      file: "gaza-food-security.html",
      title: "Gaza Food Security",
      sub: "IPC acute food insecurity phases over time"
    }
  ];

  var script =
    document.currentScript ||
    document.querySelector('script[src*="shell.js"]');
  var current = script ? script.getAttribute("data-project") : null;
  var layout = (script && script.getAttribute("data-layout")) || "page";
  var base = script && script.getAttribute("data-base");
  if (base === null || base === undefined) base = "../";

  document.documentElement.setAttribute("data-pf-layout", layout);

  var ICON_BACK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
  var ICON_DOC =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';
  var ICON_CHEV =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function build() {
    var meta = null;
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].id === current) meta = PROJECTS[i];
    }

    var nav = document.createElement("div");
    nav.id = "pfNav";

    var html =
      '<a class="pf-home" href="' +
      base +
      'index.html">' +
      ICON_BACK +
      "Geospatial Analysis</a>";

    if (meta) {
      html +=
        '<span class="pf-sep"></span><span class="pf-title"><b>' +
        esc(meta.title) +
        "</b> — " +
        esc(meta.sub) +
        "</span>";
    }

    html += '<span class="pf-right">';

    // Contextual link between the waste dashboard and its methodology page.
    if (current === "jakarta-waste") {
      html +=
        '<a class="pf-link" href="jakarta-waste-methodology.html">' +
        ICON_DOC +
        '<span class="pf-lt">Methodology</span></a>';
    } else if (current === "jakarta-waste-methodology") {
      html +=
        '<a class="pf-link" href="jakarta-waste.html">' +
        ICON_BACK +
        '<span class="pf-lt">Dashboard</span></a>';
    }

    html +=
      '<button class="pf-switch" id="pfSwitch" type="button" aria-expanded="false" aria-controls="pfMenu">Projects' +
      ICON_CHEV +
      "</button></span>";

    nav.innerHTML = html;

    var menu = document.createElement("nav");
    menu.id = "pfMenu";
    menu.setAttribute("aria-label", "All projects");
    var m = '<div class="pf-mhead">All analyses</div>';
    for (var j = 0; j < PROJECTS.length; j++) {
      var p = PROJECTS[j];
      m +=
        '<a href="' +
        base +
        "projects/" +
        p.file +
        '"' +
        (p.id === current ? ' class="on" aria-current="page"' : "") +
        '><span class="pf-mt">' +
        esc(p.title) +
        '</span><span class="pf-ms">' +
        esc(p.sub) +
        "</span></a>";
    }
    m +=
      '<div class="pf-mdiv"></div><a href="' +
      base +
      'index.html"><span class="pf-mt">Portfolio home</span><span class="pf-ms">Overview of every project</span></a>';
    menu.innerHTML = m;

    document.body.insertBefore(nav, document.body.firstChild);
    document.body.appendChild(menu);

    var btn = document.getElementById("pfSwitch");
    function close() {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
