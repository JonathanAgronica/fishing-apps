import json,numpy as np
G=json.load(open('gauge_events.json'))
AHD=1.693
def winHW(h): return 1.81+(h-2.35)*(2.27-1.81)/(2.94-2.35)
out={}
for g in ('Essendean','HillsRd'):
    for k in ('HW','LW'):
        R=[r for r in G[g] if r['kind']==k and r['amp'] is not None]
        if g=='Essendean' and k=='HW': R=[r for r in G[g] if r['kind']==k]  # include first
        x=np.array([r['bund_h'] for r in R]);lag=np.array([r['lag_mid_h']*60 for r in R]);v=np.array([r['val'] for r in R])
        unc=np.array([(r['lag_end_h']-r['lag_start_h'])*30 for r in R])
        A=np.vstack([x,np.ones_like(x)]).T
        sl,ic=np.linalg.lstsq(A,v,rcond=None)[0]; ls,li=np.linalg.lstsq(A,lag,rcond=None)[0]
        r_v=np.corrcoef(x,v)[0,1];r_l=np.corrcoef(x,lag)[0,1]
        print(f'{g} {k}: n={len(R)} lag mean {lag.mean():.0f} min sd {lag.std(ddof=1):.0f} range {lag.min():.0f}-{lag.max():.0f}; median plateau half-width ±{np.median(unc):.0f} min')
        print(f'   level(AHD) = {ic:.3f} + {sl:.3f}*BundH(LAT)  r={r_v:.2f};  lag = {li:.0f} + {ls:.0f}*BundH  r={r_l:.2f}')
        out[g+'_'+k]=dict(n=len(R),lag_mean=float(lag.mean()),lag_sd=float(lag.std(ddof=1)),lag_min=float(lag.min()),lag_max=float(lag.max()),lvl_a=float(ic),lvl_b=float(sl),lvl_r=float(r_v),lag_a=float(li),lag_b=float(ls),lag_r=float(r_l),unc_med=float(np.median(unc)),
           pts=[dict(bund_t=r['bund_t'],bund_h=r['bund_h'],lag=r['lag_mid_h']*60,val=r['val'],unc=(r['lag_end_h']-r['lag_start_h'])*30) for r in R])
# Essendean onset of rise (start of first run above trough) vs Bund HW and vs Bund LW
json.dump(out,open('stats.json','w'),indent=1)
# ratio of ranges: Hills Rd HW-LW vs Bund
E=[r for r in G['HillsRd']]
amps=[(abs(r['amp']),r) for r in E if r['amp'] is not None]
print('Hills Rd range/Bund range examples:')
W=json.load(open('bund_week.json'))['obs']
rr=[]
for a,r in amps:
    # Bund range: matched extreme vs previous opposite extreme
    i=[j for j,b in enumerate(W) if abs(b[0]-r['bund_t'])<1e-6][0]
    if i>0: rr.append(a/abs(W[i][1]-W[i-1][1]))
print('  ratio mean %.2f sd %.2f n=%d'%(np.mean(rr),np.std(rr,ddof=1),len(rr)))
# Essendean: which Bund HWs produced a detectable peak
print('Bund HWs vs Essendean response:')
peaks=[r for r in G['Essendean'] if r['kind']=='HW']
for b in W:
    if not b[2]: continue
    m=[p for p in peaks if abs(p['bund_t']-b[0])<1e-6]
    print('  Bund HW %.2f LAT (%.2f AHD) Winfield~%.2f LAT -> %s'%(b[1],b[1]-AHD,winHW(b[1]),('peak %.2f AHD lag %.0f min'%(m[0]['val'],m[0]['lag_mid_h']*60)) if m else 'no distinct peak'))
