// ==UserScript==
// @name         迷惑サイト除外
// @namespace    https://github.com/hakusyaku-lab/meiwaku-site-jogai
// @version      1.0.0
// @description  Google・Bingの検索結果から、除外リストに入れたサイトを表示しないようにします（スマホ・Safari用）
// @match        https://www.google.com/search*
// @match        https://www.google.co.jp/search*
// @match        https://www.bing.com/search*
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @updateURL    https://raw.githubusercontent.com/hakusyaku-lab/meiwaku-site-jogai/main/userscript/meiwaku-site-jogai.user.js
// @downloadURL  https://raw.githubusercontent.com/hakusyaku-lab/meiwaku-site-jogai/main/userscript/meiwaku-site-jogai.user.js
// ==/UserScript==
// このファイルは scripts/build.py が content.js から自動で作ります。直接は直さないでください。
{
const MSJ_USERSCRIPT = true;
const chrome = (() => {
  const listeners = [];
  const read = async (k, d) => {
    try { const v = await GM.getValue(k); return v === undefined ? d : JSON.parse(v); } catch { return d; }
  };
  return {
    storage: {
      local: {
        get(defaults, cb) {
          (async () => {
            const out = { ...defaults };
            for (const k in defaults) out[k] = await read(k, defaults[k]);
            cb(out);
          })();
        },
        set(obj, cb) {
          (async () => {
            const changes = {};
            for (const k in obj) {
              await GM.setValue(k, JSON.stringify(obj[k]));
              changes[k] = { newValue: obj[k] };
            }
            listeners.forEach((f) => f(changes));
            if (cb) cb();
          })();
        },
      },
      onChanged: { addListener: (f) => listeners.push(f) },
    },
  };
})();
// 迷惑サイト除外
// Google・Bing の検索結果で、除外リストに入っているサイトを非表示にする。
// 各結果の下に「✕ 〇〇 を除外」ボタンを出し、押すとリストに追加して隠す。
(() => {
  const isBing = /(^|\.)bing\.com$/.test(location.hostname);
  const P = "msj"; // このツールで使う目印の頭文字

  const CSS = `
    .${P}-hide { display: none !important; }
    .${P}-revealed { opacity: .45; }
    .${P}-bar { margin: 2px 0 8px; font-size: 12px; line-height: 1.6; }
    .${P}-btn {
      background: none; border: none; padding: 2px 4px; margin: 0; cursor: pointer;
      font: inherit; font-size: 12px; color: #70757a; text-decoration: underline;
    }
    .${P}-btn:hover { color: #d93025; }
    .${P}-notice {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      margin: 8px 0 12px; padding: 8px 12px; border-radius: 8px;
      background: rgba(127,127,127,.14); font-size: 13px; line-height: 1.5;
    }
    .${P}-notice .${P}-btn { font-size: 13px; }
    .${P}-toast {
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      z-index: 2147483647; display: flex; gap: 12px; align-items: center;
      max-width: calc(100vw - 32px); padding: 10px 16px; border-radius: 8px;
      background: #303134; color: #fff; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.3);
    }
    .${P}-toast .${P}-btn { color: #8ab4f8; font-size: 14px; white-space: nowrap; }
    html.${P}-off .${P}-bar, html.${P}-off .${P}-notice { display: none !important; }
    .${P}-editor {
      position: fixed; inset: 0; z-index: 2147483647; display: flex;
      align-items: center; justify-content: center; background: rgba(0,0,0,.45);
    }
    .${P}-editor > div {
      box-sizing: border-box; width: min(420px, calc(100vw - 24px)); padding: 16px;
      border-radius: 10px; background: #fff; color: #202124; font-size: 14px; line-height: 1.5;
    }
    .${P}-editor p { margin: 0 0 8px; font-size: 12px; color: #5f6368; }
    .${P}-editor textarea {
      box-sizing: border-box; width: 100%; height: 45vh; padding: 8px; font-size: 16px;
      border: 1px solid #dadce0; border-radius: 6px; background: #fff; color: #202124;
    }
    .${P}-editor .${P}-row { display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px; }
    .${P}-editor .${P}-btn { font-size: 15px; padding: 8px 12px; }
    .${P}-editor .${P}-save { background: #d93025; color: #fff; border-radius: 6px; text-decoration: none; }
  `;

  // スマホ・Safari 用（ユーザースクリプト）として動いているか
  // ※ツールバーのアイコンが無いので、除外リストはページ内で編集する
  const IN_PAGE_EDITOR = typeof MSJ_USERSCRIPT !== "undefined";

  let blocked = [];
  let enabled = true;
  let reveal = false; // 「表示する」を押して一時的に見せている状態
  let scheduled = false;

  // ---- ドメインまわり ----
  function normalize(s) {
    s = String(s || "").trim().toLowerCase();
    if (!s || s.startsWith("#")) return "";
    s = s.replace(/^[a-z]+:\/\//, "").replace(/^\*\./, "");
    s = s.split(/[\/\s?#:›]/)[0].replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(s) || /^xn--/.test(s) ? s : "";
  }

  function isBlocked(d) {
    return !!d && blocked.some((e) => d === e || d.endsWith("." + e));
  }

  function hostOf(url) {
    try { return new URL(url, location.href).hostname; } catch { return ""; }
  }

  // 検索サイトの中継URLから、本当の行き先を取り出す
  function realUrl(a) {
    let u;
    try { u = new URL(a.href); } catch { return ""; }
    if (/(^|\.)google\./.test(u.hostname) && u.pathname === "/url") {
      return u.searchParams.get("q") || u.searchParams.get("url") || "";
    }
    if (/(^|\.)bing\.com$/.test(u.hostname) && u.pathname.startsWith("/ck/")) {
      const p = u.searchParams.get("u") || "";
      if (p.startsWith("a1")) {
        try { return atob(p.slice(2).replace(/-/g, "+").replace(/_/g, "/")); } catch { /* 読めない */ }
      }
      return "";
    }
    return a.href;
  }

  function domainOf(a, box) {
    // Bing は広告などが中継URLになるので、表示されているサイト名（cite）を優先
    if (isBing) {
      const d = normalize(box.querySelector("cite")?.textContent);
      if (d) return d;
    }
    return normalize(hostOf(realUrl(a))) || normalize(box.querySelector("cite")?.textContent);
  }

  // ---- 検索結果を探す ----
  // PC版は <h3>、スマホ版は role="heading" で見出しが作られている
  const G_LINK = 'a[href]:has(h3), a[href]:has([role="heading"])';

  // 検索サイト自身（ショッピング広告など）は除外ボタンの対象にしない
  function isSearchEngine(d) {
    return /(^|\.)google\.[a-z.]+$/.test(d) || /(^|\.)bing\.com$/.test(d);
  }

  function findResults() {
    const out = [];
    if (isBing) {
      document.querySelectorAll("#b_results > li h2 a[href]").forEach((a) => {
        const box = a.closest("#b_results > li");
        if (box) out.push([a, box]);
      });
    } else {
      document.querySelectorAll(`#rso :is(${G_LINK}), #search :is(${G_LINK}), #botstuff :is(${G_LINK})`).forEach((a) => {
        // その結果1件だけを囲む、いちばん外側の箱を探す
        let box = a;
        while (box.parentElement) {
          const p = box.parentElement;
          if (p.id === "rso" || p.id === "search" || p.id === "botstuff" || p === document.body) break;
          if (p.querySelectorAll(G_LINK).length > 1) break;
          box = p;
        }
        if (box !== a) out.push([a, box]);
      });
    }
    return out;
  }

  // ---- 画面に出すもの ----
  function addStyle() {
    if (document.getElementById(P + "-style")) return;
    const st = document.createElement("style");
    st.id = P + "-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function makeBtn(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = P + "-btn";
    b.textContent = text;
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
  }

  function setBar(box, domain) {
    let bar = box.querySelector(":scope > ." + P + "-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = P + "-bar";
      box.appendChild(bar);
    }
    const blockedNow = isBlocked(domain);
    const key = (blockedNow ? "on:" : "off:") + domain;
    if (bar.dataset.key === key) return;
    bar.dataset.key = key;
    bar.textContent = "";
    if (blockedNow) {
      bar.appendChild(makeBtn(`除外を解除（${domain}）`, () => unblock(domain)));
    } else {
      bar.appendChild(makeBtn(`✕ ${domain} を除外`, () => block(domain)));
    }
  }

  function noticeHost() {
    if (isBing) return document.getElementById("b_results");
    return document.getElementById("rso") || document.getElementById("search");
  }

  function updateNotice(count) {
    let n = document.getElementById(P + "-notice");
    // スマホ版はリスト編集の入口として、0件でも表示する
    if ((!count && !IN_PAGE_EDITOR) || !enabled) { n?.remove(); return; }
    const host = noticeHost();
    if (!host) return;
    if (!n) {
      n = document.createElement(isBing ? "li" : "div");
      n.id = P + "-notice";
      n.className = P + "-notice";
      if (isBing) n.style.listStyle = "none";
    }
    if (host.firstElementChild !== n) host.insertBefore(n, host.firstElementChild);
    const key = `${count}:${reveal}`;
    if (n.dataset.key === key) return;
    n.dataset.key = key;
    n.textContent = "";
    const msg = document.createElement("span");
    msg.textContent = count
      ? `除外リストのサイトを ${count} 件 ${reveal ? "表示中（薄い色）" : "非表示にしています"}`
      : "迷惑サイト除外：このページで隠したサイトはありません";
    n.appendChild(msg);
    if (count) n.appendChild(makeBtn(reveal ? "隠す" : "表示する", () => { reveal = !reveal; n.dataset.key = ""; apply(); }));
    if (IN_PAGE_EDITOR) n.appendChild(makeBtn("除外リストを編集", openEditor));
  }

  // スマホ版用：ページの上に除外リストの編集画面を出す
  function openEditor() {
    document.querySelector("." + P + "-editor")?.remove();
    const wrap = document.createElement("div");
    wrap.className = P + "-editor";
    const panel = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = "除外リスト";
    const help = document.createElement("p");
    help.textContent = "1行に1つ（例：example.com）。URLを貼っても大丈夫です。サブドメインもまとめて除外されます。";
    const ta = document.createElement("textarea");
    ta.spellcheck = false;
    ta.value = blocked.join("\n");
    const row = document.createElement("div");
    row.className = P + "-row";
    const close = () => wrap.remove();
    const saveBtn = makeBtn("保存", () => {
      save(ta.value.split(/\r?\n/).map(normalize).filter(Boolean));
      close();
      toast(`除外リストを保存しました（${blocked.length} 件）`);
    });
    saveBtn.classList.add(P + "-save");
    row.append(makeBtn("閉じる", close), saveBtn);
    panel.append(title, help, ta, row);
    wrap.appendChild(panel);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
  }

  let toastTimer;
  function toast(text, undo) {
    document.querySelector("." + P + "-toast")?.remove();
    clearTimeout(toastTimer);
    const t = document.createElement("div");
    t.className = P + "-toast";
    const s = document.createElement("span");
    s.textContent = text;
    t.appendChild(s);
    if (undo) t.appendChild(makeBtn("元に戻す", () => { undo(); t.remove(); }));
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), 6000);
  }

  // ---- 除外リストの追加・解除 ----
  function save(list) {
    blocked = [...new Set(list)].sort();
    chrome.storage.local.set({ blocked });
    apply();
  }

  function block(domain) {
    chrome.storage.local.get({ blocked: [] }, (v) => {
      save([...v.blocked, domain]);
      toast(`${domain} を除外しました`, () => unblock(domain, true));
    });
  }

  function unblock(domain, quiet) {
    chrome.storage.local.get({ blocked: [] }, (v) => {
      // そのサイトを含む登録（親ドメインでの登録も）をはずす
      save(v.blocked.filter((e) => !(domain === e || domain.endsWith("." + e))));
      if (!quiet) toast(`${domain} の除外を解除しました`, () => block(domain));
    });
  }

  // ---- 反映 ----
  function apply() {
    scheduled = false;
    addStyle();
    document.documentElement.classList.toggle(P + "-off", !enabled);
    let count = 0;
    for (const [a, box] of findResults()) {
      const domain = box.dataset.msjDomain || domainOf(a, box);
      if (!domain || isSearchEngine(domain)) continue;
      box.dataset.msjDomain = domain;
      const hit = enabled && isBlocked(domain);
      if (hit) count++;
      box.classList.toggle(P + "-hide", hit && !reveal);
      box.classList.toggle(P + "-revealed", hit && reveal);
      setBar(box, domain);
    }
    updateNotice(count);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(apply, 200);
  }

  // 自分で足した部品（ボタン・お知らせ・通知）の変化は無視する（無限に動き続けないように）
  const OURS = `.${P}-bar, .${P}-notice, .${P}-toast, .${P}-editor`;
  const isOurs = (n) => n.nodeType === 1 && (n.matches?.(OURS) || n.closest?.(OURS));
  new MutationObserver((muts) => {
    const outside = muts.some((m) => !isOurs(m.target) &&
      [...m.addedNodes, ...m.removedNodes].some((n) => !isOurs(n)));
    if (outside) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.local.get({ blocked: [], enabled: true }, (v) => {
    blocked = v.blocked;
    enabled = v.enabled;
    apply();
  });

  chrome.storage.onChanged.addListener((c) => {
    if (c.blocked) blocked = c.blocked.newValue || [];
    if (c.enabled) enabled = c.enabled.newValue;
    if (c.blocked || c.enabled) apply();
  });
})();
}
