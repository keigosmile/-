#!/bin/bash
# iPhoneアプリなどに組み込むための一式を app-bundle/ に作る
# ・データを data/data.js に埋め込むので、fetch が使えない file:// でもそのまま動く
# ・アプリの WebView でローカルの index.html を開けばよい
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=app-bundle
rm -rf "$OUT"
mkdir -p "$OUT/data"
cp -r assets vendor credits.html "$OUT/"
python3 - "$OUT" <<'PY'
import json,sys
out=sys.argv[1]
han=json.load(open('data/han.json')); topo=json.load(open('data/ryobun.topojson'))
with open(f'{out}/data/data.js','w') as f:
    f.write('/* 「ここは何藩？」埋め込みデータ（CC BY-SA 4.0。出典は credits.html） */\n')
    f.write('window.KOKOHAN_DATA={han:'+json.dumps(han,ensure_ascii=False,separators=(',',':'))+',topo:'+json.dumps(topo,ensure_ascii=False,separators=(',',':'))+'};\n')
s=open('index.html').read()
s=s.replace('<script src="assets/app.js"></script>','<script src="data/data.js"></script>\n<script src="assets/app.js"></script>')
open(f'{out}/index.html','w').write(s)
PY
cp LICENSE-DATA.md "$OUT/" 2>/dev/null || true
du -sh "$OUT"; ls -la "$OUT" "$OUT/data"
