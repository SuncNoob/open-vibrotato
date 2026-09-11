/* vibrotato 2.3.1 STARFORM — complete playable integration.
 * Base: uploaded Corebreak 2.3; independent blades, trails and audio ported from Crossfire 2.2.
 * engine.js and build.py are byte-identical to that upload.
 */
'use strict';
const BALANCE=Object.freeze({
 version:'2.3.1',name:'vibrotato',project:'open-vibrotato',title:'星阵交错',waves:20,
 waveSeconds:[22,22,24,24,25,35,35,38,38,40,44,44,46,48,50,52,54,56,58,60],
 player:{maxHp:100,speed:8,credits:38,pickup:3.6,crit:3,iframe:.62,dashSpeed:30,dashTime:.2,dashCooldown:2.6,empCooldown:18,empDamage:22,regen:0},
 slots:{normal:6,max:8,core:2,weaponLevel:4},armor:{denominator:100,cap:.6,negativeCap:.6,dodgeCap:.6},
 enemy:{linear:.28,power:.045,exponent:1.6,cap:150,spawnInterval:1.1,damageGrowth:.047,speedGrowth:.008},
 danger:[
  {hp:1,count:1,speed:1,elite:.002},{hp:1.12,count:1.1,speed:1.03,elite:.008},
  {hp:1.25,count:1.2,speed:1.06,elite:.014},{hp:1.4,count:1.3,speed:1.09,elite:.02},
  {hp:1.57,count:1.4,speed:1.12,elite:.028},{hp:1.78,count:1.55,speed:1.15,elite:.036}
 ],
 rarity:{bands:[{wave:1,weights:[78,17,4,1,0]},{wave:5,weights:[62,24,10,3.5,.5]},
  {wave:10,weights:[45,29,17,7,2]},{wave:15,weights:[32,30,23,11,4]}],luck:[0,.18,.5,.9,1.3]},
 shop:{baseInflation:.052,quadratic:.0035,inflationCap:3.8,levelPrice:2.1,terminalPrice:4.8,
  matchChance:.68,specialistChance:.65,pity:2,rerollBase:9,rerollWave:2,rerollLinear:10,rerollSquare:5,
  sellFraction:.35,bonusBase:20,bonusWave:3,interest:.02,interestCap:8,uncollected:.65,
  levelUnlock:[1,4,9,15],levelWeights:[[100,0,0,0],[72,28,0,0],[52,34,14,0],[40,32,22,6]],
  terminalWave:8,terminalChance:.03,coreWave:5,coreChance:.018,coreWaveGrowth:.0017,
  coreLuckGrowth:.00010,coreChanceCap:.12,coreGuarantee:[6,12,18],healPerHp:.8},
 growth:{levelDamage:.4,xpStart:22,xpPower:1.12,hasteMin:.25,hasteMax:4,damageFloor:.08,lifestealCap:.12},
 melee:{windup:.07,sweep:.15,recovery:.13,arc:2.62,heavyArc:3.0,third:1.3,hitLimit:4,hitstop:.034,critstop:.05,stopInterval:.22,
  launchGap:.045,initialStagger:.085,socketRadius:.98,sectorWeight:1.25,
  trailLife:.12,trailLimit:90,mobileTrailLimit:36,trailSegments:5,
  palette:[0xe79bff,0x66e7ef,0xff74b5,0x9aa3ff,0x9bf2d2,0xe3bdff,0xffafcd,0x72c8ff]},
 visuals:{bloom:1.12,bladeGlow:2.05,bulletTrails:100,mobileBulletTrails:36,impactLife:.12},
 sets:{thresholds:[2,4,6],bladeKills:10,element2:15,engineeringCrit:.5},
 core:{
  blood:{threshold:.4,haste:60,melee:35,healing:.6},
  echo:{every:3,ratio:.7,cd:.28,delay:.17,maxTargets:3},
  quantum:{every:3,ratio:.6,cd:.24},
  hive:{needed:3,count:2,interval:.65,ratio:.65},
  fusion:{ratio:2.4,floor:18,radius:4.8,cd:1,targetCD:3},
  singularity:{needed:3,penalty:.8,ratio:1.4,delay:.42,cd:1.1},
  vault:{step:60,damage:4,max:24,price:1.08},
  salvage:{charge:12,max:24,ratio:1.25,targets:5,cd:.8},
  bulwark:{charge:30,base:35,armorRatio:1.4,maxDamage:180,shield:12,shieldCap:24,cd:.8,radius:5.2},
  time:{wait:8,duration:3,scale:.45},
  phase:{needed:3,distance:1.8,ratio:1.1,cooldown:.7},
  parasite:{heal:.2,haste:35,duration:10,radius:4,received:1.15}
 },
 performance:{bullets:720,particles:260,fields:70,numbers:60,mobileFPS:30,menuFPS:24,panelFPS:10},health:{delayed:.4,warning:.5,critical:.25}
});
const DIRECT_FAMILIES=new Set(['pulse','scatter','gatling','rail','laser','rocket','seeker','plasma','tesla','flame','cryo','boomerang','acid','storm','nova']);
const ENEMY_DATA={
 runner:[18,2.75,.46,8,0xf55b7a,'追猎者'],skitter:[12,3.65,.35,6,0xf5b35f,'包抄蜂'],
 tank:[65,1.55,.78,13,0xa681e0,'重甲卫士'],shooter:[28,1.8,.52,8,0xff8e6d,'远程哨兵'],
 splitter:[40,2.35,.59,9,0x97d47b,'裂变体'],charger:[44,2.1,.59,11,0xff5e68,'冲锋兵'],
 bomber:[22,3.4,.44,14,0xffab65,'自爆机'],boss:[420,1.1,1.7,19,0xff657f,'执法核心']
};
const WAVE_RULES={4:'tide',7:'elite',10:'boss',11:'barrage',14:'blackout',17:'tide',18:'elite',20:'boss'};
const RULE_NAMES={normal:'街区清扫',tide:'潮汐：60 只脆皮',elite:'精英：三重威胁',barrage:'弹幕：远程封锁',blackout:'断电：近身视野',boss:'首领：执法协议'};
function seeded(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function weighted(values,weights,rng=Math.random){let total=weights.reduce((a,b)=>a+Math.max(0,b),0),r=rng()*total;for(let i=0;i<values.length;i++){r-=Math.max(0,weights[i]);if(r<0)return values[i]}return values[values.length-1]}
function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
function segmentDistance(x,z,ax,az,bx,bz){let dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-ax-dx*t,z-az-dz*t)}
class AudioBus{
 constructor(){this.ctx=null;this.enabled=true;this.last=0;this.beat=0;this.step=0;this.heart=0}
 init(){try{if(!this.ctx){let c=this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=c.createGain();this.master.gain.value=.16;this.master.connect(c.destination);this.musicFilter=c.createBiquadFilter();this.musicFilter.type='lowpass';this.musicFilter.frequency.value=6000;this.musicFilter.connect(this.master)}if(this.ctx.state==='suspended')this.ctx.resume()}catch(e){this.enabled=false}}
 tone(freq,duration=.08,type='sine',vol=.1,end=0,music=false){if(!this.enabled||!this.ctx)return;let c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(music?this.musicFilter:this.master);o.start(t);o.stop(t+duration+.01)}
 shot(f){if(!this.ctx||this.ctx.currentTime-this.last<.07)return;this.last=this.ctx.currentTime;let melee=f==='blade';this.tone(melee?380:180,melee?.09:.05,melee?'triangle':'sawtooth',.07,melee?80:50)}
 meleeSwing(slot,heavy=false){
  if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime;
  if(t-(this.lastSwish||-1)<.025)return;this.lastSwish=t;
  if(!this.slashNoise){const frames=Math.floor(c.sampleRate*.22),buffer=c.createBuffer(1,frames,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1);this.slashNoise=buffer;}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.slashNoise;
  filter.type='bandpass';filter.Q.value=.6;filter.frequency.setValueAtTime(heavy?800:2600,t);filter.frequency.exponentialRampToValueAtTime(180,t+.12);
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(heavy?.16:.11,t+.018);gain.gain.exponentialRampToValueAtTime(.001,t+.14);
  source.connect(filter);filter.connect(gain);
  if(c.createStereoPanner){const pan=c.createStereoPanner();pan.pan.value=(slot%2?1:-1)*.45;gain.connect(pan);pan.connect(this.master);}else gain.connect(this.master);
  source.start(t);source.stop(t+.16);
 }
 meleeImpact(slot,crit=false,heavy=false){
  if(!this.enabled||!this.ctx)return;let t=this.ctx.currentTime;if(t-(this.lastSlice||-1)<.035)return;this.lastSlice=t;
  this.tone(heavy?105:180,.08,'triangle',crit?.24:.16,38);this.tone(crit?2200:1450,.055,'sine',.09,380);
 }
 impact(crit=false){this.tone(crit?230:120,.065,'triangle',crit?.2:.1,35);if(crit)this.tone(930,.08,'sine',.09,380)}
 hit(){this.tone(80,.2,'sawtooth',.2,30)}
 pick(){this.tone(1050,.035,'sine',.045,1600)}
 level(){[440,554,660].forEach((f,i)=>setTimeout(()=>this.tone(f,.18,'sine',.13),i*60))}
 update(dt,hp=1){if(!this.ctx||!this.enabled)return;this.musicFilter.frequency.setTargetAtTime(hp<.25?430:hp<.5?1400:6500,this.ctx.currentTime,.2);this.beat-=dt;this.heart-=dt;if(this.beat<=0){this.beat+=.3;this.tone([55,55,82.4,65.4][this.step%4],.16,'triangle',.07,0,true);if(this.step++%2===0)this.tone(110,.14,'sine',.17,32,true)}if(hp<.25&&this.heart<=0){this.heart=.72;this.tone(62,.12,'sine',.4,35);setTimeout(()=>this.tone(56,.1,'sine',.25,30),120)}}
}
class SpatialHash{
 constructor(size=4){this.size=size;this.cells=new Map()}
 build(enemies){this.cells.clear();for(let e of enemies)if(!e.dead){let k=Math.floor(e.x/this.size)+','+Math.floor(e.z/this.size);if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(e)}}
 near(x,z,r){let out=[];for(let i=Math.floor((x-r)/this.size);i<=Math.floor((x+r)/this.size);i++)for(let j=Math.floor((z-r)/this.size);j<=Math.floor((z+r)/this.size);j++){let a=this.cells.get(i+','+j);if(a)out.push(...a)}return out}
}
function makeCity(){let s=49218;const r=(a,b)=>{s=(s*1664525+1013904223)>>>0;return a+s/4294967296*(b-a)};let buildings=[],props=[],marks=[];for(let i=0;i<78;i++){let side=i%4,x,z,w=r(3,6.7),d=r(3,6.5),h=r(8,26);if(side===0){x=r(-58,58);z=r(-58,-29)}if(side===1){x=r(-57,-30);z=r(-27,40)}if(side===2){x=r(30,57);z=r(-30,38)}if(side===3){x=r(-57,57);z=r(34,66);h=r(2,6)}buildings.push({x,z,w,d,h,col:i%3===0?0x101e32:0x142b3c,neon:[0x33c4c2,0xb154bb,0x6587df,0xd5b779][i%4],seed:r(0,9)})}for(let i=0;i<12;i++){let a=TAU*i/12,rr=i%3===0?17.5:19.3;props.push({x:Math.sin(a)*rr,z:Math.cos(a)*rr,rot:a,color:i%2?0x254456:0x394553,type:i%3})}for(let i=0;i<90;i++)marks.push({x:r(-20,20),z:r(-20,20),w:r(.15,.9),c:i%3?0x254b54:0x655e39});return{buildings,props,marks}}
const CITY=makeCity();

