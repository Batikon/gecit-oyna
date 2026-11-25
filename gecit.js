"use strict";

function syncVisibleWidth() {
  const width = window.visualViewport?.width || window.innerWidth;
  document.documentElement.style.setProperty("--gecit-visible-width", width + "px");
}
syncVisibleWidth();
window.visualViewport?.addEventListener("resize", syncVisibleWidth);
window.addEventListener("resize", syncVisibleWidth);

const game = document.getElementById("game");
const canvas = document.getElementById("unity-canvas");
const cover = document.getElementById("cover");
const start = document.getElementById("start");
const download = document.getElementById("download");
const progress = document.getElementById("progress");
const statusLine = document.getElementById("status");
const alternatives = document.getElementById("alternatives");
const rotatePlay = document.getElementById("rotate-play");
const narrowPortrait = window.matchMedia("(orientation: portrait) and (max-width: 900px)");
let state = "ready";
let rotateTimeout;

function updateRotateHint() {
  clearTimeout(rotateTimeout);
  rotatePlay.hidden = state !== "playing" || !narrowPortrait.matches;
  if (!rotatePlay.hidden) {
    rotateTimeout = setTimeout(() => { rotatePlay.hidden = true; }, 4500);
  }
}

function showFailure(message) {
  state = "failed";
  updateRotateHint();
  cover.hidden = false;
  download.hidden = true;
  start.textContent = "Yeniden dene";
  start.hidden = false;
  alternatives.hidden = false;
  statusLine.textContent = message;
  start.focus({ preventScroll: true });
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function requestPlayingArea() {
  if (window.matchMedia("(pointer: coarse)").matches &&
      document.fullscreenEnabled && game.requestFullscreen) {
    game.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) {
        return screen.orientation.lock("landscape");
      }
    }).catch(() => {});
  }
}

async function launch() {
  if (state === "failed") {
    window.location.reload();
    return;
  }
  if (state !== "ready") return;
  state = "loading";
  start.hidden = true;
  download.hidden = false;
  statusLine.textContent = "Oyun yükleniyor…";
  if (!window.WebAssembly || !window.WebGL2RenderingContext) {
    showFailure("Bu tarayıcıda 3B oyun desteği bulunamadı. Bağlantıyı güncel Safari veya Chrome’da aç.");
    return;
  }

  requestPlayingArea();
  try {
    const response = await fetch("gecit-build.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Build bilgisi okunamadı.");
    const { loaderUrl, ...config } = await response.json();
    if (!loaderUrl || !config.dataUrl || !config.frameworkUrl || !config.codeUrl) {
      throw new Error("Build dosyalarının adresleri eksik.");
    }
    config.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    config.autoSyncPersistentDataPath = true;
    config.showBanner = (message, type) => {
      if (type === "error") {
        console.error(message);
        showFailure("Oyun bu tarayıcıda başlatılamadı. Sayfayı yenileyebilir veya bağlantıyı başka bir tarayıcıda açabilirsin.");
      } else if (type === "warning") {
        console.warn(message);
      }
    };

    await loadScript(loaderUrl);
    let lastPercent = -10;
    await window.createUnityInstance(canvas, config, (ratio) => {
      if (state !== "loading") return;
      const percent = Math.round(ratio * 100);
      progress.value = percent;
      if (percent >= 90) {
        statusLine.textContent = "Savaş alanı hazırlanıyor…";
      } else if (percent >= lastPercent + 10) {
        lastPercent = percent;
        statusLine.textContent = "Oyun yükleniyor · %" + percent;
      }
    });
    if (state !== "loading") return;
    state = "playing";
    cover.hidden = true;
    updateRotateHint();
    canvas.focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    if (state !== "failed") {
      showFailure("Oyun dosyaları açılamadı. Bağlantını kontrol edip yeniden dene.");
    }
  }
}

start.addEventListener("click", launch);
narrowPortrait.addEventListener("change", updateRotateHint);
canvas.addEventListener("webglcontextlost", () => {
  showFailure("Tarayıcı 3B görüntüyü durdurdu. Oyun alanını yeniden açmak için tekrar dene.");
});
