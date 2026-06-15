"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — UI wiring, song select, settings, init
// ════════════════════════════════════════════════════════════

// ── song card helpers ──
function chartNotes(s){ let n=0; for(const d in s.charts) n=Math.max(n, s.charts[d].objects.length); return n; }
function fmtDur(d){ const m=Math.floor(d/60); return m+':'+String(Math.floor(d%60)).padStart(2,'0'); }

// ── daily challenge ──
function mulberry32(seed){
    return function(){
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, seed | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function getDailyChallenge(){
    const d = new Date();
    const seed = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
    const rng = mulberry32(seed);
    const pool = (SONGS||[]).filter(s => !s.isTutorial && !s.id.startsWith('__'));
    if(!pool.length) return null;
    const s = pool[Math.floor(rng()*pool.length)];
    const avail = Object.keys(s.charts).filter(dd => !(s.comingSoon||[]).includes(dd));
    if(!avail.length) return null;
    const dcDiff = avail[Math.floor(rng()*avail.length)];
    const r3=rng(), r4=rng(), r5=rng(), r6=rng(), r7=rng();
    const mods = { mirror:r3>0.6, random:r4>0.75, hidden:r5>0.85, speedMod:r6>0.7?(r7>0.5?1.25:0.75):1.0 };
    const ds = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    return {songId:s.id, diff:dcDiff, mods, date:ds};
}
function setDailyDone(date, scr, gr){
    if(!progress.dailies) progress.dailies = {};
    progress.dailies[date] = {score:scr, grade:gr, ts:Date.now()};
    saveProgress();
}
function loadDailyChallenge(dc, song){
    dailyMode = true; dailyChallenge = dc;
    mirrorMode=!!dc.mods.mirror; randomMode=!!dc.mods.random;
    hiddenMode=!!dc.mods.hidden; speedMod=dc.mods.speedMod||1.0;
    document.getElementById('mirror-toggle').classList.toggle('on',mirrorMode);
    document.getElementById('random-toggle').classList.toggle('on',randomMode);
    document.getElementById('hidden-toggle').classList.toggle('on',hiddenMode);
    document.querySelectorAll('#speed-seg button').forEach(b=>{
        b.classList.toggle('sel', parseFloat(b.dataset.speed)===speedMod);
    });
    selectSong(song).then(()=>{
        diff = dc.diff;
        document.querySelectorAll('#seg-diff button').forEach(b=>{
            b.classList.remove('sel');
            if(b.dataset.d===dc.diff){ b.classList.add('sel'); b.style.color='#fff'; }
        });
        applyDiffApproach();
    });
}

// ── song list ──
function buildSongList(){
    const el=document.getElementById('song-list'); el.innerHTML='';
    const dc=getDailyChallenge();
    if(dc){
        const dcSong=SONGS.find(s=>s.id===dc.songId);
        if(dcSong){
            const isDone=!!(progress.dailies&&progress.dailies[dc.date]);
            const dcCard=document.createElement('div');
            dcCard.className='song-card daily'+(isDone?' daily-done':'');
            const dcDiff=DIFF_META[dc.diff]||[dc.diff.toUpperCase(),'#ffd166'];
            const dcMods=[];
            if(dc.mods.mirror) dcMods.push('미러');
            if(dc.mods.random) dcMods.push('랜덤');
            if(dc.mods.hidden) dcMods.push('히든');
            if(dc.mods.speedMod!==1.0) dcMods.push(dc.mods.speedMod+'×');
            dcCard.innerHTML='<div class="sc-title">오늘의 챌린지</div>'
                +'<div class="sc-sub">'+dcSong.title+' — <span style="color:'+dcDiff[1]+'">'+dcDiff[0]+'</span>'
                +(dcMods.length?' · '+dcMods.join(' · '):'')+'</div>'
                +(isDone?'<div class="sc-meta" style="color:#5effa0">✓ 오늘 완료 ('+progress.dailies[dc.date].grade+')</div>'
                        :'<div class="sc-meta">하루 1회 도전</div>');
            dcCard.onclick=()=>{ if(isDone){ return; } loadDailyChallenge(dc,dcSong); };
            el.appendChild(dcCard);
        }
    }
    SONGS.filter(s=>s.id!=='__test__').forEach(s=>{
        const card=document.createElement('div'); card.className='song-card';
        const soon=s.comingSoon||[];
        const diffs=Object.keys(s.charts).map(d=>{
            const m=DIFF_META[d]||[d.toUpperCase(),'#fff'];
            return '<span class="dchip" style="color:'+m[1]+'">'+m[0]+' '+s.charts[d].level+'</span>';
        }).join('')
        + soon.map(d=>{
            const m=DIFF_META[d]||[d.toUpperCase(),'#888'];
            return '<span class="dchip" style="color:#555;text-decoration:line-through">'+m[0]+'</span>';
        }).join('')
        + (s.isTutorial?'<span class="dchip tut">TUTORIAL</span>':'');
        const bestPB = Object.keys(s.charts)
            .filter(d=>!(s.comingSoon||[]).includes(d) && progress.pbs[s.id+'|'+d])
            .map(d=>progress.pbs[s.id+'|'+d])
            .sort((a,b)=>b.score-a.score)[0];
        const pbHtml = bestPB
            ? '<div class="sc-pb"><b style="color:'+(
                bestPB.grade==='AP'?'#ffd166':bestPB.grade==='SS'?'#ffd166':bestPB.grade==='S'?'#5ee0ff':
                bestPB.grade==='A'?'#5effa0':bestPB.grade==='B'?'#b07cff':'#9a8fb5')+'">'+bestPB.grade+'</b> '+bestPB.score.toLocaleString()+'</div>'
            : '';
        card.innerHTML='<div class="sc-title">'+s.title+'</div>'
            + (s.subtitle?'<div class="sc-sub">'+s.subtitle+'</div>':'')
            + '<div class="sc-meta">'+fmtDur(s.duration)+' · '+s.bpm+' BPM · '+chartNotes(s)+' notes</div>'
            + '<div class="sc-diffs">'+diffs+'</div>'
            + pbHtml;
        card.onclick=()=>selectSong(s);
        el.appendChild(card);
    });
}

// ── difficulty UI ──
function buildDifficultyUI(){
    const seg=document.getElementById('seg-diff'); seg.innerHTML='';
    const ladder=SONG.ladder||Object.keys(SONG.charts);
    const soon=SONG.comingSoon||[];
    let firstAvail=null;
    ladder.forEach(tier=>{
        const has=!!SONG.charts[tier];
        const isSoon=soon.includes(tier);
        const meta=DIFF_META[tier]||[tier.toUpperCase(),'#ffffff'];
        const b=document.createElement('button');
        b.dataset.d=tier;
        if(isSoon){
            b.innerHTML='⏳ '+meta[0]; b.classList.add('coming-soon'); b.disabled=true;
        } else if(has){
            const cost=SONG.charts[tier]?.bloomCost;
            const unlocked=progress.unlocks?.[SONG.id+'|'+tier];
            const badge=cost?(unlocked?` <span style="font-size:.65em;color:#5effa0">🔓</span>`:` <span style="font-size:.65em;color:#b07cff">🌸${cost}</span>`):'';
            b.innerHTML=meta[0]+badge;
            b.style.borderColor=meta[1]; b.style.color=meta[1];
            if(!firstAvail){ firstAvail=tier; b.classList.add('sel'); b.style.color='#fff'; }
        } else {
            b.innerHTML='🔒 '+meta[0]; b.classList.add('locked'); b.disabled=true;
        }
        seg.appendChild(b);
    });
    diff=firstAvail||ladder[0];
    updateLevelLabel();
}
function updateLevelLabel(){
    const ch=SONG.charts[diff]; const el=document.getElementById('diff-level');
    if(ch&&el) el.textContent='· Lv.'+ch.level;
}
function applyDiffApproach(){
    const ch=SONG&&SONG.charts[diff];
    APPROACH=(ch&&ch.approach) || (SONG&&SONG.approach) || 1.2;
    const ap=document.getElementById('approach'); if(ap){ ap.value=APPROACH;
        document.getElementById('approach-val').textContent=APPROACH.toFixed(1)+'초'; }
}
function updatePlayBtn(){
    const btn=document.getElementById('play-btn');
    if(!btn) return;
    const ch=SONG&&SONG.charts[diff];
    const cost=ch?.bloomCost;
    if(cost){
        const unlocked=progress.unlocks?.[SONG.id+'|'+diff];
        if(unlocked){
            btn.innerHTML=`▶ 시작 &nbsp;<span style="font-size:.75em;color:#5effa0">🔓 해금됨</span>`;
        } else {
            btn.innerHTML=`▶ 시작 &nbsp;<span style="font-size:.82em;color:#b07cff">🌸 -${cost}</span>`;
        }
    } else {
        btn.textContent='▶ 시작';
    }
}

// ── song selection ──
async function selectSong(s){
    stopPreview();
    if(ctx && ctx.state==='suspended') ctx.resume().catch(()=>{});
    SONG=s; audioBuffer=null;
    document.getElementById('ov-songs').classList.add('hidden');
    document.getElementById('ov-result').classList.add('hidden');
    document.getElementById('ov-start').classList.remove('hidden');
    document.getElementById('song-title').textContent=s.title;
    document.getElementById('song-sub').innerHTML=(s.subtitle?'<span>'+s.subtitle+'</span>':'')
        + (s.isTutorial?'<span class="tutorial-badge">TUTORIAL</span>':'');
    buildDifficultyUI();
    applyDiffApproach();
    updatePlayBtn();
    const psl=document.getElementById('practice-start');
    if(psl){ psl.max=Math.ceil(s.duration)||300; psl.value=Math.min(parseInt(psl.value)||0, +psl.max); practiceStartSec=+psl.value; }

    const panel=document.getElementById('panel');
    panel.style.opacity='.4'; panel.style.pointerEvents='none';
    document.getElementById('spinner').classList.remove('hidden');
    const ld=document.getElementById('loading'); ld.classList.remove('hidden'); ld.textContent='음악 불러오는 중…';
    try{
        await loadAudio(s);
        document.getElementById('spinner').classList.add('hidden');
        ld.classList.add('hidden');
        panel.style.opacity='1'; panel.style.pointerEvents='auto';
        startPreview(s);
    }catch(err){ ld.textContent='음악 로드 실패: '+err.message; console.error(err); }
}

// ════════════════ SETTINGS UI ════════════════
const musicSl=document.getElementById('music-vol'), sfxSl=document.getElementById('sfx-vol'),
      offSl=document.getElementById('ingame-offset'), noteScaleSl=document.getElementById('note-scale');
const hoverT=document.getElementById('hover-toggle');

function initSettingsUI(){
    musicSl.value=Math.round(musicVol*100); document.getElementById('music-vol-val').textContent=Math.round(musicVol*100)+'%';
    sfxSl.value=Math.round(sfxVol*100);     document.getElementById('sfx-vol-val').textContent=Math.round(sfxVol*100)+'%';
    offSl.value=inputOffset;                document.getElementById('ingame-offset-val').textContent=inputOffset+' ms';
    if(noteScaleSl){ noteScaleSl.value=Math.round(noteScale*100); document.getElementById('note-scale-val').textContent=Math.round(noteScale*100)+'%'; }
    hoverT.classList.toggle('on', hoverMode);
}
musicSl.addEventListener('input', ()=>{ musicVol=+musicSl.value/100;
    document.getElementById('music-vol-val').textContent=musicSl.value+'%';
    if(musicGain) musicGain.gain.value=musicVol; saveSettings(); });
sfxSl.addEventListener('input', ()=>{ sfxVol=+sfxSl.value/100;
    document.getElementById('sfx-vol-val').textContent=sfxSl.value+'%';
    if(sfxGain) sfxGain.gain.value=sfxVol;
    if(ctx){ if(ctx.state==='suspended') ctx.resume(); sfx(660); } saveSettings(); });
offSl.addEventListener('input', ()=>{ inputOffset=parseInt(offSl.value);
    document.getElementById('ingame-offset-val').textContent=inputOffset+' ms'; saveSettings(); });
if(noteScaleSl) noteScaleSl.addEventListener('input', ()=>{
    noteScale=+noteScaleSl.value/100;
    document.getElementById('note-scale-val').textContent=noteScaleSl.value+'%';
    resize(); saveSettings();
});
initSettingsUI();

// ════════════════ IN-GAME CALIBRATION ════════════════
const IGB=0.5, IG_CI=4, IG_M=8;
let igcal={active:false, start:0, beats:[], measure:[], taps:[], raf:0, last:-1, result:null, timer:0};
const igEl=document.getElementById('igcal'), igBeat=document.getElementById('igcal-beat'),
      igPad=document.getElementById('igcal-pad'), igRead=document.getElementById('igcal-read'),
      igApply=document.getElementById('igcal-apply'), igStartBtn=document.getElementById('igcal-start');
function calTick(at,freq){ const o=ctx.createOscillator(),gg=ctx.createGain(); o.connect(gg); gg.connect(ctx.destination);
    o.type='square'; o.frequency.value=freq; gg.gain.setValueAtTime(0.16,at); gg.gain.exponentialRampToValueAtTime(0.0001,at+0.05);
    o.start(at); o.stop(at+0.06); }
function igReset(){ igcal.active=false; igcal.taps=[]; igcal.result=null; igcal.beats=[]; igcal.measure=[]; igcal.last=-1;
    igApply.disabled=true; igRead.textContent='시작을 누르면 카운트인 후 측정합니다'; igBeat.classList.remove('flash','measuring'); igStartBtn.textContent='▶ 시작'; }
function igStop(){ if(igcal.raf)cancelAnimationFrame(igcal.raf); igcal.raf=0; if(igcal.timer)clearTimeout(igcal.timer); igcal.timer=0; }
function igOpen(){ if(!ctx) return; igEl.classList.remove('hidden'); igReset(); }
function igClose(){ igStop(); igcal.active=false; igEl.classList.add('hidden'); }
function igStart(){ if(!ctx)return; if(ctx.state==='suspended')ctx.resume(); igReset(); igcal.active=true;
    const total=IG_CI+IG_M; igcal.start=ctx.currentTime+0.8;
    for(let i=0;i<total;i++){ const bt=igcal.start+i*IGB; igcal.beats.push(bt);
        const m=i>=IG_CI; if(m)igcal.measure.push(bt); calTick(bt, m?880:520); }
    igRead.textContent='카운트인… 소리에 맞춰 탭!'; igStartBtn.textContent='측정 중…'; igBeat.classList.add('measuring');
    const endAt=igcal.start+(total-1)*IGB+0.6; igcal.timer=setTimeout(igFinish, Math.max(50,(endAt-ctx.currentTime)*1000)); }
function igTap(){ if(!igcal.active)return; igcal.taps.push(ctx.currentTime);
    igPad.classList.add('hit'); setTimeout(()=>igPad.classList.remove('hit'),80); igRead.textContent='측정 중… 탭 '+igcal.taps.length; }
function igFinish(){ igStop(); igcal.active=false; igStartBtn.textContent='▶ 다시 측정';
    const diffs=[]; for(const t of igcal.taps){ let best=1e9; for(const b of igcal.measure){ const d=t-b; if(Math.abs(d)<Math.abs(best))best=d; } if(Math.abs(best)<=0.25)diffs.push(best); }
    if(diffs.length<3){ igRead.innerHTML='측정 실패 — 탭이 부족합니다. 다시 시도하세요.'; igApply.disabled=true; return; }
    diffs.sort((a,b)=>a-b); const ms=Math.round(diffs[Math.floor(diffs.length/2)]*1000); igcal.result=ms;
    igRead.innerHTML='측정: 평균 <b>'+(ms>=0?'+':'')+ms+' ms</b> '+(ms>=0?'늦게':'빨리')+' 누름 ('+diffs.length+'회) → 적용하면 박자가 맞춰집니다'; igApply.disabled=false; }
function igApplyFn(){ if(igcal.result==null)return; const v=Math.max(-300,Math.min(300,igcal.result));
    inputOffset=v; offSl.value=v; document.getElementById('ingame-offset-val').textContent=v+' ms'; saveSettings(); igClose(); }
document.getElementById('ig-cal-open').onclick=igOpen;
igStartBtn.onclick=igStart; igApply.onclick=igApplyFn; document.getElementById('igcal-close').onclick=igClose; igPad.onclick=igTap;
window.addEventListener('keydown', e=>{ if(igcal.active && (e.key===' '||e.code==='Space')){ e.preventDefault(); igTap(); } });

// ════════════════ EVENT WIRING ════════════════
document.getElementById('seg-diff').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b||b.disabled||b.classList.contains('locked')) return;
    document.querySelectorAll('#seg-diff button').forEach(x=>{ x.classList.remove('sel');
        if(!x.classList.contains('locked')){ const m=DIFF_META[x.dataset.d]; if(m) x.style.color=m[1]; } });
    b.classList.add('sel'); b.style.color='#fff'; diff=b.dataset.d; updateLevelLabel(); applyDiffApproach(); updatePlayBtn();
});
const apSlider=document.getElementById('approach');
apSlider.addEventListener('input', ()=>{
    APPROACH=parseFloat(apSlider.value);
    document.getElementById('approach-val').textContent=APPROACH.toFixed(1)+'초';
});
const autoT=document.getElementById('auto-toggle');
autoT.addEventListener('click', ()=>{ auto=!auto; autoT.classList.toggle('on',auto); });
hoverT.addEventListener('click', ()=>{ hoverMode=!hoverMode; hoverT.classList.toggle('on',hoverMode); saveSettings(); });

