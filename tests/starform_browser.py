#!/usr/bin/env python3
"""Offline WebGL captures and native fullscreen checks for the uploaded 2.3 merge.
Run: xvfb-run -a python tests/starform_browser.py
Images use production renderer and explicitly labeled TEST loadouts, not a new-run balance sample.
"""
from pathlib import Path
import hashlib, io, json, os, traceback
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/screenshots';OUT.mkdir(exist_ok=True)
html=(ROOT/'NeonSpud.html').read_text()
results=[];errors=[];requests=[];frames=[]
class Blocked(Exception):
    pass
def check(name,fn):
    try:
        detail=fn();results.append({'name':name,'passed':True,'detail':detail});print('PASS '+name,flush=True)
    except Blocked as e:
        results.append({'name':name,'passed':None,'status':'blocked','reason':str(e)});print('BLOCKED '+name+': '+str(e),flush=True)
    except Exception:
        results.append({'name':name,'passed':False,'error':traceback.format_exc()});print('FAIL '+name+'\n'+traceback.format_exc(),flush=True)
    (ROOT/'tests/starform-browser-report.json').write_text(json.dumps({'results':results,'errors':errors,'requests':requests},indent=2,ensure_ascii=False))
def require(value,message='condition failed'):
    if not value:raise AssertionError(message)
