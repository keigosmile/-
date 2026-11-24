import pandas as pd
D='src/Kyudaka_agrivillage/02_kyudaka_v2.01/01_Data/'
ka=pd.read_csv(D+'03_KEY_AID.csv',dtype=str)
pf=pd.read_csv(D+'02_Village_polygon_field_v2.csv',dtype=str,encoding='cp932')
cols=[f'領分{c}' for c in '１２３４５６７８']
pf['rb']=pf[cols].apply(lambda x:'|'.join(v for v in x if isinstance(v,str) and v),axis=1)
pf['g']=pf['国名']+'#'+pf['rb']
m=ka.merge(pf[['AID','国名','rb','g']],on='AID')
m=m.drop_duplicates('KEY')
m.rename(columns={'国名':'kuni'})[['KEY','g','kuni','rb']].to_csv('work/key_g.csv',index=False)
print(len(m), m.g.nunique())
