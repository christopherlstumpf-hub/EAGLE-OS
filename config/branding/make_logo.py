import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
FONT="/usr/share/fonts/truetype/google-fonts/ofl/archivoblack/ArchivoBlack-Regular.ttf"
ORANGE=(255,122,0)
def chrome_text(text, height):
    font=ImageFont.truetype(FONT, height)
    bbox=font.getbbox(text)
    w,h=bbox[2]-bbox[0]+40, bbox[3]-bbox[1]+40
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).text((20-bbox[0],20-bbox[1]),text,font=font,fill=255)
    # vertical chrome gradient: bright top, dark band at horizon, bright reflection, grey base
    stops=[(0.0,(250,250,252)),(0.30,(200,204,210)),(0.48,(95,98,105)),(0.52,(45,47,52)),
           (0.60,(170,174,182)),(0.80,(235,237,240)),(1.0,(140,143,150))]
    grad=Image.new("RGB",(1,h))
    top=20; bot=h-20
    for y in range(h):
        t=min(max((y-top)/max(bot-top,1),0),1)
        for i in range(len(stops)-1):
            a,ca=stops[i]; b,cb=stops[i+1]
            if a<=t<=b:
                k=(t-a)/(b-a); grad.putpixel((0,y),tuple(int(ca[j]+(cb[j]-ca[j])*k) for j in range(3))); break
    grad=grad.resize((w,h))
    # edge: dark outline + thin highlight bevel
    outline=mask.filter(ImageFilter.MaxFilter(5))
    img=Image.new("RGBA",(w,h),(0,0,0,0))
    img.paste((30,30,34,255),(0,0),outline)
    img.paste(grad,(0,0),mask)
    inner=ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3)))
    hl=Image.new("RGBA",(w,h),(255,255,255,0)); hl.putalpha(inner.point(lambda v:int(v*0.55)))
    img=Image.alpha_composite(img,hl)
    return img
def compose(size, text_h, out, underline=True):
    W,H=size
    bg=Image.new("RGBA",(W,H),(0,0,0,255))
    logo=chrome_text("EAGLE-OS",text_h)
    if logo.width>W*0.86:
        r=W*0.86/logo.width; logo=logo.resize((int(logo.width*r),int(logo.height*r)),Image.LANCZOS)
    x=(W-logo.width)//2; y=(H-logo.height)//2-int(H*0.03)
    bg.alpha_composite(logo,(x,y))
    if underline:
        lw=int(logo.width*0.5); lx=(W-lw)//2; ly=y+logo.height+max(4,H//90)
        d=ImageDraw.Draw(bg); d.rectangle([lx,ly,lx+lw,ly+max(3,H//180)],fill=ORANGE+(255,))
    bg.convert("RGB").save(out)
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
compose((1920,1080),230,f"{out}/splash-1920x1080.png")
compose((1024,768),140,f"{out}/splash-1024x768.png")
compose((640,480),90,f"{out}/splash-640x480.png")
# transparent logo for the startup animation (Plymouth)
logo=chrome_text("EAGLE-OS",200); logo.save(f"{out}/logo.png")
print("ok")
