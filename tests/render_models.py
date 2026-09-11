#!/usr/bin/env python3
"""Render genuine in-game models in a neutral contact sheet. No generated image assets."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"tests"/"screenshots";OUT.mkdir(exist_ok=True)
fonts=list(Path("/usr/share/fonts").rglob("*CJK*"))
font_path=next((str(p) for p in fonts if "Regular" in p.name),None)
def font(size):
    return ImageFont.truetype(font_path,size) if font_path else ImageFont.load_default()
records=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium"),
      headless=False,args=["--no-sandbox","--ignore-gpu-blocklist","--use-gl=angle","--disable-gpu-sandbox",
          "--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl","--disable-dev-shm-usage"])
    ctx=browser.new_context(viewport={"width":400,"height":320},device_scale_factor=1,offline=True)
    p=ctx.new_page();p.set_content((ROOT/"vibrotato.html").read_text(),wait_until="load")
    p.evaluate("""game.suspendRendering=true;game.sound.enabled=false;
      document.getElementById('menu').classList.add('hidden');document.getElementById('overlayFX').style.display='none';
      game.renderer.quality=1;window.modelFrame=(id,gray)=>{
        game.previewCharacter(id);game.state='menu';game.player.angle=.2;game.player.walk=0;
        const r=game.renderer;r.eye=[4.9,3.8,7];r.target=[0,1.5,0];r.fov=.57;r.begin();
        r.mesh('cylinder',0,.0,0,1.9,.1,1.5,0x1a2b3a);
        const realMesh=r.mesh;
        if(gray)r.mesh=function(type,x,y,z,sx,sy,sz,color,emission=0,...rest){
          return realMesh.call(this,type,x,y,z,sx,sy,sz,color===0x050c16?0x050c16:0x9ba8b6,0,...rest);
        };
        game.drawBody(r,2.2,true);r.mesh=realMesh;r.render(0,game.player,0);
        return {id,model:game.character.model,parts:Object.fromEntries(Object.entries(r.shapes).map(([k,s])=>[k,s.instances])),error:r.gl.getError()};
      };""")
    chars=p.evaluate("CHARACTERS.map(c=>({id:c.id,name:c.name,role:c.role}))")
    for gray in [False,True]:
        sheet=Image.new("RGB",(1600,1224),(8,17,27))
        draw=ImageDraw.Draw(sheet)
        draw.text((32,19),"vibrotato / 12 种战术机体" + (" · 统一灰模" if gray else " · 实际游戏模型"),font=font(28),fill=(212,238,224))
        draw.text((32,60),"相同镜头与比例。模型来自游戏几何结构，而不是角色插画。",font=font(17),fill=(137,163,170))
        for i,c in enumerate(chars):
            result=p.evaluate("([id,gray])=>modelFrame(id,gray)",[c['id'],gray])
            assert result["error"]==0,result
            if not gray:records.append(result)
            raw=p.locator("#world").screenshot()
            import io
            im=Image.open(io.BytesIO(raw)).convert("RGB")
            col,row=i%4,i//4;x,y=col*400,100+row*370
            sheet.paste(im,(x,y))
            draw.text((x+22,y+319),c["name"],font=font(22),fill=(225,238,231))
            draw.text((x+22,y+348),c["role"],font=font(14),fill=(143,168,174))
        sheet.save(OUT/("08-models-gray.png" if gray else "07-models.png"))
    browser.close()
(ROOT/"tests"/"model-render-report.json").write_text(json.dumps({"allPassed":True,"models":records,"note":"Actual production drawBody with shared renderer/camera; gray pass only substitutes material."},ensure_ascii=False,indent=2))
print("12 production model geometries rendered; all GL error codes zero.")
