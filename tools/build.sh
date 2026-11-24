#!/bin/bash
# 「ここは何藩？」のデータ（data/ryobun.topojson, data/han.json）を作り直すスクリプト
# 必要なもの：bash, curl, git, unzip, python3（pandas）, node（npm）
# 使い方：cd tools && npm install && ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
OUT=$(cd .. && pwd)/data
mkdir -p build && cd build
mkdir -p work
MS="node --max-old-space-size=12000 ../node_modules/.bin/mapshaper"

# 1) 元データの取得 --------------------------------------------------------
[ -d src/Kyudaka_agrivillage ] || { mkdir -p src && git clone --depth 1 https://github.com/yaoyue00085856/Kyudaka_agrivillage.git src/Kyudaka_agrivillage; }
mkdir -p maffzip maff
for i in $(seq -w 2 46); do   # 北海道(01)・沖縄(47)は元データの対象外
  f=maffzip/MA0001_$i.zip
  [ -s $f ] || curl -sSfL -o $f https://www.maff.go.jp/j/tokei/census/shuraku_data/2015/ma/MA0001_2015_2015_$i.zip
  unzip -oq $f -d maff
done
[ -s han.csv ]  || curl -sSfL -o han.csv  https://codh.rois.ac.jp/han/dataset/han-20250919.csv
[ -s prov.html ] || curl -sSfL -o prov.html https://codh.rois.ac.jp/province/
[ -s han.html ] || curl -sSfL -o han.html  https://geoshape.ex.nii.ac.jp/av/han/

# 2) 領域：集落境界に近世村の領分を結合し、旧国＋領分の組み合わせごとにまとめる ----
python3 ../scripts/10_key_join.py
$MS -i maff/*/rcom.shp combine-files encoding=cp932 -merge-layers force -filter-fields KEY \
  -join work/key_g.csv keys=KEY,KEY string-fields=KEY,g,kuni,rb \
  -each 'g = g || "#未判定"; kuni = kuni || ""; rb = rb || ""' -proj wgs84 -o work/keys_joined.shp
$MS -i work/keys_joined.shp encoding=utf-8 -dissolve2 g copy-fields=kuni,rb -o work/ryobun_full.shp
# 簡略化（0.6%）＋旧国（明治の分割前の国名）でまとめたレイヤー k を作る
$MS -i work/ryobun_full.shp encoding=utf-8 name=r -simplify 0.6% keep-shapes -filter-slivers min-area=0.05km2 -filter-fields kuni,rb \
  -each 'ek = ({"岩代":"陸奥","磐城":"陸奥","陸前":"陸奥","陸中":"陸奥","羽前":"出羽","羽後":"出羽"})[kuni] || kuni' \
  -dissolve2 ek + name=k -filter 'ek!==""' target=k \
  -o format=topojson quantization=100000 target=r,k work/final.topojson
$MS -i work/final.topojson -target k -points inner -o format=geojson work/kpts.json

# 3) 領分→藩ID（CODH）、藩主名（Wikipedia）-------------------------------------
python3 ../scripts/20_scrape_han_ids.py
python3 ../scripts/30_fetch_wiki_han.py
python3 ../scripts/31_lords_stage.py
python3 ../scripts/32_fetch_wiki_lords.py
python3 ../scripts/33_lords_pick.py
python3 ../scripts/34_resolve_titles.py
python3 ../scripts/40_build_han.py

# 4) 出力 -----------------------------------------------------------------
python3 ../scripts/50_finalize.py "$OUT"
ls -la "$OUT"
