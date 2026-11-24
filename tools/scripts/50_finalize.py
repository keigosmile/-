# 領域 TopoJSON の属性を軽量化し（領分は han.json の番号で参照）、旧国ラベル位置を付けて出力する
import json,sys
out_dir=sys.argv[1]
H=json.load(open('work/han_out.json'))
tj=json.load(open('work/final.topojson'))
pts={f['properties']['ek']:[round(c,4) for c in f['geometry']['coordinates']] for f in json.load(open('work/kpts.json'))['features']}
names=sorted(H.keys(),key=lambda k:(H[k]['kind']!='han',k))
idx={n:i for i,n in enumerate(names)}
for g in tj['objects']['r']['geometries']:
    p=g.get('properties') or {}
    rb=[x for x in (p.get('rb') or '').split('|') if x]
    missing=[x for x in rb if x not in idx]
    assert not missing, missing
    g['properties']={'k':p.get('kuni') or '','r':[idx[x] for x in rb]}
for g in tj['objects']['k']['geometries']:
    n=g['properties']['ek']; g['properties']={'n':n,'p':pts[n]}
json.dump(tj,open(f'{out_dir}/ryobun.topojson','w'),ensure_ascii=False,separators=(',',':'))
json.dump({'ryobun':[dict(src=n,**H[n]) for n in names]},open(f'{out_dir}/han.json','w'),ensure_ascii=False,separators=(',',':'))
print('r',len(tj['objects']['r']['geometries']),'k',len(tj['objects']['k']['geometries']),'ryobun',len(names))
