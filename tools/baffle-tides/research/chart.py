import json,numpy as np,datetime as dt
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt, matplotlib.dates as mdates
from fit import EPOCH
from validate import extrema
AHD=1.693
W=json.load(open('bund_week.json'));bt=np.array(W['t']);bo=np.array(W['h']);bp=np.array(W['p'])
def todt(t): return [EPOCH+dt.timedelta(hours=float(x)) for x in np.atleast_1d(t)]
def clean(E):
    out=[]
    for e in E:
        if out and out[-1][2]==e[2]:
            if (e[2] and e[1]>out[-1][1]) or ((not e[2]) and e[1]<out[-1][1]): out[-1]=e
        else: out.append(e)
    return out
t1=np.arange(bt[0],bt[-1],1/60);EP=clean(extrema(t1,np.interp(t1,bt,bp)))
def win(e):
    t,h,hi=e
    if hi: return (t+65/60, 1.81+(h-2.35)*(2.27-1.81)/(2.94-2.35) - 1.53, True)
    return (t+116/60, 1.02+(h-1.20)*(1.01-1.02)/(0.61-1.20) - 1.53, False)
WE=[win(e) for e in EP]
def curve(E,tt):
    out=np.full_like(tt,np.nan)
    for a,b in zip(E[:-1],E[1:]):
        m=(tt>=a[0])&(tt<b[0]);f=(tt[m]-a[0])/(b[0]-a[0]);out[m]=a[1]+(b[1]-a[1])*(1-np.cos(np.pi*f))/2
    return out
tt=np.arange(bt[0],bt[-1],5/60);wc=curve(WE,tt)
def step(fn):
    T=[];V=[]
    for l in open(fn):
        p=l.split()
        if len(p)==3:
            d=dt.datetime.strptime(p[0]+' '+p[1],'%d/%m/%Y %H:%M');T.append(d);V.append(float(p[2]))
    return T,V
eT,eV=step('ess_bom_20261009.txt');hT,hV=step('bom_539135_20261009.txt')
fig,ax=plt.subplots(2,1,figsize=(15,9),sharex=True,gridspec_kw=dict(height_ratios=[3,1.3]))
a=ax[0]
a.plot(todt(bt),bo-AHD,color='#1f77b4',lw=1.2,label='Bundaberg (Burnett Heads) gauge 051011A – observed (LAT−1.693 → m AHD)')
a.plot(todt(tt),wc,color='#17becf',lw=1.4,ls='--',label='Baffle Ck (Winfield) – MSQ secondary-port prediction (HW +1:05, LW +1:56; ≈AHD*)')
a.step(hT,hV,where='post',color='#2ca02c',lw=1.4,label='Euleilah Ck @ Hills Rd 539135 – observed (m AHD), ~25 km via Euleilah')
a.step(eT,eV,where='post',color='#d62728',lw=2,label='Baffle Ck @ Essendean Bridge 039267 – observed (m AHD), 35.3 km')
a.plot(eT,eV,'o',color='#d62728',ms=2.5)
for e in WE:
    if e[2]: a.axvline(todt(e[0])[0],color='#17becf',lw=0.6,alpha=0.5)
G=json.load(open('gauge_events.json'))
for r in G['Essendean']:
    if r['kind']=='HW':
        a.annotate('',xy=(todt(r['mid'])[0],r['val']+0.04),xytext=(todt(r['mid'])[0],r['val']+0.22),arrowprops=dict(arrowstyle='->',color='#d62728'))
a.set_ylabel('Water level (m AHD)');a.grid(alpha=0.3);a.legend(loc='lower left',fontsize=8.5,framealpha=0.9)
a.set_title('Baffle Creek tide propagation, 2–9 Oct 2026 (AEST). Essendean HW ≈ 5.7 h after Bundaberg HW (≈4.6 h after Winfield predicted HW); lows truncated ~0.4–0.6 m AHD')
b=ax[1]
S=json.load(open('stats.json'))
for key,col,lab in (('Essendean_HW','#d62728','Essendean HW lag'),('HillsRd_HW','#2ca02c','Hills Rd HW lag'),('HillsRd_LW','#98df8a','Hills Rd LW lag'),('Essendean_LW','#ff9896','Essendean low-plateau mid lag')):
    P=S[key]['pts'];b.errorbar(todt([p['bund_t'] for p in P]),[p['lag']/60 for p in P],yerr=[p['unc']/60 for p in P],fmt='o',color=col,label=lab,capsize=2,ms=4)
b.axhline(65/60,color='#17becf',ls='--',lw=1,label='Winfield HW +1:05 (MSQ)');b.axhline(116/60,color='#17becf',ls=':',lw=1,label='Winfield LW +1:56 (MSQ)')
b.set_ylabel('Lag after Bundaberg\nobserved extreme (h)');b.grid(alpha=0.3);b.legend(fontsize=7.5,ncol=3,loc='upper right')
b.xaxis.set_major_formatter(mdates.DateFormatter('%a %d %b\n%H:%M'))
fig.text(0.01,0.005,'Sources: MSQ/DETSI Bundaberg tide gauge (data.qld.gov.au, CC BY 4.0); BoM river heights IDQ65392 (039267, 539135; 5 cm event-reported); MSQ 2025 Semidiurnal Tidal Planes.\n*Winfield AHD approximated as LAT−1.53 (MSL-based), unverified. Error bars = half the time the gauge sat at its peak/low value. Bundaberg LAT→AHD −1.693 m (TMR).',fontsize=7.5)
plt.tight_layout(rect=(0,0.035,1,1));plt.savefig('../comparison.png',dpi=110)
print('ok')
