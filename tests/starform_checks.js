/* Deterministic production-simulation checks; rendering is tested separately in verify.py.
 * Run: node tests/sim_checks.js
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const engine=fs.readFileSync(path.join(ROOT,'src/engine.js'),'utf8').split('class VibrotatoRenderer')[0];
const weapons=fs.readFileSync(path.join(ROOT,'src/weapons.js'),'utf8'),gameCode=fs.readFileSync(path.join(ROOT,'src/game.js'),'utf8');
const stub=`
class VibrotatoRenderer {constructor(){this.canvas={addEventListener(){}};this.gl={getError(){return 0}};this.eye=[0,0,0];this.target=[0,0,0]}project(){return [0,0,1]}mesh(){}line(){}begin(){}render(){}}
const UI={toast(){},showGame(){},resetJoystick(){},renderShop(){},showResult(){},closeModal(){},openUpgrade(){g.state='upgrade';this.choices=g.upgradeChoices()}};
`;
const dummy={classList:{contains:()=>true,add(){},remove(){},toggle(){}},style:{},getContext:()=>({}),addEventListener(){},textContent:''};
const ctx=vm.createContext({console,Math,Date,Map,Set,Array,Object,Number,String,JSON,Error,Float32Array,Uint32Array,
 window:{},document:{getElementById:()=>dummy,addEventListener(){},hidden:false},
 localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),requestAnimationFrame(){},addEventListener(){},
 innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>0},setTimeout(){},HTMLInputElement:class{},HTMLSelectElement:class{}});
const tests=String.raw`
let g=new VibrotatoGame(),results=[],assertions=0,coverage=[];
function assert(value,message='condition failed'){assertions++;if(!value)throw Error(message)}
function close(a,b,tol=.001){assert(Math.abs(a-b)<tol,a+' != '+b)}
function check(name,fn){try{let detail=fn();results.push({name,passed:true,detail:detail??null});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.stack});console.log('FAIL '+name+' '+e.message)}}
function reset(char='street',seed=42){
 g.best.unlocked=5;g.start(char,0,seed);g.sound.enabled=false;g.sandboxGod=true;g.spawnTimer=1e9;g.waveDuration=1e9;g.player.xpNext=1e9;g.barrels=[];g.greed=[];return g;
}
function target(x=0,z=3.2,type='tank'){let e=g.spawnEnemy(type,false,x,z,'');e.hp=e.maxHp=1e7;e.speed=0;e.damage=0;e.timer=1e8;g.grid.build(g.enemies);return e}
function ringTargets(n=12,r=3.2){for(let i=0;i<n;i++){let a=i*Math.PI*2/n;target(Math.sin(a)*r,Math.cos(a)*r)}}
function tick(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){g.step(1/60);g.updateEffects(1/60)}}

check('preserve weapon, item, character and core gameplay parameters',()=>{
 assert(BALANCE.core.echo.ratio===.7&&BALANCE.core.echo.every===3);
 assert(BALANCE.slots.normal===6&&BALANCE.slots.max===8);assert(BALANCE.waves===20);
 assert(CORES.length===12&&WEAPONS.length===120&&CHARACTERS.length===12);
});
function swords(n,id=66){reset();g.weaponFX=true;g.touch=false;g.weapons=[];if(n>6){g.items=[ITEMS.find(d=>d.special==='slot').id,ITEMS.find(d=>d.special==='slot').id];g.recalculate()}for(let i=0;i<n;i++)assert(g.equip(id));return g.weapons}
const renderer={mesh(){},line(){}};
for(const n of [1,2,4,6,8])check(n+' identical blades have evenly spaced permanent floating lanes',()=>{
 swords(n);const homes=g.weapons.map(w=>g.bladeHome(w));for(let i=1;i<n;i++)close(homes[i].a-homes[i-1].a,TAU/n);
 const before=homes.map(h=>h.a);g.player.angle=2.91;const after=g.weapons.map(w=>g.bladeHome(w).a);assert(JSON.stringify(before)===JSON.stringify(after));
 g.drawPlayer(renderer,0);assert(g.drawnBlades.length===n);assert(new Set(g.drawnBlades.map(v=>v.x.toFixed(4)+','+v.z.toFixed(4))).size===n);return homes;
});
check('two blades remain opposite in a mixed six-weapon loadout',()=>{swords(2);for(let i=0;i<4;i++)g.equip(0);close(angleDiff(g.bladeHome(g.weapons[1]).a,g.bladeHome(g.weapons[0]).a),Math.PI)});
check('idle 3D blade angles align to their stable home directions',()=>{swords(6);for(const w of g.weapons){const pose=g.bladePose(w);close(pose.a,g.bladeHome(w).a);assert(pose.phase==='idle')}});
check('sector targeting distributes surrounding enemies over all six directions',()=>{swords(6);for(const w of g.weapons){const a=g.bladeHome(w).a;target(Math.sin(a)*3,Math.cos(a)*3)}const ts=g.weapons.map(w=>g.chooseTarget(w,4));assert(new Set(ts.map(e=>e.id)).size===6)});
check('same boss focus retains six unique origins and separated height layers',()=>{
 swords(6);target(0,3);for(const w of g.weapons)g.fire(w);for(const s of g.slashes)s.age=s.duration*.45;
 g.drawPlayer(renderer,0);assert(g.drawnBlades.length===6);assert(new Set(g.drawnBlades.map(b=>b.x.toFixed(3)+','+b.z.toFixed(3))).size===6);
 assert(new Set(g.drawnBlades.map(b=>b.height)).size===3);return g.drawnBlades;
});
check('odd and even slots alternate swing handedness',()=>{swords(6);ringTargets();for(const w of g.weapons)g.fire(w);assert(g.slashes[0].dir!==g.slashes[1].dir)});
check('recovery interpolates back to each home instead of leaving stacked blades',()=>{swords(6);target(0,3);for(const w of g.weapons)g.fire(w);for(const s of g.slashes){s.age=s.duration*.9999;const pose=g.bladePose(s.w,s);assert(Math.abs(angleDiff(pose.a,g.bladeHome(s.w).a))<.001);assert(pose.phase==='recovery')}});
check('visible blade tips stay in the original player-centered attack range',()=>{
 swords(8);ringTargets(32,3);for(const w of g.weapons)g.fire(w);
 for(const s of g.slashes)for(let j=0;j<=20;j++){s.age=s.duration*(.2+.5*j/20);const q=g.bladePose(s.w,s);const tx=q.x+Math.sin(q.a)*q.reach,tz=q.z+Math.cos(q.a)*q.reach;assert(Math.hypot(tx-g.player.x,tz-g.player.z)<=s.range+.001)}
});
check('each blade hits at most once per swing and never beyond its damage range',()=>{
 swords(2);g.stats.crit=0;const e=target(0,3),far=target(0,g.rangeFor(g.weapons[0])+2);for(const w of g.weapons){g.fire(w);w.timer=99}
 const damage=g.slashes.reduce((a,s)=>a+s.damage,0);for(let i=0;i<50;i++)g.updateSlashes(.01);assert(e.maxHp-e.hp<=damage+.001);assert(far.hp===far.maxHp);
});
check('a barrel is not charged for damage every frame of a single swing',()=>{
 swords(1);target(0,3);g.barrels=[{id:'test',x:0,z:2.5,hp:1e6}];g.fire(g.weapons[0]);const amount=g.slashes[0].damage;for(let i=0;i<50;i++)g.updateSlashes(.01);close(1e6-g.barrels[0].hp,amount);
});
check('six blades produce independent per-owner partial ribbons',()=>{
 swords(6);ringTargets(24,3);tick(1.4);const owners=new Set();for(let i=0;i<100;i++){g.step(.01);g.updateEffects(.01);for(const t of g.meleeTrails){owners.add(t.uid);assert(Math.abs(t.a1-t.a0)<Math.PI)}}assert(owners.size===6,'owners '+[...owners]);return [...owners];
});
check('maximum haste does not starve any of eight blade slots',()=>{
 swords(8,67);g.character={...g.character,stats:{...g.character.stats,haste:300}};g.recalculate();g.weapons.forEach((w,i)=>w.timer=.08+i*.012);ringTargets(32,3);tick(3);const shots=g.weapons.map(w=>w.shots);assert(Math.min(...shots)>5,'shots '+shots);assert(Math.max(...shots)-Math.min(...shots)<=2,'unfair shots '+shots);return shots;
});
check('removing or merging a blade cleans its ribbons and queued core echoes',()=>{
 swords(3);ringTargets();const w=g.weapons[1];g.fire(w);g.updateSlashes(.12);g.events.push({owner:w.uid,kind:'slash'});assert(g.meleeTrails.some(t=>t.uid===w.uid));g.removeWeapon(w.uid);assert(!g.slashes.some(t=>t.wuid===w.uid));assert(!g.meleeTrails.some(t=>t.uid===w.uid));assert(!g.events.some(t=>t.owner===w.uid));
 const a=g.weapons[0],b=g.weapons[1];g.fire(b);g.updateSlashes(.12);g.events.push({owner:b.uid,kind:'slash'});assert(g.merge(a.uid,b.uid));assert(!g.events.some(t=>t.owner===b.uid));assert(!g.meleeTrails.some(t=>t.uid===b.uid));
});
check('new wave clears transient blade effects and re-staggers all weapons',()=>{
 swords(6);ringTargets();g.fire(g.weapons[0]);g.updateSlashes(.1);g.setupWave();assert(!g.slashes.length&&!g.meleeTrails.length);assert(new Set(g.weapons.map(w=>w.timer)).size===6);
});
check('echo retains two real nonrecursive attacks carrying the owner socket',()=>{
 swords(2);g.cores=['echo'];g.recalculate();ringTargets(24,2.8);let w=g.weapons[1];g.fire(w);g.fire(w);g.fire(w);const events=g.events.filter(e=>e.kind==='slash');assert(events.length===2);assert(events.every(e=>e.socketA===g.bladeHome(w).a));g.weapons.forEach(w=>w.timer=99);tick(1);assert(g.coreMetrics.echo.damage>0);
});
check('legendary blades stay orange, ordinary duplicates have slot accents',()=>{
 swords(4);assert(new Set(g.weapons.map(w=>g.bladeColor(w))).size===4);swords(1,71);assert(g.bladeColor(g.weapons[0])===0xff922e);
});
check('FX on/off cannot change combat, economy, or seeded shop RNG',()=>{
 function run(on){swords(6);g.weaponFX=on;g.cores=['echo','quantum'];g.recalculate();ringTargets(24,3);tick(2);return {damage:g.gameStats.damage,hp:g.player.hp,credits:g.player.credits,shots:g.weapons.map(w=>w.shots),core:g.coreMetrics,next:g.rng()}}
 assert(JSON.stringify(run(true))===JSON.stringify(run(false)));
});
check('mobile and desktop ribbon budgets remain bounded at maximum haste',()=>{
 for(const touch of [false,true]){swords(8,67);g.touch=touch;g.character={...g.character,stats:{...g.character.stats,haste:300}};g.recalculate();g.weapons.forEach((w,i)=>w.timer=.08+i*.012);g.cores=['echo'];g.recalculate();ringTargets(32,3);for(let i=0;i<500;i++){g.step(.008);g.updateEffects(.008);assert(g.meleeTrails.length<=(touch?36:90));assert(g.impactCuts.length<=24)}}
});
check('render-only enhancement uses no gameplay or global random calls',()=>{
 swords(6);ringTargets();tick(.2);const original=Math.random;Math.random=()=>{throw Error('render consumed RNG')};try{g.drawPlayer(renderer,.5);g.drawMeleeTrails(renderer)}finally{Math.random=original}
});
globalThis.TEST_REPORT={version:BALANCE.version,results,assertions,allPassed:results.every(x=>x.passed)};
`;
vm.runInContext(engine+stub+weapons+gameCode+tests,ctx,{timeout:120000});
const report=JSON.parse(JSON.stringify(ctx.TEST_REPORT));
fs.writeFileSync(path.join(ROOT,'tests/starform-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.results.filter(x=>x.passed).length,total:report.results.length,assertions:report.assertions,allPassed:report.allPassed},null,2));
if(!report.allPassed)process.exitCode=1;
