"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — progress, achievements, Bloom
// ════════════════════════════════════════════════════════════

function loadProgress(){ try{
    const p=JSON.parse(localStorage.getItem('pulsebloom_progress')||'{}');
    if(p&&typeof p==='object'){
        progress.clears       = p.clears||{};
        progress.bloom        = +p.bloom||0;
        progress.pbs          = p.pbs||{};
        progress.dailies      = p.dailies||{};
        progress.achievements = p.achievements||{};
        progress.unlocks      = p.unlocks||{};
    }
}catch(e){} }
function saveProgress(){ try{
    localStorage.setItem('pulsebloom_progress', JSON.stringify(progress));
}catch(e){} }

function awardBloom(){
    if(!SONG) return 0;
    const key=SONG.id+'|'+diff;
    const prev=progress.clears[key]||0;
    const amt=prev===0 ? (BLOOM_FIRST[diff]||10) : (BLOOM_REPEAT[diff]||3);
    progress.clears[key]=prev+1;
    progress.bloom=Math.min(BLOOM_MAX, progress.bloom+amt);
    saveProgress(); return amt;
}
function getClearedRatio(){
    if(!SONGS||!SONGS.length) return 0;
    let total=0, done=0;
    for(const s of SONGS){
        const soon=s.comingSoon||[];
        for(const d in s.charts){
            if(soon.includes(d)) continue;
            total++;
            if((progress.clears[s.id+'|'+d]||0)>0) done++;
        }
    }
    return total ? done/total : 0;
}

const ACHIEVEMENTS = [
    {id:'first_clear',  icon:'🌱', name:'첫 발걸음',     desc:'처음으로 곡을 클리어하세요',                bloom:5,  cond:c=>c.cleared},
    {id:'fc',           icon:'🔥', name:'풀 콤보',       desc:'FULL COMBO를 달성하세요',                  bloom:15, cond:c=>c.cleared&&c.isFC},
    {id:'ap',           icon:'💎', name:'올 퍼펙트',     desc:'ALL PERFECT를 달성하세요',                 bloom:30, cond:c=>c.cleared&&c.isAP},
    {id:'combo_100',    icon:'⚡', name:'100 콤보',      desc:'한 곡에서 콤보 100을 달성하세요',           bloom:8,  cond:c=>c.cleared&&c.maxCombo>=100},
    {id:'combo_300',    icon:'🌟', name:'300 콤보',      desc:'한 곡에서 콤보 300을 달성하세요',           bloom:15, cond:c=>c.cleared&&c.maxCombo>=300},
    {id:'score_1m',     icon:'👑', name:'백만 점',       desc:'1,000,000점을 달성하세요',                  bloom:25, cond:c=>c.cleared&&c.score>=1000000},
    {id:'all_normal',   icon:'🌿', name:'노말 마스터',   desc:'모든 곡의 NORMAL을 클리어하세요',           bloom:20, cond:()=>_allDiff('normal')},
    {id:'all_clear',    icon:'🌸', name:'풀 클리어',     desc:'모든 곡의 모든 난이도를 클리어하세요',      bloom:50, cond:()=>_allDiffs()},
    {id:'mirror_clear', icon:'🪞', name:'거울 세계',     desc:'미러 모드로 클리어하세요',                  bloom:10, cond:c=>c.cleared&&c.mirrorMode},
    {id:'hidden_clear', icon:'👻', name:'그림자 속에서', desc:'히든 모드로 클리어하세요',                  bloom:10, cond:c=>c.cleared&&c.hiddenMode},
    {id:'speed_clear',  icon:'🏎', name:'스피드 런',     desc:'1.25× 속도로 클리어하세요',                bloom:12, cond:c=>c.cleared&&c.speedMod>=1.25},
    {id:'slow_clear',   icon:'🐢', name:'슬로우 모션',   desc:'0.75× 속도로 클리어하세요',                bloom:8,  cond:c=>c.cleared&&c.speedMod<=0.75},
    {id:'daily',        icon:'🗓', name:'일일 도전자',   desc:'데일리 챌린지를 완료하세요',               bloom:10, cond:c=>c.dailyCompleted},
    {id:'bloom_500',    icon:'🌺', name:'꽃밭',          desc:'Bloom 500을 모으세요',                     bloom:20, cond:()=>progress.bloom>=500},
    {id:'bloom_max',    icon:'✨', name:'만개',           desc:'Bloom을 가득 채우세요 (1000)',             bloom:0,  cond:()=>progress.bloom>=BLOOM_MAX},
    {id:'practice',     icon:'🎯', name:'연습의 힘',     desc:'연습 모드로 클리어하세요',                  bloom:5,  cond:c=>c.cleared&&c.practiceMode},
    {id:'replay_watch', icon:'▶', name:'다시 보기',      desc:'리플레이를 시청하세요',                    bloom:5,  cond:c=>c.replayWatched},
];
function _allDiff(d){
    const pool=SONGS.filter(s=>!s.isTutorial&&!s.id.startsWith('__')&&s.charts[d]&&!(s.comingSoon||[]).includes(d));
    return pool.length>0 && pool.every(s=>(progress.clears[s.id+'|'+d]||0)>0);
}
function _allDiffs(){
    const pool=SONGS.filter(s=>!s.isTutorial&&!s.id.startsWith('__'));
    return pool.length>0 && pool.every(s=>
        Object.keys(s.charts).filter(d=>!(s.comingSoon||[]).includes(d))
            .every(d=>(progress.clears[s.id+'|'+d]||0)>0)
    );
}