args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox','--disable-dev-shm-usage']
FIXTURE="""(n)=>{
 const g=game;g.start('dancer',0,23173);g.sound.enabled=false;g.sandboxGod=true;g.weapons=[];
 if(n>6){const slot=ITEMS.find(i=>i.special==='slot').id;g.items=[slot,slot];g.character={...g.character,slots:null};g.recalculate()}
 for(let i=0;i<n;i++)g.equip(66);g.cores=['echo'];g.recalculate();g.enemies=[];g.barrels=[];g.greed=[];g.rings=[];
 g.spawnTimer=1e9;g.waveDuration=22;g.player.xpNext=1e9;g.cameraDistance=18.5;g.camYaw=.28;g.camInitialized=false;g.screenShake=false;
 g.toastTimer=0;document.getElementById('toast').classList.remove('show');UI.updateLoadout();UI.update();
 let note=document.getElementById('fixture-note');if(!note){note=document.createElement('div');note.id='fixture-note';note.style.cssText='position:fixed;bottom:12px;left:18px;font:11px monospace;color:#e6ffeb;z-index:8;background:#09131dc9;padding:6px 9px;border:1px solid #476f66';document.body.append(note)}
 note.textContent='2.3.1 / '+n+'-BLADE TEST LOADOUT / NORMAL RUN STARTS WITH ONE';g.drawWorld();
}"""
RING="""()=>{for(let i=0;i<18;i++){let a=i*TAU/18+.18;let e=game.spawnEnemy(i%3?'runner':'tank',false,Math.sin(a)*3.7,Math.cos(a)*3.7,'');e.hp=e.maxHp=1e6;e.speed=0;e.damage=0;e.timer=1e9}game.grid.build(game.enemies)}"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=args)
    ctx=browser.new_context(viewport={'width':1080,'height':760},offline=True,device_scale_factor=1)
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda e:requests.append(e.url));page.evaluate('window.requestAnimationFrame=()=>0');page.set_content(html,wait_until='load')
    def native_fullscreen():
        page.locator('#fullscreen-button').click();page.wait_for_function('!!document.fullscreenElement',polling=50,timeout=6000)
        require(page.locator('#fullscreen-button').get_attribute('aria-pressed')=='true')
        require(page.evaluate('document.fullscreenElement===document.documentElement'))
        page.locator('#fullscreen-button').click();page.wait_for_function('!document.fullscreenElement',polling=50,timeout=6000)
        require(page.locator('#fullscreen-button').get_attribute('aria-pressed')=='false')
        return {'native':True,'target':'document.documentElement'}
    check('native fullscreen enters and exits from actual top-right button',native_fullscreen)
    def keyboard_fullscreen():
        page.keyboard.press('f');page.wait_for_function('!!document.fullscreenElement',polling=50,timeout=6000)
        page.evaluate('document.exitFullscreen()');page.wait_for_function('!document.fullscreenElement && document.getElementById("fullscreen-button").getAttribute("aria-pressed")==="false"',polling=50,timeout=6000)
        require(page.locator('#fullscreen-button').get_attribute('aria-pressed')=='false')
    check('F shortcut and externally initiated fullscreen exit synchronize UI',keyboard_fullscreen)
    def idle_blades():
        for n in [2,4,6,8]:
            page.evaluate(FIXTURE,n);page.evaluate('game.drawWorld()')
            ds=page.evaluate('game.drawnBlades');require(len(ds)==n)
            require(len({(round(d['x'],3),round(d['z'],3)) for d in ds})==n)
            page.screenshot(path=str(OUT/f'starform-{n}-blade-idle.png'),timeout=30000)
        return {'counts':[2,4,6,8]}
    check('actual WebGL idle captures show unique two/four/six/eight blade sockets',idle_blades)
    def six_blade_motion():
        page.evaluate(FIXTURE,6);page.evaluate(RING)
        owners=set();positions=[]
        for i in range(42):
            page.evaluate('for(let j=0;j<8;j++){game.step(1/120);game.updateEffects(1/120);game.realTime+=1/120;}game.drawWorld();UI.update()')
            ds=page.evaluate('({blades:game.drawnBlades,trails:game.meleeTrails.map(t=>t.uid),shots:game.weapons.map(w=>w.shots)})');owners.update(ds['trails']);positions.append(ds)
            png=page.screenshot(timeout=30000)
            if i==15:(OUT/'starform-six-blade-combat.png').write_bytes(png)
            im=Image.open(io.BytesIO(png)).convert('RGB').crop((200,150,870,675)).resize((670,525)).quantize(colors=112)
            frames.append(im)
        frames[0].save(OUT/'starform-six-blade-combat.gif',save_all=True,append_images=frames[1:],duration=67,loop=0,disposal=2,optimize=True)
        require(len(owners)==6,'not all six owners produced ribbons')
        require(page.evaluate('game.renderer.gl.getError()')==0)
        require(page.evaluate('game.coreMetrics.echo?.count>0'))
        return {'trailOwners':list(owners),'frames':len(frames),'lastFrame':positions[-1],'echo':page.evaluate('game.coreMetrics.echo')}
    check('six independently animated blades and core echoes render without WebGL errors',six_blade_motion)
    def legendary_capture():
        page.evaluate(FIXTURE,2)
        page.evaluate("game.weapons=[];game.equip(71);game.equip(66);UI.updateLoadout();game.drawWorld()")
        page.screenshot(path=str(OUT/'starform-legendary-orange.png'),timeout=30000)
        require(page.evaluate('game.drawnBlades[0].color===0xff922e'))
    check('legendary blade uses orange edge and ordinary blade keeps its slot accent',legendary_capture)
    def above_modal():
        page.evaluate('game.openShop();UI.settings()')
        rect=page.locator('#fullscreen-button').bounding_box();require(rect is not None)
        require(page.evaluate('(r)=>document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest("#fullscreen-button")!==null',rect))
        page.locator('#fullscreen-button').click();page.wait_for_function('!!document.fullscreenElement',polling=50,timeout=6000)
        require(page.locator('#modal-shade').is_visible())
        page.locator('#fullscreen-button').click();page.wait_for_function('!document.fullscreenElement',polling=50,timeout=6000)
        page.evaluate('UI.closeModal()')
    check('fullscreen button stays clickable above shop and modal without closing them',above_modal)
    def deny_fullscreen():
        page.evaluate("window.savedRequest=document.documentElement.requestFullscreen;document.documentElement.requestFullscreen=()=>Promise.reject(new Error('test denied'));game.joy={x:1,y:1}")
        page.locator('#fullscreen-button').click();page.wait_for_function('!UI.fullscreenBusy',polling=50,timeout=6000)
        require(page.locator('#fullscreen-button').get_attribute('aria-pressed')=='false')
        require(page.evaluate('game.joy.x===0&&game.joy.y===0'))
        require(page.locator('#toast').is_visible())
        page.evaluate('()=>{document.documentElement.requestFullscreen=window.savedRequest}')
    check('fullscreen rejection is caught and does not fake state or leave stuck movement',deny_fullscreen)
    def fx_toggle():
        page.evaluate('UI.settings()')
        before=page.evaluate('game.weaponFX')
        page.locator('[data-action="weapon-fx"]').click()
        require(page.evaluate('game.weaponFX')!=before)
        page.locator('[data-action="weapon-fx"]').click()
        require(page.evaluate('game.weaponFX')==before)
        page.evaluate('UI.closeModal()')
    check('enhanced/simple weapon effects can be toggled from settings',fx_toggle)
    ctx.close()
    def mobile_layouts():
        details=[]
        for width,height in [(320,740),(390,844),(932,430)]:
            ctx=browser.new_context(viewport={'width':width,'height':height},offline=True,is_mobile=True,has_touch=True,device_scale_factor=1)
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda e:requests.append(e.url))
            page.evaluate('window.requestAnimationFrame=()=>0');page.set_content(html,wait_until='load');page.evaluate(FIXTURE,4)
            b=page.locator('#fullscreen-button').bounding_box();require(b and b['height']>=46 and b['width']>=46)
            for sel in ['.hud-health','.wave-panel','.hud-tools']:
                r=page.locator(sel).bounding_box();overlap=max(0,min(b['x']+b['width'],r['x']+r['width'])-max(b['x'],r['x']))*max(0,min(b['y']+b['height'],r['y']+r['height'])-max(b['y'],r['y']))
                require(overlap==0,sel+' overlaps fullscreen')
            require(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            page.screenshot(path=str(OUT/f'starform-mobile-{width}x{height}.png'),timeout=30000)
            page.evaluate("game.openShop();game.cores=[];game.offers=[{kind:'core',id:'echo',price:170,sold:false}];game.player.credits=500;UI.coreDetail('echo',0)")
            foot=page.locator('.modal-foot').bounding_box();require(foot and foot['y']+foot['height']<=height+1)
            require(page.evaluate('(r)=>!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("#fullscreen-button")',b))
            page.screenshot(path=str(OUT/f'starform-mobile-settings-{width}.png'),timeout=30000)
            details.append({'viewport':[width,height],'button':b,'modalFooter':foot})
            if width==390:
                page.locator('#fullscreen-button').tap();page.wait_for_function('!!document.fullscreenElement',polling=50,timeout=6000)
                page.locator('#fullscreen-button').tap();page.wait_for_function('!document.fullscreenElement',polling=50,timeout=6000)
            ctx.close()
        return details
    check('mobile portrait/landscape HUD, modal checkout, and real touch fullscreen fit',mobile_layouts)
    def file_launch():
        ctx=browser.new_context(viewport={'width':960,'height':700},offline=True)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        try:page.goto((ROOT/'NeonSpud.html').as_uri(),wait_until='load')
        except Exception as e:
            ctx.close()
            if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(e):raise Blocked('Browser policy blocks file:// navigation; exact bundle is verified in an offline set_content context instead.')
            raise
        require(page.evaluate('!!window.game&&BALANCE.version==="2.3.1"'))
        page.locator('#start-button').click();require(page.evaluate('game.weapons.length===1&&game.state==="playing"'))
        page.locator('#fullscreen-button').click();page.wait_for_function('!!document.fullscreenElement',polling=50,timeout=6000)
        page.locator('#fullscreen-button').click();page.wait_for_function('!document.fullscreenElement',polling=50,timeout=6000)
        ctx.close();return {'protocol':'file:','offline':True,'started':True,'nativeFullscreen':True}
    check('actual local file URL starts offline and native fullscreen works',file_launch)
    browser.close()
check('no unhandled runtime errors or external resource requests',lambda: require(not errors and not requests,str(errors)+str(requests)))
report={'version':'2.3.1','bundleSHA256':hashlib.sha256((ROOT/'NeonSpud.html').read_bytes()).hexdigest(),'results':results,'errors':errors,'networkRequests':requests,'passed':sum(r['passed'] is True for r in results),'blocked':sum(r['passed'] is None for r in results),'total':len(results),'allPassed':all(r['passed'] is not False for r in results),'captureNote':'Production WebGL renderer. Six-blade labeled test loadouts, deterministic stationary targets, manually stepped simulation. Not an FPS benchmark or starting equipment.'}
(ROOT/'tests/starform-browser-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps({k:report[k] for k in ['passed','blocked','total','allPassed']},indent=2))
raise SystemExit(0 if report['allPassed'] else 1)
