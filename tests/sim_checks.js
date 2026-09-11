/* Deterministic production-simulation checks; rendering is tested separately in verify.py.
 * Run: node tests/sim_checks.js
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const engine=fs.readFileSync(path.join(ROOT,'src/engine.js'),'utf8').split('class NeonRenderer')[0];
const weapons=fs.readFileSync(path.join(ROOT,'src/weapons.js'),'utf8'),gameCode=fs.readFileSync(path.join(ROOT,'src/game.js'),'utf8');
const stub=`
class NeonRenderer {constructor(){this.canvas={addEventListener(){}};this.gl={getError(){return 0}};this.eye=[0,0,0];this.target=[0,0,0]}project(){return [0,0,1]}mesh(){}line(){}begin(){}render(){}}
const UI={toast(){},showGame(){},resetJoystick(){},renderShop(){},showResult(){},closeModal(){},openUpgrade(){g.state='upgrade';this.choices=g.upgradeChoices()}};
`;
const dummy={classList:{contains:()=>true,add(){},remove(){},toggle(){}},style:{},getContext:()=>({}),addEventListener(){},textContent:''};
const ctx=vm.createContext({console,Math,Date,Map,Set,Array,Object,Number,String,JSON,Error,Float32Array,Uint32Array,
 window:{},document:{getElementById:()=>dummy,addEventListener(){},hidden:false},
 localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),requestAnimationFrame(){},addEventListener(){},
 innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>0},setTimeout(){},HTMLInputElement:class{},HTMLSelectElement:class{}});
const tests=String.raw`
let g=new NeonGame(),results=[],assertions=0,coverage=[];
function assert(value,message='condition failed'){assertions++;if(!value)throw Error(message)}
function close(a,b,tol=.001){assert(Math.abs(a-b)<tol,a+' != '+b)}
function check(name,fn){try{let detail=fn();results.push({name,passed:true,detail:detail??null});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.stack});console.log('FAIL '+name+' '+e.message)}}
function reset(char='street',seed=42){
 g.best.unlocked=5;g.start(char,0,seed);g.sound.enabled=false;g.sandboxGod=true;g.spawnTimer=1e9;g.waveDuration=1e9;g.player.xpNext=1e9;g.barrels=[];g.greed=[];return g;
}
function target(x=0,z=3.2,type='tank'){let e=g.spawnEnemy(type,false,x,z,'');e.hp=e.maxHp=1e7;e.speed=0;e.damage=0;e.timer=1e8;g.grid.build(g.enemies);return e}
function ringTargets(n=12,r=3.2){for(let i=0;i<n;i++){let a=i*Math.PI*2/n;target(Math.sin(a)*r,Math.cos(a)*r)}}
function tick(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){g.step(1/60);g.updateEffects(1/60)}}
check('one initial level-I weapon for all 12 characters',()=>{for(let c of CHARACTERS){reset(c.id);assert(g.weapons.length===1);assert(g.weapons[0].level===1);assert(g.weapons[0].id===c.start);assert(g.player.hp===g.player.maxHp)}return CHARACTERS.length});
check('six normal slots, at most eight, fixed specialist caps',()=>{
 reset();for(let i=0;i<5;i++)assert(g.equip(0));assert(!g.equip(0));let slot=ITEMS.find(d=>d.special==='slot').id;g.items=[slot,slot];g.recalculate();assert(g.slots()===8);assert(g.equip(0));assert(g.equip(0));assert(!g.equip(0));
 reset('lone');g.items=[slot,slot];assert(g.slots()===3);reset('sniper');assert(g.slots()===4);
});
check('character weapon restrictions are enforced by equip',()=>{for(let c of CHARACTERS.filter(c=>c.only||c.deny)){reset(c.id);let allowed=WEAPONS.filter(d=>g.characterAllows(d)),blocked=WEAPONS.filter(d=>!g.characterAllows(d));assert(allowed.length>0);for(let d of blocked)assert(!g.equip(d.id))}});
check('duplicates occupy slots until an explicit merge',()=>{reset();assert(g.equip(0));assert(g.weapons.length===2);assert(g.weapons.every(w=>w.level===1));assert(g.merge(g.weapons[0].uid,g.weapons[1].uid));assert(g.weapons.length===1&&g.weapons[0].level===2)});
check('mismatched level, model, and terminal merges rejected',()=>{
 reset();g.equip(0,2);assert(!g.merge(g.weapons[0].uid,g.weapons[1].uid));g.equip(6);assert(!g.merge(g.weapons[0].uid,g.weapons[2].uid));
 for(let d of WEAPONS.filter(d=>d.terminal)){reset();assert(g.equip(d.id));assert(g.weapons.at(-1).level===4);assert(!g.equip(d.id))}
});
check('full-slot paid merge is atomic and cannot double-charge',()=>{
 reset();for(let i=0;i<5;i++)g.equip(0);g.state='shop';g.player.credits=200;g.offers=[{kind:'weapon',id:0,level:1,price:50,sold:false}];
 assert(g.buyOffer(0,'merge').ok);assert(g.weapons.length===6);assert(g.weapons[0].level===2);assert(g.player.credits===150);
 assert(!g.buyOffer(0,'merge').ok);assert(g.player.credits===150);
});
check('paid investment survives fusion, salvage cannot use inflation',()=>{
 reset();g.equip(6,1,40);g.equip(6,1,60);let a=g.weapons[1],b=g.weapons[2];assert(g.merge(a.uid,b.uid));assert(a.paid===100);let before=g.player.credits;g.wave=19;assert(g.removeWeapon(a.uid));assert(g.player.credits-before===35);assert(!g.removeWeapon(g.weapons[0].uid));
});
check('core replacement requires explicit choice; same-name uniqueness',()=>{
 reset();g.state='shop';g.cores=['echo','quantum'];g.recalculate();g.player.credits=500;g.offers=[{kind:'core',id:'fusion',price:170,sold:false}];
 assert(!g.buyOffer(0).ok);assert(g.player.credits===500);assert(g.buyOffer(0,'equip','echo').ok);assert(g.cores.includes('fusion')&&!g.cores.includes('echo'));assert(g.cores.length===2);assert(g.player.credits===330);
 g.offers=[{kind:'core',id:'fusion',price:170,sold:false}];assert(!g.buyOffer(0,'equip','quantum').ok);
});
check('item quantity caps and hard-slot characters',()=>{
 reset();g.state='shop';g.player.credits=999;g.items=[0,0,0];g.offers=[{kind:'item',id:0,price:10,sold:false}];assert(!g.buyOffer(0).ok);
 reset('lone');g.state='shop';g.player.credits=999;g.offers=[{kind:'item',id:ITEMS.find(x=>x.special==='slot').id,price:10,sold:false}];assert(!g.buyOffer(0).ok);
});
check('lock preserves exact offer, level and price across waves',()=>{
 reset();g.openShop();let o=g.offers[0];o.locked=true;let snapshot=JSON.stringify(o);assert(g.nextWave());g.openShop();assert(JSON.stringify(g.offers[0])===snapshot);
});
check('reroll costs grow within shop and with wave; all-locked costs zero',()=>{
 reset();g.state='shop';g.player.credits=9999;g.refreshOffers();let costs=[];for(let i=0;i<4;i++){costs.push(g.rerollCost());assert(g.reroll())}
 assert(costs.every((v,i)=>i===0||v>costs[i-1]));g.wave=10;g.rerolls=0;assert(g.rerollCost()>costs[0]);
 g.offers.forEach(o=>o.locked=true);let before=g.player.credits;assert(!g.reroll());assert(g.player.credits===before);return costs;
});
check('precise matching pity on second unsuccessful weapon refresh',()=>{
 reset();g.rng=()=>.999;g.offers=[];g.refreshOffers();assert(g.misses===1);g.offers=[];g.refreshOffers();assert(g.offers.some(o=>o.kind==='weapon'&&o.id===0&&o.level===1));assert(g.misses===0);
});
check('targeted material respects existing high level before natural unlock',()=>{
 reset();g.weapons[0].level=3;g.targetUid=g.weapons[0].uid;let o=g.weaponOffer(true);assert(o.id===0&&o.level===3);assert(o.price>g.price(WEAPONS[0].price,1));
});
check('guaranteed core offers defer behind locks and never overwrite them',()=>{
 reset();g.wave=6;g.offers=Array.from({length:4},()=>({kind:'item',id:0,price:22,locked:true,sold:false}));g.refreshOffers();assert(!g.coreOfferedAt.has(6));g.offers[1].locked=false;g.refreshOffers();assert(g.offers[1].kind==='core');assert(g.offers[0].locked&&g.offers[0].id===0);
});
check('wave and luck use explicit non-uniform rarity weights',()=>{
 reset();g.wave=10;let low=g.rarityWeights();g.stats.luck=50;let high=g.rarityWeights();assert(high[4]/high.reduce((a,b)=>a+b)>low[4]/low.reduce((a,b)=>a+b));assert(new Set(low).size>1);assert(BALANCE.rarity.bands.length===4);
});
check('catalog integrity: 120 weapons, 20 families, 64 items, 12 cores',()=>{
 assert(WEAPONS.length===120);assert(new Set(WEAPONS.map(d=>d.id)).size===120);assert(FAMILY_DATA.length===20);assert(ITEMS.length===64);
 let negatives=ITEMS.filter(d=>Object.values(d.stats).some(v=>v<0)).length;assert(negatives>=32);assert(CORES.length===12);assert(new Set(CORES.map(c=>c.id)).size===12);return {negativeItems:negatives,terminals:WEAPONS.filter(d=>d.terminal).length};
});
check('600 same-family variant comparisons: no all-dimension dominance',()=>{
 let compared=0;
 const metric=d=>[d.damage,1/d.cooldown,d.range,d.pierce,d.variant===2?1:0,d.variant===4?-1:0,d.variant===5?-1:0];
 for(let f=0;f<20;f++)for(let a=0;a<6;a++)for(let b=0;b<6;b++)if(a!==b){let x=metric(WEAPONS[f*6+a]),y=metric(WEAPONS[f*6+b]);assert(!(x.every((v,i)=>v>=y[i])&&x.some((v,i)=>v>y[i])));compared++}
 return compared;
});
check('damage growth is additive, not repeated global multiplication',()=>{
 reset();g.upgrades=[0,0,0];g.recalculate();close(g.stats.damage,27);let d=g.damageFor(g.weapons[0]);close(d,WEAPONS[0].damage*1.27);
});
check('armor and dodge cap at 60%, negative armor increases damage',()=>{
 reset();close(g.armorReduction(150),.6);close(g.armorReduction(10000),.6);close(g.armorReduction(-100),-.5);g.stats.dodge=100;close(g.dodgeChance(),.6);g.stats.dodge=-20;close(g.dodgeChance(),0);
});
check('200 level-up draws: three unique options, at least one cost',()=>{
 reset();for(let i=0;i<200;i++){let ids=g.upgradeChoices();assert(ids.length===3&&new Set(ids).size===3);assert(ids.some(id=>UPGRADES[id].risky));assert(ids.every(id=>!g.upgradeHistory.slice(-6).includes(id)));g.upgradeHistory.push(ids[0])}
});
check('blood threshold, stronger payoff and healing penalty are real',()=>{
 reset();g.cores=['blood'];g.weapons=[];g.equip(66);g.player.hp=37;g.recalculate();assert(g.stats.haste===0);let high=g.damageFor(g.weapons[0]);
 g.player.hp=36;g.recalculate();assert(g.stats.haste===60);assert(g.damageFor(g.weapons[0])>high*1.3);g.player.hp=10;close(g.heal(10),6);g.updateCores(.01);assert(g.coreMetrics.blood.count===1);
});
check('vampire positive regeneration is locked, negative remains a cost',()=>{
 reset('vampire');g.upgrades=[3,3];g.recalculate();close(g.stats.regen,0);g.upgrades=[];g.items=[14];g.recalculate();assert(g.stats.regen<0);
});
check('echo: every third blade swing produces two damaging nonrecursive slashes',()=>{
 reset();g.cores=['echo'];g.weapons=[];g.equip(66);g.recalculate();ringTargets(20,2.8);g.fire(g.weapons[0]);g.fire(g.weapons[0]);assert(g.events.length===0);g.fire(g.weapons[0]);assert(g.events.filter(e=>e.kind==='slash').length===2);g.weapons[0].timer=99;tick(1);assert(g.coreMetrics.echo.count===1);assert(g.coreMetrics.echo.damage>0);return g.coreMetrics.echo;
});
check('quantum: per-weapon third shot, two missiles, global rate limit',()=>{
 reset();g.cores=['quantum'];g.recalculate();target();let w=g.weapons[0];g.fire(w);g.fire(w);assert(!g.bullets.some(b=>b.meta.core==='quantum'));g.fire(w);assert(g.bullets.filter(b=>b.meta.core==='quantum').length===2);
 g.elapsed=.1;g.fire(w);g.fire(w);g.fire(w);assert(g.bullets.filter(b=>b.meta.core==='quantum').length===2);
});
check('hive: no free companion core before three engineering weapons',()=>{
 reset();g.cores=['hive'];g.weapons=[];g.equip(90);g.equip(90);target();g.coreState.hiveTimer=0;g.updateCores(.1);assert(g.bullets.filter(b=>b.meta.core==='hive').length===0);
 g.equip(90);g.coreState.hiveTimer=0;g.updateCores(.1);assert(g.bullets.filter(b=>b.meta.core==='hive').length===2);assert(g.coreMetrics.hive.count===1);
});
check('fusion: three statuses, 240% burst, consumption and target cooldown',()=>{
 reset();g.cores=['fusion'];g.recalculate();let e=target(),o=target(1,3);e.status={fire:3,ice:3,shock:0};g.damage(e,20,{crit:0,element:'shock'});assert(g.coreMetrics.fusion.count===1);close(g.coreMetrics.fusion.damage,96);assert(Object.values(e.status).every(v=>v===0));
 e.status={fire:3,ice:3,shock:3};g.elapsed=1.1;g.damage(e,20,{crit:0});assert(g.coreMetrics.fusion.count===1);g.elapsed=3.1;g.damage(e,20,{crit:0});assert(g.coreMetrics.fusion.count===2);
 g.elapsed=7;e.status={fire:3,ice:3,shock:3};g.damage(e,20,{derived:true});assert(g.coreMetrics.fusion.count===2);
});
check('singularity requires three hits and collapse deals actual delayed damage',()=>{
 reset();g.cores=['singularity'];g.recalculate();target();g.explode(0,0,5,100,{crit:0});assert(!g.coreMetrics.singularity);
 target(1,3);target(-1,3);g.explode(0,0,5,100,{crit:0});assert(g.coreMetrics.singularity.count===1);assert(g.events.length===1);
 g.elapsed=.5;g.updateCores(.01);assert(g.coreMetrics.singularity.damage>300);return g.coreMetrics.singularity;
});
check('vault is capped, uses post-payment balance and preserves locked prices',()=>{
 reset();g.state='shop';g.cores=['vault'];g.player.credits=359;g.recalculate();assert(g.stats.damage===20);g.player.credits=360;g.recalculate();assert(g.stats.damage===24);g.player.credits=900;g.recalculate();assert(g.stats.damage===24);
 g.offers=[{kind:'item',id:0,price:620,sold:false,locked:true}];let preview=g.statSheet({items:[0],credits:280}).stats;assert(g.buyOffer(0).ok);close(g.stats.damage,preview.damage);assert(g.stats.damage===16);
});
check('salvage charges only manual pickups and discharges on primary hit',()=>{
 reset();g.cores=['salvage'];g.recalculate();g.collectGem({value:12,xp:0},false);assert(g.coreState.charge===0);g.collectGem({value:12,xp:0},true);assert(g.coreState.charge===12);
 let e=target();target(1,3);g.damage(e,10,{derived:true});assert(g.coreState.charge===12);g.damage(e,10,{crit:0});assert(g.coreState.charge===0);assert(g.coreMetrics.salvage.damage>0);
});
check('bulwark uses real enemy mitigation; self-harm cannot charge it',()=>{
 reset();g.sandboxGod=false;g.cores=['bulwark'];g.recalculate();g.stats.armor=150;g.stats.dodge=-100;
 g.hurt(50,'test contact');assert(g.coreMetrics.bulwark.count===1);close(g.player.shield,12);close(g.coreState.blocked,0);close(g.damageLog.at(-1).blocked,30);
 g.hurt(5,'self',true);close(g.coreState.blocked,0);close(g.player.shield,12);
});
check('time core has 8-second build-up, 3-second window, interrupted by damage',()=>{
 reset();g.cores=['time'];g.recalculate();g.updateCores(7.9);assert(g.coreState.timeLeft===0);g.updateCores(.1);close(g.coreState.timeLeft,3);g.updateCores(3);close(g.coreState.timeLeft,0);
 g.coreState.noHit=7;g.sandboxGod=false;g.hurt(1,'test',true);assert(g.coreState.noHit===0);
});
check('time core slows telegraph and enemy time, not wave clock or movement',()=>{
 reset();g.cores=['time'];g.coreState.timeLeft=2;g.warnings=[{type:'circle',x:15,z:15,r:1,time:2,total:2,damage:1,source:'test'}];
 let old=g.waveTime;g.step(.1);close(g.waveTime-old,.1);close(g.warnings[0].time,2-.1*BALANCE.core.time.scale);
});
check('phase requires three crossed enemies and emits three damaging strikes',()=>{
 reset();g.cores=['phase'];g.recalculate();g.lastMove={x:0,z:-1};target(0,-1.5);target(0,-3);target(0,-4.5);assert(g.dash());tick(.25);assert(g.player.dashHits.size>=3);assert(g.coreMetrics.phase.count===1);tick(.8);assert(g.coreMetrics.phase.damage>0);return g.coreMetrics.phase;
});
check('parasite rewards close elite kills, not remote kills or normal kills',()=>{
 reset();g.cores=['parasite'];g.recalculate();g.player.hp=20;let e=target(0,3);e.elite='rage';g.kill(e,{derived:true});close(g.player.hp,35);assert(g.coreState.parasite===10);assert(g.coreMetrics.parasite.count===1);
 let remote=target(0,10);remote.elite='rage';g.kill(remote,{derived:true});close(g.player.hp,35);assert(g.coreMetrics.parasite.count===1);
});
check('derived core attacks do not lifesteal or recursively trigger cores',()=>{
 reset();g.cores=['salvage','fusion'];g.recalculate();g.stats.lifesteal=80;g.player.hp=20;g.coreState.charge=24;let e=target();e.status={fire:3,ice:3,shock:3};g.damage(e,30,{derived:true,core:'echo'});close(g.player.hp,20);assert(g.coreState.charge===24);assert(!g.coreMetrics.fusion);
});
check('all 120 live weapons deal damage, including directional and deployed families',()=>{
 for(let id=0;id<120;id++){reset('street',id+88);g.weapons=[];g.equip(id);ringTargets(14,WEAPONS[id].family==='mine'?1.8:3.1);tick(4.5);let damage=g.gameStats.damage;coverage.push({id,family:WEAPONS[id].family,damage});assert(damage>0,'weapon '+id+' did not damage')}
 return {tested:coverage.length,minDamage:Math.min(...coverage.map(r=>r.damage))};
});
check('six blades have independent shot counts, targets and real hit records',()=>{
 reset();g.weapons=[];for(let i=0;i<6;i++)g.equip(66);ringTargets(25,3.1);tick(2.5);
 assert(g.weapons.every(w=>w.shots>=2));assert(new Set(g.weapons.map(w=>w.timer.toFixed(4))).size>=3);assert(g.gameStats.damage>1000);assert(g.slashes.length>0);return {damage:g.gameStats.damage,shots:g.weapons.map(w=>w.shots)};
});
check('melee does not damage behind the locked slash direction',()=>{
 reset();g.weapons=[];g.equip(66);let front=target(0,3),back=target(0,-3);g.fire(g.weapons[0]);g.weapons[0].timer=99;tick(.4);assert(front.hp<front.maxHp);assert(back.hp===back.maxHp);
});
check('deleting a weapon cleans its active slashes and deployment fields',()=>{
 reset();g.equip(66,1,30);ringTargets();let w=g.weapons[1];g.fire(w);assert(g.slashes.some(s=>s.wuid===w.uid));assert(g.removeWeapon(w.uid));assert(!g.slashes.some(s=>s.wuid===w.uid));
});
check('enemy HP follows the configured superlinear growth curve',()=>{
 reset();g.wave=10;let e=g.spawnEnemy('runner',false,10,10,'');let w=9;close(e.maxHp,ENEMY_DATA.runner[0]*(1+.28*w+.045*w**1.6));
});
check('boss has three telegraph types, second phase and arena hazards',()=>{
 reset();g.wave=20;let boss=g.spawnEnemy('boss',false,12,12,'');boss.timer=0;g.updateEnemies(.01);boss.timer=0;g.updateEnemies(.01);boss.timer=0;g.updateEnemies(.01);
 assert(['circle','line','volley'].every(t=>g.warnings.some(w=>w.type===t)));boss.hp=boss.maxHp*.49;g.updateEnemies(.01);assert(boss.phase===2);assert(g.fields.filter(f=>f.type==='danger').length===4);
});
check('charger has a wind-up before movement; shooter keeps distance',()=>{
 reset();let c=g.spawnEnemy('charger',false,10,0,'');c.timer=0;g.updateEnemies(.01);assert(c.windup>0&&!c.charge);let old=c.x;g.updateEnemies(.1);close(c.x,old,.05);
 let s=g.spawnEnemy('shooter',false,5,0,'');let x=s.x;g.updateEnemies(.2);assert(s.x>x);
});
check('elite loot is guaranteed and pickup is automatic but not auto-installed',()=>{
 reset();let e=target(0,.1);e.elite='rage';g.kill(e);assert(g.drops.length===1);g.updatePickups(.1);assert(g.satchel.length===1);assert(g.items.length===0);assert(!g.installLoot(0));g.state='shop';assert(g.installLoot(0));assert(g.items.length===1);
});
check('explosive barrels telegraph before hurting player',()=>{
 reset();g.sandboxGod=false;let b={x:0,z:0,hp:1,dead:false};g.barrels=[b];let hp=g.player.hp;g.breakBarrel(b);assert(g.warnings[0].time>.5);close(g.player.hp,hp);g.updateWarnings(.6);assert(g.player.hp<hp);assert(g.damageLog.at(-1).source.includes('爆炸桶'));
});
check('wave variations and tiered durations are configured across 20 waves',()=>{
 assert(BALANCE.waveSeconds.length===20);assert(BALANCE.waveSeconds.slice(0,5).every(v=>v<=25));assert(BALANCE.waveSeconds.slice(-5).every(v=>v>=50));assert(new Set(Object.values(WAVE_RULES)).size===5);
 return {combatSeconds:BALANCE.waveSeconds.reduce((a,b)=>a+b),bossWaves:Object.keys(WAVE_RULES).filter(k=>WAVE_RULES[k]==='boss')};
});
check('end-of-wave recovery, interest, bonus and fractional healing prices',()=>{
 reset();g.player.credits=200;g.player.hp=80;g.gems=[{value:10,xp:0}];g.completeWave();assert(g.state==='shop');close(g.ledger.recovery,6.5);assert(g.ledger.bonus===23);assert(g.ledger.interest===4);assert(g.player.hp===88);
 g.player.hp=99;assert(g.repairCost()<5);let cost=g.repairCost(),gold=g.player.credits;assert(g.repair());close(g.player.hp,100);close(gold-g.player.credits,cost);
});
check('win unlocks only the next danger level and restart stays single-weapon',()=>{
 reset();g.wave=20;g.best.unlocked=0;g.enemies=[];g.completeWave();assert(g.state==='victory');assert(g.best.unlocked===1);g.start();assert(g.weapons.length===1);
});
check('death log attributes overdrive self-harm, not an unknown enemy',()=>{
 reset();g.sandboxGod=false;g.weapons=[];g.equip(4);g.player.hp=.5;target();g.fire(g.weapons[0]);assert(g.state==='gameover');assert(g.damageLog.at(-1).source.includes('超载'));assert(g.damageLog.at(-1).self);
});
check('negative regeneration death has a readable source',()=>{
 reset();g.sandboxGod=false;g.items=[13];let neg=ITEMS.find(d=>d.stats.regen<0);g.items=[neg.id];g.player.hp=.001;g.recalculate();g.step(.1);assert(g.state==='gameover');assert(g.damageLog.at(-1).source.includes('生命回复'));
});
check('global projectile, particle and field budgets remain bounded',()=>{
 reset();for(let i=0;i<1000;i++)g.addBullet({});assert(g.bullets.length===BALANCE.performance.bullets);for(let i=0;i<100;i++)g.spark(0,0,0,0xffffff,10);assert(g.particles.length<=BALANCE.performance.particles);
});

check('overkill cannot manufacture lifesteal or negative nested damage',()=>{
 reset();g.player.hp=40;g.items=[];g.stats.lifesteal=100;let e=target();e.hp=2;
 let before=g.player.hp,actual=g.damage(e,200,{family:'pulse'});close(actual,2);close(g.player.hp-before,2);
 assert(g.damage(e,100,{derived:true,core:'fusion'})===0);
 reset();g.cores=['fusion'];g.recalculate();e=target();e.hp=1;e.status={fire:2,ice:2,shock:2};e.fusionAt=-999;
 let other=target(1,3.2);let d=g.gameStats.damage;g.damage(e,30,{family:'pulse'});
 assert(g.gameStats.damage>=d+1);assert(g.coreMetrics.fusion.damage>=0);assert(e.dead);
});
check('core-generated elite kills do not trigger parasite; ordinary DOT kills can',()=>{
 reset();g.cores=['parasite'];g.recalculate();g.player.hp=20;
 let e=target(0,2);e.elite='rage';let before=g.player.hp;g.kill(e,{derived:true,core:'echo'});
 close(g.player.hp,before);assert(!g.coreMetrics.parasite);
 e=target(0,2);e.elite='rage';g.kill(e,{derived:true});assert(g.player.hp>before);assert(g.coreMetrics.parasite.count===1);
});

const firstWave=[];
check('non-invincible first-wave movement probes, four seeds per character',()=>{
 for(let char of CHARACTERS)for(let seed=1;seed<=4;seed++){
  reset(char.id,seed);g.sandboxGod=false;g.waveDuration=BALANCE.waveSeconds[0];g.spawnTimer=.65;g.player.xpNext=BALANCE.growth.xpStart;let minHp=g.player.hp;
  for(let i=0;i<1600&&g.state!=='shop'&&g.state!=='gameover';i++){
   if(g.state==='upgrade'){let ids=UI.choices;g.selectUpgrade(ids.find(id=>!UPGRADES[id].risky)??ids[0]);continue}
   let a=i/240,tx=Math.sin(a)*8,tz=Math.cos(a)*8,dx=tx-g.player.x,dz=tz-g.player.z,len=Math.hypot(dx,dz)||1;
   g.joy={x:(Math.cos(g.camYaw)*dx-Math.sin(g.camYaw)*dz)/len,y:(Math.sin(g.camYaw)*dx+Math.cos(g.camYaw)*dz)/len};
   g.step(1/60);minHp=Math.min(minHp,g.player.hp);
  }
  firstWave.push({character:char.id,seed,survived:g.state==='shop',hp:g.player.hp,minHp,kills:g.player.kills,credits:g.player.credits,level:g.player.level});
 }
 assert(firstWave.some(x=>x.survived));return {survived:firstWave.filter(x=>x.survived).length,total:firstWave.length,minHp:Math.min(...firstWave.map(x=>x.minHp))};
});
globalThis.TEST_REPORT={version:BALANCE.version,results,assertions,allPassed:results.every(x=>x.passed),coverage,firstWave};
globalThis.CATALOG={weapons:WEAPONS,items:ITEMS,cores:CORES,characters:CHARACTERS,balance:BALANCE};
`;
vm.runInContext(engine+stub+weapons+gameCode+tests,ctx,{timeout:180000});
const report=JSON.parse(JSON.stringify(ctx.TEST_REPORT));
fs.writeFileSync(path.join(ROOT,'tests/simulation-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(ROOT,'weapon-catalog.json'),JSON.stringify(ctx.CATALOG.weapons,null,2));
fs.writeFileSync(path.join(ROOT,'item-catalog.json'),JSON.stringify({items:ctx.CATALOG.items,cores:ctx.CATALOG.cores,characters:ctx.CATALOG.characters},null,2));
console.log(JSON.stringify({passed:report.results.filter(x=>x.passed).length,total:report.results.length,assertions:report.assertions,allPassed:report.allPassed},null,2));
if(!report.allPassed)process.exitCode=1;
