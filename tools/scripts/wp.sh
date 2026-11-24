#!/bin/bash
# usage: wp.sh "title1|title2|..."  -> json (wikitext, max 50 titles)
for i in 1 2 3 4 5 6; do
  out=$(curl -s -X POST 'https://ja.wikipedia.org/w/api.php' --data-urlencode "titles=$1" -d action=query -d prop=revisions -d rvprop=content -d rvslots=main -d format=json -d formatversion=2 -d redirects=1 -d maxlag=5 -A 'KokoHanPrototype/0.1 (one-off data preparation; low rate)' -w '\n%{http_code}')
  code=$(echo "$out" | tail -1)
  if [ "$code" = 200 ]; then echo "$out" | sed '$d'; exit 0; fi
  sleep $((i*5))
done
echo "FAILED $code" >&2; exit 1
