/* Dusty — pet the cat. Idle breath, ear flick, tail sway; pet nuzzles. */
(function () {
  if (window.__petDusty) return;
  window.__petDusty = true;
  var btn = document.getElementById("petcat");
  if (!btn) return;
  var svg = btn.querySelector(".dusty-svg");
  if (!svg) return;

  var SEASONS = [
    { id: "halloween", months: [10] },
    { id: "winter", months: [12] }
  ];
  function resolveSeason() {
    var q = new URLSearchParams(location.search).get("season");
    if (q === "none" || q === "halloween" || q === "winter") return q;
    var m = new Date().getMonth() + 1;
    for (var j = 0; j < SEASONS.length; j++) {
      if (SEASONS[j].months.indexOf(m) !== -1) return SEASONS[j].id;
    }
    return "none";
  }
  btn.setAttribute("data-season", resolveSeason());

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var petting = false, petAnims = [], idleAnims = [];
  function $(s) { return svg.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(svg.querySelectorAll(s)); }
  function stop(list) { list.forEach(function (a) { try { a.cancel(); } catch (e) {} }); list.length = 0; }

  var TAIL_IDLE = "M158 188C118 196 86 228 78 272C70 316 82 362 112 374C134 368 136 330 132 294C128 252 146 216 178 202C192 196 174 182 158 188Z";
  var TAIL_UP = "M158 188C126 178 102 198 98 236C94 274 112 314 138 326C154 320 152 286 146 256C138 222 150 198 176 190C190 184 172 178 158 188Z";
  var TAIL_CURL = "M158 188C132 168 110 184 104 218C98 252 120 288 144 298C160 292 156 260 150 232C142 204 154 186 174 182C188 178 170 176 158 188Z";

  function startIdle() {
    stop(idleAnims);
    if (reduce.matches || !svg.animate) { btn.classList.add("idle"); return; }
    btn.classList.remove("idle");
    var torso = $(".dusty-torso"), earR = $(".ear-r"), earL = $(".ear-l");
    var tail = $(".dusty-tail"), tailPath = $(".tail-path");
    if (torso) idleAnims.push(torso.animate(
      [{ transform: "scale(1,1)" }, { transform: "scale(1.015,.972)" }, { transform: "scale(1,1)" }],
      { duration: 3600, easing: "ease-in-out", iterations: Infinity }
    ));
    if (tail) idleAnims.push(tail.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(-2.4deg)" }, { transform: "rotate(0deg)" }],
      { duration: 5800, easing: "ease-in-out", iterations: Infinity }
    ));
    if (tailPath && tailPath.animate) {
      try {
        idleAnims.push(tailPath.animate(
          [{ d: TAIL_IDLE }, { d: TAIL_UP }, { d: TAIL_IDLE }],
          { duration: 5800, easing: "ease-in-out", iterations: Infinity }
        ));
      } catch (e) {}
    }
    if (earR) idleAnims.push(earR.animate(
      [{ transform: "rotate(0deg)", offset: 0 }, { transform: "rotate(0deg)", offset: 0.84 },
       { transform: "rotate(-12deg)", offset: 0.87 }, { transform: "rotate(6deg)", offset: 0.9 },
       { transform: "rotate(-3deg)", offset: 0.93 }, { transform: "rotate(0deg)", offset: 1 }],
      { duration: 7500, easing: "ease-in-out", iterations: Infinity }
    ));
    if (earL) idleAnims.push(earL.animate(
      [{ transform: "rotate(0deg)", offset: 0 }, { transform: "rotate(0deg)", offset: 0.91 },
       { transform: "rotate(5deg)", offset: 0.94 }, { transform: "rotate(0deg)", offset: 1 }],
      { duration: 9000, easing: "ease-in-out", iterations: Infinity }
    ));
  }

  function runPet() {
    if (reduce.matches) {
      btn.classList.add("petting");
      btn.setAttribute("aria-pressed", "true");
      setTimeout(function () {
        btn.classList.remove("petting");
        btn.setAttribute("aria-pressed", "false");
      }, 900);
      return;
    }
    if (petting) stop(petAnims);
    petting = true;
    btn.classList.add("petting");
    btn.setAttribute("aria-pressed", "true");
    stop(idleAnims);

    var head = $(".dusty-head"), torso = $(".dusty-torso"), paw = $(".dusty-paw-stretch");
    var toes = $all(".toes .toe"), eyesClosed = $(".eyes-closed"), eyesContent = $(".eyes-content");
    var hearts = $(".hearts"), heartEls = $all(".hearts .heart");
    var tail = $(".dusty-tail"), tailPath = $(".tail-path"), earL = $(".ear-l"), earR = $(".ear-r");
    var easeIO = "cubic-bezier(0.45, 0, 0.55, 1)";
    var easeBack = "cubic-bezier(0.34, 1.35, 0.64, 1)";

    if (head) petAnims.push(head.animate([
      { transform: "rotate(0deg) translate(0px,0px)", offset: 0 },
      { transform: "rotate(-7deg) translate(4px,-10px)", offset: 0.22 },
      { transform: "rotate(-11deg) translate(8px,-14px)", offset: 0.42 },
      { transform: "rotate(-8deg) translate(5px,-8px)", offset: 0.68 },
      { transform: "rotate(0deg) translate(0px,0px)", offset: 1 }
    ], { duration: 1800, easing: easeIO, fill: "forwards" }));

    if (eyesClosed) petAnims.push(eyesClosed.animate(
      [{ opacity: 1 }, { opacity: 0, offset: 0.14 }, { opacity: 0, offset: 0.74 }, { opacity: 1 }],
      { duration: 1800, fill: "forwards" }));
    if (eyesContent) petAnims.push(eyesContent.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.16 }, { opacity: 1, offset: 0.48 },
       { opacity: 0.2, offset: 0.58 }, { opacity: 1, offset: 0.68 }, { opacity: 1, offset: 0.76 }, { opacity: 0 }],
      { duration: 1800, fill: "forwards" }));

    if (paw) petAnims.push(paw.animate([
      { transform: "rotate(0deg) translate(0px,0px)", offset: 0 },
      { transform: "rotate(-14deg) translate(-6px,10px)", offset: 0.28 },
      { transform: "rotate(-8deg) translate(-2px,4px)", offset: 0.46 },
      { transform: "rotate(-12deg) translate(-4px,8px)", offset: 0.62 },
      { transform: "rotate(0deg) translate(0px,0px)", offset: 1 }
    ], { duration: 1800, easing: easeIO, fill: "forwards" }));
    toes.forEach(function (t, i) {
      var spread = (i - 1.5) * 3.2;
      petAnims.push(t.animate([
        { transform: "translate(0px,0px) scale(1)" },
        { transform: "translate(" + spread + "px,-3px) scale(1.16)", offset: 0.32 },
        { transform: "translate(0px,0px) scale(1)", offset: 1 }
      ], { duration: 1800, delay: i * 24, easing: easeBack, fill: "forwards" }));
    });

    if (tail) petAnims.push(tail.animate([
      { transform: "rotate(0deg)" },
      { transform: "rotate(-16deg)", offset: 0.34 },
      { transform: "rotate(-7deg)", offset: 0.62 },
      { transform: "rotate(0deg)", offset: 1 }
    ], { duration: 1800, easing: easeBack, fill: "forwards" }));
    if (tailPath && tailPath.animate) {
      try {
        petAnims.push(tailPath.animate(
          [{ d: TAIL_IDLE }, { d: TAIL_CURL, offset: 0.36 }, { d: TAIL_UP, offset: 0.66 }, { d: TAIL_IDLE }],
          { duration: 1800, easing: easeIO, fill: "forwards" }
        ));
      } catch (e) {}
    }

    if (earL) petAnims.push(earL.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(8deg)", offset: 0.3 }, { transform: "rotate(0deg)", offset: 1 }],
      { duration: 1800, fill: "forwards" }));
    if (earR) petAnims.push(earR.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-10deg)", offset: 0.3 }, { transform: "rotate(0deg)", offset: 1 }],
      { duration: 1800, fill: "forwards" }));

    if (torso) petAnims.push(torso.animate([
      { transform: "translateX(0px) scale(1,1)" },
      { transform: "translateX(-1.2px) scale(1.012,.988)", offset: 0.12 },
      { transform: "translateX(1.2px) scale(1.012,.988)", offset: 0.24 },
      { transform: "translateX(-0.8px) scale(1.008,.992)", offset: 0.36 },
      { transform: "translateX(0.8px) scale(1.008,.992)", offset: 0.48 },
      { transform: "translateX(0px) scale(1,1)", offset: 0.62 },
      { transform: "translateX(0px) scale(1,1)", offset: 1 }
    ], { duration: 1800, easing: "ease-in-out", fill: "forwards" }));

    if (hearts) petAnims.push(hearts.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
      { duration: 1500, fill: "forwards" }));
    heartEls.forEach(function (h, i) {
      var dx = [-18, 6, 22][i] || 0;
      petAnims.push(h.animate([
        { transform: "translate(0px,10px) scale(.45)", opacity: 0 },
        { transform: "translate(" + (dx * 0.35) + "px,-6px) scale(1)", opacity: 1, offset: 0.22 },
        { transform: "translate(" + dx + "px,-52px) scale(1.05)", opacity: 0 }
      ], { duration: 1300, delay: 80 + i * 110, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" }));
    });

    var done = petAnims[0];
    function finish() {
      petting = false;
      btn.classList.remove("petting");
      btn.setAttribute("aria-pressed", "false");
      stop(petAnims);
      [head, torso, paw, tail, earL, earR, eyesClosed, eyesContent, hearts].forEach(function (el) {
        if (!el) return;
        el.style.transform = "";
        el.style.opacity = "";
      });
      toes.forEach(function (t) { t.style.transform = ""; });
      heartEls.forEach(function (h) { h.style.transform = ""; h.style.opacity = ""; });
      if (tailPath) tailPath.setAttribute("d", TAIL_IDLE);
      startIdle();
    }
    if (done) done.onfinish = finish;
    else setTimeout(finish, 1800);
  }

  btn.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") runPet(); });
  btn.addEventListener("click", function () { runPet(); });
  reduce.addEventListener("change", function () { stop(petAnims); stop(idleAnims); startIdle(); });
  startIdle();
})();
