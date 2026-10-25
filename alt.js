/* Visible ALT badge for content photos with non-empty alt text.
   Speaker badges (.badge) keep their alt attribute and do not get the chip.
   Shared so images injected later (covers, thumbnails, lightbox) get one too. */
(function () {
  if (window.__altBadge) return;
  window.__altBadge = true;

  var state = null;
  var pop = null;
  var popText = null;
  var closeBtn = null;
  var swallowClick = false;

  function described(img) {
    return img && img.tagName === "IMG" && !img.classList.contains("badge") && (img.getAttribute("alt") || "").trim();
  }

  function stop(e) {
    e.stopPropagation();
  }

  function shield(el) {
    ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"].forEach(function (type) {
      el.addEventListener(type, stop);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") e.stopPropagation();
    });
  }

  function ensurePop() {
    if (pop) return;
    pop = document.createElement("div");
    pop.className = "altpop";
    pop.id = "alt-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "false");
    pop.setAttribute("aria-label", "Image description");
    pop.hidden = true;
    popText = document.createElement("p");
    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "altx";
    closeBtn.setAttribute("aria-label", "Close image description");
    closeBtn.textContent = "\u00d7";
    pop.appendChild(popText);
    pop.appendChild(closeBtn);
    document.body.appendChild(pop);
    shield(closeBtn);
    closeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var back = state && state.btn;
      close();
      if (back) back.focus();
    });
  }

  function place() {
    if (!state || !pop) return;
    var r = state.btn.getBoundingClientRect();
    pop.hidden = false;
    pop.style.left = "0px";
    pop.style.top = "0px";
    var w = pop.offsetWidth;
    var h = pop.offsetHeight;
    var left = r.left;
    var top = r.top - h - 6;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    if (left < 8) left = 8;
    if (top < 8) top = Math.min(r.bottom + 6, window.innerHeight - h - 8);
    if (top < 8) top = 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function close() {
    if (!state) return;
    state.btn.setAttribute("aria-expanded", "false");
    state.btn.removeAttribute("aria-controls");
    if (pop) pop.hidden = true;
    state = null;
  }

  function open(btn, frame, img) {
    if (state && state.btn === btn) {
      close();
      return;
    }
    if (state) close();
    ensurePop();
    popText.textContent = img.alt;
    state = { btn: btn, frame: frame, img: img };
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", "alt-pop");
    place();
    closeBtn.focus();
  }

  function mount(img) {
    var frame = document.createElement("span");
    frame.className = "altframe";
    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "altbadge";
    btn.textContent = "ALT";
    btn.setAttribute("aria-label", "Show image description");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-haspopup", "dialog");
    frame.appendChild(btn);
    shield(btn);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(btn, frame, img);
    });
  }

  function unmount(img) {
    var frame = img.parentElement;
    if (!frame || !frame.classList.contains("altframe")) return;
    if (state && state.img === img) close();
    frame.parentNode.insertBefore(img, frame);
    frame.remove();
  }

  function sync() {
    if (state && !state.img.isConnected) close();
    document.querySelectorAll("img").forEach(function (img) {
      var framed = img.parentElement && img.parentElement.classList.contains("altframe");
      if (described(img)) {
        if (!framed) mount(img);
        else if (state && state.img === img && popText.textContent !== img.alt) {
          popText.textContent = img.alt;
          place();
        }
      } else if (framed) {
        unmount(img);
      }
    });
  }

  document.addEventListener("pointerdown", function (e) {
    if (!state) return;
    if (pop.contains(e.target) || state.btn.contains(e.target)) return;
    var inFrame = state.frame.contains(e.target);
    close();
    if (inFrame) {
      swallowClick = true;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener("click", function (e) {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener("keydown", function (e) {
    if (!state) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      var back = state.btn;
      close();
      back.focus();
      return;
    }
    if (e.key !== "Tab") return;
    var nodes = [state.btn, closeBtn];
    var i = nodes.indexOf(document.activeElement);
    if (i === -1 && !pop.contains(document.activeElement)) return;
    e.preventDefault();
    e.stopPropagation();
    var next = e.shiftKey ? nodes[(i <= 0 ? nodes.length : i) - 1] : nodes[(i + 1) % nodes.length];
    next.focus();
  }, true);

  window.addEventListener("resize", function () { if (state) place(); });
  document.addEventListener("scroll", function () { if (state) place(); }, true);
  document.addEventListener("load", function (e) {
    if (state && e.target === state.img) place();
  }, true);

  var mo = new MutationObserver(sync);
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["alt"]
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync);
  else sync();
})();
