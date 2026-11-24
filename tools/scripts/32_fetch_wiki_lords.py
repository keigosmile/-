import json,subprocess,os,time
C=json.load(open('work/wpcache.json'))
need=[x for x in open('work/need.txt').read().split('\n') if x and x not in C]
for i in range(0,len(need),20):
    chunk=need[i:i+20]
    out=subprocess.run(['../scripts/wp.sh','|'.join(chunk)],capture_output=True,check=True).stdout
    d=json.loads(out)['query']
    red={x['from']:x['to'] for x in d.get('redirects',[])}; norm={x['from']:x['to'] for x in d.get('normalized',[])}
    pages={p['title']:p for p in d['pages']}
    for x in chunk:
        y=norm.get(x,x); y=red.get(y,y); p=pages.get(y,{})
        C[x]=None if p.get('missing') or 'revisions' not in p else {'title':p['title'],'text':p['revisions'][0]['slots']['main']['content']}
    json.dump(C,open('work/wpcache.json','w'),ensure_ascii=False); time.sleep(3)
print(len(need))
