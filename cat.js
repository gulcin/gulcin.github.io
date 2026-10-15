/* Dusty, the Books-page cat. Kept in sync with <script id="dusty-js"> in books.html. */
(function () {
  if (window.__dustyPet) return;
  window.__dustyPet = true;
  var btn = document.getElementById("petcat");
  if (!btn) return;
  var q = new URLSearchParams(location.search).get("season");
  var season = "none";
  if (q === "halloween" || q === "winter" || q === "none") season = q;
  else {
    var month = new Date().getMonth();
    if (month === 9) season = "halloween";
    else if (month === 11 || month === 0 || month === 1) season = "winter";
  }
  if (season !== "none") btn.setAttribute("data-season", season);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var live = document.getElementById("dusty-live");
  var timer;
  btn.addEventListener("click", function () {
    if (reduce) {
      var on = btn.classList.toggle("is-pet");
      if (live) live.textContent = on ? "Dusty purrs." : "";
      return;
    }
    btn.classList.remove("is-pet");
    void btn.offsetWidth;
    btn.classList.add("is-pet");
    if (live) live.textContent = "Dusty purrs.";
    clearTimeout(timer);
    timer = setTimeout(function () {
      btn.classList.remove("is-pet");
      if (live) live.textContent = "";
    }, 850);
  });
})();
