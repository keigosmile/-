import json,re,csv,subprocess,time,os,sys
sys.path.insert(0,'work')
C=json.load(open('work/wpcache.json')); cands=json.load(open('work/cands.json'))
han={r['藩ID']:r for r in csv.DictReader(open('han.csv',encoding='utf-8'))}
ERA='慶長|元和|寛永|正保|慶安|承応|明暦|万治|寛文|延宝|天和|貞享|元禄|宝永|正徳|享保|元文|寛保|延享|寛延|宝暦|明和|安永|天明|寛政|享和|文化|文政|天保|弘化|嘉永|安政|万延|文久|元治|慶応|明治'
E0=dict(zip(ERA.split('|'),[1596,1615,1624,1644,1648,1652,1655,1658,1661,1673,1681,1684,1688,1704,1711,1716,1736,1741,1744,1748,1751,1764,1772,1781,1789,1801,1804,1818,1830,1844,1848,1854,1860,1861,1864,1865,1868]))
def clean(s): return re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]',r'\1',re.sub(r'<ref[^>]*/>|<ref.*?</ref>|\{\{[^{}]*\}\}','',s,flags=re.S))
def years(s):
    s=clean(s); out=[]
    for m in re.finditer(rf'({ERA})\s*(元|\d+)年',s):
        out.append((m.start(),E0[m.group(1)]+(0 if m.group(2)=='元' else int(m.group(2))-1),'era'))
    for m in re.finditer(r'(1[5-9]\d\d)年',s): out.append((m.start(),int(m.group(1)),'ad'))
    return sorted(out)
def disamb(t): return bool(re.search(r'\{\{\s*(Aimai|aimai|曖昧さ回避|人名の曖昧さ回避|地名の曖昧さ回避)',t))
def section(text):
    m=re.search(r'\n(==+)\s*歴代(藩主|当主)[^=\n]*==+',text)
    if not m: return None
    lv=len(m.group(1)); rest=text[m.end():]
    j=re.search(r'\n={2,%d}[^=]'%lv,rest)
    return rest[:j.start()] if j else rest
LINK=r'\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]'
BAD=('ファイル','File','画像','譜代','外様','親藩','従','正','御家門')
def entries(sec):
    ents=[]
    for ln in sec.split('\n'):
        if re.match(r'^\s*#',ln):
            for m in re.finditer(LINK,ln):
                if not m.group(1).startswith(BAD) and not re.search(r'(国|家|藩)$',m.group(1)): break
            else: continue
            ents.append(dict(target=m.group(1).strip(),label=clean(m.group(2) or m.group(1)).strip(),years=years(ln[m.end():]),line=ln))
    if ents: return ents
    for row in re.split(r'\n\|-',sec):
        for m in re.finditer(LINK,row):
            if not m.group(1).startswith(BAD) and not re.search(r'(国|家|藩|守|位|大夫|奉行|老中|年|号)$',m.group(1)) and not re.match(r'^\d',m.group(1)): break
        else: continue
        ents.append(dict(target=m.group(1).strip(),label=clean(m.group(2) or m.group(1)).strip(),years=years(row[m.end():]),line=row.replace('\n',' ')))
    return ents
def span(e):
    ys=e['years']; era=[y[1] for y in ys if y[2]=='era']; ad=[y[1] for y in ys if y[2]=='ad']
    seq=era if len(era)>=2 else ad if len(ad)>=2 else (era or ad)
    if not seq: return None
    return (seq[0], seq[1] if len(seq)>1 else None)
def succ_year(text):
    t=clean(text)
    for m in re.finditer(r'[^。\n]*(家督を(継|相続|譲られ)|藩主(と|に)な|襲封|跡を継|家督相続)[^。\n]*',t):
        ys=years(m.group(0))
        ys=[y for y in ys if 1800<=y[1]<=1871]
        if ys: return ys[0][1]
    return None
res={}; need=set()
for hid,cs in cands.items():
    n=re.sub(r'（.*?）|［.*?］','',han[hid]['藩名'])
    alt=re.search(r'［(.*?)］',han[hid]['藩名'])
    art=None
    for c in cs:
        p=C.get(c)
        if p and not disamb(p['text']) and (n in p['title'] or (alt and alt.group(1) in p['title'])) and section(p['text']):
            art=p; break
    if not art: res[hid]=dict(article=None); continue
    ents=entries(section(art['text']))
    res[hid]=dict(article=art['title'],ents=[dict(target=e['target'],label=e['label'],span=span(e)) for e in ents])
    if ents and not any(span(e) for e in ents[-3:]):
        for e in ents[-3:]: need.add(e['target'])
json.dump(res,open('work/lords_stage.json','w'),ensure_ascii=False)
print('need lord articles',len(need))
open('work/need.txt','w').write('\n'.join(sorted(need)))
