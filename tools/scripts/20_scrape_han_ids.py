import re,json,time,urllib.request,os
t=open('han.html',encoding='utf-8').read()
tables=re.findall(r'<table.*?</table>',t,flags=re.S)
print('tables',len(tables))
for i,tb in enumerate(tables):
    print(i, re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',tb))[:200])
rows=[]
for ti,tb in enumerate(tables):
  for r in re.findall(r'<tr[^>]*>(.*?)</tr>',tb,flags=re.S):
    tds=re.findall(r'<td[^>]*>(.*?)</td>',r,flags=re.S)
    if not tds: continue
    page=re.search(r'href="([HO]\d+)/"',tds[1]); 
    rows.append(dict(table=ti,name=re.sub('<[^>]+>','',tds[1]).strip(),page=page.group(1) if page else None,
      villages=int(tds[2]),koku=int(tds[3]),hanid=re.sub('<[^>]+>','',tds[4]).strip()))
print(len(rows)); print(rows[:3]); print([r for r in rows if r['table']==1][:10])
os.makedirs('work/hanpages',exist_ok=True)
for r in rows:
    if not r['page']: continue
    fn=f"work/hanpages/{r['page']}.txt"
    if not os.path.exists(fn):
        import subprocess
        h=subprocess.run(["curl","-sS","--retry","4","-m","120",f"https://geoshape.ex.nii.ac.jp/av/han/{r['page']}/"],capture_output=True,check=True).stdout.decode("utf-8")
        m=re.search(r'let ryobun = (\[.*?\]);',h)
        open(fn,'w').write(m.group(1) if m else '[]')
        time.sleep(0.3)
    r['ryobun']=json.load(open(fn))
json.dump(rows,open('work/hanrows.json','w'),ensure_ascii=False,indent=0)
