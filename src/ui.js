/* Accessible offline DOM interface. All purchases call the production simulation. */
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Math.floor(v).toLocaleString('zh-CN');
const levelName=v=>['','I','II','III','IV'][v];
function statHTML(stats,compact=false){
 return `<div class="${compact?'stat-inline':'stat-lines'}">${Object.entries(stats).filter(([k,v])=>v!==0).map(([k,v])=>`<span class="${v<0?'negative':'positive'}"><b>${v>0?'+':''}${Number(v.toFixed(2))}${STAT_INFO[k]?.[1]||''}</b> ${STAT_INFO[k]?.[0]||k}</span>`).join('')}</div>`;
}
const UI={
 modalResume:null,focusReturn:null,shopPage:0,joyPointer:null,joyTarget:null,choices:[],libraryFilter:'',
 init(){
  document.addEventListener('click',e=>{
   let b=e.target.closest('[data-action]');if(!b||b.disabled)return;
   if(b.dataset.skill&&this.skillTouchAt&&performance.now()-this.skillTouchAt<350)return;
   this.action(b.dataset.action,b.dataset);
  });
  document.addEventListener('pointerdown',e=>{
   let b=e.target.closest('[data-skill]');if(b&&game.state==='playing'){e.preventDefault();this.skillTouchAt=performance.now();this.action(b.dataset.skill,{});return}
  },{passive:false});
  document.addEventListener('keydown',e=>{
   if(e.code==='Tab'&&!$('modal-shade').classList.contains('hidden')){
    let focus=[...$('modal').querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')].filter(el=>el.offsetParent!==null);if(!focus.length)return;
    if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1).focus()}
    else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0].focus()}
   }
  });
  $('modal-shade').addEventListener('click',e=>{if(e.target===$('modal-shade'))this.closeModal()});
  $('danger-select').addEventListener('change',e=>game.danger=+e.target.value);
  this.bindJoystick();this.bindFullscreen();this.renderMenu();
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)game.screenShake=false;
 },
 fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null},
 syncFullscreen(){
  const active=!!this.fullscreenElement(),b=$('fullscreen-button');
  if(!b)return;b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',active?'退出全屏':'进入全屏');
  b.title=active?'退出全屏 / Esc':'全屏 / F';b.querySelector('span').textContent=active?'退出':'全屏';
  b.classList.toggle('is-fullscreen',active);game.resetInput();game.camInitialized=false;
 },
 bindFullscreen(){
  this.syncFullscreen();for(const name of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(name,()=>this.syncFullscreen());
  document.addEventListener('keydown',e=>{if(e.code==='KeyF'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.target.closest('input,select,textarea,[contenteditable="true"]')){e.preventDefault();this.toggleFullscreen()}});
 },
 async toggleFullscreen(){
  if(this.fullscreenBusy)return;this.fullscreenBusy=true;game.resetInput();
  try{
   if(this.fullscreenElement()){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document)}
   else{
    const el=document.documentElement,request=el.requestFullscreen||el.webkitRequestFullscreen;
    if(!request){this.toast('浏览器未开放全屏','可使用浏览器全屏或添加到主屏幕；游戏仍可继续');return}
    await request.call(el);
   }
   this.syncFullscreen();
  }catch(e){this.syncFullscreen();this.toast('未能进入全屏','请在独立浏览器页面打开游戏后重试')}
  finally{this.fullscreenBusy=false}
 },
 action(action,d){
  const idx=Number(d.index);
  switch(action){
   case 'fullscreen':this.toggleFullscreen();break;
   case 'weapon-fx':game.weaponFX=!game.weaponFX;if(!game.weaponFX){game.meleeTrails=[];game.impactCuts=[]}this.settings();break;
   case 'start':game.start();break;
   case 'character':game.previewCharacter(d.id);this.renderMenu();break;
   case 'library':this.openLibrary();break;
   case 'core-library-detail':this.coreDetail(d.id,null);break;
   case 'arsenal':this.openArsenal();break;
   case 'weapon-detail':this.weaponDetail(Number(d.id),Number(d.level)||1);break;
   case 'weapon-owned':this.ownedDetail(Number(d.uid));break;
   case 'offer-detail':this.offerDetail(idx);break;
   case 'buy':this.buy(idx,d.mode||'equip');break;
   case 'core-select':this.coreDetail(game.offers[idx].id,idx,d.replace);break;
   case 'core-confirm':this.buy(idx,'equip',d.replace||null);break;
   case 'lock':if(game.state==='shop'){let o=game.offers[idx];if(o&&!o.sold)o.locked=!o.locked;this.renderShop()}break;
   case 'reroll':this.reroll();break;
   case 'reroll-confirm':this.closeModal();if(game.reroll())this.renderShop();break;
   case 'lock-cores':game.offers.forEach(o=>{if(o.kind==='core'&&!o.sold)o.locked=true});this.closeModal();this.renderShop();break;
   case 'next':game.nextWave();break;
   case 'repair':if(game.repair())this.renderShop();break;
   case 'target':game.targetUid=Number(d.uid);this.closeModal();this.renderShop();this.toast('已设置定向目标','后续武器报价优先匹配该型号、改装与等级');break;
   case 'remove':this.confirmRemove(Number(d.uid));break;
   case 'remove-confirm':game.removeWeapon(Number(d.uid));this.closeModal();this.renderShop();break;
   case 'merge':game.merge(Number(d.uid),Number(d.other));this.closeModal();this.renderShop();break;
   case 'build':this.openBuild();break;
   case 'satchel':this.openSatchel();break;
   case 'install-loot':if(game.installLoot(idx,false)){if(game.state==='shop')this.renderShop();this.openSatchel()}else this.toast('不能安装','已达到持有上限或角色存在硬约束');break;
   case 'discard-loot':game.installLoot(idx,true);if(game.state==='shop')this.renderShop();this.openSatchel();break;
   case 'upgrade':this.selectUpgrade(idx);break;
   case 'pause':this.pause();break;
   case 'resume':this.closeModal();if(game.state==='paused'){game.state='playing';this.showGame()}break;
   case 'close':this.closeModal();break;
   case 'menu':this.confirmMenu();break;
   case 'menu-confirm':this.closeModal(false);game.state='menu';game.previewCharacter(game.character.id);this.renderMenu();break;
   case 'retry':this.closeModal(false);game.start(game.character.id,game.danger);break;
   case 'settings':this.settings();break;
   case 'sound':this.toggleSound();this.settings();break;
   case 'quality':game.visualQuality=!game.visualQuality;game.renderer.quality=game.visualQuality?1:.7;this.settings();break;
   case 'shake':game.screenShake=!game.screenShake;this.settings();break;
   case 'help':this.help();break;
   case 'dash':game.dash();break;
   case 'emp':game.emp();break;
  }
 },
 renderMenu(){
  $('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('screen').classList.add('hidden');$('touch-controls').classList.add('hidden');
  $('character-grid').innerHTML=CHARACTERS.map(c=>`<button class="character-card ${game.character.id===c.id?'selected':''}" data-action="character" data-id="${c.id}" style="--char:${c.color}" aria-pressed="${game.character.id===c.id}"><span class="char-icon">${glyphSVG(c.icon)}</span><span><b>${c.name}</b><small>${c.role}</small></span></button>`).join('');
  const c=game.character,d=WEAPONS[c.start];
  $('character-details').innerHTML=`<div class="eyebrow" style="color:${c.color}">${c.en}</div><h2>${c.name}</h2><div class="character-perk"><span class="positive">优势</span><p>${c.gain}</p></div><div class="character-perk"><span class="negative">约束</span><p>${c.cost}</p></div><div class="starter"><span>${iconSVG(d.family)}</span><div><small>唯一初始武器 / I 级</small><b>${d.name}</b></div><em>${c.slots||6} 槽</em></div>`;
  $('danger-select').innerHTML=BALANCE.danger.map((v,i)=>`<option value="${i}" ${i===game.danger?'selected':''} ${i>game.best.unlocked?'disabled':''}>Danger ${i}${i>game.best.unlocked?' · 通关解锁':''}</option>`).join('');
 },
 showGame(){
  $('menu').classList.add('hidden');$('screen').classList.add('hidden');$('hud').classList.remove('hidden');
  $('modal-shade').classList.add('hidden');this.modalResume=null;
  $('touch-controls').classList.toggle('hidden',!game.touch);this.updateLoadout();this.update();
 },
 toast(title,sub=''){
  $('toast-title').textContent=title;$('toast-sub').textContent=sub;$('toast').classList.add('show');game.toastTimer=2.5;
 },
 fatal(message){$('fatal').classList.remove('hidden');$('fatal-details').textContent=message},
 update(){
  if(game.state==='menu')return;
  const p=game.player,ratio=p.hp/p.maxHp;
  $('hud-name').textContent=game.character.name;
  $('health-number').innerHTML=Math.ceil(p.hp)+` <small>/ ${Math.ceil(p.maxHp)}</small>`;
  $('health-fill').style.width=clamp(ratio*100,0,100)+'%';$('health-trail').style.width=game.healthTrail*100+'%';
  $('health-fill').style.background=ratio<.25?'#ff7489':ratio<.5?'#f4c580':'#95e4c5';
  $('health-ticks').style.backgroundSize=(25/p.maxHp*100)+'% 100%';
  $('health-state').textContent=ratio<.25?'! 濒危':ratio<.5?'△ 警戒':'● 稳定';
  $('health-state').className=ratio<.5?'negative':'positive';
  $('defense-value').textContent='减伤 '+Math.round(game.armorReduction()*100)+'% · 闪避 '+Math.round(game.dodgeChance()*100)+'%';
  $('xp-fill').style.width=p.xp/p.xpNext*100+'%';
  $('wave-number').innerHTML=String(game.wave).padStart(2,'0')+' <small>/ 20</small>';
  $('wave-rule').textContent=RULE_NAMES[game.waveRule];$('wave-timer').textContent=Math.max(0,Math.ceil(game.waveDuration-game.waveTime))+'s';
  $('hud-credits').textContent=money(p.credits);$('hud-level').textContent='LV.'+p.level;$('bag-button').textContent='战利品 '+game.satchel.length;
  let boss=game.enemies.find(e=>e.type==='boss'&&!e.dead);$('boss-hud').classList.toggle('hidden',!boss);
  if(boss){$('boss-label').textContent='执法核心 / 阶段 '+boss.phase;$('boss-fill').style.width=boss.hp/boss.maxHp*100+'%'}
  $('dash-time').textContent=p.dashCD>.05?p.dashCD.toFixed(1)+'s':'就绪';$('emp-time').textContent=p.empCD>.05?Math.ceil(p.empCD)+'s':'就绪';
  $('touch-dash').innerHTML=`<b>${p.dashCD>.05?p.dashCD.toFixed(1)+'s':'冲刺'}</b><span>↗</span>`;
  $('touch-emp').innerHTML=`<b>${p.empCD>.05?Math.ceil(p.empCD)+'s':'EMP'}</b><span>◎</span>`;
  $('touch-dash').classList.toggle('cooling',p.dashCD>0);$('touch-emp').classList.toggle('cooling',p.empCD>0);
  $('core-status').innerHTML=game.cores.map(id=>{let c=game.core(id),s=game.coreStatus(id),pulse=game.corePulse?.id===id&&game.elapsed-game.corePulse.at<.7;return `<div class="core-chip ${pulse?'proc':''}"><span>${glyphSVG(c.icon)}</span><div><b>${c.name}</b><small>${s.text}</small><i style="width:${clamp(s.progress*100,0,100)}%"></i></div></div>`}).join('');
 },
 updateLoadout(){
  $('loadout').innerHTML=Array.from({length:game.slots()},(_,i)=>{let w=game.weapons[i];return w?`<button class="hud-weapon ${w.def.rarity===4?'legendary':''}" data-action="weapon-owned" data-uid="${w.uid}" title="${w.def.name} ${levelName(w.level)}" style="--rarity:${RARITY_COLORS[w.def.rarity]}">${iconSVG(w.def.family)}<b>${levelName(w.level)}</b></button>`:`<span class="hud-empty">${i+1}</span>`}).join('');
 },
 openModal(title,body,footer='',wide=false){
  $('toast').classList.remove('show');game.toastTimer=0;
  if($('modal-shade').classList.contains('hidden')){this.focusReturn=document.activeElement;if(game.state==='playing'){this.modalResume='playing';game.state='panel';game.resetInput()}else this.modalResume=null}
  $('modal').className='modal'+(wide?' wide':'');
  $('modal').innerHTML=`<header class="modal-head"><h2 id="modal-title">${title}</h2><button class="close-btn" data-action="close" aria-label="关闭">×</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-foot">${footer}</footer>`:''}`;
  $('modal-shade').classList.remove('hidden');$('modal').focus({preventScroll:true});
 },
 closeModal(resume=true){
  $('modal-shade').classList.add('hidden');
  if(resume&&this.modalResume==='playing'&&['panel','paused'].includes(game.state)){game.state='playing';game.resetInput();this.updateLoadout()}
  this.modalResume=null;this.focusReturn?.focus?.({preventScroll:true});
 },
 escape(){
  if(!$('modal-shade').classList.contains('hidden')){this.closeModal();return}
  if(game.state==='playing')this.pause();
 },
 pause(){
  if(game.state!=='playing')return;
  this.openModal('暂停 / PAUSED',`<p class="lead">构筑已经选好，下一步由你决定。</p><div class="pause-grid"><button data-action="settings">声音与画质</button><button data-action="build">构筑与属性</button><button data-action="help">操作说明</button><button data-action="menu">返回角色选择</button></div>`,`<button class="primary" data-action="resume">继续战斗</button>`);
  game.state='paused';this.modalResume='playing';
 },
 confirmMenu(){
  this.openModal('结束当前行动？',`<p class="lead">本局进度不会保存。已解锁的危险等级仍会保留。</p>`,`<button data-action="close">取消</button><button class="danger-button" data-action="menu-confirm">返回角色选择</button>`);
 },
 settings(){
  this.openModal('设置',`<div class="setting"><div><b>合成音效与音乐</b><p>低血量时启用心跳与音乐低通。</p></div><button data-action="sound">${game.sound.enabled?'开启':'关闭'}</button></div><div class="setting"><div><b>画面质量</b><p>低画质减少远景建筑与像素负担，不改变玩法。</p></div><button data-action="quality">${game.visualQuality?'标准':'省电'}</button></div><div class="setting"><div><b>武器光效</b><p>独立刀光、弹道拖尾与命中闪光。手机自动减少拖尾层数，不改变伤害。</p></div><button data-action="weapon-fx">${game.weaponFX?'增强':'简洁'}</button></div><div class="setting"><div><b>受击与暴击震动</b><p>关闭镜头震动，仍保留伤害数字和形状提示。</p></div><button data-action="shake">${game.screenShake?'开启':'关闭'}</button></div><p class="muted">电脑：WASD / 方向键。手机：左侧摇杆，右侧冲刺与 EMP。触摸时游戏不会滚动页面。</p>`);
 },
 toggleSound(){game.sound.enabled=!game.sound.enabled;if(game.sound.enabled)game.sound.init();try{localStorage.setItem('neon-spud-muted',game.sound.enabled?'0':'1')}catch(e){}},
 help(){
  this.openModal('行动手册',`<div class="help-grid"><div><h3>移动就是你的瞄准</h3><p>WASD / 方向键移动，武器自动选敌。手机左侧摇杆即时响应；第二根手指操作技能。</p></div><div><h3>冲刺穿过危险</h3><p>Space / Shift 冲刺，短暂无敌。Q 释放 EMP，清除敌弹并击退近敌。</p></div><div><h3>一把武器，慢慢成型</h3><p>普通角色 6 槽。两把同名同改装同等级武器可以合成。商店“购入并合成”允许满槽直接付费合成。</p></div><div><h3>核心只装两颗</h3><p>橙色核心会改变机制。门槛、代价与当前进度均可查看。第三颗需要明确替换，不会自动覆盖。</p></div><div><h3>拾取不等于强制安装</h3><p>素材自动吸附。道具进入战利品背包，波后决定安装或拆解，不会强装负属性。</p></div><div><h3>低血看中央</h3><p>角色头顶数字和分段条常驻。低于 50% 显示警戒，低于 25% 显示濒危、边缘脉动和心跳。</p></div></div><div class="notice">C / Tab：构筑属性。F：全屏。Esc：暂停。M：静音。滚轮：缩放。首次需要点击“开始行动”解锁浏览器音频。</div>`, '',true);
 },
 offerCard(o,index){
  if(o.sold)return `<article class="offer sold"><div class="sold-symbol">✓</div><h3>已购入</h3><p>本次决策已写入构筑。</p><span class="muted">刷新后补充新商品</span></article>`;
  let d=o.kind==='weapon'?WEAPONS[o.id]:o.kind==='core'?game.core(o.id):ITEMS[o.id],rare=o.kind==='core'?4:d.rarity,col=RARITY_COLORS[rare],legend=rare===4;
  let title=o.kind==='weapon'?d.type:o.kind==='core'?'唯一核心 · '+d.style:'属性组件 · '+RARITIES[rare];
  let icon=o.kind==='weapon'?iconSVG(d.family):glyphSVG(d.icon),desc,meta='',buttons='';
  if(o.kind==='weapon'){
   let fake={def:d,level:o.level},current=game.damageFor(fake),interval=game.cooldownFor(fake);
   meta=`<div class="weapon-metrics"><span><b>${current.toFixed(1)}</b> ${['flame','scatter','cryo','gatling'].includes(d.family)?'每弹':'单次'}</span><span><b>${interval.toFixed(2)}s</b> 间隔</span><span><b>${levelName(o.level)}</b> 级</span></div><div class="tags">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div>`;
   desc=`<p class="item-desc">${d.description}</p><p class="trade">${d.trade}</p>`;
   let match=game.weapons.find(w=>w.id===o.id&&w.level===o.level&&!w.def.terminal&&w.level<4),full=game.weapons.length>=game.slots(),afford=game.player.credits>=o.price;
   if(match)buttons+=`<button class="primary" data-action="buy" data-index="${index}" data-mode="merge" ${!afford?'disabled':''}>购入并合成 ${levelName(o.level+1)}</button>`;
   buttons+=`<button ${!match?'class="primary"':''} data-action="buy" data-index="${index}" ${!afford||full?'disabled':''}>${full?'槽位已满':d.terminal?'购入终式':'购入'}</button>`;
  }else if(o.kind==='core'){
   desc=`<p class="core-effect">${d.effect}</p><p class="core-condition"><span>达成条件</span>${d.condition}</p><p class="trade">${d.cost}</p>`;
   meta=`<span class="signature">独特机制 / 最多装备 2 个核心</span>`;
   buttons=`<button class="primary orange" data-action="offer-detail" data-index="${index}">查看与安装</button>`;
  }else{
   meta=statHTML(d.stats,true);desc=`<p class="item-desc">${d.special==='slot'?'武器槽 +1，最多扩至 8；独狼与猎手的固定槽位不能扩展。':Object.values(d.stats).some(v=>v<0)?'补强一个方向，同时放弃另一个方向。':'稳定补足构筑短板。'}</p><p class="trade">最多持有 ${d.max} 件 · 已持有 ${game.items.filter(id=>id===d.id).length}</p>`;
   buttons=`<button class="primary" data-action="buy" data-index="${index}" ${game.player.credits<o.price?'disabled':''}>购买组件</button>`;
  }
  return `<article class="offer ${legend?'legendary':''}" style="--rarity:${col}"><div class="offer-top"><span class="rarity-label">${o.kind==='core'?'◆ 传说核心':d.terminal?'♛ 传说终式':RARITIES[rare]+(o.match?' · 合成材料':'')}</span><button class="lock ${o.locked?'locked':''}" data-action="lock" data-index="${index}" aria-pressed="${o.locked}">${o.locked?'已锁定':'锁定'}</button></div><button class="offer-identity" data-action="offer-detail" data-index="${index}"><span class="item-icon">${icon}</span><span><small>${title}</small><h3>${d.name}</h3></span></button>${meta}${desc}<div class="offer-bottom"><div class="price"><b>${money(o.price)}</b><span>信用点</span><button class="detail-link" data-action="offer-detail" data-index="${index}">详情 ↗</button></div><div class="buy-buttons">${buttons}</div></div></article>`;
 },
 renderShop(){
  $('toast').classList.remove('show');game.toastTimer=0;
  $('menu').classList.add('hidden');$('hud').classList.add('hidden');$('touch-controls').classList.add('hidden');$('screen').classList.remove('hidden');
  const p=game.player,l=game.ledger,black=BALANCE.shop.coreGuarantee.includes(game.wave);
  $('screen').innerHTML=`<div class="screen-inner"><header class="market-header"><div><div class="eyebrow">${black?'BLACK MARKET / 稀有信号':'ARMORY / 街区军火商'}</div><h1>第 ${String(game.wave).padStart(2,'0')} 波，活下来了<span class="market-subtitle">下一次出手之前，选好你的代价。</span></h1></div><div class="shop-wallet"><span>可用信用点</span><b>${money(p.credits)}</b><small>当前生命 ${Math.ceil(p.hp)} / ${p.maxHp}</small></div></header>
   <div class="shop-summary"><div class="ledger"><span>拾取 <b>+${money(l.pickup)}</b></span><span>回收 <b>+${money(l.recovery)}</b></span><span>赏金 <b>+${money(l.bonus)}</b></span><span>利息 <b>+${money(l.interest)}</b></span><span>支出 <b>−${money(l.spent)}</b></span></div><button data-action="build">构筑属性 ↗</button></div>
   <div class="offers">${game.offers.map((o,i)=>this.offerCard(o,i)).join('')}</div>
   <section class="armory"><div class="section-head"><h2>武器挂点 <span>${game.weapons.length} / ${game.slots()}</span></h2><p>点击武器：拆除、定向、合成。满槽仍可购买合成材料。</p></div><div class="owned-weapons">${Array.from({length:game.slots()},(_,i)=>{let w=game.weapons[i];return w?`<button class="owned-weapon ${w.def.rarity===4?'legendary':''} ${game.targetUid===w.uid?'targeted':''}" style="--rarity:${RARITY_COLORS[w.def.rarity]}" data-action="weapon-owned" data-uid="${w.uid}"><span>${iconSVG(w.def.family)}</span><div><b>${w.def.name}</b><small>${levelName(w.level)} 级 · ${game.targetUid===w.uid?'定向中':w.def.tags.join(' / ')}</small></div></button>`:`<div class="empty-slot"><b>＋</b>空闲挂点 ${i+1}</div>`}).join('')}</div></section>
   <section class="shop-build"><div><div class="section-head"><h2>唯一核心 <span>${game.cores.length} / 2</span></h2><button class="text-button" data-action="library">查看核心档案 ↗</button></div><div class="core-slots">${Array.from({length:2},(_,i)=>{let id=game.cores[i],c=game.core(id);return c?`<button class="installed-core" data-action="core-library-detail" data-id="${id}"><span>${glyphSVG(c.icon)}</span><div><b>${c.name}</b><small>${game.coreStatus(id).text}</small></div><em>已安装</em></button>`:`<div class="core-empty"><span>◇</span><div><b>等待关键的那一颗</b><small>稀有核心不会强制塞入构筑。</small></div></div>`}).join('')}</div></div><div class="loot-summary"><span class="loot-icon">${glyphSVG('gem')}</span><div><h3>战利品待安装 <b>${game.satchel.length}</b></h3><p>拾取只负责回收，负面代价由你确认。</p><button data-action="satchel">打开战利品背包 ↗</button></div></div></section>
   <div class="shop-foot-note">新商品稀有度由波次与幸运共同决定。锁定跨波保留价格。合成减少件数，也可能暂时失去套装效果。</div>
  </div><footer class="market-footer"><div class="market-actions"><button data-action="reroll" ${p.credits<game.rerollCost()||game.offers.every(o=>o.locked&&!o.sold)?'disabled':''}>刷新报价 <b>${game.rerollCost()}</b><small>本波第 ${game.rerolls+1} 次</small></button><button data-action="repair" ${game.repairCost()<=0||p.credits<game.repairCost()?'disabled':''}>修复 ${Math.ceil(Math.min(p.maxHp*.3,p.maxHp-p.hp))} HP <b>${game.repairCost()}</b></button></div><button class="primary next-wave" data-action="next">第 ${String(game.wave+1).padStart(2,'0')} 波 <span>继续行动 ↗</span></button></footer>`;
 },
 reroll(){
  if(game.offers.some(o=>o.kind==='core'&&!o.sold&&!o.locked)){
   this.openModal('要放弃这次稀有信号吗？',`<p class="lead">未锁定的核心会随刷新消失。可以先锁住核心，再考虑其他商品。</p><p class="muted">刷新费用 ${game.rerollCost()}，下次还会更贵。</p>`,`<button data-action="lock-cores">锁住核心并返回</button><button class="danger-button" data-action="reroll-confirm">仍然刷新</button>`);
  }else if(game.reroll())this.renderShop();
 },
 buy(index,mode='equip',replace=null){
  let o=game.offers[index];if(o?.kind==='core'&&replace===null&&game.cores.length>=2){this.coreDetail(o.id,index);return}
  let result=game.buyOffer(index,mode,replace);
  if(result.ok){this.closeModal();this.renderShop();game.sound.pick();this.toast(o.kind==='core'?'核心已接入':'购入成功',o.kind==='weapon'&&mode==='merge'?'已完成付费合成，无需额外空槽。':o.kind==='core'?game.core(o.id).name+' · 条件进度会显示在战斗界面。':'属性与套装已经更新。')}
  else this.toast('未完成购买',result.reason);
 },
 offerDetail(index){
  let o=game.offers[index];if(!o||o.sold)return;
  if(o.kind==='core'){this.coreDetail(o.id,index);return}
  if(o.kind==='weapon'){this.weaponDetail(o.id,o.level,index);return}
  let d=ITEMS[o.id],after=game.statSheet({items:[...game.items,d.id],credits:game.player.credits-o.price}).stats;
  this.openModal(d.name,`<div class="detail-hero"><span>${glyphSVG(d.icon)}</span><div><span class="eyebrow">${RARITIES[d.rarity]} / 构筑组件</span><h3>${d.name}</h3></div></div>${statHTML(d.stats)}${d.special==='slot'?'<p class="notice">增加 1 个武器槽，最大生命 −15。总槽位最多 8；固定槽角色不可扩展。</p>':''}<h3 class="subheading">安装后的属性变化</h3>${this.comparison(after)}<p class="muted">道具不会补满生命。最大生命下降时，当前生命只在超出新上限时被截断。</p>`,`<div class="checkout"><span>支出 <b>${o.price}</b> / 余额 ${Math.floor(game.player.credits-o.price)}</span><button class="primary" data-action="buy" data-index="${index}" ${game.player.credits<o.price?'disabled':''}>确认购买</button></div>`);
 },
 comparison(after){
  let before=game.stats,keys=Object.keys(STAT_INFO).filter(k=>Math.abs((after[k]||0)-(before[k]||0))>.001);
  if(!keys.length)return `<p class="notice">基础属性没有变化；收益由下方独特机制结算，不以虚假的总 DPS 表示。</p>`;
  return `<div class="comparison">${keys.map(k=>`<div><span>${STAT_INFO[k][0]}</span><span>${Number(before[k].toFixed(2))}${STAT_INFO[k][1]}</span><b class="${after[k]<before[k]?'negative':'positive'}">→ ${Number(after[k].toFixed(2))}${STAT_INFO[k][1]}</b></div>`).join('')}</div>`;
 },
 coreDetail(id,index=null,replace=null){
  const c=game.core(id);if(!c)return;const offer=index!==null?game.offers[index]:null,full=game.cores.length>=2&&!game.has(id);
  let cores=game.cores.filter(v=>v!==replace);if(!cores.includes(id))cores.push(id);
  let after=game.statSheet({cores,credits:game.player.credits-(offer?.price||0)}).stats,s=game.coreStatus(id),metric=game.coreMetrics[id];
  let body=`<div class="detail-hero legendary"><span>${glyphSVG(c.icon)}</span><div><span class="eyebrow">LEGENDARY / 唯一核心</span><h3>${c.name}</h3><p>${c.en} · ${c.style}</p></div></div>
   <div class="core-reward"><span class="eyebrow">达成后的奖励</span><p>${c.effect}</p></div><div class="condition-box"><b>触发门槛</b><p>${c.condition}</p><div class="condition-current"><span style="width:${clamp(s.progress*100,0,100)}%"></span><b>${s.text}</b></div></div>
   <div class="cost-box"><b>真实代价</b><p>${c.cost}</p></div><p class="core-tip">${c.tip}</p>`;
  if(offer){
   if(full)body+=`<h3 class="subheading">两个核心槽已满，选择替换对象</h3><div class="replacement-grid">${game.cores.map(v=>`<button class="${replace===v?'selected':''}" data-action="core-select" data-index="${index}" data-replace="${v}">${glyphSVG(game.core(v).icon)}<b>${game.core(v).name}</b><small>移除，不返还购买费用</small></button>`).join('')}</div>`;
   if(!full||replace)body+=`<h3 class="subheading">按付款后余额计算</h3>${this.comparison(after)}`;
  }else if(game.has(id))body+=`<div class="notice">本局已触发 <b>${metric?.count||0}</b> 次；记录到的衍生伤害 <b>${Math.round(metric?.damage||0)}</b>。常驻属性收益不计入衍生伤害。</div>`;
  body+=`<p class="safety-note">机制边界：核心衍生攻击不触发其他核心、不再吸血；具有触发间隔或容量限制。</p>`;
  let footer=offer?`<div class="checkout"><div><span>支出 <b>${offer.price}</b></span><small>购买后余额 ${Math.floor(game.player.credits-offer.price)}</small></div><button class="primary orange" data-action="core-confirm" data-index="${index}" ${replace?`data-replace="${replace}"`:''} ${game.player.credits<offer.price||full&&!replace?'disabled':''}>${game.player.credits<offer.price?'信用点不足':full?'确认替换并安装':'确认安装核心'}</button></div>`:`<button data-action="library">返回核心档案</button><button class="primary" data-action="close">关闭</button>`;
  this.openModal(c.name,body,footer);
 },
 weaponDetail(id,level=1,index=null,owned=null){
  const d=WEAPONS[id],w=owned||{def:d,level},damage=game.damageFor(w),cool=game.cooldownFor(w);
  let body=`<div class="detail-hero ${d.rarity===4?'legendary':''}" style="--rarity:${RARITY_COLORS[d.rarity]}"><span>${iconSVG(d.family)}</span><div><span class="eyebrow">${d.type}</span><h3>${d.name} <small>${levelName(level)}</small></h3><p>${RARITIES[d.rarity]}${d.terminal?' · 到手 IV 级，无法合成，同名唯一':''}</p></div></div><div class="tags big">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div><p class="lead">${d.description}</p><div class="damage-preview"><div><b>${damage.toFixed(1)}</b><span>当前基础单次${['flame','cryo','scatter'].includes(d.family)?' / 每弹':''}</span></div><div><b>${cool.toFixed(2)}s</b><span>攻击间隔</span></div><div><b>${game.rangeFor(w).toFixed(1)}</b><span>当前射程</span></div></div><div class="scaling-info"><b>吃什么属性？</b><p>${STAT_INFO[d.stat][0]}：每 1 点为基础单次增加 ${d.scaling}，之后计入等级和伤害加算。${d.family==='boomerang'?'飞锯虽然投射出去，仍然吃近战属性。':''}</p></div><div class="cost-box"><b>改装取舍</b><p>${d.trade}</p></div><p class="muted">数值预览不含随机暴击、敌人护盾、后续流血或核心连锁，不冒充实战 DPS。</p>`;
  let footer=`<button class="primary" data-action="close">关闭</button>`;
  if(index!==null){
   let o=game.offers[index],match=game.weapons.find(v=>v.id===id&&v.level===level&&!d.terminal&&level<4);
   footer=`<span class="checkout-price">${o.price} 信用点</span>${match?`<button class="primary" data-action="buy" data-index="${index}" data-mode="merge" ${game.player.credits<o.price?'disabled':''}>购入并合成 ${levelName(level+1)}</button>`:''}<button ${!match?'class="primary"':''} data-action="buy" data-index="${index}" ${game.player.credits<o.price||game.weapons.length>=game.slots()?'disabled':''}>购入为独立武器</button>`;
  }
  if(owned&&game.state==='shop'){
   let other=game.weapons.find(v=>v!==owned&&v.id===id&&v.level===level),salvage=Math.floor(owned.paid*BALANCE.shop.sellFraction);
   footer=`<button data-action="target" data-uid="${owned.uid}" ${d.terminal||level>=4?'disabled':''}>定向此武器</button>${other&&!d.terminal&&level<4?`<button class="primary" data-action="merge" data-uid="${owned.uid}" data-other="${other.uid}">两把合成 ${levelName(level+1)}</button>`:''}<button class="danger-button" data-action="remove" data-uid="${owned.uid}" ${game.weapons.length<=1?'disabled':''}>拆除 +${salvage}</button>`;
   body+=`<div class="notice">拆除释放槽位，返还记录投入的 35%。最后一把武器不能拆除。${other?'合成会少一件装备，可能暂时失去套装。':''}</div>`;
  }
  this.openModal(d.name,body,footer);
 },
 ownedDetail(uid){let w=game.weapons.find(v=>v.uid===uid);if(w)this.weaponDetail(w.id,w.level,null,w)},
 confirmRemove(uid){
  let w=game.weapons.find(v=>v.uid===uid);if(!w)return;
  this.openModal('确认拆除武器',`<p class="lead">${w.def.name} · ${levelName(w.level)} 级</p><p>返还 ${Math.floor(w.paid*BALANCE.shop.sellFraction)} 信用点，永久删除这把武器。相关套装件数会立即减少。</p>`,`<button data-action="close">取消</button><button class="danger-button" data-action="remove-confirm" data-uid="${uid}">确认拆除</button>`);
 },
 openUpgrade(){
  game.state='upgrade';game.resetInput();this.closeModal(false);this.choices=game.upgradeChoices();
  $('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('touch-controls').classList.add('hidden');$('screen').classList.remove('hidden');
  $('screen').innerHTML=`<div class="upgrade-screen"><div class="eyebrow">LEVEL ${game.player.level} / 人物进化</div><h1>强化一个方向。<br><span>承担一个选择。</span></h1><p>三选一 · 至少一项高风险回报 · 没有免费赠送武器</p><div class="upgrade-grid">${this.choices.map((id,i)=>{let d=UPGRADES[id],key=Object.keys(d.stats)[0];return `<button class="upgrade-card ${d.risky?'risky':''}" data-action="upgrade" data-index="${i}"><div class="upgrade-top"><kbd>${i+1}</kbd><span>${d.risky?'高风险 / 高回报':'稳定成长'}</span></div><div class="upgrade-icon">${glyphSVG(STAT_INFO[key][2])}</div><h2>${d.name}</h2>${statHTML(d.stats)}<span class="choose">选择这次进化 ↗</span></button>`}).join('')}</div><span class="upgrade-hint">选择会永久加入本局属性。按 1 / 2 / 3 选择。</span></div>`;
  game.sound.level();
 },
 selectUpgrade(i){if(game.state!=='upgrade'||this.choices[i]===undefined)return;let id=this.choices[i];this.choices=[];game.selectUpgrade(id)},
 openBuild(){
  let stats=`<div class="stats-grid">${Object.entries(STAT_INFO).map(([k,info])=>{let v=game.stats[k]||0,src=game.sources.filter(s=>s.stats[k]);return `<details class="stat-row"><summary><span>${glyphSVG(info[2])}<b>${info[0]}</b></span><strong class="${v<0?'negative':''}">${Number(v.toFixed(2))}${info[1]}</strong></summary><div>${src.length?src.map(s=>`<p><span>${s.name}</span><b class="${s.stats[k]<0?'negative':'positive'}">${s.stats[k]>0?'+':''}${s.stats[k]}</b></p>`).join(''):'<p>没有额外来源</p>'}</div></details>`}).join('')}</div>`;
  let sets=`<div class="set-grid">${Object.entries(SET_DESCRIPTIONS).map(([tag,lines])=>{let n=game.tags[tag]||0;return `<div class="set-card ${n>=2?'active':''}"><h3>${tag} <b>${n} 件</b></h3>${lines.map((s,i)=>`<p class="${n>=2+i*2?'positive':''}"><b>${2+i*2}</b> ${s}</p>`).join('')}</div>`}).join('')}</div>`;
  this.openModal('构筑 / 属性来源',`<div class="build-overview"><div><b>${game.character.name}</b><p>${game.character.gain}</p><p class="negative">${game.character.cost}</p></div><div><span>实际减伤</span><b>${Math.round(game.armorReduction()*100)}%</b><small>硬上限 60%</small></div><div><span>实际闪避</span><b>${Math.round(game.dodgeChance()*100)}%</b><small>硬上限 60%</small></div></div><h3 class="subheading">属性 · 点击展开来源</h3>${stats}<p class="muted">属性可以为负；生命上限最低 1、实际闪避最低 0。负护甲会增加承伤。吸血每秒最多回复最大生命的 12%，再计算治疗减效。</p><h3 class="subheading">套装 · 件数比等级更重要</h3>${sets}<h3 class="subheading">已安装组件 · ${game.items.length}</h3><div class="item-list">${[...new Set(game.items)].map(id=>`<span>${glyphSVG(ITEMS[id].icon)}${ITEMS[id].name}<b>×${game.items.filter(v=>v===id).length}</b></span>`).join('')||'<p class="muted">尚未安装组件。</p>'}</div>`, `<button class="primary" data-action="close">返回</button>`,true);
 },
 openSatchel(){
  this.openModal('战利品背包',`<p class="muted">靠近时自动回收，不会强制安装。波次之间再决定是否接受负面代价。免费战利品按原基价的 22% 拆解，不随物价膨胀。</p><div class="satchel-list">${game.satchel.map((id,i)=>{let d=ITEMS[id];return `<div class="loot-row"><span class="loot-icon">${glyphSVG(d.icon)}</span><div><h3>${d.name}</h3>${statHTML(d.stats,true)}${d.special==='slot'?'<p>武器槽 +1；固定槽位角色不可安装。</p>':''}</div><div><button class="primary" data-action="install-loot" data-index="${i}" ${game.state!=='shop'?'disabled':''}>安装</button><button data-action="discard-loot" data-index="${i}" ${game.state!=='shop'?'disabled':''}>拆解 +${Math.round(d.price*.22)}</button></div></div>`}).join('')||'<div class="empty-state">背包为空。精英和首领必定掉落一件道具。</div>'}</div>${game.state!=='shop'?'<div class="notice">战斗中只能查看；到波次商店后可以安装或拆解。</div>':''}`,`<button class="primary" data-action="close">关闭</button>`,true);
 },
 openLibrary(){
  this.openModal('核心档案 / CORE ARCHIVE',`<p class="lead">12 个机制核心，每局最多同时安装 2 个。难门槛配高回报，不是每一颗都适合现在的你。</p><div class="notice">第 6 / 12 / 18 波商店各提供一次核心报价机会。不是免费赠送；全锁定时等待有空格再提供。</div><div class="library-grid">${CORES.map(c=>`<button class="library-card legendary" data-action="core-library-detail" data-id="${c.id}"><span class="library-icon">${glyphSVG(c.icon)}</span><small>${c.style}</small><h3>${c.name}</h3><p>${c.condition}</p><span>${game.has(c.id)?'已安装':'查看机制与代价 ↗'}</span></button>`).join('')}</div>`, `<button class="primary" data-action="close">关闭档案</button>`,true);
 },
 openArsenal(){
  this.openModal('武器图鉴',`<div class="search-row"><input id="weapon-search" placeholder="搜索名称、家族、标签，例如：刀刃 / 冰 / 工程" aria-label="搜索武器"><span>114 款可合成 / 6 款终式</span></div><div id="arsenal-grid" class="arsenal-grid"></div>`, `<button class="primary" data-action="close">关闭图鉴</button>`,true);
  const render=()=>{let q=$('weapon-search').value.trim().toLowerCase();$('arsenal-grid').innerHTML=WEAPONS.filter(d=>(d.name+d.code+d.type+d.tags.join()).toLowerCase().includes(q)).map(d=>`<button class="catalog-card ${d.rarity===4?'legendary':''}" style="--rarity:${RARITY_COLORS[d.rarity]}" data-action="weapon-detail" data-id="${d.id}" data-level="${d.terminal?4:1}"><span>${iconSVG(d.family)}</span><div><small>${d.type}</small><b>${d.name}</b><p>${d.tags.join(' / ')}${d.terminal?' · 固定 IV':''}</p></div></button>`).join('')};
  $('weapon-search').addEventListener('input',render);render();
 },
 showResult(victory){
  this.closeModal(false);$('hud').classList.add('hidden');$('touch-controls').classList.add('hidden');$('screen').classList.remove('hidden');
  let p=game.player,last=game.damageLog.at(-1),duration=Math.floor(game.totalTime),coreRows=game.cores.map(id=>{let c=game.core(id),m=game.coreMetrics[id]||{count:0,damage:0};return `<div class="result-core">${glyphSVG(c.icon)}<b>${c.name}</b><span>触发 ${m.count} 次</span><span>衍生伤害 ${Math.round(m.damage)}</span></div>`}).join('');
  $('screen').innerHTML=`<div class="result-screen"><span class="eyebrow">${victory?'DISTRICT LIBERATED':'CONNECTION LOST'} / ${game.character.en}</span><h1>${victory?'街区已解放。':'本次行动结束。'}</h1><p class="result-reason">${victory?'20 波完成 · 已解锁 Danger '+game.best.unlocked:'致命来源：'+esc(last?.source||'生命耗尽')}</p>${!victory&&last?`<p class="muted">该次原始伤害 ${last.raw?.toFixed(1)||'—'} → 实际生命伤害 ${last.actual?.toFixed(1)||'—'}${last.self?' / 自伤不受护甲或闪避保护':''}</p>`:''}<div class="result-numbers"><div><b>${game.wave}</b><span>抵达波次</span></div><div><b>${p.kills}</b><span>击杀</span></div><div><b>${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}</b><span>模拟战斗时间</span></div><div><b>${game.gameStats.purchases}</b><span>交易决策</span></div></div><h3 class="subheading">这局核心做了什么</h3>${coreRows||'<p class="muted">本局尚未安装核心。</p>'}${!victory?`<details class="death-log" open><summary>最后 8 秒伤害记录</summary>${game.damageLog.slice(-8).reverse().map(v=>`<p><span>${Math.max(0,game.elapsed-v.time).toFixed(1)} 秒前 · ${esc(v.source)}</span><b class="negative">−${v.actual.toFixed(1)}</b></p>`).join('')}</details>`:''}<div class="result-actions"><button class="primary" data-action="retry">同角色再来一局 ↗</button><button data-action="menu-confirm">重新选择角色</button><button data-action="build">检查本局构筑</button></div><p class="muted">种子 ${game.seed} · Danger ${game.danger} · ${BALANCE.version}。不同的选择，会让下一局完全不同。</p></div>`;
 },
 resetJoystick(){
  if(this.joyTarget&&this.joyPointer!==null)try{if(this.joyTarget.hasPointerCapture(this.joyPointer))this.joyTarget.releasePointerCapture(this.joyPointer)}catch(e){}
  this.joyPointer=null;this.joyTarget=null;if($('joy-thumb'))$('joy-thumb').style.transform='translate(0px,0px)';
  if(typeof game!=='undefined')game.joy={x:0,y:0};
 },
 bindJoystick(){
  const down=e=>{
   if(game.state!=='playing'||this.joyPointer!==null||e.pointerType==='mouse')return;
   if(e.currentTarget===$('world')&&e.clientX>innerWidth*.52)return;
   e.preventDefault();game.touch=true;$('touch-controls').classList.remove('hidden');
   this.joyPointer=e.pointerId;this.joyTarget=e.currentTarget;
   let rect=$('joystick').getBoundingClientRect();this.joyCenter={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
   if(e.currentTarget===$('world'))this.joyCenter={x:e.clientX,y:e.clientY};
   e.currentTarget.setPointerCapture(e.pointerId);this.joyMove(e);
  };
  this.joyMove=e=>{
   if(e.pointerId!==this.joyPointer||game.state!=='playing')return;e.preventDefault();
   let dx=e.clientX-this.joyCenter.x,dy=e.clientY-this.joyCenter.y,len=Math.hypot(dx,dy),max=42,dead=3,mag=clamp((len-dead)/(max-dead),0,1);
   game.joy={x:len?dx/len*mag:0,y:len?dy/len*mag:0};let v=Math.min(max,len);$('joy-thumb').style.transform=`translate(${len?dx/len*v:0}px,${len?dy/len*v:0}px)`;
  };
  for(let el of [$('joystick'),$('world')]){el.addEventListener('pointerdown',down,{passive:false});el.addEventListener('pointermove',this.joyMove,{passive:false});el.addEventListener('lostpointercapture',e=>{if(e.pointerId===this.joyPointer)this.resetJoystick()})}
  for(let type of ['pointerup','pointercancel'])addEventListener(type,e=>{if(e.pointerId===this.joyPointer)this.resetJoystick()});
 }
};
let game;
try{game=new NeonGame();window.game=game;window.UI=UI;UI.init()}catch(e){console.error(e);$('fatal').classList.remove('hidden');$('fatal-details').textContent=e.stack||e.message}