let _toastQ=[], _toastBusy=false;
function checkAchievements(ctx){
    const ul=progress.achievements||{};
    const newIds=[];
    for(const a of ACHIEVEMENTS){
        if(ul[a.id]) continue;
        try{ if(a.cond(ctx)){ ul[a.id]={ts:Date.now()}; newIds.push(a.id); } }catch(e){}
    }
    if(!newIds.length) return;
    progress.achievements=ul;
    let bonusBloom=0;
    for(const id of newIds){ const a=ACHIEVEMENTS.find(x=>x.id===id); if(a&&a.bloom) bonusBloom+=a.bloom; }
    if(bonusBloom){ progress.bloom=Math.min(BLOOM_MAX,progress.bloom+bonusBloom); }
    saveProgress();
    _toastQ.push(...newIds);
    if(!_toastBusy) _drainToast();
}
function _drainToast(){
    if(!_toastQ.length){ _toastBusy=false; return; }
    _toastBusy=true;
    const id=_toastQ.shift();
    const a=ACHIEVEMENTS.find(x=>x.id===id); if(!a){ _drainToast(); return; }
    const el=document.getElementById('achievement-toast');
    el.innerHTML='🏆 <b>업적 달성</b> — '+a.icon+' '+a.name+(a.bloom>0?' <span style="color:#b07cff">+'+a.bloom+' Bloom</span>':'');
    el.classList.add('show');
    setTimeout(()=>{ el.classList.remove('show'); setTimeout(_drainToast,350); },2800);
}
function buildAchievements(){
    const ul=progress.achievements||{};
    const done=ACHIEVEMENTS.filter(a=>ul[a.id]).length;
    document.getElementById('ach-counter').textContent=done+' / '+ACHIEVEMENTS.length+' 달성';
    const el=document.getElementById('achievement-list'); el.innerHTML='';
    for(const a of ACHIEVEMENTS){
        const isDone=!!ul[a.id];
        const div=document.createElement('div');
        div.className='ach-item'+(isDone?' done':' locked');
        div.innerHTML='<div class="ach-icon">'+a.icon+'</div>'
            +'<div class="ach-info"><div class="ach-name">'+a.name+'</div>'
            +'<div class="ach-desc">'+a.desc+(a.bloom>0?' · +'+a.bloom+' Bloom':'')+'</div></div>'
            +(isDone?'<div class="ach-check">✓</div>':'');
        el.appendChild(div);
    }
}