document.getElementById('play-btn').addEventListener('click', ()=>{
    const ch=SONG&&SONG.charts[diff];
    const cost=ch?.bloomCost;
    if(cost){
        const unlockKey=SONG.id+'|'+diff;
        if(!progress.unlocks?.[unlockKey]){
            // 최초 1회 구매
            if(progress.bloom<cost){
                alert(`🌸 블룸이 부족합니다.\n??? 채보는 ${cost} 블룸이 필요합니다.\n현재: ${progress.bloom} 블룸`);
                return;
            }
            if(!confirm(`🌸 ${cost} 블룸을 소모하여 해금합니다.\n현재: ${progress.bloom} 블룸\n\n한 번 해금하면 이후엔 무료로 플레이할 수 있습니다.\n\n??? 채보를 해금하시겠습니까?`)) return;
            progress.bloom=Math.max(0,progress.bloom-cost);
            if(!progress.unlocks) progress.unlocks={};
            progress.unlocks[unlockKey]=true;
            saveProgress();
            document.getElementById('title-bloom-val').textContent=progress.bloom;
            updatePlayBtn();
        }
    }
    startGame();
});
document.getElementById('r-retry').addEventListener('click', ()=>{
    if(replayMode){ replayMode=false; auto=false; }
    startGame();
});
document.getElementById('r-replay').addEventListener('click', ()=>{
    const key='pb_replay_'+SONG.id+'|'+diff;
    const data=localStorage.getItem(key); if(!data) return;
    replayPlayLog=JSON.parse(data); replayIdx=0; replayMode=true; auto=true;
    startGame();
});

