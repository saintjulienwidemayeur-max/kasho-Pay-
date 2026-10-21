(function () {
  var b = document.querySelector(".burger"), n = document.getElementById("nav");
  if (b && n) {
    b.addEventListener("click", function () { var o = n.classList.toggle("open"); b.setAttribute("aria-expanded", String(o)); });
    n.addEventListener("click", function (e) { if (e.target.tagName === "A") { n.classList.remove("open"); b.setAttribute("aria-expanded", "false"); } });
  }
  var els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: 0.12 });
  els.forEach(function (e) { io.observe(e); });
})();
