// 除外リストの画面
const listEl = document.getElementById("list");
const enabledEl = document.getElementById("enabled");
const msgEl = document.getElementById("msg");

// URL や「www.」つきでも、ドメインだけに整える（content.js と同じ決まり）
function normalize(s) {
  s = String(s || "").trim().toLowerCase();
  if (!s || s.startsWith("#")) return "";
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^\*\./, "");
  s = s.split(/[\/\s?#:›]/)[0].replace(/^www\./, "").replace(/\.$/, "");
  return /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(s) || /^xn--/.test(s) ? s : "";
}

function show(list) {
  listEl.value = list.join("\n") + (list.length ? "\n" : "");
  msgEl.textContent = `${list.length} 件登録中`;
}

chrome.storage.local.get({ blocked: [], enabled: true }, (v) => {
  enabledEl.checked = v.enabled;
  show(v.blocked);
});

enabledEl.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

document.getElementById("save").addEventListener("click", () => {
  const lines = listEl.value.split(/\r?\n/);
  const ok = [...new Set(lines.map(normalize).filter(Boolean))].sort();
  const bad = lines.filter((l) => l.trim() && !l.trim().startsWith("#") && !normalize(l));
  chrome.storage.local.set({ blocked: ok }, () => {
    show(ok);
    msgEl.textContent = `保存しました（${ok.length} 件）` + (bad.length ? `／読めない行 ${bad.length} 件は除きました` : "");
  });
});