class VibrotatoGame{
 constructor(){
  this.renderer=new VibrotatoRenderer(document.getElementById('world'));this.fxCanvas=document.getElementById('overlayFX');this.fx=this.fxCanvas.getContext('2d');
  this.sound=new AudioBus();this.grid=new SpatialHash();this.keys=new Set();this.joy={x:0,y:0};this.pointer={x:0,y:0,down:false};this.lastMove={x:0,z:-1};
  this.touch=matchMedia('(pointer:coarse)').matches;this.visualQuality=!this.touch;this.renderer.quality=this.touch?.85:1;this.renderer.bloom=BALANCE.visuals.bloom;this.weaponFX=true;
  this.rain=false;this.screenShake=true;this.damageNumbers=true;this.autoAim=true;this.state='menu';this.realTime=0;this.elapsed=0;this.frame=0;this.lastTime=performance.now();this.camYaw=.36;this.cameraDistance=26;
  this.best={wave:0,kills:0,unlocked:0};try{Object.assign(this.best,JSON.parse(localStorage.getItem('neon-spud-corebreak'))||{});this.sound.enabled=localStorage.getItem('neon-spud-muted')!=='1'}catch(e){}
  this.character=CHARACTERS[0];this.danger=0;this.seed=Date.now()>>>0;this.rng=seeded(this.seed);this.initRun();
  this.equip(this.character.start,1,0);this.bindInput();this.loop=this.loop.bind(this);requestAnimationFrame(this.loop);
 }
 initRun(){
  const b=BALANCE.player;this.player={x:0,z:0,hp:b.maxHp,maxHp:b.maxHp,credits:this.character.credits??b.credits,kills:0,level:1,xp:0,xpNext:BALANCE.growth.xpStart,angle:0,walk:0,iframe:0,dashCD:0,dashTime:0,empCD:0,shield:0};
  this.weapons=[];this.items=[];this.cores=[];this.upgrades=[];this.satchel=[];this.sources=[];this.tags={};this.uid=1;this.nextMeleeLaunch=0;this.drawnBlades=[];
  for(let key of ['enemies','bullets','fields','particles','beams','rings','gems','numbers','slashes','warnings','drops','barrels','greed','events','meleeTrails','impactCuts'])this[key]=[];
  this.coreState={counts:{},last:{},charge:0,blocked:0,noHit:0,timeLeft:0,parasite:0,hiveTimer:0,bladeKills:0,heavyHits:0};
  this.coreMetrics={};this.damageLog=[];this.gameStats={damage:0,shots:0,purchases:0,coreDamage:0};this.ledger={pickup:0,recovery:0,bonus:0,interest:0,salvage:0,spent:0};
  this.offers=[];this.rerolls=0;this.misses=0;this.targetUid=null;this.coreOfferedAt=new Set();this.upgradeHistory=[];this.pendingLevels=0;this.postUpgrade='playing';
  this.wave=1;this.waveTime=0;this.waveDuration=BALANCE.waveSeconds[0];this.waveRule='normal';this.elapsed=0;this.totalTime=0;
  this.spawnTimer=.65;this.bossSpawned=false;this.completedWave=false;this.enemyId=1;this.shake=0;this.damageFlash=0;this.healthTrail=1;this.trailHold=0;this.hitstop=0;this.lastHitstop=-1;this.toastTimer=0;this.uiTick=0;this.sandboxGod=false;
  this.recalculate();this.player.hp=this.player.maxHp;this.healthTrail=1;this.resetInput();
 }
 has(id){return this.cores.includes(id)}
 core(id){return CORES.find(c=>c.id===id)}
 characterAllows(d){return !!d&&(!this.character.only||d.tags.includes(this.character.only))&&(!this.character.deny||!d.tags.includes(this.character.deny))}
 slots(){return this.character.slots||Math.min(BALANCE.slots.max,BALANCE.slots.normal+this.items.filter(id=>ITEMS[id].special==='slot').length)}
 statSheet(overrides={}){
  const items=overrides.items??this.items,cores=overrides.cores??this.cores,credits=overrides.credits??this.player.credits;
  let stats=Object.fromEntries(Object.keys(STAT_INFO).map(k=>[k,0]));stats.maxHp=BALANCE.player.maxHp;stats.crit=BALANCE.player.crit;
  let sources=[{name:'基础',stats:{maxHp:stats.maxHp,crit:stats.crit}}],add=(name,values)=>{for(let [k,v]of Object.entries(values))stats[k]=(stats[k]||0)+v;sources.push({name,stats:values})};
  add(this.character.name,this.character.stats);
  items.forEach(id=>add(ITEMS[id].name,ITEMS[id].stats));this.upgrades.forEach(id=>add('升级 · '+UPGRADES[id].name,UPGRADES[id].stats));
  cores.forEach(id=>add(this.core(id).name,this.core(id).stats));
  if(this.tags['刀刃']>=2)add('刀刃 ×2',{crit:8});if(this.tags['精准']>=2)add('精准 ×2',{crit:5});
  if(this.tags['重型']>=2)add('重型 ×2',{maxHp:15});if(this.tags['近战']>=2)add('近战 ×2',{melee:3});
  if(this.tags['远程']>=2)add('远程 ×2',{range:10});if(this.tags['支援']>=2)add('支援 ×2',{pickup:25});
  if(cores.includes('vault'))add('金库 · 余额 '+Math.floor(credits),{damage:Math.min(BALANCE.core.vault.max,Math.floor(credits/BALANCE.core.vault.step)*BALANCE.core.vault.damage)});
  if(cores.includes('blood')&&this.player.hp/Math.max(1,stats.maxHp)<=BALANCE.core.blood.threshold)add('猩红 · 残血激活',{haste:BALANCE.core.blood.haste});
  if(cores.includes('parasite')&&this.coreState.parasite>0)add('寄生 · 猎杀奖励',{haste:BALANCE.core.parasite.haste});
  if(this.character.id==='vampire'&&stats.regen>0){add('吸血鬼 · 回复锁定',{regen:-stats.regen})}
  return {stats,sources};
 }
 recalculate(){
  this.tags={};for(let w of this.weapons)for(let tag of w.def.tags)this.tags[tag]=(this.tags[tag]||0)+1;
  let sheet=this.statSheet();this.stats=sheet.stats;this.sources=sheet.sources;this.player.maxHp=Math.max(1,this.stats.maxHp);this.player.hp=Math.min(this.player.hp,this.player.maxHp);
 }
 armorReduction(a=this.stats.armor){return a>=0?Math.min(BALANCE.armor.cap,a/(a+BALANCE.armor.denominator)):Math.max(-BALANCE.armor.negativeCap,a/(BALANCE.armor.denominator-a))}
 dodgeChance(){return clamp(this.stats.dodge/100,0,BALANCE.armor.dodgeCap)}
 damageFor(w){
  let d=w.def,s=this.stats,bonus=s.damage,flat=s[d.stat]*d.scaling;
  if(this.character.id==='lone')bonus+=60;
  if(this.character.spec&&d.tags.includes(this.character.spec))bonus+=this.character.bonus;
  if(this.character.id==='engineer')bonus+=d.tags.includes('工程')?65:DIRECT_FAMILIES.has(d.family)?-30:0;
  if(this.has('hive')&&!d.tags.includes('工程')&&DIRECT_FAMILIES.has(d.family))bonus-=35;
  if(d.tags.includes('元素')&&this.tags['元素']>=2)bonus+=BALANCE.sets.element2;
  if(this.has('blood')&&this.player.hp/this.player.maxHp<=BALANCE.core.blood.threshold&&d.tags.includes('近战'))bonus+=BALANCE.core.blood.melee;
  return Math.max(.3,d.damage+flat)*(1+(w.level-1)*BALANCE.growth.levelDamage)*Math.max(BALANCE.growth.damageFloor,1+bonus/100);
 }
 cooldownFor(w){return w.def.cooldown/clamp(1+this.stats.haste/100,BALANCE.growth.hasteMin,BALANCE.growth.hasteMax)}
 rangeFor(w){return w.def.range*clamp(1+this.stats.range/100,.35,2.1)*(w.def.family==='blade'&&this.tags['近战']>=4&&this.player.afterDash>0?1.25:1)}
 metaFor(w,extra={}){let deploy=w.def.tags.includes('工程');return Object.assign({wuid:w.uid,family:w.def.family,tags:w.def.tags,color:w.def.color,crit:deploy?(this.tags['工程']>=4?this.stats.crit*.5:0):this.stats.crit,knock:w.def.variant===2?5:0,derived:false},extra)}
 equip(id,level=1,paid=0){
  let d=WEAPONS[id];if(!this.characterAllows(d)||this.weapons.length>=this.slots()||d.terminal&&this.weapons.some(w=>w.id===id))return false;
  this.weapons.push({uid:this.uid++,id,def:d,level:d.terminal?4:clamp(level,1,4),paid,timer:.08+this.weapons.length*BALANCE.melee.initialStagger,recoil:0,index:this.weapons.length,aim:0,shots:0,combo:0});
  this.recalculate();return true;
 }
 clearBladeEffects(uid){
  this.slashes=this.slashes.filter(s=>s.wuid!==uid);
  this.meleeTrails=this.meleeTrails.filter(s=>s.uid!==uid);
  this.events=this.events.filter(e=>e.owner!==uid);
 }
 removeWeapon(uid){
  if(this.weapons.length<=1)return false;let idx=this.weapons.findIndex(w=>w.uid===uid);if(idx<0)return false;
  let w=this.weapons[idx],credit=Math.floor(w.paid*BALANCE.shop.sellFraction);this.player.credits+=credit;this.ledger.salvage+=credit;this.weapons.splice(idx,1);
  this.clearBladeEffects(uid);this.fields=this.fields.filter(f=>f.wuid!==uid);this.weapons.forEach((v,i)=>v.index=i);
  if(this.targetUid===uid)this.targetUid=null;this.recalculate();return true;
 }
 merge(aid,bid){
  let a=this.weapons.find(w=>w.uid===aid),b=this.weapons.find(w=>w.uid===bid);
  if(!a||!b||a===b||a.id!==b.id||a.level!==b.level||a.def.terminal||a.level>=4)return false;
  a.level++;a.paid+=b.paid;this.weapons=this.weapons.filter(w=>w!==b);this.clearBladeEffects(b.uid);
  if(this.targetUid===b.uid)this.targetUid=a.uid;this.weapons.forEach((w,i)=>w.index=i);this.recalculate();return true;
 }
 start(characterId=this.character.id,danger=this.danger,seed=null){
  this.character=CHARACTERS.find(c=>c.id===characterId)||CHARACTERS[0];this.danger=clamp(danger,0,this.best.unlocked||0);
  this.seed=seed??(Date.now()>>>0);this.rng=seeded(this.seed);this.initRun();this.equip(this.character.start,1,0);this.player.hp=this.player.maxHp;
  this.state='playing';this.camInitialized=false;this.sound.init();this.setupWave();if(typeof UI!=='undefined'){UI.showGame();UI.toast('第 01 波 · 单武器起步','移动走位 · 自动攻击 · 留意素材')}
 }
 previewCharacter(id){this.character=CHARACTERS.find(c=>c.id===id)||CHARACTERS[0];this.initRun();this.equip(this.character.start,1,0);this.player.hp=this.player.maxHp;this.camInitialized=false}
 resetInput(){this.keys?.clear();this.joy={x:0,y:0};if(this.pointer)this.pointer.down=false;if(typeof UI!=='undefined'&&UI.resetJoystick)UI.resetJoystick()}
 bindInput(){
  addEventListener('keydown',e=>{
   if(e.code==='Tab'&&!document.getElementById('modal-shade')?.classList.contains('hidden'))return;
   if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
   if(e.code==='Tab'||this.state==='playing'&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
   this.keys.add(e.code);if(e.repeat)return;
   if(e.code==='Escape'){UI.escape();return}
   if(e.code==='KeyC'||e.code==='Tab'){UI.openBuild();return}
   if(e.code==='KeyM'){UI.toggleSound();return}
   if(this.state==='upgrade'&&['Digit1','Digit2','Digit3'].includes(e.code)){UI.selectUpgrade(Number(e.code.slice(-1))-1);return}
   if(this.state==='playing'){if(e.code==='Space'||e.code==='ShiftLeft')this.dash();if(e.code==='KeyQ')this.emp();if(e.code==='KeyE')UI.openSatchel()}
  });
  addEventListener('keyup',e=>this.keys.delete(e.code));
  const lose=()=>{this.resetInput();if(this.state==='playing')UI.pause()};addEventListener('blur',lose);document.addEventListener('visibilitychange',()=>{if(document.hidden)lose()});
  addEventListener('resize',()=>{this.resetInput();this.camInitialized=false});
  const canvas=this.renderer.canvas;canvas.addEventListener('pointermove',e=>{this.pointer.x=e.clientX;this.pointer.y=e.clientY});
  canvas.addEventListener('wheel',e=>{if(this.state==='playing'){e.preventDefault();this.cameraDistance=clamp(this.cameraDistance+e.deltaY*.01,20,36)}},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.state='error';UI.fatal('图形上下文丢失，请重新载入游戏。')});
 }
 movePlayer(dt){
  const p=this.player;let ix=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.joy.x;
  let iz=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)+this.joy.y,mag=Math.hypot(ix,iz);
  if(mag>1){ix/=mag;iz/=mag}let mx=Math.cos(this.camYaw)*ix+Math.sin(this.camYaw)*iz,mz=-Math.sin(this.camYaw)*ix+Math.cos(this.camYaw)*iz;
  if(mag>.02){let len=Math.hypot(mx,mz);this.lastMove={x:mx/len,z:mz/len};p.walk+=dt*12}
  if(p.dashTime>0){
   let ax=p.x,az=p.z;p.dashTime=Math.max(0,p.dashTime-dt);p.x+=p.dashX*BALANCE.player.dashSpeed*dt;p.z+=p.dashZ*BALANCE.player.dashSpeed*dt;
   if(this.has('phase'))for(let e of this.enemies)if(!e.dead&&segmentDistance(e.x,e.z,ax,az,p.x,p.z)<BALANCE.core.phase.distance+e.radius)p.dashHits.add(e.id);
   this.spark(p.x,.8,p.z,0x81e9da,1,1);
   if(p.dashTime===0){p.afterDash=1;if(this.character.id==='dancer')for(let w of this.weapons)if(w.def.family==='blade')w.timer=Math.min(w.timer,.08+w.index*.05);this.finishDash()}
  }else{
   let speed=BALANCE.player.speed*clamp(1+this.stats.speed/100,.35,1.9);
   if(this.weapons.some(w=>w.def.variant===5&&w.timer>0))speed*=.9;p.x+=mx*speed*dt;p.z+=mz*speed*dt;
  }
  p.x=clamp(p.x,-20.3,20.3);p.z=clamp(p.z,-20.3,20.3);
  let target=this.nearest(p.x,p.z,22);if(target)p.angle=Math.atan2(target.x-p.x,target.z-p.z);else if(mag>.02)p.angle=Math.atan2(mx,mz);
 }
 dash(){
  let p=this.player;if(this.state!=='playing'||p.dashCD>0)return false;
  let ix=this.joy.x+((this.keys.has('KeyD')||this.keys.has('ArrowRight'))?1:0)-((this.keys.has('KeyA')||this.keys.has('ArrowLeft'))?1:0),iz=this.joy.y+((this.keys.has('KeyS')||this.keys.has('ArrowDown'))?1:0)-((this.keys.has('KeyW')||this.keys.has('ArrowUp'))?1:0);
  if(Math.hypot(ix,iz)>.05){let mx=Math.cos(this.camYaw)*ix+Math.sin(this.camYaw)*iz,mz=-Math.sin(this.camYaw)*ix+Math.cos(this.camYaw)*iz,l=Math.hypot(mx,mz);this.lastMove={x:mx/l,z:mz/l}}
  p.dashCD=BALANCE.player.dashCooldown+(this.has('phase')?BALANCE.core.phase.cooldown:0);p.dashTime=BALANCE.player.dashTime;p.iframe=Math.max(p.iframe,.28);
  p.dashX=this.lastMove.x;p.dashZ=this.lastMove.z;p.dashStart={x:p.x,z:p.z};p.dashHits=new Set();this.sound.tone(150,.13,'triangle',.14,680);return true;
 }
 finishDash(){
  const p=this.player;if(!this.has('phase')||p.dashHits.size<BALANCE.core.phase.needed)return;
  const damage=Math.max(...this.weapons.map(w=>this.damageFor(w)),10)*BALANCE.core.phase.ratio;
  for(let i=0;i<3;i++){let t=(i+.5)/3;this.events.push({at:this.elapsed+.10*i,kind:'slash',x:mix(p.dashStart.x,p.x,t),z:mix(p.dashStart.z,p.z,t),a:Math.atan2(p.dashX,p.dashZ)+(i%2?.9:-.9),damage,core:'phase',range:4.3})}
  this.proc('phase');
 }
 emp(){
  let p=this.player;if(this.state!=='playing'||p.empCD>0)return false;p.empCD=BALANCE.player.empCooldown;p.iframe=Math.max(p.iframe,.3);this.ring(p.x,p.z,11,0xace1b7,.5);
  for(let e of this.enemies)if(!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<11){this.damage(e,BALANCE.player.empDamage*(1+this.wave*.07),{derived:true,color:0xacffc9});e.slow=2.5;let a=Math.atan2(e.x-p.x,e.z-p.z);e.vx+=Math.sin(a)*8;e.vz+=Math.cos(a)*8}
  this.bullets=this.bullets.filter(b=>!b.enemy);if(this.tags['支援']>=6){this.warnings=this.warnings.filter(t=>t.boss);this.heal(5)}
  this.sound.tone(90,.4,'sine',.25,28);return true;
 }
 nearest(x,z,range=100,skip=null){
  let best=null,min=range*range;for(let e of this.enemies){if(e.dead||(skip&&skip.has(e.id)))continue;let d=(e.x-x)**2+(e.z-z)**2;if(d<min){min=d;best=e}}return best;
 }
 // Stable radial lanes are independent of model ID, facing and target direction.
 bladeHome(w){
  const blades=this.weapons.filter(v=>v.def.family==='blade'),index=Math.max(0,blades.indexOf(w)),n=Math.max(1,blades.length);
  return {a:.18+TAU*index/n,index,n,r:BALANCE.melee.socketRadius,y:.94+(index%3)*.36};
 }
 bladeColor(w){return w.def.rarity===4||w.def.variant===5?0xff922e:BALANCE.melee.palette[this.bladeHome(w).index%BALANCE.melee.palette.length]}
 slashOrigin(s){
  const x=s.follow||s.x===undefined?this.player.x:s.x,z=s.follow||s.z===undefined?this.player.z:s.z;
  const r=s.socketA===undefined?0:BALANCE.melee.socketRadius;
  return {x:x+Math.sin(s.socketA||0)*r,z:z+Math.cos(s.socketA||0)*r,cx:x,cz:z};
 }
 bladeReach(s,a){
  // Intersect the visible ray with the ORIGINAL player-centered reach circle.
  // Offset grips improve separation without extending the damage range.
  const r=s.socketA===undefined?0:BALANCE.melee.socketRadius,dot=r*Math.cos(a-(s.socketA||0));
  return Math.max(.3,-dot+Math.sqrt(Math.max(.01,s.range*s.range-r*r+dot*dot)));
 }
 chooseTarget(w,range){
  if(w.def.family!=='blade')return this.nearest(this.player.x,this.player.z,range);
  const p=this.player,home=this.bladeHome(w),reserved=new Set(this.slashes.filter(s=>!s.derived&&s.target&&s.wuid!==w.uid).map(s=>s.target.id));
  let best=null,score=Infinity;
  for(const e of this.enemies){
   if(e.dead)continue;const dist=Math.hypot(e.x-p.x,e.z-p.z);if(dist>=range)continue;
   const bearing=Math.atan2(e.x-p.x,e.z-p.z),lane=Math.abs(angleDiff(bearing,home.a))/Math.PI;
   const value=dist+lane*range*BALANCE.melee.sectorWeight+(reserved.has(e.id)?range*2:0);
   if(value<score){score=value;best=e}
  }
  return best;
 }
 spawnEnemy(type=null,initial=false,x=null,z=null,elite=null){
  if(this.enemies.filter(e=>!e.dead).length>=BALANCE.enemy.cap)return null;
  let choices=this.wave<=2?['runner','runner','skitter']:this.wave<5?['runner','skitter','tank','shooter']:['runner','skitter','tank','shooter','splitter','charger','bomber'];
  type=type||(this.waveRule==='barrage'?'shooter':choices[Math.floor(this.rng()*choices.length)]);
  if(x===null){let a=this.rng()*TAU,r=19.5+this.rng();x=Math.sin(a)*r;z=Math.cos(a)*r;if(Math.hypot(x-this.player.x,z-this.player.z)<10){x=-x;z=-z}}
  let b=ENEMY_DATA[type],w=this.wave-1,d=BALANCE.danger[this.danger],scale=1+BALANCE.enemy.linear*w+BALANCE.enemy.power*w**BALANCE.enemy.exponent;
  let hp=b[0]*scale*d.hp;if(this.waveRule==='tide'&&type!=='boss')hp*=.45;
  if(elite===null&&type!=='boss'&&this.wave>=5&&this.rng()<d.elite)elite=['shield','split','rage','summon'][Math.floor(this.rng()*4)];
  if(elite)hp*=2.2;let e={id:this.enemyId++,type,name:b[5],x,z,hp,maxHp:hp,speed:b[1]*(1+this.wave*BALANCE.enemy.speedGrowth)*d.speed,radius:b[2],damage:b[3]*(1+w*BALANCE.enemy.damageGrowth),
   color:b[4],angle:0,timer:1.2+this.rng(),age:0,slow:0,hit:0,dead:false,vx:0,vz:0,status:{fire:0,ice:0,shock:0},dot:0,dotTimer:0,elite,shield:elite==='shield'?hp*.22:0,phase:1,skill:0,fusionAt:-99,summon:6,child:false};
  if(type==='boss'){e.timer=3;e.damage*=1.15}this.enemies.push(e);this.ring(x,z,e.radius*1.8,0xff7296,.3);return e;
 }
 setupWave(){
  this.waveDuration=BALANCE.waveSeconds[Math.min(this.wave,20)-1];this.waveRule=WAVE_RULES[this.wave]||'normal';this.waveTime=0;this.completedWave=false;this.spawnTimer=.75;this.bossSpawned=false;this.rerolls=0;
  this.coreState.noHit=0;this.coreState.timeLeft=0;this.coreState.charge=0;this.coreState.blocked=0;this.player.shield=0;this.coreState.last={};
  this.ledger={pickup:0,recovery:0,bonus:0,interest:0,salvage:0,spent:0};this.warnings=[];this.events=[];this.barrels=[];this.greed=[];this.slashes=[];this.meleeTrails=[];this.nextMeleeLaunch=0;
  for(let w of this.weapons)w.timer=.08+w.index*BALANCE.melee.initialStagger;
  for(let i=0;i<3;i++){let a=this.rng()*TAU,r=6+this.rng()*10;this.barrels.push({id:'b'+i,x:Math.sin(a)*r,z:Math.cos(a)*r,hp:20,dead:false})}
  if(this.waveRule==='tide'){for(let i=0;i<60;i++)this.spawnEnemy(i%3?'runner':'skitter');this.spawnTimer=12}
  if(this.waveRule==='elite')for(let i=0;i<3;i++)this.spawnEnemy(i===0?'tank':i===1?'charger':'shooter',false,null,null,['shield','rage','summon'][i]);
  if(this.wave>=3&&this.rng()<.33)this.greed.push({x:(this.rng()-.5)*24,z:(this.rng()-.5)*24,progress:0,done:false,age:0,tick:0,value:Math.round(16+this.wave*2)});
  if(this.character.id==='gambler'&&this.wave>1&&this.weapons.length){let idx=Math.floor(this.rng()*this.weapons.length),old=this.weapons[idx],pool=WEAPONS.filter(d=>!d.terminal);let d=pool[Math.floor(this.rng()*pool.length)];old.id=d.id;old.def=d;old.paid=0;old.shots=0;old.combo=0;this.recalculate();UI.toast('赌徒 · 武器已重写',d.name+' / 保留 '+old.level+' 级')}
 }
 ring(x,z,max,color,life=.4,y=.08){this.rings.push({x,z,max,color,life,total:life,y});if(this.rings.length>65)this.rings.shift()}
 spark(x,y,z,color,count=4,power=3){
  for(let i=0;i<count&&this.particles.length<BALANCE.performance.particles;i++){let a=rand(0,TAU),s=rand(.3,power);this.particles.push({x,y,z,vx:Math.sin(a)*s,vz:Math.cos(a)*s,vy:rand(1,4),life:rand(.15,.4),color,size:rand(.025,.085)})}
 }
 beam(ax,az,bx,bz,color,width=.08,life=.13,ay=1.05,by=.8){this.beams.push({ax,az,bx,bz,color,width,life,total:life,ay,by});if(this.beams.length>100)this.beams.shift()}
 pop(text,x,z,color='#e8fcf1',crit=false,player=false){if(this.numbers.length>=BALANCE.performance.numbers)this.numbers.shift();this.numbers.push({text,x,z,y:player?2.65:1.8,color,crit,player,life:player?.9:.55,total:player?.9:.55})}
 heal(amount,combat=true){
  if(amount<=0)return 0;let m=combat&&this.has('blood')?BALANCE.core.blood.healing:1,old=this.player.hp;
  this.player.hp=Math.min(this.player.maxHp,this.player.hp+amount*m);return this.player.hp-old;
 }
 proc(id){this.coreMetrics[id]??={count:0,damage:0};this.coreMetrics[id].count++;this.coreState.last[id]=this.elapsed;this.corePulse={id,at:this.elapsed}}
 ready(id,cd=0){return this.elapsed-(this.coreState.last[id]??-99)>=cd}
 applyStatus(e,kind,duration,damage=0){
  let stack=this.character.id==='elemental'||this.has('fusion')||this.tags['元素']>=4;
  if(!stack)for(let k of ['fire','ice','shock'])if(k!==kind)e.status[k]=0;
  e.status[kind]=duration*(this.character.id==='elemental'?1.4:1)*(this.tags['元素']>=6?1.5:1);if(kind==='fire')e.dot=Math.max(e.dot,damage*.16);
  if(kind==='ice')e.slow=Math.max(e.slow,duration);
 }
 damage(e,amount,meta={}){
  if(!e||e.dead||e.hp<=0||!Number.isFinite(amount)||amount<=0)return 0;
  let crit=!meta.derived&&this.rng()<Math.max(0,meta.crit??this.stats.crit)/100;
  let value=amount*(crit?1.8:1),absorbed=Math.min(e.shield||0,value);e.shield=Math.max(0,(e.shield||0)-absorbed);value-=absorbed;
  let real=Math.max(0,Math.min(e.hp,Math.max(0,value)));e.hp=Math.max(0,e.hp-value);e.hit=.1;this.gameStats.damage+=real;
  if(meta.core){this.coreMetrics[meta.core]??={count:0,damage:0};this.coreMetrics[meta.core].damage+=real;this.gameStats.coreDamage+=real}
  let knock=meta.knock||0;if(!meta.derived&&meta.tags?.includes('重型')&&this.tags['重型']>=4){knock+=3;e.charge=0;e.windup=0}
  if(knock&&e.type!=='boss'){let a=Math.atan2(e.x-this.player.x,e.z-this.player.z);e.vx+=Math.sin(a)*knock;e.vz+=Math.cos(a)*knock}
  if(this.damageNumbers&&(crit||meta.family==='blade'||this.rng()<.25))this.pop(Math.max(1,Math.round(value)),e.x,e.z,crit?'#ffe2a4':'#e6f6ef',crit);
  if(meta.element)this.applyStatus(e,meta.element,3.2,amount);
  if(!meta.derived&&meta.tags?.includes('刀刃')&&this.tags['刀刃']>=4){e.bleed=2.5;e.bleedDamage=Math.max(e.bleedDamage||0,amount*.11)}
  if(!meta.derived){
   let cap=this.player.maxHp*BALANCE.growth.lifestealCap;
   let heal=Math.min(real*Math.max(0,this.stats.lifesteal)/100,Math.max(0,cap-(this.lifeHeal||0)));if(heal>0){this.heal(heal);this.lifeHeal=(this.lifeHeal||0)+heal}
   if(this.has('fusion')&&Object.values(e.status).every(v=>v>0)&&this.ready('fusion',BALANCE.core.fusion.cd)&&this.elapsed-e.fusionAt>=BALANCE.core.fusion.targetCD){
    e.fusionAt=this.elapsed;for(let k in e.status)e.status[k]=0;this.proc('fusion');
    this.explode(e.x,e.z,BALANCE.core.fusion.radius,Math.max(BALANCE.core.fusion.floor,amount)*BALANCE.core.fusion.ratio,{derived:true,core:'fusion',color:0xffb86f});
   }else if(this.tags['元素']>=6&&Object.values(e.status).every(v=>v>0)&&this.ready('elementSet',1.2)){
    for(let k in e.status)e.status[k]=0;this.coreState.last.elementSet=this.elapsed;this.explode(e.x,e.z,3,amount*.65,{derived:true,color:0xa4ffe2});
   }
   if(this.has('salvage')&&this.coreState.charge>=BALANCE.core.salvage.charge&&this.ready('salvage',BALANCE.core.salvage.cd)){
    this.coreState.charge-=BALANCE.core.salvage.charge;this.proc('salvage');this.chain(e,amount*BALANCE.core.salvage.ratio,BALANCE.core.salvage.targets,{derived:true,core:'salvage',color:0xffc56b});
   }
   if(crit&&this.tags['精准']>=6&&meta.tags?.includes('精准'))this.damage(e,amount*.35,{derived:true,color:0xaccdff});
  }
  if(meta.family==='blade'||meta.melee){this.spark(e.x,1,e.z,meta.color||0xffd9ab,crit?7:3,4);this.sound.meleeImpact?.(this.weapons.find(w=>w.uid===meta.wuid)?.index||0,crit);if(this.elapsed-this.lastHitstop>BALANCE.melee.stopInterval){this.hitstop=this.touch?(crit?.02:.012):(crit?BALANCE.melee.critstop:BALANCE.melee.hitstop);this.lastHitstop=this.elapsed}this.shake=Math.max(this.shake,crit?.24:.08)}
  if(e.hp<=0&&!e.dead)this.kill(e,meta);
  return real;
 }
 kill(e,meta={}){
  if(e.dead)return;e.dead=true;this.player.kills++;this.spark(e.x,.9,e.z,e.color,e.type==='boss'?30:e.elite?15:5,e.type==='boss'?8:3);
  let val=e.type==='boss'?20:e.elite?8:e.type==='tank'?2:1;if(e.child)val=.35;
  this.gems.push({x:e.x,z:e.z,value:val,xp:e.type==='boss'?36:e.elite?12:e.child?1:2,age:0,spin:this.rng()*TAU});
  if(e.elite||e.type==='boss')this.drops.push({id:this.uid++,item:this.rollItem(),x:e.x,z:e.z,age:0});
  if(e.type==='splitter'||e.elite==='split')for(let i=0;i<2;i++){let c=this.spawnEnemy('skitter',false,e.x+(i?1:-1),e.z,'');if(c){c.hp=c.maxHp*=.45;c.child=true}}
  if(!meta.derived&&this.tags['刀刃']>=6&&++this.coreState.bladeKills%BALANCE.sets.bladeKills===0)this.explode(e.x,e.z,4.2,22+this.stats.melee*1.2,{derived:true,color:0xe9bbff});
  if(!meta.derived&&meta.explosion&&this.tags['爆裂']>=6)this.events.push({at:this.elapsed+.1,kind:'explosion',x:e.x,z:e.z,r:2.5,damage:(meta.baseDamage||10)*.3,meta:{derived:true,color:0xffb578}});
  if(!meta.core&&this.has('parasite')&&(e.elite||e.type==='boss')&&Math.hypot(e.x-this.player.x,e.z-this.player.z)<=BALANCE.core.parasite.radius){
   this.heal(this.player.maxHp*BALANCE.core.parasite.heal);this.coreState.parasite=BALANCE.core.parasite.duration;this.proc('parasite');this.pop('近身猎杀 · 回复',this.player.x,this.player.z,'#b5f7cd',false,true);
  }
 }
 hurt(amount,source='敌人接触',self=false){
  let p=this.player;if(this.state!=='playing'||this.sandboxGod||(!self&&p.iframe>0))return 0;
  if(!self&&this.rng()<this.dodgeChance()){p.iframe=.15;this.pop('闪避',p.x,p.z,'#c9f5f1',false,true);return 0}
  let reduction=self?0:this.armorReduction(),mitigated=self?0:Math.max(0,amount*reduction),dmg=amount*(1-reduction);
  if(this.has('parasite'))dmg*=BALANCE.core.parasite.received;
  let shield=self?0:Math.min(p.shield,dmg);p.shield-=shield;dmg=Math.max(0,dmg-shield);
  if(!self)p.iframe=BALANCE.player.iframe;
  if(dmg>0){p.hp-=dmg;this.coreState.noHit=0;this.trailHold=.08;this.damageFlash=.65;this.shake=.22;this.sound.hit();this.pop('−'+Math.ceil(dmg),p.x,p.z,'#ff7385',true,true)}
  else this.pop('护盾 '+Math.ceil(shield),p.x,p.z,'#d8eeff',false,true);
  this.damageLog.push({time:this.elapsed,source,raw:amount,actual:dmg,blocked:mitigated,shield,self});this.damageLog=this.damageLog.filter(v=>this.elapsed-v.time<8);
  if(!self&&this.has('bulwark')&&mitigated>0){
   this.coreState.blocked=Math.min(60,this.coreState.blocked+mitigated);let c=BALANCE.core.bulwark;
   if(this.coreState.blocked>=c.charge&&this.ready('bulwark',c.cd)){this.coreState.blocked-=c.charge;p.shield=Math.min(c.shieldCap,p.shield+c.shield);this.proc('bulwark');this.explode(p.x,p.z,c.radius,Math.min(c.maxDamage,c.base+Math.max(0,this.stats.armor)*c.armorRatio),{derived:true,core:'bulwark',color:0xa6d7ff})}
  }
  if(p.hp<=0){p.hp=0;this.endRun(false)}return dmg;
 }
 addBullet(options){
  if(this.bullets.length>=BALANCE.performance.bullets)return;
  this.bullets.push(Object.assign({x:0,z:0,y:1,dx:0,dz:1,age:0,life:1.5,speed:22,damage:5,radius:.13,color:0x88eece,enemy:false,type:'pulse',pierce:0,hit:new Set(),meta:{}},options));
 }
 explode(x,z,r,damage,meta={},field=null){
  let main=!meta.derived;if(main&&this.character.id==='demolition')r*=1.2;if(main&&this.tags['爆裂']>=2)r*=1.1;
  if(main&&this.has('singularity'))damage*=BALANCE.core.singularity.penalty;
  this.ring(x,z,r,meta.color||0xffb06a,.36);this.spark(x,.5,z,meta.color||0xffb06a,10,5);
  let targets=this.enemies.filter(e=>!e.dead&&Math.hypot(e.x-x,e.z-z)<r+e.radius);let hitMeta=Object.assign({},meta,{explosion:true,baseDamage:damage});
  for(let e of targets){this.damage(e,damage,hitMeta);if(main&&this.tags['爆裂']>=4)e.slow=Math.max(e.slow,1.2)}
  if(main&&this.has('singularity')&&targets.length>=BALANCE.core.singularity.needed&&this.ready('singularity',BALANCE.core.singularity.cd)){
   this.proc('singularity');this.fields.push({type:'pull',x,z,r:r*1.3,life:.55,tick:99,color:0xffa362,damage:0,meta:{derived:true}});
   this.events.push({at:this.elapsed+BALANCE.core.singularity.delay,kind:'explosion',x,z,r:r*1.1,damage:damage*BALANCE.core.singularity.ratio,meta:{derived:true,core:'singularity',color:0xffa362}});
  }
  if(field&&this.fields.length<BALANCE.performance.fields)this.fields.push({type:field,x,z,r:Math.min(r,3.5),life:3.5,tick:.2,color:meta.color||0xc9ee6a,damage:damage*.35,meta:Object.assign({},meta,{derived:true})});
  for(let b of this.barrels)if(!b.dead&&Math.hypot(b.x-x,b.z-z)<r)this.breakBarrel(b);
  return targets.length;
 }
 chain(first,damage,count,meta){
  let e=first,seen=new Set(),x=this.player.x,z=this.player.z;
  for(let i=0;i<count&&e;i++){seen.add(e.id);this.beam(x,z,e.x,e.z,meta.color||0x88ccff,.08,.17);this.damage(e,damage,meta);x=e.x;z=e.z;e=this.nearest(x,z,6.5,seen)}
 }
 fire(w){
  let p=this.player,d=w.def,range=this.rangeFor(w),target=this.chooseTarget(w,range);
  if(!target&&d.family!=='mine')return false;
  if(d.family==='mine'&&this.fields.filter(f=>f.wuid===w.uid&&f.type==='mine').length>=4+d.pierce)return false;
  let mount=TAU*w.index/Math.max(1,this.weapons.length)+p.angle*.2,rr=1.3,sx=p.x+Math.sin(mount)*rr,sz=p.z+Math.cos(mount)*rr;
  let home=d.family==='blade'?this.bladeHome(w):null;
  let a=target?Math.atan2(target.x-(home?p.x+Math.sin(home.a)*home.r:sx),target.z-(home?p.z+Math.cos(home.a)*home.r:sz)):p.angle,amount=this.damageFor(w),meta=this.metaFor(w),extra=d.pierce;
  w.aim=a;w.recoil=.12;w.shots++;this.gameStats.shots++;
  if(d.variant===4){this.hurt(1,'超载改装 · 开火自伤',true);if(this.state!=='playing')return false}
  let shot=(aa,opts={})=>this.addBullet(Object.assign({x:sx,z:sz,dx:Math.sin(aa),dz:Math.cos(aa),damage:amount,color:d.color,meta,pierce:extra+(this.tags['精准']>=4&&d.tags.includes('精准')?1:0),life:range/23},opts));
  switch(d.family){
   case 'pulse':shot(a);break;
   case 'scatter':for(let i=0;i<5;i++)shot(a+(i-2)*.14,{life:range/23,radius:.12});break;
   case 'gatling':shot(a+(this.rng()-.5)*.13,{speed:29,life:range/29,radius:.08});break;
   case 'rail':case 'laser':{
    let dx=Math.sin(a),dz=Math.cos(a),endx=sx+dx*range,endz=sz+dz*range;this.beam(sx,sz,endx,endz,d.color,d.family==='rail'?.09:.13,.16);
    let hit=this.enemies.filter(e=>!e.dead&&(e.x-sx)*dx+(e.z-sz)*dz>0&&Math.hypot(e.x-sx,e.z-sz)<range&&segmentDistance(e.x,e.z,sx,sz,endx,endz)<e.radius+.18)
     .sort((u,v)=>Math.hypot(u.x-sx,u.z-sz)-Math.hypot(v.x-sx,v.z-sz)).slice(0,(d.family==='rail'?8:3)+extra);
    hit.forEach(e=>this.damage(e,amount,meta));break;
   }
   case 'rocket':shot(a,{speed:14,life:range/14,type:'rocket',radius:.22,explode:2.9,pierce:0});break;
   case 'seeker':for(let i=0;i<2;i++)shot(a+(i?1:-1)*.16,{speed:16,life:range/12,type:'seeker',target,damage:amount*.85,explode:1.6,radius:.17,pierce:0});break;
   case 'plasma':shot(a,{speed:12,life:range/12,type:'plasma',radius:.42,pierce:2+extra,explode:1.7,damage:amount*.75});break;
   case 'tesla':this.chain(target,amount,4+extra,Object.assign({},meta,{element:'shock'}));break;
   case 'flame':{
    for(let i=0;i<3;i++)shot(a+(i-1)*.2,{speed:10,life:range/10,type:'flame',damage:amount*.5,radius:.32,pierce:1+extra,meta:Object.assign({},meta,{element:'fire'})});break;
   }
   case 'cryo':for(let i=0;i<3;i++)shot(a+(i-1)*.13,{type:'cryo',damage:amount*.75,meta:Object.assign({},meta,{element:'ice'}),pierce:1+extra});break;
   case 'blade':{
    w.combo=(w.combo%3)+1;let duration=Math.min(.35,this.cooldownFor(w)*.88);let slash={wuid:w.uid,w,age:0,duration,a,dir:(home.index+w.shots)%2?1:-1,socketA:home.a,height:home.y,range,damage:amount*(w.combo===3?BALANCE.melee.third:1),arc:w.combo===3?BALANCE.melee.heavyArc:BALANCE.melee.arc,hit:new Set(),barrelHits:new Set(),target,color:this.bladeColor(w),meta:Object.assign({},meta,{color:this.bladeColor(w)}),heavy:w.combo===3,derived:false,max:BALANCE.melee.hitLimit+extra};
    if(this.tags['近战']>=6&&w.combo===3)slash.meta=Object.assign({},slash.meta,{element:'ice'});
    this.slashes.push(slash);
    if(this.has('echo')&&w.combo===3&&this.ready('echo',BALANCE.core.echo.cd)){
     this.proc('echo');for(let i=0;i<2;i++)this.events.push({at:this.elapsed+duration+BALANCE.core.echo.delay+i*.09,kind:'slash',follow:true,owner:w.uid,socketA:home.a,height:home.y+.15,a:a+(i?.5:-.5),range:range*1.06,damage:slash.damage*BALANCE.core.echo.ratio,core:'echo',dir:i?1:-1})
    }
    break;
   }
   case 'orbit':{
    let oa=this.elapsed*2.5+w.index*1.7,rr=range*.89,ox=p.x+Math.sin(oa)*rr,oz=p.z+Math.cos(oa)*rr;
    let hit=0;for(let e of this.enemies)if(!e.dead&&hit<4+extra&&Math.hypot(e.x-ox,e.z-oz)<1.5+e.radius){this.damage(e,amount,meta);hit++}break;
   }
   case 'boomerang':shot(a,{type:'boomerang',speed:17,life:1.5,radius:.45,pierce:18,returnAt:.6});break;
   case 'mine':this.fields.push({type:'mine',wuid:w.uid,x:p.x+(this.rng()-.5)*2,z:p.z+(this.rng()-.5)*2,r:3.6*(range/6),trigger:1.7*(range/6),life:12,arm:.45,tick:0,damage:amount,color:d.color,meta});break;
   case 'drone':{
    let da=this.elapsed*.75+w.index,ox=p.x+Math.sin(da)*3.1,oz=p.z+Math.cos(da)*3.1,tgt=this.nearest(ox,oz,range)||target,aa=Math.atan2(tgt.z-oz,tgt.x-ox);shot(Math.PI/2-aa,{x:ox,z:oz,y:2.8,speed:24,life:range/24});break;
   }
   case 'acid':shot(a,{type:'acid',speed:13,life:range/13,radius:.24,explode:2.8,field:'acid',pierce:0});break;
   case 'gravity':if(target&&this.fields.length<BALANCE.performance.fields)this.fields.push({type:'gravity',x:target.x,z:target.z,r:4.8,life:3.3+extra*.5,tick:.1,damage:amount,color:d.color,meta:Object.assign({},meta,{derived:true})});break;
   case 'storm':this.events.push({at:this.elapsed+.28,kind:'explosion',x:target.x,z:target.z,r:2.5,damage:amount,meta:Object.assign({},meta,{element:'shock'})});this.beam(target.x+.7,target.z,target.x,target.z,d.color,.09,.32,10,.2);break;
   case 'nova':this.explode(p.x,p.z,range,amount,Object.assign({},meta,{element:'shock',knock:7}));break;
  }
  if(this.has('quantum')&&DIRECT_FAMILIES.has(d.family)&&!d.tags.includes('工程')&&w.shots%BALANCE.core.quantum.every===0&&this.ready('quantum',BALANCE.core.quantum.cd)){
   this.proc('quantum');for(let i=0;i<2;i++)shot(a+(i?.3:-.3),{damage:amount*BALANCE.core.quantum.ratio,type:'seeker',speed:21,life:1.5,target,meta:{derived:true,core:'quantum',color:0xffad65},color:0xffad65,pierce:0});
  }
  if(this.tags['远程']>=4&&DIRECT_FAMILIES.has(d.family)&&w.shots%5===0&&target){let e=this.nearest(target.x,target.z,6,new Set([target.id]));if(e){this.beam(target.x,target.z,e.x,e.z,d.color,.04);this.damage(e,amount*.3,{derived:true,color:d.color})}}
  if(this.tags['重型']>=6&&d.tags.includes('重型')&&++this.coreState.heavyHits%6===0)this.explode(p.x,p.z,4.5,amount*.65,{derived:true,color:d.color,knock:6});
  if(d.family!=='blade')this.sound.shot(d.family);return true;
 }
 slashPosition(s){
  let p=s.age/s.duration,wind=.2,end=.7,u=clamp((p-wind)/(end-wind),0,1),ease=u*u*(3-2*u);
  return {p,u,active:p>=wind&&p<=end,a:s.a+s.dir*(-s.arc/2+ease*s.arc)};
 }
 updateSlashes(dt){
  for(let s of this.slashes){
   const previous=s.age;s.age+=dt;const q=this.slashPosition(s);
   if(previous/s.duration<.2&&q.p>=.2&&!s.derived)this.sound.meleeSwing?.(s.w?.index||0,s.heavy);
   if(!q.active&&!(previous/s.duration<.7&&q.p>.7))continue;
   const origin=this.slashOrigin(s),x=origin.x,z=origin.z;
   const age=s.age;s.age=previous;const prev=this.slashPosition(s);s.age=age;
   const start=prev.a,end=q.a,sweep=Math.abs(end-start),center=(start+end)/2;
   if(sweep>.0001&&this.weaponFX){
    this.meleeTrails.push({uid:s.wuid,x,z,cx:origin.cx,cz:origin.cz,socketA:s.socketA,range:s.range,y:s.height??1.12,
     a0:start,a1:end,color:s.color,heavy:s.heavy,derived:s.derived,life:BALANCE.melee.trailLife,total:BALANCE.melee.trailLife});
   }
   for(let e of this.enemies){
    if(e.dead||s.hit.has(e.id)||s.hit.size>=s.max)continue;
    const dist=Math.hypot(e.x-x,e.z-z),a=Math.atan2(e.x-x,e.z-z),tol=Math.asin(Math.min(.8,(e.radius+.22)/Math.max(.2,dist)));
    if(Math.hypot(e.x-origin.cx,e.z-origin.cz)<s.range+e.radius&&Math.abs(angleDiff(a,center))<=sweep/2+tol+.06){
     s.hit.add(e.id);const before=e.hp;this.damage(e,s.damage,Object.assign({},s.meta,{melee:true,knock:(s.heavy?7:3)+(s.meta.knock||0)}));
     if(before>e.hp&&this.weaponFX){
      this.impactCuts.push({x:e.x,z:e.z,y:s.height??1.12,a:q.a+Math.PI/2,color:s.color,life:BALANCE.visuals.impactLife,total:BALANCE.visuals.impactLife});
      if(this.impactCuts.length>24)this.impactCuts.shift();
     }
    }
   }
   s.barrelHits??=new Set();
   for(let b of this.barrels)if(!b.dead&&!s.barrelHits.has(b.id)&&Math.hypot(b.x-origin.cx,b.z-origin.cz)<s.range&&Math.abs(angleDiff(Math.atan2(b.x-x,b.z-z),center))<=sweep/2+.22){
    s.barrelHits.add(b.id);b.hp-=s.damage;if(b.hp<=0)this.breakBarrel(b);
   }
  }
  this.slashes=this.slashes.filter(s=>s.age<s.duration);
  const cap=this.touch?BALANCE.melee.mobileTrailLimit:BALANCE.melee.trailLimit;
  if(this.meleeTrails.length>cap)this.meleeTrails.splice(0,this.meleeTrails.length-cap);
 }
 breakBarrel(b){
  if(b.dead)return;b.dead=true;this.warnings.push({type:'circle',x:b.x,z:b.z,r:3.1,time:.52,total:.52,damage:13+this.wave,source:'爆炸桶',barrel:true,color:0xffc371});
 }
 updateWarnings(dt){
  for(let t of this.warnings){t.time-=dt;if(t.time>0||t.done)continue;t.done=true;
   if(t.type==='volley'){
    for(let i=0;i<t.count;i++){let a=TAU*i/t.count+t.a;this.addBullet({x:t.x,z:t.z,dx:Math.sin(a),dz:Math.cos(a),speed:7,life:4,radius:.19,enemy:true,type:'enemy',color:0xff6b8b,damage:t.damage,source:t.source})}
   }else if(t.type==='line'){
    if(segmentDistance(this.player.x,this.player.z,t.x,t.z,t.bx,t.bz)<t.width+.5)this.hurt(t.damage,t.source);
    this.beam(t.x,t.z,t.bx,t.bz,0xff5677,t.width*.7,.25,.18,.18);
   }else{
    if(Math.hypot(this.player.x-t.x,this.player.z-t.z)<t.r+.4)this.hurt(t.damage,t.source);
    this.ring(t.x,t.z,t.r,0xff6b87,.3);
    if(t.barrel){this.explode(t.x,t.z,t.r,45+this.wave*3,{derived:true,color:0xffba67});this.gems.push({x:t.x,z:t.z,value:5,xp:4,age:0,spin:0})}
   }
  }this.warnings=this.warnings.filter(t=>!t.done);
 }
 updateEnemies(dt){
  let p=this.player;
  for(let e of this.enemies){
   if(e.dead)continue;e.age+=dt;e.timer-=dt;e.hit=Math.max(0,e.hit-dt);e.slow=Math.max(0,e.slow-dt);e.dotTimer-=dt;
   for(let k in e.status)e.status[k]=Math.max(0,e.status[k]-dt);
   if(e.bleed>0)e.bleed-=dt;
   if(e.dotTimer<=0){e.dotTimer=.5;if(e.status.fire>0)this.damage(e,e.dot||2,{derived:true,color:0xff9d62});if(e.bleed>0)this.damage(e,e.bleedDamage||2,{derived:true,color:0xe69bef})}
   if(e.dead)continue;
   let dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz)||.1,nx=dx/dist,nz=dz/dist,speed=e.speed*(e.slow>0?.48:1);
   e.angle=Math.atan2(dx,dz);if(e.elite==='rage'&&e.hp<e.maxHp*.5)speed*=1.5;
   if(e.elite==='summon'){e.summon-=dt;if(e.summon<=0){e.summon=7;for(let i=0;i<2;i++){let c=this.spawnEnemy('runner',false,e.x+(i?1:-1),e.z,'');if(c){c.child=true;c.hp=c.maxHp*=.6}}}}
   if(e.type==='skitter'&&dist>3){let sign=e.id%2?1:-1;let tx=nx+nz*.8*sign,tz=nz-nx*.8*sign,l=Math.hypot(tx,tz);nx=tx/l;nz=tz/l}
   if(e.type==='shooter'){
    if(dist<10)speed=dist<7?-e.speed*.8:0;
    if(e.timer<=0){e.timer=2.3-this.danger*.08;this.warnings.push({type:'line',x:e.x,z:e.z,bx:e.x+dx/dist*16,bz:e.z+dz/dist*16,width:.22,time:.7,total:.7,damage:e.damage,source:'远程哨兵 · 瞄准射击',color:0xff967f})}
   }
   if(e.type==='charger'){
    if(e.windup>0){e.windup-=dt;speed=0;if(e.windup<=0)e.charge=.5}
    else if(e.charge>0){e.charge-=dt;e.x+=e.cx*15*dt;e.z+=e.cz*15*dt;speed=0}
    else if(e.timer<=0){e.timer=4.2;e.windup=.8;e.cx=dx/dist;e.cz=dz/dist}
   }
   if(e.type==='bomber'&&dist<2.1&&!e.armed){e.armed=true;this.warnings.push({type:'circle',x:e.x,z:e.z,r:2.5,time:.7,total:.7,damage:e.damage*1.3,source:'自爆机 · 近身爆破',color:0xffab65});this.kill(e,{derived:true})}
   if(e.type==='boss'){
    if(e.hp<e.maxHp*.5&&e.phase===1){
     e.phase=2;e.timer=1.2;UI.toast('执法核心 · 阶段 II','四个场地角落进入周期封锁');
     for(let sx of [-1,1])for(let sz of [-1,1])this.fields.push({type:'danger',x:sx*13,z:sz*13,r:4,life:999,tick:1.5,damage:12+this.wave*.4,color:0xe36789});
    }
    if(dist<6)speed=0;
    if(e.timer<=0){e.timer=e.phase===2?2.8:3.8;let skill=e.skill++%3;
     if(skill===0){for(let i=0;i<(e.phase===2?4:3);i++)this.warnings.push({type:'circle',x:clamp(p.x+(i-1)*3.6,-19,19),z:clamp(p.z+Math.sin(i*2)*3,-19,19),r:2.5,time:1.25+i*.12,total:1.25+i*.12,damage:e.damage,source:'执法核心 · 轨道轰炸',boss:true})}
     if(skill===1){let ax=dx/dist,az=dz/dist;this.warnings.push({type:'line',x:e.x-ax*20,z:e.z-az*20,bx:e.x+ax*35,bz:e.z+az*35,width:1.2,time:1.3,total:1.3,damage:e.damage*1.25,source:'执法核心 · 裁决光束',boss:true})}
     if(skill===2)this.warnings.push({type:'volley',x:e.x,z:e.z,r:2,time:1.05,total:1.05,count:e.phase===2?20:14,a:e.age,damage:e.damage*.7,source:'执法核心 · 环形弹幕',boss:true});
    }
   }
   e.x+=nx*speed*dt+e.vx*dt;e.z+=nz*speed*dt+e.vz*dt;e.vx*=Math.exp(-dt*7);e.vz*=Math.exp(-dt*7);e.x=clamp(e.x,-21,21);e.z=clamp(e.z,-21,21);
   if(!e.dead&&Math.hypot(p.x-e.x,p.z-e.z)<e.radius+.53){this.hurt(e.damage,e.name+(e.elite?'【精英】':'')+(e.charge>0?' · 冲锋撞击':' · 接触伤害'));if(this.state!=='playing')return}
  }
  this.grid.build(this.enemies);
  for(let e of this.enemies)if(!e.dead)for(let o of this.grid.near(e.x,e.z,1.5)){if(o.dead||o.id<=e.id)continue;let dx=e.x-o.x,dz=e.z-o.z,d=Math.hypot(dx,dz)||.01,min=(e.radius+o.radius)*.85;if(d<min){let push=(min-d)*dt*2;e.x+=dx/d*push;e.z+=dz/d*push;o.x-=dx/d*push;o.z-=dz/d*push}}
 }
 updateBullets(dt,enemyScale=1){
  let p=this.player;
  for(let b of this.bullets){
   if(b.life<=0)continue;let t=dt*(b.enemy?enemyScale:1),ox=b.x,oz=b.z;b.age+=t;b.life-=t;
   if(b.type==='seeker'||b.redirect){let target=b.target;if(!target||target.dead)target=b.target=this.nearest(b.x,b.z,22,b.hit);if(target){let dx=target.x-b.x,dz=target.z-b.z,d=Math.hypot(dx,dz)||1;b.dx=mix(b.dx,dx/d,t*9);b.dz=mix(b.dz,dz/d,t*9);let l=Math.hypot(b.dx,b.dz)||1;b.dx/=l;b.dz/=l}}
   if(b.type==='boomerang'&&b.age>b.returnAt){if(!b.returning){b.hit.clear();b.returning=true}let dx=p.x-b.x,dz=p.z-b.z,d=Math.hypot(dx,dz)||1;b.dx=dx/d;b.dz=dz/d;if(d<.6)b.life=0}
   b.x+=b.dx*b.speed*t;b.z+=b.dz*b.speed*t;if(Math.abs(b.x)>26||Math.abs(b.z)>26)b.life=0;
   if(b.enemy){if(segmentDistance(p.x,p.z,ox,oz,b.x,b.z)<b.radius+.5){this.hurt(b.damage,b.source||'敌方投射物');b.life=0}continue}
   for(let e of this.grid.near(b.x,b.z,b.radius+2.5)){
    if(e.dead||b.hit.has(e.id)||segmentDistance(e.x,e.z,ox,oz,b.x,b.z)>=e.radius+b.radius)continue;
    b.hit.add(e.id);if(b.explode)this.explode(b.x,b.z,b.explode,b.damage,b.meta,b.field);else this.damage(e,b.damage,b.meta);
    if(b.pierce--<=0){b.life=0;break}
    if(this.tags['远程']>=6&&!b.meta.derived&&!b.redirected){b.redirect=true;b.redirected=true;b.target=this.nearest(b.x,b.z,12,b.hit)}
   }
   for(let barrel of this.barrels)if(!barrel.dead&&b.life>0&&segmentDistance(barrel.x,barrel.z,ox,oz,b.x,b.z)<.65+b.radius){barrel.hp-=b.damage;if(barrel.hp<=0)this.breakBarrel(barrel);b.life=0;break}
   if(b.life<=0&&b.field&&!b.hit.size)this.explode(b.x,b.z,b.explode,b.damage*.65,b.meta,b.field);
  }
  this.bullets=this.bullets.filter(b=>b.life>0);
 }
 updateFields(dt){
  for(let f of this.fields){f.life-=dt;f.tick-=dt;
   if(f.type==='mine'){
    f.arm-=dt;if(f.arm<=0&&this.enemies.some(e=>!e.dead&&Math.hypot(e.x-f.x,e.z-f.z)<(f.trigger||1.7)+e.radius)){
     this.explode(f.x,f.z,f.r,f.damage,f.meta);f.life=0;
     if(this.tags['工程']>=6&&!f.reborn)this.events.push({at:this.elapsed+5,kind:'remine',field:Object.assign({},f,{life:12,arm:.4,reborn:true})});
    }
   }else if(f.type==='danger'){
    if(f.tick<=0){f.tick=2.2;this.warnings.push({type:'circle',x:f.x,z:f.z,r:f.r,time:1.1,total:1.1,damage:f.damage,source:'执法核心 · 场地封锁',boss:true})}
   }else{
    for(let e of this.enemies){if(e.dead)continue;let dx=f.x-e.x,dz=f.z-e.z,d=Math.hypot(dx,dz)||.1;if(d>=f.r+e.radius)continue;
     if((f.type==='gravity'||f.type==='pull')&&e.type!=='boss'){let pull=f.type==='pull'?6:3;e.x+=dx/d*dt*pull;e.z+=dz/d*dt*pull}
     if(f.tick<=0&&f.damage>0){this.damage(e,f.damage,f.meta||{derived:true});if(f.type==='acid')e.slow=Math.max(e.slow,.6)}
    }
    if(f.tick<=0)f.tick=f.type==='acid'?.5:.4;
   }
  }
  this.fields=this.fields.filter(f=>f.life>0);
 }
 updateCores(dt){
  let cs=this.coreState;cs.parasite=Math.max(0,cs.parasite-dt);
  const bloodOn=this.has('blood')&&this.player.hp/this.player.maxHp<=BALANCE.core.blood.threshold;
  if(bloodOn&&!cs.bloodActive)this.proc('blood');cs.bloodActive=bloodOn;
  if(this.has('time')){
   if(cs.timeLeft>0)cs.timeLeft=Math.max(0,cs.timeLeft-dt);
   else{cs.noHit+=dt;if(cs.noHit>=BALANCE.core.time.wait){cs.noHit=0;cs.timeLeft=BALANCE.core.time.duration;this.proc('time');this.ring(this.player.x,this.player.z,13,0xc4a0ff,.65)}}
  }else cs.timeLeft=0;
  let hive=this.has('hive')&&this.tags['工程']>=BALANCE.core.hive.needed?2:0,bonus=this.tags['工程']>=2?1:0;
  if(hive||bonus){
   cs.hiveTimer-=dt;if(cs.hiveTimer<=0){cs.hiveTimer=BALANCE.core.hive.interval;let ws=this.weapons.filter(w=>w.def.tags.includes('工程')),avg=ws.reduce((a,w)=>a+this.damageFor(w),0)/(ws.length||1);
    let target=this.nearest(this.player.x,this.player.z,18);
    if(target){for(let i=0;i<hive+bonus;i++){let a=this.elapsed*.8+i*2.1,x=this.player.x+Math.sin(a)*4,z=this.player.z+Math.cos(a)*4,l=Math.hypot(target.x-x,target.z-z)||1;
      this.addBullet({x,z,y:3.1,dx:(target.x-x)/l,dz:(target.z-z)/l,damage:avg*(i<hive?BALANCE.core.hive.ratio:.4),color:0xffb97b,meta:{derived:true,core:i<hive?'hive':null},life:1,speed:24});
     }if(hive)this.proc('hive')}
   }
  }
  for(let e of this.events){if(e.done||this.elapsed<e.at)continue;e.done=true;
   if(e.kind==='explosion')this.explode(e.x,e.z,e.r,e.damage,e.meta);
   if(e.kind==='slash'&&(!e.owner||this.weapons.some(w=>w.uid===e.owner)))this.slashes.push({wuid:e.owner,socketA:e.socketA,height:e.height,age:0,duration:.3,a:e.a,dir:e.dir||1,range:e.range,damage:e.damage,arc:2.7,hit:new Set(),x:e.x,z:e.z,follow:e.follow,color:0xffb268,meta:{derived:true,core:e.core,color:0xffb268,melee:true},heavy:true,derived:true,max:e.core==='echo'?3:4});
   if(e.kind==='remine'&&this.weapons.some(w=>w.uid===e.field.wuid))this.fields.push(e.field);
  }
  this.events=this.events.filter(e=>!e.done);
 }
 collectGem(g,manual=true){
  if(g.collected)return;g.collected=true;let credit=g.value*Math.max(.1,1+this.stats.harvest/100)*(manual?1:BALANCE.shop.uncollected);
  this.player.credits+=credit;this.player.xp+=g.xp;this.ledger[manual?'pickup':'recovery']+=credit;
  if(manual){if(this.has('salvage'))this.coreState.charge=Math.min(BALANCE.core.salvage.max,this.coreState.charge+g.value);if(this.tags['支援']>=4)this.player.empCD=Math.max(0,this.player.empCD-.03*g.value);if(this.frame%6===0)this.sound.pick()}
 }
 updatePickups(dt){
  let p=this.player,range=BALANCE.player.pickup*clamp(1+this.stats.pickup/100,.3,3.5);
  for(let g of this.gems){g.age+=dt;let dx=p.x-g.x,dz=p.z-g.z,d=Math.hypot(dx,dz);if(d<range){let step=Math.min(d,dt*15);g.x+=dx/(d||1)*step;g.z+=dz/(d||1)*step;if(d<.7)this.collectGem(g,true)}}
  this.gems=this.gems.filter(g=>!g.collected);
  for(let d of this.drops){d.age+=dt;let dx=p.x-d.x,dz=p.z-d.z,len=Math.hypot(dx,dz);if(len<range+1){let s=Math.min(len,dt*13);d.x+=dx/(len||1)*s;d.z+=dz/(len||1)*s;if(len<.8&&!d.collected){d.collected=true;this.satchel.push(d.item);UI.toast('战利品已回收',ITEMS[d.item].name+' · 波后安装，不会强装负属性')}}}
  this.drops=this.drops.filter(d=>!d.collected);
  for(let g of this.greed){if(g.done)continue;g.age+=dt;g.tick-=dt;let near=Math.hypot(p.x-g.x,p.z-g.z)<2;if(near){g.progress+=dt;if(g.tick<=0){g.tick=.9;this.warnings.push({type:'circle',x:g.x+(this.rng()-.5)*2,z:g.z+(this.rng()-.5)*2,r:1.3,time:.65,total:.65,damage:8+this.wave*.4,source:'贪心奖励 · 警戒轰炸'})}if(g.progress>=3){g.done=true;this.gems.push({x:g.x,z:g.z,value:g.value,xp:8,age:0,spin:0});this.drops.push({id:this.uid++,x:g.x,z:g.z,item:this.rollItem(),age:0});UI.toast('贪心奖励到手','素材袋 + 道具')}}}
 }
 checkLevels(){
  let p=this.player;while(p.xp>=p.xpNext){p.xp-=p.xpNext;p.level++;p.xpNext=Math.round(BALANCE.growth.xpStart*p.level**BALANCE.growth.xpPower);this.pendingLevels++}
 }
 step(dt){
  if(this.state!=='playing')return;
  const p=this.player;this.elapsed+=dt;this.totalTime+=dt;this.waveTime+=dt;this.lifeHeal=Math.max(0,(this.lifeHeal||0)-p.maxHp*BALANCE.growth.lifestealCap*dt);
  p.iframe=Math.max(0,p.iframe-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.empCD=Math.max(0,p.empCD-dt);p.afterDash=Math.max(0,(p.afterDash||0)-dt);
  this.recalculate();if(this.stats.regen>=0)this.heal(this.stats.regen*dt);else{p.hp+=this.stats.regen*dt;if(p.hp<=0){this.damageLog.push({time:this.elapsed,source:'负生命回复 · 持续流失',raw:-this.stats.regen,actual:-this.stats.regen});this.endRun(false);return}}
  this.movePlayer(dt);this.updateCores(dt);const timeScale=this.coreState.timeLeft>0?BALANCE.core.time.scale:1;
  this.spawnTimer-=dt;
  if(this.spawnTimer<=0&&this.waveTime<this.waveDuration-2){
   this.spawnTimer=Math.max(.5,BALANCE.enemy.spawnInterval-this.wave*.017)/BALANCE.danger[this.danger].count;
   let count=1+Math.floor((this.wave-1)/5);if(this.waveRule==='tide')count=1;
   for(let i=0;i<count;i++)this.spawnEnemy();
  }
  if(this.waveRule==='boss'&&!this.bossSpawned&&this.waveTime>=2){this.bossSpawned=true;this.spawnEnemy('boss');UI.toast('执法核心已入场','红色地面预警先于伤害 · 留出冲刺')}
  this.updateEnemies(dt*timeScale);if(this.state!=='playing')return;
  this.updateWarnings(dt*timeScale);if(this.state!=='playing')return;
  for(const w of this.weapons){w.timer-=dt;w.recoil=Math.max(0,w.recoil-dt)}
  const blades=this.weapons.filter(w=>w.def.family==='blade');
  const launchGap=Math.min(BALANCE.melee.launchGap,...blades.map(w=>this.cooldownFor(w)/(blades.length+1)));
  // Oldest deadline first prevents high-haste front slots from starving rear slots.
  const fireOrder=this.weapons.filter(w=>w.def.family!=='blade').concat(blades.sort((a,b)=>a.timer-b.timer));
  for(const w of fireOrder)if(w.timer<=0){
   if(w.def.family==='blade'&&(this.elapsed<this.nextMeleeLaunch||this.slashes.some(s=>s.wuid===w.uid&&!s.derived)))continue;
   const fired=this.fire(w);w.timer=fired?this.cooldownFor(w):.1;
   if(fired&&w.def.family==='blade')this.nextMeleeLaunch=Math.max(this.nextMeleeLaunch,this.elapsed-dt)+launchGap;
   if(this.state!=='playing')return;
  }
  this.updateSlashes(dt);this.updateBullets(dt,timeScale);this.updateFields(dt);this.updatePickups(dt);this.checkLevels();this.enemies=this.enemies.filter(e=>!e.dead);
  this.sound.update(dt,p.hp/p.maxHp);
  if(this.waveTime>=this.waveDuration&&!this.enemies.some(e=>e.type==='boss')){this.completeWave();return}
  if(this.pendingLevels>0){this.pendingLevels--;this.postUpgrade='playing';UI.openUpgrade()}
 }
 completeWave(){
  if(this.completedWave)return;this.completedWave=true;
  for(let g of this.gems)this.collectGem(g,false);this.gems=[];for(let d of this.drops)this.satchel.push(d.item);this.drops=[];
  this.checkLevels();let interest=Math.min(BALANCE.shop.interestCap,Math.floor(this.player.credits*BALANCE.shop.interest)),bonus=BALANCE.shop.bonusBase+BALANCE.shop.bonusWave*this.wave;
  this.player.credits+=interest+bonus;this.ledger.bonus+=bonus;this.ledger.interest+=interest;
  this.heal(this.player.maxHp*.08,false);this.player.shield=0;this.enemies=[];this.bullets=[];this.fields=[];this.warnings=[];this.slashes=[];this.events=[];
  if(this.wave>=BALANCE.waves){this.endRun(true);return}
  if(this.pendingLevels>0){this.pendingLevels--;this.postUpgrade='shop';UI.openUpgrade()}else this.openShop();
 }
 nextWave(){
  if(this.state!=='shop')return false;this.wave++;this.state='playing';this.resetInput();this.setupWave();UI.showGame();UI.toast('第 '+String(this.wave).padStart(2,'0')+' 波',RULE_NAMES[this.waveRule]);return true;
 }
 endRun(victory){
  if(this.state==='gameover'||this.state==='victory')return;
  this.state=victory?'victory':'gameover';this.resetInput();this.best.wave=Math.max(this.best.wave,this.wave);this.best.kills=Math.max(this.best.kills,this.player.kills);
  if(victory)this.best.unlocked=Math.min(5,Math.max(this.best.unlocked,this.danger+1));
  try{localStorage.setItem('neon-spud-corebreak',JSON.stringify(this.best))}catch(e){}
  UI.showResult(victory);this.sound.tone(victory?650:90,.5,'sine',.2,victory?900:25);
 }
 rarityWeights(){
  let row=BALANCE.rarity.bands[0];for(let r of BALANCE.rarity.bands)if(this.wave>=r.wave)row=r;
  return row.weights.map((w,i)=>w*Math.max(.1,1+this.stats.luck/100*BALANCE.rarity.luck[i]));
 }
 rollRarity(){return weighted([0,1,2,3,4],this.rarityWeights(),this.rng)}
 rollItem(){
  let r=Math.min(3,this.rollRarity()),pool=ITEMS.filter(d=>d.rarity===r&&(this.items.filter(id=>id===d.id).length<d.max)&&!(d.special==='slot'&&this.character.slots));
  if(!pool.length)pool=ITEMS.filter(d=>d.special!=='slot');return pool[Math.floor(this.rng()*pool.length)].id;
 }
 inflation(){let w=this.wave-1;return Math.min(BALANCE.shop.inflationCap,1+BALANCE.shop.baseInflation*w+BALANCE.shop.quadratic*w*w)}
 price(base,level=1,terminal=false){
  let cost=base*this.inflation()*(terminal?BALANCE.shop.terminalPrice:BALANCE.shop.levelPrice**(level-1));
  if(this.has('vault'))cost*=BALANCE.core.vault.price;return Math.round(cost);
 }
 matchingWeapon(){return this.weapons.find(w=>w.uid===this.targetUid&&!w.def.terminal&&w.level<4)||this.weapons.filter(w=>!w.def.terminal&&w.level<4)[Math.floor(this.rng()*this.weapons.filter(w=>!w.def.terminal&&w.level<4).length)]}
 weaponOffer(forceMatch=false){
  let match=this.matchingWeapon();
  if(match&&(forceMatch||this.rng()<BALANCE.shop.matchChance))return {kind:'weapon',id:match.id,level:match.level,price:this.price(match.def.price,match.level),match:true,locked:false,sold:false};
  let terminal=this.wave>=BALANCE.shop.terminalWave&&this.rng()<BALANCE.shop.terminalChance*Math.max(.25,1+this.stats.luck/100);
  let rarity=this.rollRarity(),pool=WEAPONS.filter(d=>this.characterAllows(d)&&(terminal?d.terminal:!d.terminal)&&(!d.terminal||!this.weapons.some(w=>w.id===d.id)));
  if(terminal&&!pool.length){terminal=false;pool=WEAPONS.filter(d=>this.characterAllows(d)&&!d.terminal)}
  if(!terminal){
   let tier=pool.filter(d=>d.rarity===rarity);if(tier.length)pool=tier;
   if(this.character.spec&&this.rng()<BALANCE.shop.specialistChance){let spec=pool.filter(d=>d.tags.includes(this.character.spec));if(spec.length)pool=spec}
  }
  let d=pool[Math.floor(this.rng()*pool.length)],band=0;for(let i=0;i<4;i++)if(this.wave>=BALANCE.shop.levelUnlock[i])band=i;
  let level=d.terminal?4:weighted([1,2,3,4],BALANCE.shop.levelWeights[band],this.rng);
  return {kind:'weapon',id:d.id,level,price:this.price(d.price,level,d.terminal),locked:false,sold:false};
 }
 coreOffer(){
  let pool=CORES.filter(c=>!this.has(c.id));if(!pool.length)return null;
  let preferred=pool.filter(c=>c.tags.some(t=>(this.tags[t]||0)>=2));if(preferred.length&&this.rng()<.55)pool=preferred;
  let c=pool[Math.floor(this.rng()*pool.length)];return {kind:'core',id:c.id,price:this.price(c.price),locked:false,sold:false};
 }
 refreshOffers(){
  let guarantee=BALANCE.shop.coreGuarantee.includes(this.wave)&&!this.coreOfferedAt.has(this.wave);
  let unlocked=[];for(let i=0;i<4;i++)if(!this.offers[i]?.locked||this.offers[i].sold)unlocked.push(i);
  let chance=this.wave>=BALANCE.shop.coreWave?clamp(BALANCE.shop.coreChance+this.wave*BALANCE.shop.coreWaveGrowth+this.stats.luck*BALANCE.shop.coreLuckGrowth,0,BALANCE.shop.coreChanceCap):0;
  let weaponSeen=this.offers.some(o=>o?.locked&&!o.sold&&o.kind==='weapon'),itemSeen=this.offers.some(o=>o?.locked&&!o.sold&&o.kind!=='weapon');
  for(let n=0;n<unlocked.length;n++){
   let i=unlocked[n],offer;
   if(guarantee&&n===unlocked.length-1){offer=this.coreOffer();if(offer){guarantee=false;this.coreOfferedAt.add(this.wave)}}
   if(!offer){
    let wantWeapon=!weaponSeen||itemSeen&&this.rng()<.52;
    if(wantWeapon){offer=this.weaponOffer();weaponSeen=true}
    else if(this.rng()<chance)offer=this.coreOffer();
    if(!offer){let id=this.rollItem();offer={kind:'item',id,price:this.price(ITEMS[id].price),locked:false,sold:false};itemSeen=true}
   }
   this.offers[i]=offer;
  }
  let matches=this.offers.some(o=>!o.sold&&o.kind==='weapon'&&this.weapons.some(w=>w.id===o.id&&w.level===o.level&&!w.def.terminal&&w.level<4));
  this.misses=matches?0:this.misses+1;
  if(this.misses>=BALANCE.shop.pity&&this.matchingWeapon()){
   let idx=unlocked.find(i=>this.offers[i].kind==='weapon');if(idx!==undefined){this.offers[idx]=this.weaponOffer(true);this.misses=0}
  }
  this.offers.forEach(o=>{if(o?.kind==='core')this.coreOfferedAt.add(this.wave)});
 }
 openShop(){this.state='shop';this.resetInput();this.rerolls=0;this.refreshOffers();UI.renderShop()}
 rerollCost(){return Math.round(BALANCE.shop.rerollBase+this.wave*BALANCE.shop.rerollWave+this.rerolls*BALANCE.shop.rerollLinear+this.rerolls*this.rerolls*BALANCE.shop.rerollSquare)}
 reroll(){
  let cost=this.rerollCost();if(this.state!=='shop'||this.player.credits<cost||this.offers.every(o=>o.locked&&!o.sold))return false;
  this.player.credits-=cost;this.ledger.spent+=cost;this.rerolls++;this.refreshOffers();this.recalculate();return true;
 }
 buyOffer(index,mode='equip',replace=null){
  if(this.state!=='shop')return {ok:false,reason:'只能在商店购买。'};
  let o=this.offers[index];if(!o||o.sold||this.player.credits<o.price)return {ok:false,reason:'信用点不足或商品已售出。'};
  if(o.kind==='weapon'){
   let def=WEAPONS[o.id];if(!this.characterAllows(def))return {ok:false,reason:'角色不能装备此类武器。'};
   if(mode==='merge'){
    let w=this.weapons.find(w=>w.id===o.id&&w.level===o.level&&!w.def.terminal&&w.level<4);
    if(!w)return {ok:false,reason:'没有同型号、同改装、同等级的合成对象。'};
    w.level++;w.paid+=o.price;
   }else if(!this.equip(o.id,o.level,o.price))return {ok:false,reason:def.terminal?'终式同名唯一，或槽位已满。':'武器槽已满：可购买并合成，或先拆除武器。'};
  }else if(o.kind==='item'){
   let item=ITEMS[o.id];if(this.items.filter(id=>id===item.id).length>=item.max||item.special==='slot'&&this.character.slots)return {ok:false,reason:'已达持有限制，或角色不能扩槽。'};
   this.items.push(item.id);
  }else{
   if(this.has(o.id))return {ok:false,reason:'同名核心唯一。'};
   if(this.cores.length>=BALANCE.slots.core){if(!this.cores.includes(replace))return {ok:false,reason:'必须选择要替换的核心。'};this.cores=this.cores.filter(id=>id!==replace)}
   this.cores.push(o.id);
  }
  this.player.credits-=o.price;this.ledger.spent+=o.price;this.gameStats.purchases++;o.sold=true;o.locked=false;this.recalculate();return {ok:true};
 }
 installLoot(index,discard=false){
  if(this.state!=='shop')return false;let id=this.satchel[index];if(id===undefined)return false;
  if(discard){let money=Math.round(ITEMS[id].price*.22);this.player.credits+=money;this.ledger.salvage+=money}
  else{let d=ITEMS[id];if(this.items.filter(i=>i===id).length>=d.max||d.special==='slot'&&this.character.slots)return false;this.items.push(id)}
  this.satchel.splice(index,1);this.recalculate();return true;
 }
 repairCost(){return Math.ceil(Math.min(this.player.maxHp*.3,this.player.maxHp-this.player.hp)*BALANCE.shop.healPerHp*(1+this.wave*.03))}
 repair(){let cost=this.repairCost();if(this.state!=='shop'||cost<=0||this.player.credits<cost)return false;this.player.credits-=cost;this.ledger.spent+=cost;this.heal(this.player.maxHp*.3,false);this.recalculate();return true}
 upgradeChoices(){
  let avoid=new Set(this.upgradeHistory.slice(-6)),pool=UPGRADES.filter(u=>!avoid.has(u.id)),risky=pool.filter(u=>u.risky);
  if(!risky.length)risky=UPGRADES.filter(u=>u.risky);
  let ids=[risky[Math.floor(this.rng()*risky.length)].id];
  if(this.player.hp/this.player.maxHp<.4){let defense=pool.filter(u=>!ids.includes(u.id)&&((u.stats.maxHp||0)>0||(u.stats.regen||0)>0));if(defense.length)ids.push(defense[Math.floor(this.rng()*defense.length)].id)}
  while(ids.length<3){let choices=pool.filter(u=>!ids.includes(u.id));if(!choices.length)choices=UPGRADES.filter(u=>!ids.includes(u.id));ids.push(choices[Math.floor(this.rng()*choices.length)].id)}
  return ids.sort(()=>this.rng()-.5);
 }
 selectUpgrade(id){
  if(this.state!=='upgrade')return false;this.upgrades.push(id);this.upgradeHistory.push(id);this.recalculate();
  if(this.pendingLevels>0){this.pendingLevels--;UI.openUpgrade()}else if(this.postUpgrade==='shop')this.openShop();else{this.state='playing';UI.showGame()}return true;
 }
 coreStatus(id){
  const c=this.coreState,p=this.player,b=BALANCE.core;
  switch(id){
   case 'blood':return {progress:p.hp/p.maxHp<=b.blood.threshold?1:0,text:p.hp/p.maxHp<=b.blood.threshold?'已激活 · 攻速 +60%':'血量 '+Math.ceil(p.hp/p.maxHp*100)+'% / 需 ≤40%'};
   case 'echo':{let ws=this.weapons.filter(w=>w.def.family==='blade'),max=Math.max(0,...ws.map(w=>w.combo));return {progress:max/3,text:ws.length?ws.length+' 把太刀 · 各自三段计数':'缺少高频太刀'}}
   case 'quantum':{let ws=this.weapons.filter(w=>DIRECT_FAMILIES.has(w.def.family)&&!w.def.tags.includes('工程'));return {progress:ws.length?Math.max(...ws.map(w=>w.shots%3))/3:0,text:ws.length?ws.length+' 把直射 · 每三轮追击':'缺少直射武器'}}
   case 'hive':return {progress:Math.min(1,(this.tags['工程']||0)/3),text:(this.tags['工程']||0)+'/3 工程 · '+(this.tags['工程']>=3?'伴机上线':'等待部署')};
   case 'fusion':{let families=new Set(this.weapons.map(w=>w.def.family)),n=Number(families.has('flame'))+Number(families.has('cryo'))+Number(['tesla','storm','nova'].some(f=>families.has(f)));return {progress:n/3,text:n+'/3 元素来源 · '+(n===3?'三态就绪':'需火、冰、电')}}
   case 'singularity':return {progress:this.weapons.some(w=>w.def.tags.includes('爆裂'))?1:0,text:'一次主爆炸需命中 3 个目标'};
   case 'vault':{let n=Math.min(6,Math.floor(p.credits/60));return {progress:n/6,text:Math.floor(p.credits)+'/360 信用点 · 伤害 +'+n*4+'%'}}
   case 'salvage':return {progress:Math.min(1,c.charge/12),text:Math.floor(c.charge)+'/12 充能 · 主命中释放'};
   case 'bulwark':return {progress:Math.min(1,c.blocked/30),text:Math.floor(c.blocked)+'/30 实际减伤储能'};
   case 'time':return {progress:c.timeLeft>0?1:c.noHit/8,text:c.timeLeft>0?'时间减速 · '+c.timeLeft.toFixed(1)+'s':c.noHit.toFixed(1)+'/8s 无伤'};
   case 'phase':return {progress:Math.min(1,(p.dashHits?.size||0)/3),text:(p.dashHits?.size||0)+'/3 穿阵 · 冲刺 '+p.dashCD.toFixed(1)+'s'};
   case 'parasite':return {progress:c.parasite>0?1:0,text:c.parasite>0?'猎杀增幅 · '+c.parasite.toFixed(1)+'s':'4 米内击杀精英 / 首领'};
  }
  return {progress:0,text:'未激活'};
 }
 updateEffects(dt){
  for(let p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=12*dt}this.particles=this.particles.filter(p=>p.life>0);
  for(let key of ['beams','rings','meleeTrails','impactCuts']){for(let v of this[key])v.life-=dt;this[key]=this[key].filter(v=>v.life>0)}
  for(let n of this.numbers){n.life-=dt;n.y+=dt*1.2}this.numbers=this.numbers.filter(n=>n.life>0);
  this.shake=Math.max(0,this.shake-dt*2);this.damageFlash=Math.max(0,this.damageFlash-dt*2);
  let ratio=this.player.hp/this.player.maxHp;if(this.trailHold>0)this.trailHold-=dt;else this.healthTrail=Math.max(ratio,this.healthTrail-dt/BALANCE.health.delayed);if(ratio>this.healthTrail)this.healthTrail=ratio;
 }
 drawCity(r,t){r.mesh('box',0,-1.5,0,150,1,150,0x071423);r.mesh('box',0,-.45,0,44,.8,44,0x182b3d);r.mesh('box',0,-.015,0,43.2,.08,43.2,0x112831,0,0,0,0,1);r.mesh('ring',0,.045,0,7.8,1,7.8,0x315c64,.35);r.mesh('ring',0,.05,0,3.9,1,3.9,0x42817d,.5);r.mesh('ring',0,.055,0,.7,1,.7,0x74b6a1,.75);
 for(let i=-20;i<=20;i+=2){let col=i%4===0?0x66cebd:0x31596a;r.mesh('box',i,.12,-21.6,1.7,.12,.12,col,1);r.mesh('box',i,.12,21.6,1.7,.12,.12,col,1);r.mesh('box',-21.6,.12,i,.12,.12,1.7,col,1);r.mesh('box',21.6,.12,i,.12,.12,1.7,col,1)}
 for(let sx of [-1,1])for(let sz of [-1,1]){r.mesh('box',sx*21.4,.48,sz*21.4,.75,.9,.75,0x23384a);r.mesh('box',sx*21.4,.92,sz*21.4,.6,.08,.6,0xa8ffce,1.5);for(let j=0;j<6;j++)r.mesh('box',sx*(14+j*.6),.051,sz*19.5,.22,.04,1.25,0x8a835c,.23,0,sx*sz*.5);r.mesh('box',sx*20.9,.3,0,.5,.6,5,0x163746);r.mesh('box',sx*20.6,.62,0,.07,.08,4.6,0xc4f2a2,1)}
 for(let m of CITY.marks)r.mesh('box',m.x,.047,m.z,m.w,.022,.035,m.c,.15);
 for(let p of CITY.props){let {x,z}=p;if(p.type===0){r.mesh('box',x,.66,z,1.6,1.3,1.05,p.color,0,0,p.rot);r.mesh('box',x,1.33,z,1.4,.04,.88,0x47657a);r.mesh('box',x,1.38,z,.8,.045,.15,0xb4df8a,.7,0,p.rot)}else if(p.type===1){r.mesh('cylinder',x,.6,z,.46,1.2,.46,0x3b4052);r.mesh('cylinder',x,.63,z,.47,.1,.47,0xfaad6e,1.05)}else{r.mesh('box',x,.35,z,1.8,.7,.8,0x304356,0,0,p.rot);r.mesh('box',x,.74,z,1.3,.06,.08,0x68dcd0,1.1,0,p.rot)}}
 for(let b of (this.visualQuality?CITY.buildings:CITY.buildings.slice(0,42))){r.mesh('box',b.x,b.h/2-1,b.z,b.w,b.h,b.d,b.col);r.mesh('box',b.x,b.h-.9,b.z,b.w+.2,.23,b.d+.2,0x263e51);r.mesh('box',b.x,b.h,b.z,b.w*.64,.15,b.d*.7,b.neon,.8);for(let y=1;y<b.h-1;y+=2.05){for(let j=-1;j<=1;j++){let lit=Math.sin(j*9+y*3+b.seed)>.05;if(lit){r.mesh('box',b.x+j*b.w*.25,y,b.z+b.d/2+.03,b.w*.13,.64,.05,b.neon,.7);r.mesh('box',b.x+b.w/2+.03,y,b.z+j*b.d*.25,.05,.64,b.d*.13,b.neon,.7)}}}if(b.seed>6){r.mesh('box',b.x,b.h+1.2,b.z,.13,2.4,.13,0x46626d);r.mesh('sphere',b.x,b.h+2.4,b.z,.12,.12,.12,b.neon,1.4)}if(b.seed<3){r.mesh('box',b.x,b.h*.7,b.z+b.d/2+.11,b.w*.8,2,.1,0x182d42);for(let j=0;j<3;j++)r.mesh('box',b.x,b.h*.7+(j-1)*.45,b.z+b.d/2+.19,b.w*(j===1?.58:.68),.16,.025,b.neon,1.05)}}
 // Thin overhead cables, floating traffic, runway beacons.
 for(let i=0;i<4;i++){let z=-27-i*6;r.line(-40,10+i,z,40,10+i,z,.035,0x18354b,.3)}for(let i=0;i<7;i++){let xx=((t*(2+i*.2)+i*15)%100)-50,z=-28-(i%3)*5,y=5+i*.65;r.mesh('box',xx,y,z,1.8,.35,.7,0x293c50);r.mesh('box',xx-1,y,z,.2,.12,.52,0x74e7e3,1.6)}
 if(this.rain&&this.visualQuality){for(let i=0;i<125;i++){let x=Math.sin(i*12.87)*25,z=Math.cos(i*8.62)*25,y=((i*.71-t*8)%12+12)%12;r.line(x,y,z,x+.08,y-.55,z+.05,.009,0x315562,.5)}}
 }
 drawWeapon(r,x,y,z,a,d,scale=1){let c=Math.cos(a),s=Math.sin(a),col=d.color,base=0x26384c;let part=(type,lx,ly,lz,sx,sy,sz,color,em=0,ry=0,rx=0)=>r.mesh(type,x+(lx*c+lz*s)*scale,y+ly*scale,z+(-lx*s+lz*c)*scale,sx*scale,sy*scale,sz*scale,color,em,rx,a+ry);let f=d.family;
 if(['blade','orbit','boomerang'].includes(f)){part('box',0,0,0,.15,.13,.4,0x263347);part('box',0,.02,.55,.10,.055,.87,col,1.3);part('box',0,.02,.05,.5,.075,.12,base);return}
 if(['tesla','gravity','nova'].includes(f)){part('sphere',0,.02,.18,.22,.24,.34,base);part('sphere',0,.04,.30,.13,.16,.23,col,1.5);part('box',-.2,0,.43,.06,.09,.44,0x608697);part('box',.2,0,.43,.06,.09,.44,0x608697);return}
 part('box',0,0,.1,.27,.23,.58,base);part('box',0,-.17,-.03,.12,.26,.16,0x152137);part('box',-.145,.02,.08,.025,.08,.36,col,1.25);part('box',.145,.02,.08,.025,.08,.36,col,1.25);
 if(f==='gatling'){for(let i=0;i<4;i++){let aa=TAU*i/4+this.realTime*5;part('box',Math.sin(aa)*.095,Math.cos(aa)*.095,.66,.07,.07,.6,0x4d6472)}part('box',0,0,.46,.32,.3,.11,col,.8)}else if(f==='rocket'||f==='seeker'){part('box',0,.05,.46,.33,.3,.52,0x48617a);part('cone',0,.06,.83,.13,.3,.13,col,.5,0,Math.PI/2)}else if(f==='plasma'||f==='acid'||f==='cryo'){part('sphere',0,.04,.4,.2,.18,.25,col,1.2);part('box',0,.06,.62,.25,.2,.2,0x4d677b)}else if(f==='scatter'){part('box',-.09,.03,.57,.1,.13,.5,0x728294);part('box',.09,.03,.57,.1,.13,.5,0x728294)}else{part('box',0,.03,.62,.105,.11,f==='rail'?.84:.55,0x6c8190);part('box',0,.16,.16,.13,.08,.23,col,1.1)}
 }
 drawEnemy(r,e,t){let x=e.x,z=e.z,a=e.angle,c=Math.cos(a),s=Math.sin(a),col=e.hit>0?0xffffff:e.slow>0?0x81d9ef:e.color,scale=e.radius/.5;let part=(type,lx,y,lz,sx,sy,sz,color,em=0,ry=0)=>r.mesh(type,x+(lx*c+lz*s)*scale,y*scale,z+(-lx*s+lz*c)*scale,sx*scale,sy*scale,sz*scale,color,em,0,a+ry);r.mesh('cylinder',x,.045,z,e.radius*1.24,.015,e.radius*.94,0x050d16);
 if(e.type==='boss'){scale=2.5;part('box',0,1.07,0,1.4,1.5,1,0x392637);part('box',0,1.92,.12,1.15,.55,.75,0x523342);part('box',0,1.92,.55,.85,.11,.05,col,1.5);part('sphere',0,1.09,.59,.28,.28,.08,col,1.4);for(let k of [-1,1]){part('box',k*.82,1.35,0,.45,1,.8,0x4b3b4b);part('box',k*.85,1.15,.7,.23,.24,.95,0x374453);part('box',k*.48,.28,.07,.45,.55,.65,0x4a3448);part('box',k*.85,1.25,1.17,.18,.17,.07,col,1.5)}r.mesh('ring',x,.12,z,3.6,1,3.6,0xb43d66,.8);return}
 if(e.type==='skitter'){part('octa',0,.52,0,.51,.40,.48,0x43404b);part('sphere',0,.61,.30,.23,.14,.09,col,1.2)}else if(e.type==='tank'){part('box',0,.67,0,.92,1.1,.80,0x343043);part('box',0,1.12,.44,.63,.12,.08,col,1.3);part('box',0,.43,.43,.45,.43,.07,0x645374)}else{part('sphere',0,.73,0,.47,.52,.40,0x293b50);part('box',0,.82,.36,.70,.2,.12,col,1.05);part('box',0,.76,.44,.34,.085,.04,0xffded7,1.3);if(e.type==='shooter')part('box',.4,.72,.4,.19,.22,.65,0x6c4852);if(e.type==='splitter'){part('sphere',0,.9,-.24,.32,.36,.27,0x639a64,.45)}if(e.type==='charger')part('cone',0,.8,.62,.22,.7,.22,col,.6)}
 for(let k of [-1,1]){let step=Math.sin(e.age*10+k)*.15;part('box',k*.33,.18,.1+step,.22,.26,.38,0x425264);part('box',k*.48,.53,-.02,.13,.42,.16,0x3e5367,0,k*.3)}if(e.burn>0)r.mesh('sphere',x,1.1*scale,z,.16,.3,.16,0xffb557,1.7);
 }

 drawBody(r,t,preview){
  let p=this.player,x=p.x,z=p.z,face=preview?this.camYaw+.3:p.angle,c=Math.cos(face),s=Math.sin(face),model=this.character.model;
  let emColor=parseInt(this.character.color.slice(1),16),skin=0xb68b62,dark=0x203346,steel=0x748a9a;
  let float=['elemental','vampire'].includes(model)?Math.sin(t*2.2)*.13:Math.sin(p.walk)*.035;
  const part=(type,lx,y,lz,sx,sy,sz,col=dark,em=0,ry=0,rx=0,rz=0)=>r.mesh(type,x+lx*c+lz*s,y+float,z-lx*s+lz*c,sx,sy,sz,col,em,rx,face+ry,rz);
  r.mesh('cylinder',x,.04,z,1.25,.016,1,0x050c16);
  let hp=p.hp/p.maxHp,healthColor=hp<.25?0xff7085:hp<.5?0xffc377:0x80e5c5;
  if(!preview)for(let i=0;i<24;i++){let a=i*TAU/24,b=a+TAU/24*.68;let col=i/24<hp?healthColor:0x294b52;r.line(x+Math.sin(a)*1.36,.07,z+Math.cos(a)*1.36,x+Math.sin(b)*1.36,.07,z+Math.cos(b)*1.36,.055,col,i/24<hp?1:.1)}
  if(p.iframe>0)r.mesh('ring',x,.12,z,1.52,1,1.52,0xe4fff0,1);
  if(model==='armor'){
   part('box',0,1.42,0,1.95,1.85,1.25,0x465065);part('box',0,2.4,.05,1.25,.65,1.05,0x65758b);
   part('box',0,1.5,.7,1.2,.95,.14,0x8b9eaa);part('box',0,1.5,.79,.3,.33,.06,emColor,1.2);
   for(let side of [-1,1]){part('box',side*.87,.37,0,.65,.65,1.75,0x1e283a);for(let j=-2;j<=2;j++)part('box',side*.87,.41,j*.3,.73,.12,.16,0x6b7b89);part('box',side*1.07,1.9,0,.65,.8,1.15,0x576982)}
  }else if(model==='vampire'){
   part('octa',0,1.48,0,.32,.62,.3,0xfa506e,1.2,0,t*.3);
   for(let side of [-1,1]){
    part('box',side*.62,1.45,-.2,.15,1.65,.26,0x261d30,0,0,0,side*.14);
    for(let i=0;i<4;i++)part('box',side*.46,.9+i*.31,.13,.5,.12,.54,0x513747,0,side*.32);
    part('cone',side*.59,2.72,-.03,.2,.8,.22,0x463044,0,0,0,-side*.35);
    part('cone',side*.68,.5,-.15,.28,.7,.27,0x191e32);
   }
   part('sphere',0,2.25,.05,.53,.5,.43,0x60464e);part('box',0,2.3,.46,.85,.14,.06,0xff6a81,1.3);
  }else if(model==='elemental'){
   part('octa',0,1.5,0,.53,.83,.5,0x81cbca,.5,t*.5);
   for(let i=0;i<3;i++){let a=t*.5+i*TAU/3;part('octa',Math.sin(a)*1.02,1.95+Math.sin(a*2)*.23,Math.cos(a)*1.02,.24,.48,.23,[0xff925b,0x85e7ff,0xc099ff][i],1.1,a);part('box',Math.sin(i*TAU/3)*.65,1.15,Math.cos(i*TAU/3)*.65,.5,.95,.2,0x263d52,0,i*TAU/3)}
   part('sphere',0,2.5,0,.36,.34,.34,0xbda780);part('box',0,2.51,.32,.52,.13,.05,emColor,1.3);
   part('cone',0,.55,0,.4,.55,.4,0x364259,0,0,Math.PI);
  }else if(model==='engineer'){
   part('sphere',0,1.15,0,1.03,.83,.88,0xb2976f);part('cylinder',0,1.85,0,.78,.3,.65,0x426075);
   part('box',0,1.32,-.75,1.3,1.3,.55,0x354c64);part('box',0,1.6,-1.06,.72,.7,.12,emColor,.8);
   for(let side of [-1,1]){part('box',side*1.05,1.6,-.18,.18,.85,.24,0x8da4ad,0,0,0,side*.3);part('sphere',side*1.2,1.95,-.1,.21,.21,.21,emColor,.6);part('box',side*1.35,1.72,.3,.14,.2,.9,0x455e70);part('box',side*.64,.32,.15,.53,.4,.7,0x354459)}
  }else if(model==='demolition'){
   part('cylinder',0,1.45,0,.9,1.95,.8,0x77604b);for(let y of [.64,1.48,2.27])part('cylinder',0,y,0,.96,.15,.87,0x394356);
   part('box',0,1.65,.83,.5,.55,.08,0xffa65f,.8);
   for(let side of [-1,1]){part('cylinder',side*.89,2.0,-.22,.23,1.55,.23,0x62707e);part('cone',side*.89,2.98,-.22,.25,.55,.25,0xffa15b,.5);part('box',side*.5,.22,.1,.45,.32,.72,dark)}
  }else{
   let slender=['lone','dancer','sniper'].includes(model),sx=slender?.65:model==='gunner'?.97:.83,sy=slender?1.22:1.03;
   if(model==='gambler'){part('box',0,1.48,0,1.48,1.65,1.17,0xa98565,0,0,0,.08);for(let side of [-1,1])for(let k=0;k<3;k++)part('sphere',side*.38,1.15+k*.29,.62,.07,.07,.045,emColor,.6)}
   else {part('sphere',0,1.4,0,sx,sy,.67,skin);part('sphere',-.08,2.1,0,sx*.68,.4,.49,0xc3a27a)}
   let step=Math.sin(p.walk)*.11;
   for(let side of [-1,1]){part('box',side*(slender?.31:.43),.27,.06+side*step,.42,.4,.65,dark);part('box',side*sx*.91,1.32,.02,.27,.62,.33,0x405060,0,0,0,side*.12)}
   part('box',0,.95,.05,sx*2.03,.2,1.28,dark);part('box',0,.95,.72,.23,.18,.06,emColor,.9);
   if(model==='lone'){
    part('cone',0,1.37,-.53,1.05,1.8,.35,0x293142,0,0,Math.PI);part('box',-.96,1.71,-.08,.36,1,.65,0x566273);part('box',-.9,2.2,.3,.48,.22,.9,0x85979e);
   }else if(model==='gunner'){
    for(let side of [-1,1]){part('cylinder',side*1.1,1.9,-.07,.4,.8,.4,0x65707f,0,0,Math.PI/2);for(let j=0;j<3;j++)part('box',side*1.1+(j-1)*.14,2.04,.7,.1,.1,.6,0x99a8ae);part('box',side*.5,1.65,-.71,.45,.75,.3,0xe0b76d)}
   }else if(model==='scavenger'){
    part('box',-.27,1.45,-.8,1.3,1.4,.62,0x5e6350);part('box',.75,2.23,-.49,.07,1.6,.07,0x91aab0);part('sphere',.75,3.06,-.49,.18,.18,.18,emColor,1.1);part('cylinder',.97,1.05,.28,.35,.2,.35,0x829671,0,0,Math.PI/2);
   }else if(model==='dancer'){
    for(let side of [-1,1]){part('box',side*.73,2.08,-.35,.15,.15,2.1,0xa8b8c4,.15,side*.3,-.62);part('box',side*.68,2.5,-.75,.22,.75,.12,emColor,.7,0,0,side*.25)}
    part('box',0,1.21,.59,1.17,.15,.25,0xd1bacb);part('box',.37,.67,-.2,.18,1,.46,0x5d4669,0,0,0,-.12);
   }else if(model==='sniper'){
    part('cone',0,1.26,-.5,.86,1.5,.32,0x354857,0,0,Math.PI);part('box',-.68,2.75,-.15,.06,1.1,.06,0x9eb1b8);part('sphere',-.68,3.32,-.15,.12,.12,.12,emColor,.9);part('box',.61,2.04,.35,.4,.42,.7,0x465f75);part('cylinder',.61,2.05,.73,.17,.16,.17,emColor,1.1,0,Math.PI/2);
   }else if(model==='gambler'){
    part('box',0,2.41,-.01,1.48,.18,1.1,0x32263f);part('box',0,2.65,-.13,.88,.42,.72,0x634975);part('box',.85,1.55,.17,.32,.46,.1,emColor,.6,0,0,.3);
   }else{
    part('box',-.67,2.08,-.21,.08,.9,.08,0x68838c);part('sphere',-.67,2.58,-.21,.12,.12,.12,emColor,1.2);
   }
  }
  if(!['vampire','elemental'].includes(model)){
   let yy=model==='armor'?2.43:model==='engineer'?1.62:model==='demolition'?2.08:1.94,zz=model==='engineer'?.79:model==='armor'?.61:.64;
   part('box',0,yy,zz,model==='armor'?1.07:1.03,.3,.13,0x182536);
   if(model==='lone'||model==='sniper')part('box',.05,yy,zz+.08,.48,.095,.045,emColor,1.4);
   else for(let side of [-1,1])part('box',side*.26,yy,zz+.08,.24,.085,.045,emColor,1.4);
  }
  if(p.shield>0&&!preview)r.mesh('ring',x,.26,z,1.65,1,1.65,0xaed9ff,1.3);
 }
 bladePose(w,s=null){
  const home=this.bladeHome(w),idle=home.a,idleReach=Math.min(3.4,this.rangeFor(w)*.8);
  let a=idle,phase='idle',height=home.y,reach=idleReach-home.r;
  let shape=s||{range:idleReach,socketA:home.a};
  if(s){
   const q=this.slashPosition(s);height=s.height??home.y;
   const smooth=v=>v*v*(3-2*v),start=s.a-s.dir*s.arc/2;
   if(q.p<.2){phase='windup';let k=smooth(clamp(q.p/.2,0,1));a=idle+angleDiff(start,idle)*k;reach=mix(reach,this.bladeReach(s,a),k)}
   else if(q.p<=.7){phase='strike';a=q.a;reach=this.bladeReach(s,a)}
   else{phase='recovery';let k=smooth(clamp((q.p-.7)/.3,0,1)),end=s.a+s.dir*s.arc/2;a=end+angleDiff(idle,end)*k;reach=mix(this.bladeReach(s,a),reach,k)}
  }
  const origin=this.slashOrigin(shape);
  return {a,phase,height,reach,x:origin.x,z:origin.z,home,color:this.bladeColor(w)};
 }
 drawMeleeWeapon(r,w,t,s=null){
  const p=this.player,q=this.bladePose(w,s),a=q.a,ux=Math.sin(a),uz=Math.cos(a),px=Math.cos(a),pz=-Math.sin(a),y=q.height;
  const gx=q.x+ux*.16,gz=q.z+uz*.16,tx=q.x+ux*q.reach,tz=q.z+uz*q.reach;
  const col=q.color,active=q.phase==='strike',glow=this.weaponFX?BALANCE.visuals.bladeGlow:1.1,lean=active?(s.dir*.12):.18;
  // Permanent floating socket + short induction prongs, never a rotating aura.
  r.mesh('octa',q.x,y-.06,q.z,.19,.14,.19,0x60748a,.25,0,q.home.a);
  r.line(q.x-Math.cos(q.home.a)*.18,y-.09,q.z+Math.sin(q.home.a)*.18,q.x+Math.cos(q.home.a)*.18,y-.09,q.z-Math.sin(q.home.a)*.18,.055,col,.85);
  r.line(gx-ux*.35,y,gz-uz*.35,gx+ux*.05,y,gz+uz*.05,.14,0x1a2c40,.1);
  r.line(gx-px*.28,y,gz-pz*.28,gx+px*.28,y,gz+pz*.28,.09,0x708a9b,.3);
  r.line(gx-px*.24,y+.04,gz-pz*.24,gx+px*.24,y+.04,gz+pz*.24,.04,col,glow);
  const thick=w.def.variant===2?.21:.13;
  r.line(gx,y,gz,tx,y+lean,tz,thick,0x86a4b9,.4);
  for(const side of [-1,1])r.line(gx+side*px*thick*.55,y+.025,gz+side*pz*thick*.55,tx+side*px*.02,y+lean+.025,tz+side*pz*.02,.036,col,glow);
  r.mesh('octa',tx,y+lean,tz,.055,.06,.12,col,active?2.3:1.3,0,a);
  // Different pip counts preserve per-slot recognition without relying on hue.
  for(let j=0;j<=q.home.index%3;j++)r.mesh('box',gx-ux*(.13+j*.09),y+.1,gz-uz*(.13+j*.09),.08,.03,.04,col,1.4,0,a);
  if(this.weaponFX&&active)r.line(q.x+ux*q.reach*.76,y+.05,q.z+uz*q.reach*.76,tx,y+lean+.05,tz,.045,0xfff4dc,2.1);
  this.drawnBlades.push({uid:w.uid,phase:q.phase,angle:a,home:q.home.a,x:q.x,z:q.z,height:y,tipX:tx,tipZ:tz,color:col});
 }
 drawBlade(r,s){
  // Echo/phase blades are thin independent amber ghosts; main blades use their sockets.
  const q=this.slashPosition(s),o=this.slashOrigin(s),a=q.a,reach=this.bladeReach(s,a),y=s.height??1.25;
  const ux=Math.sin(a),uz=Math.cos(a),alpha=clamp(1-q.p*.65,.2,1);
  r.line(o.x+ux*.4,y,o.z+uz*.4,o.x+ux*reach,y+.13,o.z+uz*reach,.06*alpha,0xffad65,1.7*alpha);
  r.line(o.x+ux*.5,y+.035,o.z+uz*.5,o.x+ux*reach,y+.17,o.z+uz*reach,.023,0xffefd4,1.5*alpha);
 }
 drawMeleeTrails(r){
  if(!this.weaponFX)return;
  const rows=this.touch?[[1,.065,1.9],[.89,.12,.75]]:[[1,.065,2.0],[.94,.13,1.25],[.83,.19,.5]];
  for(const t of this.meleeTrails){
   const fade=clamp(t.life/t.total,0,1),segments=Math.max(1,Math.ceil(Math.abs(t.a1-t.a0)*BALANCE.melee.trailSegments));
   for(let j=0;j<segments;j++){
    const a=mix(t.a0,t.a1,j/segments),b=mix(t.a0,t.a1,(j+1)/segments),ra=this.bladeReach(t,a),rb=this.bladeReach(t,b);
    for(const [fraction,width,em]of rows){const f=fade*fade;r.line(t.x+Math.sin(a)*ra*fraction,t.y+.055,t.z+Math.cos(a)*ra*fraction,t.x+Math.sin(b)*rb*fraction,t.y+.055,t.z+Math.cos(b)*rb*fraction,Math.max(.006,width*f*(t.heavy?1.25:1)),t.color,em*fade)}
   }
  }
  for(const q of this.impactCuts){let f=q.life/q.total,dx=Math.sin(q.a)*.5*f,dz=Math.cos(q.a)*.5*f;r.line(q.x-dx,q.y-.24,q.z-dz,q.x+dx,q.y+.24,q.z+dz,.045*f,q.color,2.1);r.line(q.x+dz*.6,q.y-.13,q.z-dx*.6,q.x-dz*.6,q.y+.13,q.z+dx*.6,.025*f,0xfff4dc,1.7)}
 }
 drawPlayer(r,t,preview=false){
  this.drawBody(r,t,preview);let p=this.player;this.drawnBlades=[];
  for(let w of this.weapons){
   if(w.def.family==='blade'){this.drawMeleeWeapon(r,w,t,this.slashes.find(s=>s.wuid===w.uid&&!s.derived));continue}
   let a=TAU*w.index/Math.max(1,this.weapons.length)+(preview?t*.14:p.angle*.2),rr=1.48,wx=p.x+Math.sin(a)*rr,wz=p.z+Math.cos(a)*rr,wy=1.2+(w.index%3)*.23,aim=preview?a:w.aim;
   r.line(p.x+Math.sin(a)*.64,1.23,p.z+Math.cos(a)*.64,wx,wy,wz,.065,0x435c70,.1);
   this.drawWeapon(r,wx-Math.sin(aim)*w.recoil,wy,wz-Math.cos(aim)*w.recoil,aim,w.def,.9);
   if(w.recoil>.055){let mx=wx+Math.sin(aim)*.86,mz=wz+Math.cos(aim)*.86;r.mesh('octa',mx,wy,mz,.13,.10,.19,w.def.color,this.weaponFX?2.2:1.4,0,aim);if(this.weaponFX)r.line(mx,wy,mz,mx+Math.sin(aim)*.42,wy,mz+Math.cos(aim)*.42,.045,0xfff2d5,2)}
   if(w.def.family==='orbit'){let oa=t*2.5+w.index*1.7,rr=this.rangeFor(w)*.89,ox=p.x+Math.sin(oa)*rr,oz=p.z+Math.cos(oa)*rr;r.mesh('box',ox,.85,oz,.13,.10,1.1,w.def.color,1.7,0,oa+Math.PI/2);if(this.weaponFX)r.line(ox-Math.cos(oa)*.55,.91,oz+Math.sin(oa)*.55,ox+Math.cos(oa)*.55,.91,oz-Math.sin(oa)*.55,.035,0xffefd3,1.7)}
   if(w.def.family==='drone'){let da=t*.75+w.index;this.drawDrone(r,p.x+Math.sin(da)*3.1,2.9,p.z+Math.cos(da)*3.1,w.def.color,t)}
  }
  for(let s of this.slashes)if(s.derived)this.drawBlade(r,s);
  this.drawMeleeTrails(r);
  let count=(this.has('hive')&&this.tags['工程']>=3?2:0)+(this.tags['工程']>=2?1:0);
  for(let i=0;i<count;i++){let a=t*.8+i*2.1;this.drawDrone(r,p.x+Math.sin(a)*4,3.15,p.z+Math.cos(a)*4,0xffb97b,t)}
 }
 drawDrone(r,x,y,z,col,t){
  r.mesh('box',x,y,z,.44,.2,.4,0x3f5b70);r.mesh('sphere',x,y,z+.25,.12,.09,.08,col,1.1);
  for(let side of [-1,1]){r.mesh('box',x+side*.37,y,z,.43,.045,.07,0xa0b4bd,.1,0,t*14);r.mesh('ring',x+side*.35,y+.015,z,.25,1,.25,col,.6)}
 }
 drawWorld(){
  let r=this.renderer,t=this.realTime,p=this.player,preview=this.state==='menu',portrait=innerWidth<760;
  let dist=preview?(portrait?12.5:12.5):this.cameraDistance,aimx=preview?(portrait?0:-4.4)*Math.cos(this.camYaw):p.x,aimz=preview?(portrait?0:4.4)*Math.sin(this.camYaw):p.z;
  let desiredTarget=[aimx,preview?1.1:0,aimz],desiredEye=[aimx+Math.sin(this.camYaw)*dist,dist*(preview?.6:1.1),aimz+Math.cos(this.camYaw)*dist];
  if(!this.camInitialized){r.eye=desiredEye;r.target=desiredTarget;this.camInitialized=true}
  else{r.eye=r.eye.map((v,i)=>mix(v,desiredEye[i],.16));r.target=r.target.map((v,i)=>mix(v,desiredTarget[i],.16))}
  if(this.screenShake&&this.shake>0){r.eye[0]+=rand(-1,1)*this.shake*.2;r.eye[2]+=rand(-1,1)*this.shake*.2}
  r.begin();this.drawCity(r,t);
  if(preview){r.mesh('cylinder',0,.0,0,3.1,.12,3.1,0x203645);r.mesh('ring',0,.08,0,3.2,1,3.2,0x609788,.7)}
  for(let b of this.barrels)if(!b.dead){r.mesh('cylinder',b.x,.58,b.z,.48,1.1,.48,0x3f4655);for(let y of [.25,.75])r.mesh('cylinder',b.x,y,b.z,.5,.13,.5,0xff9e62,.3);r.mesh('octa',b.x,.6,b.z+.46,.16,.18,.04,0xffd58c,.7)}
  for(let g of this.greed)if(!g.done){r.mesh('ring',g.x,.07,g.z,2,1,2,0xffb661,.9);r.mesh('octa',g.x,.8+Math.sin(t*3)*.12,g.z,.46,.6,.46,0xffaa52,1.2,0,t);for(let i=0;i<8;i++){let a=TAU*i/8;r.mesh('box',g.x+Math.sin(a)*2,.07,g.z+Math.cos(a)*2,.12,.05,.45,0xffb866,.6,0,a)}}
  for(let g of this.gems)r.mesh('octa',g.x,.25+Math.sin(t*3+g.spin)*.06,g.z,g.value>4?.25:.12,g.value>4?.35:.18,g.value>4?.25:.12,0x9cecc7,.9,0,t+g.spin);
  for(let d of this.drops){r.mesh('box',d.x,.4,d.z,.58,.62,.58,0x536b83,.1,0,t*.6);r.mesh('box',d.x,.42,d.z,.63,.14,.63,parseInt(RARITY_COLORS[ITEMS[d.item].rarity].slice(1),16),1,0,t*.6);r.mesh('ring',d.x,.065,d.z,.65,1,.65,0xe5c486,.7)}
  for(let f of this.fields){
   if(f.type==='mine'){r.mesh('cylinder',f.x,.17,f.z,.34,.19,.34,0x51667a);r.mesh('sphere',f.x,.3,f.z,.08,.08,.08,f.color,1.5);r.mesh('ring',f.x,.07,f.z,.58,1,.58,f.color,.5)}
   else if(f.type==='danger'){r.mesh('ring',f.x,.06,f.z,f.r,1,f.r,0x8a3852,.6)}
   else if(f.type==='gravity'||f.type==='pull'){
    r.mesh('sphere',f.x,.5,f.z,.33,.34,.33,0x181124);for(let i=0;i<3;i++){let radius=.75+i*.7;r.mesh('ring',f.x,.1+i*.15,f.z,radius,1,radius,f.color,.85,0,t+i)}
   }else{r.mesh('cylinder',f.x,.052,f.z,f.r,.014,f.r,0x33422d,.15);r.mesh('ring',f.x,.071,f.z,f.r,1,f.r,f.color,.6)}
  }
  for(let a of this.warnings){
   let p=clamp(1-a.time/a.total,0,1),col=a.barrel?0xffb367:0xff6384;
   if(a.type==='line'){
    r.line(a.x,.10,a.z,a.bx,.10,a.bz,.055,col,.6);
    let dx=a.bx-a.x,dz=a.bz-a.z,l=Math.hypot(dx,dz)||1,ox=dz/l*a.width,oz=-dx/l*a.width;
    r.line(a.x+ox,.085,a.z+oz,a.bx+ox,.085,a.bz+oz,.04,col,1);r.line(a.x-ox,.085,a.z-oz,a.bx-ox,.085,a.bz-oz,.04,col,1);
    r.line(a.x,.075,a.z,mix(a.x,a.bx,p),.075,mix(a.z,a.bz,p),Math.max(.08,a.width*.55),0x80364d,.6);
   }else{
    r.mesh('cylinder',a.x,.058,a.z,a.r,.012,a.r,0x442234,.25);
    r.mesh('ring',a.x,.083,a.z,a.r,1,a.r,col,1.0);r.mesh('ring',a.x,.092,a.z,a.r*p,1,a.r*p,col,.8);
    for(let i=0;i<4;i++){let aa=i*TAU/4+t*.4;r.mesh('box',a.x+Math.sin(aa)*a.r,.1,a.z+Math.cos(aa)*a.r,.15,.03,.48,col,.8,0,aa)}
   }
  }
  for(let e of this.enemies)if(!e.dead){
   this.drawEnemy(r,e,t);
   if(e.elite){r.mesh('ring',e.x,.07,e.z,e.radius*1.8,1,e.radius*1.8,0xffb15d,.9);r.mesh('octa',e.x,e.radius*2.6+1,e.z,.16,.21,.16,0xffc77b,.9,0,t);if(e.shield>0)r.mesh('ring',e.x,.48,e.z,e.radius*1.6,1,e.radius*1.6,0xa6d6ff,1)}
   if(e.windup>0)r.line(e.x,.12,e.z,e.x+e.cx*9,.12,e.z+e.cz*9,.09,0xff666d,1.2);
  }
  this.drawPlayer(r,preview?t:this.elapsed,preview);
  let fxBudget=this.touch?BALANCE.visuals.mobileBulletTrails:BALANCE.visuals.bulletTrails;
  for(let b of this.bullets){
   let a=Math.atan2(b.dx,b.dz);
   if(this.weaponFX&&!b.enemy&&fxBudget-->0){
    let length=Math.min(b.age*b.speed,['rocket','seeker'].includes(b.type)?1.1:b.type==='plasma'?.75:.65),yy=b.y||1;
    if(length>.02){r.line(b.x,b.type==='flame'?.7:yy,b.z,b.x-b.dx*length,yy,b.z-b.dz*length,b.type==='plasma'?.13:.045,b.color,1.5);r.line(b.x,yy+.015,b.z,b.x-b.dx*length*.35,yy+.015,b.z-b.dz*length*.35,.025,0xfff2dc,1.9)}
   }
   if(b.type==='plasma'){r.mesh('sphere',b.x,.9,b.z,b.radius,b.radius,b.radius,b.color,1.2)}
   else if(b.type==='boomerang'){r.mesh('box',b.x,.9,b.z,.95,.1,.16,b.color,1.1,0,t*17);r.mesh('box',b.x,.9,b.z,.16,.1,.95,b.color,1.1,0,t*17)}
   else if(b.type==='enemy')r.mesh('sphere',b.x,.65,b.z,b.radius,b.radius,b.radius,b.color,1.2);
   else if(b.type==='flame')r.mesh('sphere',b.x,.7,b.z,.21+b.age*.15,.22,.21+b.age*.15,b.color,1.1);
   else r.mesh('box',b.x,b.y||1,b.z,b.type==='rocket'?.18:.07,b.type==='rocket'?.18:.07,b.type==='cryo'?.65:.47,b.color,1.3,0,a);
  }
  for(let b of this.beams){let a=b.life/b.total;r.line(b.ax,b.ay,b.az,b.bx,b.by,b.bz,Math.max(.01,b.width*a),b.color,1.55);if(this.weaponFX)r.line(b.ax,b.ay+.012,b.az,b.bx,b.by+.012,b.bz,Math.max(.008,b.width*a*.28),0xffedda,1.7)}
  for(let q of this.rings){let p=1-q.life/q.total,rr=q.max*(.2+p*.8);r.mesh('ring',q.x,q.y,q.z,rr,1,rr,q.color,Math.max(.1,1-p*.8))}
  for(let q of this.particles)r.mesh('box',q.x,q.y,q.z,q.size,q.size,q.size,q.color,1,0,q.life*9);
  r.render(t,p,this.damageFlash*.45);this.drawOverlay();
 }
 drawOverlay(){
  let c=this.fx,w=innerWidth,h=innerHeight,ratio=Math.min(devicePixelRatio||1,1.5);
  if(this.fxCanvas.width!==Math.floor(w*ratio)||this.fxCanvas.height!==Math.floor(h*ratio)){this.fxCanvas.width=Math.floor(w*ratio);this.fxCanvas.height=Math.floor(h*ratio)}
  c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);if(this.state==='menu')return;
  let p=this.player,[px,py]=this.renderer.project(p.x,3.25,p.z),hp=clamp(p.hp/p.maxHp,0,1),col=hp<.25?'#ff7386':hp<.5?'#ffd087':'#a4edcf';
  if(this.waveRule==='blackout'&&['playing','paused','panel'].includes(this.state)){
   let grd=c.createRadialGradient(px,py+45,100,px,py+45,Math.min(w,h)*.62);grd.addColorStop(0,'rgba(1,5,13,0)');grd.addColorStop(.6,'rgba(1,5,13,.45)');grd.addColorStop(1,'rgba(1,5,13,.9)');c.fillStyle=grd;c.fillRect(0,0,w,h);
  }
  if(hp<.5){
   let grad=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.63),pulse=hp<.25?.25+.15*(.5+.5*Math.sin(this.realTime*7)):.12;
   grad.addColorStop(0,'rgba(100,6,27,0)');grad.addColorStop(.62,'rgba(140,12,37,.02)');grad.addColorStop(1,`rgba(205,28,62,${pulse})`);c.fillStyle=grad;c.fillRect(0,0,w,h);
   if(hp<.25){c.strokeStyle='rgba(255,110,138,.22)';c.lineWidth=2;c.strokeRect(3,3,w-6,h-6);c.strokeStyle='rgba(105,238,250,.15)';c.strokeRect(6,5,w-12,h-10)}
  }
  for(let e of this.enemies){
   if(e.dead||e.type==='boss'||e.hp>=e.maxHp&&!e.elite)continue;
   let [x,y,k]=this.renderer.project(e.x,e.radius*2.4+.5,e.z);if(k<0)continue;let ww=e.elite?42:25;c.fillStyle='#080f1ed9';c.fillRect(x-ww/2,y,ww,4);c.fillStyle=e.elite?'#ffb16a':'#ed8ba1';c.fillRect(x-ww/2,y,ww*clamp(e.hp/e.maxHp,0,1),3);
  }
  let bw=104,bh=9;
  c.fillStyle='#070e1ceb';c.fillRect(px-bw/2-4,py-21,bw+8,39);
  c.fillStyle='#374451';c.fillRect(px-bw/2,py,bw,bh);c.fillStyle='#f2ced2';c.fillRect(px-bw/2,py,bw*this.healthTrail,bh);c.fillStyle=col;c.fillRect(px-bw/2,py,bw*hp,bh);
  c.fillStyle='#081520';for(let i=25;i<p.maxHp;i+=25)c.fillRect(px-bw/2+bw*i/p.maxHp,py,1,bh);
  c.textAlign='center';c.font='700 14px system-ui,sans-serif';c.fillStyle=col;
  c.fillText((hp<.25?'! 濒危 ':hp<.5?'△ 警戒 ':'')+Math.ceil(p.hp)+' / '+Math.ceil(p.maxHp),px,py-5);
  if(p.shield>0){c.font='11px system-ui';c.fillStyle='#afd7ff';c.fillText('护盾 '+Math.ceil(p.shield),px,py+23)}
  for(let n of this.numbers){
   let [x,y,k]=this.renderer.project(n.x,n.y+(n.player?1.1:0),n.z);if(k<0)continue;
   c.globalAlpha=Math.min(1,n.life/n.total*1.5);c.fillStyle=n.color;c.strokeStyle='#090e1b';c.lineWidth=3;c.font=(n.player?'800 21px':n.crit?'800 18px':'600 12px')+' system-ui,sans-serif';c.strokeText(n.text,x,y);c.fillText(n.text,x,y);
  }
  c.globalAlpha=1;c.shadowBlur=0;
  for(let g of this.greed)if(!g.done){let[x,y]=this.renderer.project(g.x,1.6,g.z);c.font='700 12px system-ui';c.fillStyle='#ffd195';c.fillText('贪心 '+g.progress.toFixed(1)+'/3 秒',x,y)}
 }
 loop(now){
  const raw=Math.max(0,(now-this.lastTime)/1000);this.lastTime=now;const dt=Math.min(.05,raw||.0167);this.realTime+=dt;this.frame++;
  this.fps=raw?1/raw:60;
  try{
   if(this.state==='playing'){
    if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);this.movePlayer(dt)}
    else{let n=Math.max(1,Math.ceil(dt/.0167));for(let i=0;i<n&&this.state==='playing';i++)this.step(dt/n)}
    this.updateEffects(dt);
   }else if(this.state==='menu')this.updateEffects(dt);
   // Input/simulation stay on every animation frame; only GPU work is throttled.
   this.renderAccum=(this.renderAccum||0)+dt;
   const drawInterval=this.state==='playing'?(this.touch?1/BALANCE.performance.mobileFPS:0):1/(this.state==='menu'?BALANCE.performance.menuFPS:BALANCE.performance.panelFPS);
   if(!this.suspendRendering&&this.renderAccum>=drawInterval){this.drawWorld();this.renderAccum=drawInterval?this.renderAccum%drawInterval:0}
   this.uiTick-=dt;if(this.uiTick<=0){this.uiTick=.1;if(typeof UI!=='undefined')UI.update()}
   if(this.toastTimer>0){this.toastTimer-=dt;if(this.toastTimer<=0)document.getElementById('toast')?.classList.remove('show')}
  }catch(e){console.error(e);this.state='error';if(typeof UI!=='undefined')UI.fatal(e.stack||e.message);return}
  requestAnimationFrame(this.loop);
 }
}
window.BALANCE=BALANCE;
