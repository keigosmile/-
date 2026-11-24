# Wikipedia の記事名（藩・藩主・旧国など）がリダイレクトか、存在するか、曖昧さ回避でないかを確認する
import json,subprocess,time
m=json.load(open('../manual.json'))
L=json.load(open('work/lords_final.json'))
titles=set(m['article'].values())|{v for v in m['lord'].values() if v}|set(m['lordwiki'].values())|{v[0] for v in m['other'].values() if v[0]}
titles|={v['article'] for v in L.values() if v.get('article')}|{v['lordwiki'] for v in L.values() if v.get('lordwiki')}
kuni=['陸奥','出羽','岩代','磐城','陸前','陸中','羽前','羽後']+"三河 上総 上野 下総 下野 丹後 丹波 伊予 伊勢 伊豆 伊賀 伯耆 但馬 佐渡 信濃 備中 備前 備後 出雲 加賀 周防 和泉 因幡 土佐 壱岐 大和 大隅 安房 安芸 対馬 尾張 山城 常陸 志摩 摂津 播磨 日向 武蔵 河内 淡路 甲斐 相模 石見 筑前 筑後 紀伊 美作 美濃 肥前 肥後 能登 若狭 薩摩 讃岐 豊前 豊後 越中 越前 越後 近江 遠江 長門 阿波 隠岐 飛騨 駿河".split()
titles|={k+'国' for k in kuni}
titles=sorted(titles); bad=[]; res={}
for i in range(0,len(titles),50):
    ch=titles[i:i+50]
    for attempt in range(6):
        r=subprocess.run(['curl','-s','-w','\n%{http_code}','-X','POST','https://ja.wikipedia.org/w/api.php','--data-urlencode','titles='+'|'.join(ch),'-d','action=query','-d','format=json','-d','formatversion=2','-d','redirects=1','-d','prop=pageprops','-d','ppprop=disambiguation','-A','KokoHanPrototype/0.1 (one-off data preparation; low rate)'],capture_output=True,text=True).stdout
        body,code=r.rsplit('\n',1)
        if code=='200': break
        time.sleep(5*(attempt+1))
    else: raise SystemExit('Wikipedia API error '+code)
    d=json.loads(body)['query']; red={x['from']:x['to'] for x in d.get('redirects',[])}; norm={x['from']:x['to'] for x in d.get('normalized',[])}
    pages={p['title']:p for p in d['pages']}
    for x in ch:
        y=red.get(norm.get(x,x),norm.get(x,x)); p=pages.get(y,{})
        if p.get('missing') or not p: bad.append(x)
        elif 'pageprops' in p: bad.append(x+'(曖昧)')
        res[x]=y
    time.sleep(2)
json.dump(res,open('work/titles_resolved.json','w'),ensure_ascii=False)
print(len(titles),'要確認:',bad)
