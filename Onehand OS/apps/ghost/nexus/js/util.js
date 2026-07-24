/* NEXUS util — RNG, formatting, tiny helpers. Global namespace: NX */
window.NX = {};

(function () {
  // Mulberry32 seeded PRNG. Seed lives in module scope; reseeded from saved state.
  let _s = 1234567;
  function next() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  NX.R = {
    seed(s) { _s = s | 0; },
    val: next,
    chance(p) { return next() < p; },
    int(a, b) { return a + Math.floor(next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };

  NX.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  NX.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  NX.money = (n) => {
    n = Math.round(n);
    return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US");
  };

  NX.fmtTime = (minute) => {
    const h = Math.floor(minute / 60) % 24;
    const m = minute % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  };

  NX.phase = (minute) => {
    const h = Math.floor(minute / 60);
    if (h < 6) return "night";
    if (h < 9) return "dawn";
    if (h < 17) return "day";
    if (h < 21) return "dusk";
    return "night";
  };

  NX.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  NX.initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // Deterministic pastel-ish color from a string (for avatars)
  NX.colorFor = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return `hsl(${((h % 360) + 360) % 360} 65% 62%)`;
  };

  NX.relWord = (score) => {
    if (score <= -60) return "hateful";
    if (score <= -30) return "hostile";
    if (score <= -10) return "suspicious";
    if (score < 10) return "neutral";
    if (score < 30) return "warm";
    if (score < 60) return "friendly";
    return "devoted";
  };

  NX.moodWord = (mood) => {
    if (mood <= -60) return "despairing";
    if (mood <= -30) return "angry";
    if (mood <= -10) return "uneasy";
    if (mood < 15) return "flat";
    if (mood < 40) return "okay";
    if (mood < 70) return "upbeat";
    return "thriving";
  };

  NX.listNames = (arr, max = 3) => {
    const names = arr.slice(0, max);
    const extra = arr.length - names.length;
    return names.join(", ") + (extra > 0 ? ` and ${extra} more` : "");
  };
})();
