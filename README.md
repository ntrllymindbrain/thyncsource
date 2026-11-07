# thyncSource

Workflowyを原稿の置き場所にして、論文の形（段落・例文番号・相互参照）で表示・編集するためのWebアプリです。

- 画面：`index.html` 1枚で動きます。
- WorkflowyのAPIキーは、画面の「Workflowy接続」から入力し、そのブラウザの中だけに保存します。このリポジトリには含めません。
- 原稿の中身もこのリポジトリには入りません。

## 中継（relay/worker.js）

WorkflowyのAPIはブラウザから直接呼べないため、Cloudflare Workerで中継します。`relay/worker.js` をWorkerに貼り付けて保存し、そのURLを画面の「Workflowy接続」→「中継のURL」に入れます。中継はAPIキーを保存せず、`https://ntrllymindbrain.github.io` からの呼び出しだけを通します。
