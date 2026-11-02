"""配布用ファイルを作る（GitHub Actions から自動で呼ばれます）。

  dist/MeiwakuSiteJogai.zip          … Chrome・Edge・Brave など（展開して「展開して読み込み」）
  dist/MeiwakuSiteJogai-firefox.zip  … Firefox（addons.mozilla.org にそのままアップロードできる形）
  userscript/meiwaku-site-jogai.user.js … スマホ・Safari 用ユーザースクリプト（content.js から自動生成）

JavaScript は全版で共通です（content.js / popup.js を直すだけ）。
手元で試すときは:  python scripts/build.py
"""
import json
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARED = ["content.js", "popup.html", "popup.js", "icons/icon16.png", "icons/icon32.png",
          "icons/icon48.png", "icons/icon128.png", "LICENSE"]
REPO_RAW = "https://raw.githubusercontent.com/hakusyaku-lab/meiwaku-site-jogai/main/userscript/meiwaku-site-jogai.user.js"

# ユーザースクリプトでは、拡張機能の保存機能の代わりに GM.getValue / GM.setValue を使う
STUB = """const MSJ_USERSCRIPT = true;
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
"""


def build_userscript(version: str) -> None:
    content = (ROOT / "content.js").read_text(encoding="utf-8")
    header = f"""// ==UserScript==
// @name         迷惑サイト除外
// @namespace    https://github.com/hakusyaku-lab/meiwaku-site-jogai
// @version      {version}
// @description  Google・Bingの検索結果から、除外リストに入れたサイトを表示しないようにします（スマホ・Safari用）
// @match        https://www.google.com/search*
// @match        https://www.google.co.jp/search*
// @match        https://www.bing.com/search*
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @updateURL    {REPO_RAW}
// @downloadURL  {REPO_RAW}
// ==/UserScript==
// このファイルは scripts/build.py が content.js から自動で作ります。直接は直さないでください。
"""
    out = ROOT / "userscript" / "meiwaku-site-jogai.user.js"
    out.parent.mkdir(exist_ok=True)
    out.write_text(header + "{\n" + STUB + content + "}\n", encoding="utf-8")
    print("作成:", out.relative_to(ROOT))


def main() -> int:
    v1 = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    v2 = json.loads((ROOT / "firefox/manifest.json").read_text(encoding="utf-8"))["version"]
    if v1 != v2:
        print(f"manifest.json({v1}) と firefox/manifest.json({v2}) の version がそろっていません")
        return 1

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    targets = [
        ("MeiwakuSiteJogai.zip", ROOT / "manifest.json", "MeiwakuSiteJogai/"),
        ("MeiwakuSiteJogai-firefox.zip", ROOT / "firefox/manifest.json", ""),  # AMO は manifest.json が直下
    ]
    for zip_name, manifest, inner in targets:
        with zipfile.ZipFile(dist / zip_name, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(manifest, inner + "manifest.json")
            for n in SHARED:
                z.write(ROOT / n, inner + n)
        print("作成: dist/" + zip_name)

    build_userscript(v1)
    print("バージョン", v1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
