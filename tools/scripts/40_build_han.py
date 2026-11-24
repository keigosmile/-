import json,csv,re
rows=json.load(open('work/hanrows.json')); m=json.load(open('../manual.json'))
L=json.load(open('work/lords_final.json')); T=json.load(open('work/titles_resolved.json'))
han={r['藩ID']:r for r in csv.DictReader(open('han.csv',encoding='utf-8'))}
prov={}
import re as _r
t=open('prov.html',encoding='utf-8').read()
for pid,name in _r.findall(r'<td style="white-space:nowrap">(P\d+)</td>\s*<td style="white-space:nowrap">([^<]+)</td>',t): prov[pid]=name.strip()
rb2id={}
for r in rows:
    for rb in r['ryobun']: rb2id[rb]=(r['hanid'] or None, r['name'])
for rb,hid in m['ryobun_extra'].items(): rb2id[rb]=(hid,None)
def res(t): return T.get(t,t) if t else None
out={}
for rb,(hid,listname) in sorted(rb2id.items()):
    if hid:
        art=m['article'].get(hid) or L.get(hid,{}).get('article')
        lord = m['lord'][hid] if hid in m['lord'] else L.get(hid,{}).get('lord')
        lordwiki = m['lordwiki'].get(hid) or (m['lord'].get(hid) if hid in m['lord'] else L.get(hid,{}).get('lordwiki'))
        if lord and hid not in m['lord']:
            # full name from wiki title (labels are often given names only)
            lord=re.sub(r'\s*\(.*\)$','',lordwiki)
        if hid in m['lord'] and lord is None: lordwiki=None
        lord=re.sub(r'\s*\(.*\)$','',lord) if lord else lord
        name=re.sub(r'\s*\(.*\)$','',res(art)) if art else han[hid]['藩名']+'藩'
        base=re.sub(r'（.*?）|［.*?］','',han[hid]['藩名'])
        if base not in name: name+=f'（{base}藩）'
        sub=re.search(r'（(.*?家)）$',rb)
        if sub: name+=f'（{sub.group(1)}）'
        out[rb]=dict(kind='han',id=hid,name=name,wiki=res(art),lord=lord,lordWiki=res(lordwiki) if lordwiki else None,
                     lordNote=m['lordnote'].get(hid),codh=f'https://codh.rois.ac.jp/han/{hid}/')
    else:
        o=m['other'][rb]
        kind={'幕領':'tenryo','旗本領分':'hatamoto','社寺領':'jisha'}.get(rb,'other')
        disp={'幕領':'幕領（天領）','旗本領分':'旗本領','社寺領':'寺社領','一橋家領分':'一橋家領','田安家領分':'田安家領','その他領分':'その他の領分'}.get(rb,rb)
        out[rb]=dict(kind=kind,id=None,name=disp,wiki=res(o[0]) if o[0] else None,lord=None,lordWiki=None,lordNote=o[1] or None)
json.dump(out,open('work/han_out.json','w'),ensure_ascii=False,indent=1)
print(len(out)); 
for k in ['信濃松代藩','尾張名古屋藩（成瀬家）','伊予松山藩','幕領','出羽久保田藩','陸奥白河藩','出羽秋田藩']:
    print(k,out.get(k))
