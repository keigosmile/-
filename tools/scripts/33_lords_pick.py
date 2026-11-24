import json,re,sys
sys.argv=['x']; exec(open('../scripts/31_lords_stage.py').read().split('res={}; need=set()')[0])
st=json.load(open('work/lords_stage.json'))
out={}
from collections import Counter; cnt=Counter()
for hid,v in st.items():
    if not v['article']: out[hid]=dict(article=None,lord=None,method='no-article'); cnt['noart']+=1; continue
    ents=v['ents']
    if not ents: out[hid]=dict(article=v['article'],lord=None,method='no-list'); cnt['nolist']+=1; continue
    pick=None; method=None
    sp=[(e,e['span']) for e in ents]
    inoff=[(e,s) for e,s in sp if s and s[0]<=1867 and (s[1] is None or s[1]>=1868)]
    # prefer those with explicit end >= 1868
    strict=[(e,s) for e,s in inoff if s[1] is not None]
    if strict: pick=strict[-1][0]; method='list-years'
    elif any(s for e,s in sp[-3:]) and inoff: pick=inoff[-1][0]; method='list-years(start only)'
    else:
        ys=[]
        for e in ents[-3:]:
            p=C.get(e['target']); y=succ_year(p['text']) if p else None
            ys.append((e,y))
        ok=[(e,y) for e,y in ys if y is not None and y<=1867]
        if ok: pick=ok[-1][0]; method='lord-article-succession'
        else: pick=None; method='undetermined'
    cnt[method]+=1
    out[hid]=dict(article=v['article'],lord=pick and pick['label'],lordwiki=pick and pick['target'],method=method)
json.dump(out,open('work/lords_final.json','w'),ensure_ascii=False,indent=1)
print(cnt)
for k,v in out.items():
    if v['method'] not in ('list-years','lord-article-succession'): print(k,v)
