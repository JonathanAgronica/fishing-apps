from PIL import Image, ImageDraw
import math
def base(size,bg1,bg2):
    im=Image.new('RGB',(size,size),bg1);d=ImageDraw.Draw(im)
    for y in range(size):
        f=y/size;c=tuple(int(bg1[i]+(bg2[i]-bg1[i])*f) for i in range(3));d.line([(0,y),(size,y)],fill=c)
    return im,d
def fish(size,path):
    im,d=base(size,(11,59,58),(59,31,22));s=size
    # body (ellipse) + tail
    d.ellipse([s*0.20,s*0.33,s*0.70,s*0.67],fill=(232,96,52))
    d.polygon([(s*0.66,s*0.5),(s*0.86,s*0.32),(s*0.86,s*0.68)],fill=(232,96,52))
    d.polygon([(s*0.35,s*0.35),(s*0.50,s*0.24),(s*0.55,s*0.36)],fill=(240,160,58))
    d.ellipse([s*0.28,s*0.43,s*0.34,s*0.49],fill=(20,20,20))
    d.arc([s*0.36,s*0.38,s*0.52,s*0.62],300,60,fill=(160,50,30),width=max(2,s//64))
    im.save(path)
def wave(size,path):
    im,d=base(size,(16,48,59),(11,59,58));s=size
    for k,(yy,col) in enumerate([(0.42,(92,200,255)),(0.58,(60,150,210)),(0.74,(40,110,170))]):
        pts=[(x, s*yy+math.sin(x/s*2*math.pi*1.5+k)*s*0.06) for x in range(0,s+1,max(1,s//64))]
        d.line(pts,fill=col,width=max(3,s//22))
    d.ellipse([s*0.66,s*0.12,s*0.84,s*0.30],fill=(240,160,58))
    im.save(path)
for n in (192,512,180):
    fish(n,f'mangrove-jack/icon-{n}.png');wave(n,f'baffle-tides/icon-{n}.png')
# landing icon: combine
for n in (192,512,180):
    a=Image.open(f'mangrove-jack/icon-{n}.png');b=Image.open(f'baffle-tides/icon-{n}.png')
    im=Image.new('RGB',(n,n));im.paste(b.crop((0,0,n,n//2)),(0,0));im.paste(a.crop((0,n//4,n,n*3//4)),(0,n//2));im.save(f'icons/icon-{n}.png')
print('ok')
