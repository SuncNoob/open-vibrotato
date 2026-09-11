#!/usr/bin/env python3
"""Production regression + offline Chromium/WebGL2 UI checks.

Dependencies for development only: node, chromium, Python playwright.
Linux: xvfb-run -a python tests/verify.py
Simulation only: python tests/verify.py --simulation-only
A graphics-capable Chromium is needed. No dependencies are shipped in the game.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "tests" / "browser-report.json"
SHOTS = ROOT / "tests" / "screenshots"

def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulation-only", action="store_true")
    parser.add_argument("--skip-sim", action="store_true")
    args = parser.parse_args()
    results: list[dict] = []
    errors: list[str] = []
    requests: list[str] = []
    diagnostics = {}
    def check(name, fn):
        try:
            value = fn()
            results.append({"name": name, "passed": True, "detail": value})
            print("PASS " + name, flush=True)
        except Exception:
            results.append({"name": name, "passed": False, "error": traceback.format_exc()})
            print("FAIL " + name + "\n" + traceback.format_exc(), flush=True)
        (ROOT/"tests"/"browser-checkpoint.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    def require(condition, message="condition failed"):
        if not condition:
            raise AssertionError(message)
    def source_hashes():
        hashes = json.loads((ROOT/"tests"/"source-hashes.json").read_text())
        for rel, expected in hashes.items():
            require(hashlib.sha256((ROOT/rel).read_bytes()).hexdigest() == expected, rel)
        return hashes
    check("source files match the current release integrity baseline", source_hashes)
    def syntax():
        for rel in ("src/engine.js", "src/weapons.js", "src/game.js", "src/ui.js"):
            subprocess.run(["node", "--check", str(ROOT/rel)], check=True, capture_output=True)
        subprocess.run([sys.executable, "build.py"], cwd=ROOT, check=True, capture_output=True)
        html = (ROOT/"vibrotato.html").read_text()
        for marker in ("/*__ENGINE__*/", "/*__WEAPONS__*/", "/*__GAME__*/", "/*__UI__*/", "/*__STYLE__*/"):
            require(marker not in html, marker)
        require('<script src=' not in html.lower())
        return {"bytes": len(html.encode()), "scripts": 4}
    check("all JavaScript parses and build emits complete inline HTML", syntax)
    if not args.skip_sim:
        subprocess.run(["node", "tests/sim_checks.js"], cwd=ROOT, check=True)
    sim = json.loads((ROOT/"tests"/"simulation-report.json").read_text())
    check("production simulation contract passed", lambda: require(sim["allPassed"]))
    if args.simulation_only:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return int(not all(x["passed"] for x in results))
    from playwright.sync_api import sync_playwright
    SHOTS.mkdir(exist_ok=True)
    html=(ROOT/"vibrotato.html").read_text()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium"),
            headless=False,
            args=["--no-sandbox", "--ignore-gpu-blocklist", "--use-gl=angle",
                  "--disable-gpu-sandbox", "--use-angle=swiftshader",
                  "--enable-unsafe-swiftshader", "--enable-webgl", "--disable-dev-shm-usage",
                  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
                  "--disable-background-timer-throttling"])
        ctx=browser.new_context(viewport={"width":1440,"height":1000},device_scale_factor=1,offline=True)
        page=ctx.new_page();page.set_default_timeout(8000)
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.on("request",lambda req:requests.append(req.url))
        page.set_content(html,wait_until="load")
        page.wait_for_timeout(500)
        def ready():
            require(page.evaluate("game.state==='menu' && CHARACTERS.length===12 && CORES.length===12"))
            require(page.locator(".character-card").count()==12)
            require(page.locator("#fatal").is_hidden())
            require(page.evaluate("game.renderer.gl.getError()") == 0)
            return page.evaluate("({gl:game.renderer.gl.getParameter(game.renderer.gl.VERSION),version:BALANCE.version})")
        check("offline full artifact boots real WebGL2 and twelve-character menu",ready)
        page.screenshot(path=str(SHOTS/"01-menu.png"))
        def select_start():
            page.locator('[data-action="character"][data-id="dancer"]').click()
            require("刀" in page.locator("#character-details").inner_text())
            page.locator("#start-button").click()
            require(page.evaluate("game.state==='playing'&&game.weapons.length===1&&game.weapons[0].level===1&&game.character.id==='dancer'"))
            page.evaluate("game.sound.enabled=false;game.sandboxGod=true;game.spawnTimer=999;game.player.xpNext=999999;game.suspendRendering=true;game.resetInput();")
        check("real character click starts battle with exactly one initial weapon",select_start)
        def realtime_movement():
            page.evaluate("game.player.x=0;game.player.z=0;game.resetInput()")
            before=page.evaluate("({x:game.player.x,z:game.player.z,t:game.waveTime})")
            page.bring_to_front()
            page.keyboard.down("w")
            try:
                page.wait_for_function("Math.abs(game.player.x)+Math.abs(game.player.z)>.5",timeout=6000,polling=30)
            finally:
                page.keyboard.up("w")
            after=page.evaluate("({x:game.player.x,z:game.player.z,t:game.waveTime})")
            require(abs(after["x"]-before["x"])+abs(after["z"]-before["z"])>.3)
            require(after["t"]>before["t"])
            page.keyboard.press("Space")
            require(page.evaluate("game.player.dashCD>0"))
            page.keyboard.press("q")
            require(page.evaluate("game.player.empCD>0"))
            return {"before":before,"after":after}
        check("real animation loop, keyboard movement, dash and EMP work",realtime_movement)
        def pause_build():
            page.keyboard.press("Escape")
            require(page.evaluate("game.state==='paused'"))
            t=page.evaluate("game.waveTime");page.wait_for_timeout(150)
            require(page.evaluate("game.waveTime")==t)
            page.locator('[data-action="resume"]').click()
            require(page.evaluate("game.state==='playing'"))
            page.keyboard.press("c")
            require(page.locator(".stat-row").count()==16)
            page.locator(".stat-row summary").first.click()
            require(page.locator(".stat-row").first.get_attribute("open") is not None)
            page.keyboard.press("Escape")
            require(page.evaluate("game.state==='playing'"))
        check("pause freezes combat; sixteen source-expandable stats reopen and resume",pause_build)
        def upgrade():
            page.evaluate("game.pendingUpgrades=1;game.player.level=2;UI.openUpgrade()")
            require(page.locator(".upgrade-card").count()==3)
            require(page.locator(".upgrade-card.risky").count()>=1)
            before=page.evaluate("game.upgrades.length")
            page.keyboard.press("1")
            require(page.evaluate("game.upgrades.length")==before+1)
            require(page.evaluate("game.state==='playing'"))
        check("visible upgrade choices include a cost and keyboard selection applies",upgrade)
        def shop_setup():
            page.evaluate("""game.start('street',0,123);game.sound.enabled=false;game.suspendRendering=true;
              game.player.credits=850;game.wave=8;game.openShop();
              game.offers=[{kind:'weapon',id:0,level:1,price:50,locked:false,sold:false},
                {kind:'item',id:0,price:30,locked:false,sold:false},
                {kind:'core',id:'fusion',price:245,locked:false,sold:false},
                {kind:'core',id:'echo',price:215,locked:false,sold:false}];UI.renderShop();""")
            require(page.locator(".offer").count()==4)
        check("mixed shop renders weapons, components and orange build cores",shop_setup)
        def lock_guard():
            page.locator('[data-action="lock"][data-index="0"]').click()
            require(page.evaluate("game.offers[0].locked"))
            page.locator('[data-action="reroll"]').click()
            require(page.locator('[data-action="lock-cores"]').is_visible())
            before=page.evaluate("game.player.credits")
            page.locator('[data-action="lock-cores"]').click()
            require(page.evaluate("game.offers[2].locked&&game.offers[3].locked"))
            page.locator('[data-action="reroll"]').click()
            require(page.evaluate("game.player.credits")<before)
            require(page.evaluate("game.offers[0].price===50&&game.offers[2].id==='fusion'&&game.offers[3].id==='echo'"))
        check("real lock/reroll actions protect rare offers and charge once",lock_guard)
        def paid_merge():
            page.evaluate("while(game.weapons.length<game.slots())game.equip(0);UI.renderShop()")
            before=page.evaluate("game.player.credits")
            page.locator('[data-action="buy"][data-index="0"][data-mode="merge"]').click()
            require(page.evaluate("game.weapons.length===6&&game.weapons[0].level===2"))
            require(page.evaluate("game.player.credits")==before-50)
        check("full-slot purchase-and-merge works through shop button",paid_merge)
        def remove():
            uid=page.evaluate("game.weapons[0].uid")
            page.locator(f'.owned-weapon[data-action="weapon-owned"][data-uid="{uid}"]').click()
            page.locator('[data-action="remove"]').click()
            count=page.evaluate("game.weapons.length")
            page.locator('#modal [data-action="close"]').last.click()
            require(page.evaluate("game.weapons.length")==count)
            page.locator(f'.owned-weapon[data-action="weapon-owned"][data-uid="{uid}"]').click()
            page.locator('[data-action="remove"]').click()
            page.locator('[data-action="remove-confirm"]').click()
            require(page.evaluate("game.weapons.length")==count-1)
        check("weapon removal has explicit cancel and confirmation with slot release",remove)
        def core_checkout():
            page.locator('[data-action="offer-detail"][data-index="2"]').first.click()
            text=page.locator("#modal").inner_text()
            require("240%" in text and "触发门槛" in text and "真实代价" in text)
            require(page.locator(".condition-current").count()==1)
            before=page.evaluate("game.player.credits")
            page.locator('[data-action="core-confirm"]').click()
            require(page.evaluate("game.cores.includes('fusion')"))
            require(page.evaluate("game.player.credits")==before-245)
            require(page.evaluate("game.offers[2].sold"))
        check("core condition/payoff/cost checkout installs actual production mechanism",core_checkout)
        def replacement():
            page.evaluate("""game.cores=['fusion','blood'];game.recalculate();game.player.credits=500;UI.renderShop()""")
            page.locator('[data-action="offer-detail"][data-index="3"]').first.click()
            require(page.locator('[data-action="core-confirm"]').is_disabled())
            require(page.locator(".replacement-grid button").count()==2)
            page.locator('[data-action="core-select"][data-replace="blood"]').click()
            require(page.locator('[data-action="core-confirm"]').is_enabled())
            page.locator('[data-action="core-confirm"]').click()
            require(page.evaluate("game.cores.join(',')==='fusion,echo'&&game.player.credits===285"))
        check("third core cannot auto-overwrite; explicit chosen replacement is atomic",replacement)
        def satchel():
            page.evaluate("game.satchel=[0];UI.openSatchel()")
            before=page.evaluate("game.items.length")
            page.locator('[data-action="install-loot"]').click()
            require(page.evaluate("game.items.length")==before+1)
            require(page.evaluate("game.satchel.length===0"))
            page.locator('#modal [data-action="close"]').last.click()
            page.evaluate("game.state='playing';game.satchel=[1];UI.showGame();UI.openSatchel()")
            require(page.locator('[data-action="install-loot"]').is_disabled())
            require(page.locator('[data-action="discard-loot"]').is_disabled())
            page.locator('#modal [data-action="close"]').last.click()
        check("collected loot installs only in shop and cannot silently impose penalties",satchel)
        def details():
            page.evaluate("game.openShop();UI.openArsenal()")
            require(page.locator(".catalog-card").count()==120)
            page.locator(".search-row input").fill("太刀")
            require(0<page.locator(".catalog-card").count()<120)
            page.locator(".catalog-card").first.click()
            require("吃什么属性" in page.locator("#modal").inner_text())
            require(page.locator(".tags.big").count()==1)
            require(page.locator(".cost-box").count()==1)
            page.locator('#modal [data-action="close"]').last.click()
            page.evaluate("UI.openLibrary()")
            require(page.locator(".library-card").count()==12)
            page.locator('#modal [data-action="close"]').first.click()
        check("searchable actual weapon catalog states attack type, scaling and cost",details)
        def modal_focus():
            page.evaluate("UI.coreDetail('phase',null)")
            buttons=page.locator('#modal button:visible:not([disabled])')
            buttons.last.focus();page.keyboard.press("Tab")
            require(buttons.first.evaluate("(e)=>e===document.activeElement"))
            page.keyboard.press("Shift+Tab")
            require(buttons.last.evaluate("(e)=>e===document.activeElement"))
            page.locator('#modal [data-action="close"]').last.click()
        check("dialog keyboard tab/shift-tab keeps focus inside visible actions",modal_focus)
        def render_melee():
            page.evaluate("""game.start('dancer',0,842);game.sound.enabled=false;game.suspendRendering=true;
                game.spawnTimer=999;game.sandboxGod=true;game.player.xpNext=99999;game.cores=['echo','phase'];
                for(let i=0;i<5;i++)game.equip(66+i%2);game.recalculate();
                game.enemies=[];game.barrels=[];game.greed=[];
                for(let i=0;i<12;i++){let a=i*Math.PI*2/12;let d=i<6?3.5:6;
                  let e=game.spawnEnemy(i%3===0?'tank':'runner',false,Math.sin(a)*d,Math.cos(a)*d);
                  e.hp=e.maxHp=1200;e.speed=.3;e.damage=0}
                game.state='playing';for(let i=0;i<145;i++){game.step(1/60);game.updateEffects(1/60)}
                game.state='paused';game.suspendRendering=true;game.camInitialized=false;
                UI.showGame();game.state='paused';document.getElementById('toast').classList.remove('show');game.toastTimer=0;UI.update();game.drawWorld();""")
            page.wait_for_timeout(100)
            require(page.evaluate("game.gameStats.damage>0 && game.weapons.filter(w=>w.shots>0).length===6"))
            require(page.evaluate("game.coreMetrics.echo?.count>0"))
            require(page.evaluate("game.renderer.gl.getError()")==0)
            page.screenshot(path=str(SHOTS/"02-six-blade-combat.png"))
            return page.evaluate("({damage:game.gameStats.damage,core:game.coreMetrics.echo,shots:game.weapons.map(w=>w.shots)})")
        check("real renderer draws six independently damaging blades and triggered core",render_melee)
        def low_health():
            page.evaluate("""game.player.hp=18;game.healthTrail=.46;UI.update();
                document.querySelector('.hud-health').style.visibility='hidden';
                game.realTime=2.4;game.drawWorld();""")
            page.screenshot(path=str(SHOTS/"03-health-without-top-left.png"))
            require(page.evaluate("game.player.hp/game.player.maxHp<.25"))
            require(page.evaluate("getComputedStyle(document.querySelector('.health-bar')).height")=="16px")
            require(page.evaluate("parseFloat(getComputedStyle(document.querySelector('#health-number')).fontSize)")>=20)
            page.evaluate("document.querySelector('.hud-health').style.visibility=''")
        check("central health and low-health vignette render with top-left HUD hidden",low_health)
        def death():
            page.evaluate("""game.sandboxGod=false;game.state='playing';game.player.hp=.5;game.player.iframe=0;
              game.hurt(1,'超载改装自伤',true)""")
            require(page.evaluate("game.state==='gameover'"))
            require("超载" in page.locator("#screen").inner_text())
            require(page.locator(".death-log").count()==1)
            return page.locator(".result-reason").inner_text()
        check("actual lethal damage produces named cause and recent hit log",death)
        def resized():
            page.evaluate("game.suspendRendering=true")
            records=[]
            for w,h in [(320,740),(390,844),(932,430)]:
                page.set_viewport_size({"width":w,"height":h})
                page.evaluate("""game.start('street',0,2);game.sound.enabled=false;game.suspendRendering=true;
                    game.wave=12;game.player.credits=520;game.openShop();
                    game.offers=[{kind:'core',id:'echo',price:245,locked:false,sold:false},
                    {kind:'core',id:'fusion',price:275,locked:false,sold:false},
                    {kind:'weapon',id:71,level:4,price:490,locked:false,sold:false},
                    {kind:'item',id:0,price:62,locked:false,sold:false}];UI.renderShop()""")
                page.wait_for_timeout(50)
                require(page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
                require(page.evaluate("document.querySelector('#screen').scrollWidth<=innerWidth+1"))
                box=page.locator(".next-wave").bounding_box()
                require(box is not None and box["x"]>=0 and box["x"]+box["width"]<=w+1)
                require(box["y"]+box["height"]<=h+1)
                page.locator('[data-action="offer-detail"][data-index="1"]').first.click()
                page.wait_for_timeout(40)
                box=page.locator('[data-action="core-confirm"]').bounding_box()
                require(box is not None and box["y"]+box["height"]<=h+1)
                require(box["width"]>=100 and box["height"]>=43)
                require(page.evaluate("document.querySelector('.modal').scrollWidth<=innerWidth"))
                fonts=page.evaluate("""({reward:parseFloat(getComputedStyle(document.querySelector('.core-reward p')).fontSize),
                    cost:parseFloat(getComputedStyle(document.querySelector('.cost-box p')).fontSize)})""")
                require(fonts["reward"]>=15 and fonts["cost"]>=14)
                records.append({"viewport":[w,h],"fonts":fonts,"checkout":box})
                if w==390:page.screenshot(path=str(SHOTS/"04-mobile-core.png"))
                page.locator('#modal [data-action="close"]').first.click()
                if w==932:page.screenshot(path=str(SHOTS/"05-mobile-landscape-shop.png"))
            return records
        check("320/390 portrait and 932 landscape: no horizontal overflow, visible checkout",resized)
        ctx.close()

        # CDP touch events pass through Chromium's real pointer dispatch/capture.
        mc=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True,offline=True)
        mp=mc.new_page();mp.set_default_timeout(8000)
        mp.on("pageerror",lambda err:errors.append(str(err)))
        mp.on("request",lambda req:requests.append(req.url))
        mp.set_content(html,wait_until="load");mp.wait_for_timeout(200)
        mp.locator("#start-button").tap()
        mp.evaluate("game.sound.enabled=false;game.sandboxGod=true;game.suspendRendering=true;game.spawnTimer=999;game.player.xpNext=99999;game.resetInput();")
        cdp=mc.new_cdp_session(mp)
        def pt(i,x,y):
            return {"id":i,"x":float(x),"y":float(y),"radiusX":6,"radiusY":6,"force":1}
        def touch(kind,points):
            cdp.send("Input.dispatchTouchEvent",{"type":kind,"touchPoints":points})
            # Chromium dispatches/coalesces touch moves on its compositor frame.
            mp.wait_for_timeout(45)
        def touch_move():
            require(mp.locator("#touch-controls").is_visible())
            j=mp.locator("#joystick").bounding_box()
            x,y=j["x"]+j["width"]/2,j["y"]+j["height"]/2
            diagnostics["joycenter"]=[x,y]
            touch("touchStart",[pt(1,x,y)])
            touch("touchMove",[pt(1,x+38,y)])
            require(mp.evaluate("game.joy.x>.85 && Math.abs(game.joy.y)<.01"))
            before=mp.evaluate("({x:game.player.x,z:game.player.z})")
            mp.wait_for_timeout(180)
            after=mp.evaluate("({x:game.player.x,z:game.player.z})")
            require(abs(after["x"]-before["x"])+abs(after["z"]-before["z"])>.2)
            touch("touchMove",[pt(1,x-38,y)])
            require(mp.evaluate("game.joy.x<-.85"))
            return {"before":before,"after":after}
        check("physical touch dispatch gives immediate analog move and reverse",touch_move)
        def multi():
            x,y=diagnostics["joycenter"]
            b=mp.locator("#touch-dash").bounding_box();bx,by=b["x"]+b["width"]/2,b["y"]+b["height"]/2
            touch("touchStart",[pt(1,x-38,y),pt(2,bx,by)])
            require(mp.evaluate("game.player.dashCD>0&&game.joy.x<-.85"))
            touch("touchEnd",[pt(2,bx,by)])  # CDP end list specifies the released contacts.
            require(mp.evaluate("game.joy.x<-.85&&UI.joyPointer!==null"))
            touch("touchEnd",[])
            require(mp.evaluate("game.joy.x===0&&game.joy.y===0&&UI.joyPointer===null"))
            return {"dashCooldown":mp.evaluate("game.player.dashCD")}
        check("second finger triggers dash on press; releasing it preserves movement",multi)
        def touch_cancel():
            x,y=diagnostics["joycenter"]
            touch("touchStart",[pt(3,x,y)]);touch("touchMove",[pt(3,x,y-35)])
            require(mp.evaluate("game.joy.y<-.7"))
            touch("touchCancel",[])
            require(mp.evaluate("game.joy.y===0&&UI.joyPointer===null"))
            touch("touchStart",[pt(4,x,y)]);touch("touchMove",[pt(4,x+30,y)])
            mp.set_viewport_size({"width":932,"height":430});mp.wait_for_timeout(70)
            require(mp.evaluate("game.joy.x===0&&game.joy.y===0"))
            touch("touchEnd",[])
            mp.evaluate("game.suspendRendering=true;game.state='paused';game.camInitialized=false;UI.update();game.drawWorld()")
            mp.screenshot(path=str(SHOTS/"06-mobile-combat.png"))
        check("touch cancel and screen rotation clear captured direction",touch_cancel)
        def touch_shop_scroll():
            mp.evaluate("game.suspendRendering=true")
            mp.set_viewport_size({"width":390,"height":844})
            mp.evaluate("""game.wave=8;game.player.credits=800;game.openShop();
                game.offers=[{kind:'core',id:'fusion',price:200,locked:false,sold:false},
                  {kind:'core',id:'phase',price:210,locked:false,sold:false},
                  {kind:'weapon',id:71,level:4,price:380,locked:false,sold:false},
                  {kind:'item',id:0,price:20,locked:false,sold:false}];UI.renderShop();""")
            mp.wait_for_timeout(60)
            touch("touchStart",[pt(6,180,605)])
            for y in [555,490,415,340,265]:
                touch("touchMove",[pt(6,180,y)])
            touch("touchEnd",[])
            require(mp.evaluate("document.getElementById('screen').scrollTop>150"))
            mp.evaluate("UI.coreDetail('fusion',0)")
            touch("touchStart",[pt(7,180,580)])
            for y in [540,470,400,330,270]:
                touch("touchMove",[pt(7,180,y)])
            touch("touchEnd",[])
            require(mp.evaluate("document.querySelector('.modal-body').scrollTop>70"))
            box=mp.locator('[data-action="core-confirm"]').bounding_box()
            require(box is not None and box['y']+box['height']<=844)
            mp.locator('[data-action="core-confirm"]').tap()
            require(mp.evaluate("game.cores.includes('fusion')&&game.player.credits===600"))
        check("real finger drag scrolls mobile shop and detail; fixed checkout remains tappable",touch_shop_scroll)
        def integrity():
            require(not errors,str(errors))
            require(not requests,str(requests))
            require(mp.evaluate("game.renderer.gl.getError()")==0)
            require(mp.locator("#fatal").is_hidden())
            return {"errors":errors,"externalRequests":requests,"transport":"exact built HTML injected into offline browser; file:// launch not validated"}
        check("all interactive sessions remain error-free and perform zero network requests",integrity)
        mc.close();browser.close()
    report={"version":"2.3.0","artifactSha256":hashlib.sha256((ROOT/"vibrotato.html").read_bytes()).hexdigest(),"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
            "transport":"exact built HTML in offline Chromium; managed environment does not verify file:// launch",
            "browser":"Chromium + software ANGLE/SwiftShader under Xvfb; not physical mobile",
            "results":results,"allPassed":all(r["passed"] for r in results),"errors":errors,"requests":requests,
            "simulation":{"groups":len(sim["results"]),"assertions":sim["assertions"],"allPassed":sim["allPassed"]}}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"browserPassed":sum(r["passed"] for r in results),"total":len(results),"allPassed":report["allPassed"]},indent=2))
    return int(not report["allPassed"])

if __name__=="__main__":
    raise SystemExit(run())
