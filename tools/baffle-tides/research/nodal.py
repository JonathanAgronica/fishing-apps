import numpy as np
def node_deg(t_hours_from_2026):
    # days since J2000.0 ; 2026-01-01 00:00 AEST = 2025-12-31 14:00 UT
    d0=(np.datetime64('2025-12-31T14:00')-np.datetime64('2000-01-01T12:00'))/np.timedelta64(1,'D')
    return (125.0445-0.0529538*(d0+t_hours_from_2026/24.0))
def fu(name,t):
    N=np.radians(node_deg(t));c=np.cos;s=np.sin
    fM2=1.0004-0.0373*c(N)+0.0002*c(2*N); uM2=-2.14*s(N)
    fK1=1.0060+0.1150*c(N)-0.0088*c(2*N)+0.0006*c(3*N); uK1=-8.86*s(N)+0.68*s(2*N)-0.07*s(3*N)
    fO1=1.0089+0.1871*c(N)-0.0147*c(2*N)+0.0014*c(3*N); uO1=10.80*s(N)-1.34*s(2*N)+0.19*s(3*N)
    fK2=1.0241+0.2863*c(N)+0.0083*c(2*N)-0.0015*c(3*N); uK2=-17.74*s(N)+0.68*s(2*N)-0.04*s(3*N)
    one=np.ones_like(t);zero=np.zeros_like(t)
    tbl={'SA':(one,zero),'SSA':(one,zero),'MM':(1-0.13*c(N),zero),'MSF':(fM2,-uM2),
    'MF':(1.0429+0.4135*c(N)-0.004*c(2*N),-23.74*s(N)+2.68*s(2*N)-0.38*s(3*N)),
    '2Q1':(fO1,uO1),'Q1':(fO1,uO1),'RHO1':(fO1,uO1),'O1':(fO1,uO1),'M1':(fO1,uO1),'P1':(one,zero),'S1':(one,zero),'K1':(fK1,uK1),
    'J1':(1.0129+0.1676*c(N)-0.017*c(2*N),-12.94*s(N)+1.34*s(2*N)-0.19*s(3*N)),
    'OO1':(1.1027+0.6504*c(N)+0.0317*c(2*N)-0.0014*c(3*N),-36.68*s(N)+4.02*s(2*N)-0.57*s(3*N)),
    '2N2':(fM2,uM2),'MU2':(fM2,uM2),'N2':(fM2,uM2),'NU2':(fM2,uM2),'M2':(fM2,uM2),'LAM2':(fM2,uM2),'L2':(fM2,uM2),'T2':(one,zero),'S2':(one,zero),'R2':(one,zero),'K2':(fK2,uK2),'2SM2':(fM2,-uM2),
    'MO3':(fM2*fO1,uM2+uO1),'M3':(fM2**1.5,1.5*uM2),'MK3':(fM2*fK1,uM2+uK1),'SK3':(fK1,uK1),
    'MN4':(fM2**2,2*uM2),'M4':(fM2**2,2*uM2),'MS4':(fM2,uM2),'MK4':(fM2*fK2,uM2+uK2),'S4':(one,zero),
    '2MN6':(fM2**3,3*uM2),'M6':(fM2**3,3*uM2),'2MS6':(fM2**2,2*uM2),'2SM6':(fM2,uM2),'M8':(fM2**4,4*uM2)}
    f,u=tbl[name];return f*one,u*one
