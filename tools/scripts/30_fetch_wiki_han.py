import json,subprocess,os,re,csv,time
rows=json.load(open('work/hanrows.json'))
han={r['藩ID']:r for r in csv.DictReader(open('han.csv',encoding='utf-8'))}
prov={}  # P-id -> name from province page
t=open('prov.html',encoding='utf-8').read()
for pid,name in re.findall(r'<td style="white-space:nowrap">(P\d+)</td>\s*<td style="white-space:nowrap">([^<]+)</td>',t): prov[pid]=name.strip()
if not prov:
    s=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',t))
    for pid,name in re.findall(r'(P\d{3}) (\S+)',s): prov.setdefault(pid,name)
print('prov',len(prov),list(prov.items())[:5])
cache='work/wpcache.json'
C=json.load(open(cache)) if os.path.exists(cache) else {}
def fetch(titles):
    need=[x for x in titles if x not in C]
    for i in range(0,len(need),20):
        chunk=need[i:i+20]
        out=subprocess.run(['../scripts/wp.sh','|'.join(chunk)],capture_output=True,check=True).stdout
        d=json.loads(out)['query']
        red={x['from']:x['to'] for x in d.get('redirects',[])}
        norm={x['from']:x['to'] for x in d.get('normalized',[])}
        pages={p['title']:p for p in d['pages']}
        for x in chunk:
            y=norm.get(x,x); y=red.get(y,y); p=pages.get(y,{})
            C[x]=None if p.get('missing') or 'revisions' not in p else {'title':p['title'],'text':p['revisions'][0]['slots']['main']['content']}
        json.dump(C,open(cache,'w'),ensure_ascii=False)
        time.sleep(3)
cands={}
for r in rows:
    hid=r['hanid']
    if not hid: continue
    h=han[hid]; n=re.sub(r'（.*?）|［.*?］','',h['藩名']); kuni=prov.get(h['国・地域ID'],'')
    m=re.search(r'（(.*?)）',h['藩名']); k2=m.group(1) if m else kuni
    alt=re.search(r'［(.*?)］',h['藩名'])
    c=[f'{k2}{n}藩', f'{n}藩 ({k2}国)', f'{n}藩']
    if alt: c=[f'{alt.group(1)}藩']+c
    if not m: c=[f'{n}藩', f'{kuni}{n}藩']
    cands[hid]=c
allt=sorted({x for c in cands.values() for x in c})
fetch(allt)
json.dump(cands,open('work/cands.json','w'),ensure_ascii=False)
print('fetched',len(C))
