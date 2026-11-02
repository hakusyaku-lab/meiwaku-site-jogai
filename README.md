# 迷惑サイト除外（MeiwakuSiteJogai）

Google・Bing の検索結果から、除外リスト（ブラックリスト）に入れたサイトを表示しないようにするツールです。
PC のブラウザ拡張機能と、スマホ・Safari 用のユーザースクリプトがあります。

## できること

- **検索結果から登録**：各結果の下にある「✕ 〇〇 を除外」を押すと除外リストに入り、すぐに隠れます（画面下の「元に戻す」で取り消し）
- **手で登録・解除**：除外リストに1行に1つサイトを書いて「保存」。URLを貼っても大丈夫です
  - PC の拡張機能：ツールバーのアイコンを押すとリストが開きます
  - スマホ・Safari 版：検索結果の上の「除外リストを編集」を押します
- サブドメインもまとめて除外されます（`example.com` を入れると `blog.example.com` も隠れる）
- 隠したサイトがあると、結果の上に「〇件 非表示にしています［表示する］」と出ます。「表示する」で薄い色で見え、「除外を解除」もできます
- PC の拡張機能では、リスト画面の「有効」のチェックで一時的に全部オフにできます

対象：Google（www.google.com / www.google.co.jp）、Bing（www.bing.com）

## 対応している端末

| | Windows | Mac | iPhone・iPad | Android |
|---|---|---|---|---|
| Chrome・Edge・Brave など | ○ 拡張機能 | ○ 拡張機能 | ✕（拡張を入れられない） | ✕（拡張を入れられない） |
| Firefox | ○ 拡張機能 | ○ 拡張機能 | — | ○ 拡張機能（ストア公開が必要） |
| Safari | — | ○ ユーザースクリプト | ○ ユーザースクリプト | — |
| Edge（Android）・Firefox（Android） | — | — | — | ○ ユーザースクリプト |

※ 除外リストは端末・ブラウザごとに別々に保存されます。別の端末へ移すときは、リスト画面の中身をコピーして貼り付けてください。
※ Google・Bing のアプリ内の検索では使えません。ブラウザで検索したときに働きます。

## 入れ方

### Edge・Chrome（Windows・Mac）

1. [⬇ 最新版をダウンロード（MeiwakuSiteJogai.zip）](https://github.com/hakusyaku-lab/meiwaku-site-jogai/releases/latest/download/MeiwakuSiteJogai.zip)して展開する（展開したフォルダは消さずに置いておく）
2. Edge はアドレスバーに `edge://extensions`、Chrome は `chrome://extensions` と入力
3. 「開発者モード」をオンにする
4. 「展開して読み込み」（Chrome は「パッケージ化されていない拡張機能を読み込む」）で、`manifest.json` があるフォルダーを選ぶ
5. 検索ページを開き直すと反映されます

Brave（`brave://extensions`）・Vivaldi・Opera など Chromium 系も同じ手順です。

### Firefox（PC・Android）

**お試し（再起動すると外れます）**：`about:debugging#/runtime/this-firefox` →「一時的なアドオンを読み込む」→ [MeiwakuSiteJogai-firefox.zip](https://github.com/hakusyaku-lab/meiwaku-site-jogai/releases/latest/download/MeiwakuSiteJogai-firefox.zip) を展開した中の `manifest.json` を選ぶ

**ずっと使う**：[addons.mozilla.org の開発者ページ](https://addons.mozilla.org/developers/) に MeiwakuSiteJogai-firefox.zip をそのままアップロードし、「自分で配布（On your own）」を選ぶと署名済みの `.xpi` がもらえます。Android 版 Firefox で使うときは、ストアで公開（On this site）する必要があります。

### iPhone・iPad・Mac の Safari

1. App Store から無料アプリ「**Userscripts**」を入れる
2. 設定 → Safari → 機能拡張 →「Userscripts」をオンにし、「すべてのWebサイト」を許可（Mac は Safari の設定 → 機能拡張）
3. Safari で [meiwaku-site-jogai.user.js](https://raw.githubusercontent.com/hakusyaku-lab/meiwaku-site-jogai/main/userscript/meiwaku-site-jogai.user.js) を開く
4. アドレスバーの「ぁあ」（Mac はツールバー）→ Userscripts →「Install」

### Android（Edge・Firefox）

1. Edge または Firefox に拡張機能「**Tampermonkey**」を入れる
2. [meiwaku-site-jogai.user.js](https://raw.githubusercontent.com/hakusyaku-lab/meiwaku-site-jogai/main/userscript/meiwaku-site-jogai.user.js) を開き、「インストール」を押す

ユーザースクリプト版は、新しい版が出ると自動で更新されます。止めたいときは Userscripts／Tampermonkey の画面でオフにしてください。

## フォルダー構成

| ファイル・フォルダー | 内容 |
|---|---|
| `manifest.json` | Chrome・Edge など Chromium 系用の設定 |
| `firefox/manifest.json` | Firefox 用の設定（JavaScript は共通） |
| `content.js` | 検索結果を隠す本体（全版で共通） |
| `popup.html` / `popup.js` | 拡張機能の除外リスト画面 |
| `userscript/` | スマホ・Safari 用（`scripts/build.py` が `content.js` から自動で作る） |

## 新しい版を出すとき

1. `content.js` などを直す
2. `manifest.json` と `firefox/manifest.json` の `version` を同じ番号に上げる
3. `CHANGELOG.md` に「### 新しい番号（日付）」で変更点を書く
4. `python scripts/build.py` を実行（スマホ用ファイルが更新されます）
5. main に送ると、GitHub Actions が自動で Releases に公開します

## ライセンス

MIT