const practiceT=document.getElementById('practice-toggle');
const practiceRow=document.getElementById('practice-row');
const practiceSlider=document.getElementById('practice-start');
const practiceValEl=document.getElementById('practice-start-val');
practiceT.addEventListener('click',()=>{
    practiceMode=!practiceMode; practiceT.classList.toggle('on',practiceMode);
    practiceRow.style.display=practiceMode?'':'none';
});
practiceSlider.addEventListener('input',()=>{
    practiceStartSec=+practiceSlider.value;
    const m=Math.floor(practiceStartSec/60), s=practiceStartSec%60;
    practiceValEl.textContent=m+':'+String(s).padStart(2,'0');
});

document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('pause-quit-btn').addEventListener('click', toSongSelect);
document.getElementById('r-menu').addEventListener('click', ()=>{
    stopAudio();
    document.getElementById('ov-result').classList.add('hidden');
    document.getElementById('ov-start').classList.remove('hidden');
});
function toSongSelect(){
    if(paused){ paused=false; try{ ctx.resume(); }catch(e){} }
    stopAudio(); stopPreview(); running=false;
    if(replayMode){ replayMode=false; auto=false; }
    dailyMode=false; dailyChallenge=null;
    document.getElementById('pause-btn').classList.remove('active');
    ['ov-result','ov-start','ov-settings','ov-title','ov-pause','ov-mods'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('ov-songs').classList.remove('hidden');
}
document.getElementById('back-songs').addEventListener('click', toSongSelect);

document.getElementById('ov-title').addEventListener('click', ()=>{
    initAudio();
    buildSongList();
    stopTitleAnim();
    document.getElementById('ov-title').classList.add('hidden');
    document.getElementById('ov-songs').classList.remove('hidden');
});
document.getElementById('back-title').addEventListener('click', ()=>{
    document.getElementById('ov-songs').classList.add('hidden');
    document.getElementById('ov-title').classList.remove('hidden');
    startTitleAnim();
});
document.getElementById('btn-achievements').addEventListener('click', ()=>{
    buildAchievements();
    document.getElementById('ov-songs').classList.add('hidden');
    document.getElementById('ov-achievements').classList.remove('hidden');
});
document.getElementById('back-achievements').addEventListener('click', ()=>{
    document.getElementById('ov-achievements').classList.add('hidden');
    document.getElementById('ov-songs').classList.remove('hidden');
});

function openSettings(from){
    settingsOrigin=from;
    document.getElementById('ov-'+from).classList.add('hidden');
    document.getElementById('ov-settings').classList.remove('hidden');
}
document.getElementById('btn-settings-songs').addEventListener('click', ()=>openSettings('songs'));
document.getElementById('btn-settings-start').addEventListener('click', ()=>openSettings('start'));
document.getElementById('back-settings').addEventListener('click', ()=>{
    document.getElementById('ov-settings').classList.add('hidden');
    document.getElementById('ov-'+settingsOrigin).classList.remove('hidden');
});

function openMods(){
    if(dailyMode){ alert('오늘의 챌린지 중에는 모드를 변경할 수 없습니다.'); return; }
    document.getElementById('ov-start').classList.add('hidden');
    document.getElementById('ov-mods').classList.remove('hidden');
}
function closeMods(){
    document.getElementById('ov-mods').classList.add('hidden');
    document.getElementById('ov-start').classList.remove('hidden');
}
document.getElementById('btn-mods-start').addEventListener('click', openMods);
document.getElementById('back-mods').addEventListener('click', closeMods);

document.getElementById('mode-cards').addEventListener('click', e=>{
    const b=e.target.closest('button[data-mode]'); if(!b) return;
    document.querySelectorAll('#mode-cards button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
    gameMode=b.dataset.mode;
});

const randomT=document.getElementById('random-toggle');
randomT.addEventListener('click', ()=>{ randomMode=!randomMode; randomT.classList.toggle('on',randomMode); });
const mirrorT=document.getElementById('mirror-toggle');
mirrorT.addEventListener('click', ()=>{ mirrorMode=!mirrorMode; mirrorT.classList.toggle('on',mirrorMode); });
const hiddenT=document.getElementById('hidden-toggle');
hiddenT.addEventListener('click', ()=>{ hiddenMode=!hiddenMode; hiddenT.classList.toggle('on',hiddenMode); });
document.getElementById('speed-seg').addEventListener('click', e=>{
    const b=e.target.closest('button[data-speed]'); if(!b) return;
    document.querySelectorAll('#speed-seg button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); speedMod=parseFloat(b.dataset.speed);
});

document.getElementById('r-cal').addEventListener('click', e=>{
    const adj=parseInt(e.currentTarget.dataset.adj||'0');
    inputOffset=Math.max(-300,Math.min(300, inputOffset+adj));
    offSl.value=inputOffset; document.getElementById('ingame-offset-val').textContent=inputOffset+' ms';
    saveSettings();
    e.currentTarget.textContent='✓ 적용됨 (오프셋 '+inputOffset+'ms) — 다시 플레이해 확인';
    e.currentTarget.disabled=true;
});

window.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    if(running && paused){ resumeGame(); }
    else if(running && !paused){ pauseGame(); }
    else if(!document.getElementById('ov-achievements').classList.contains('hidden')){
        document.getElementById('ov-achievements').classList.add('hidden');
        document.getElementById('ov-songs').classList.remove('hidden');
    }
    else if(!document.getElementById('ov-mods').classList.contains('hidden')){
        document.getElementById('ov-mods').classList.add('hidden');
        document.getElementById('ov-start').classList.remove('hidden');
    }
    else if(!document.getElementById('ov-settings').classList.contains('hidden')){
        document.getElementById('ov-settings').classList.add('hidden');
        document.getElementById('ov-'+settingsOrigin).classList.remove('hidden');
    }
    else if(!document.getElementById('ov-start').classList.contains('hidden')){ toSongSelect(); }
    else if(!document.getElementById('ov-songs').classList.contains('hidden')){
        document.getElementById('ov-songs').classList.add('hidden');
        document.getElementById('ov-title').classList.remove('hidden');
    }
});

window.addEventListener('popstate', ()=>{
    if(running && !paused){ pauseGame(); history.pushState({game:true}, ''); }
});

document.addEventListener('contextmenu', e => e.preventDefault());

// ════════════════ INIT ════════════════
try{ initSongs(); startTitleAnim(); }catch(err){
    const ld=document.getElementById('songs-loading');
    ld.classList.remove('hidden'); ld.textContent='로드 실패: '+err.message;
    console.error(err);
}
