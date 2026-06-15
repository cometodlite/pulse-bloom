"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — game logic, input, scoring, rendering
// ════════════════════════════════════════════════════════════

function initSongs(){
    if(!window.SONGS) throw new Error('songs.js 누락');
    SONGS = window.SONGS;
    loadProgress();
}

// ── chart setup ──
function getPhase(t, sections){
    if(!sections||!sections.length) return 'blooming';
    return [...sections].slice().reverse().find(s=>t>=s.startT)?.phase || 'blooming';
}
function buildObjects(){
    const chart = SONG.charts[diff];
    const raw = chart.objects;
    const chartShift = (chart.offset||0) / 1000;
    const sections = chart.sections || [];
    // For charts with uniform y:0.5, compute separate 2D crowning positions (cnx, cny)
    // so crowning mode spreads notes across the full screen; nx/ny stay as raining coords.
    const hasVariedY = raw.some(o => Math.abs((o.y||0.5)-0.5) > 0.05);
    objects = raw.map((o,i)=>{
        const t = o.t + chartShift;
        const phase = getPhase(t, sections);
        const cnx = hasVariedY ? o.x        : crownToX(i);
        const cny = hasVariedY ? (o.y||0.5) : crownToY(i);
        return {
            t, type:o.type, dur:o.dur||0,
            nx:o.x, ny:o.y||0.5, cnx, cny, hint:o.hint||null,
            phase,
            zx: phase==='blooming' ? snapToZone(o.x) : o.x,
            color:COLORS[i%COLORS.length],
            state:'wait',
            headJudge:null, holdEnd:0, lastTick:0, spawnShown:false
        };
    });
    captions = chart.captions || [];
    const totalJudge = objects.reduce((s,o)=>s+1+(o.type==='hold'?1:0), 0);
    scorePerJudge = totalJudge ? Math.floor(1000000/totalJudge) : 1000;
    if(randomMode){
        const cxs=objects.map(o=>o.cnx), cys=objects.map(o=>o.cny);
        for(let i=cxs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [cxs[i],cxs[j]]=[cxs[j],cxs[i]]; [cys[i],cys[j]]=[cys[j],cys[i]]; }
        objects.forEach((o,i)=>{ o.cnx=cxs[i]; o.cny=cys[i]; });
    }
    if(mirrorMode){ objects.forEach(o=>{ o.cnx=1-o.cnx; }); }
}
function P(o){
    return gameMode==='crowning'
        ? {x:o.cnx*W, y:o.cny*H}
        : {x:o.cnx*W, y:H*dynJLINE};
}

// ════════════════ INPUT ════════════════
function canvasPos(e){
    const r=cv.getBoundingClientRect();
    return { x:e.clientX-r.left, y:e.clientY-r.top };
}
cv.addEventListener('touchstart', e=>{
    if(!running||auto) return;
    e.preventDefault();
    for(const t of e.changedTouches){
        const {x,y}=canvasPos(t);
        onDown('t'+t.identifier, x, y);
    }
},{passive:false});
cv.addEventListener('touchmove', e=>{
    if(!running||auto) return;
    e.preventDefault();
    for(const t of e.changedTouches){
        const {x,y}=canvasPos(t);
        cursor.x=x; cursor.y=y; cursor.on=true;
        const p=pointers.get('t'+t.identifier); if(!p) continue;
        p.x=x; p.y=y;
    }
},{passive:false});
function touchUp(e){
    for(const t of e.changedTouches){
        const p=pointers.get('t'+t.identifier);
        if(p && p.obj) finalizeHold(p.obj, songTime());
        pointers.delete('t'+t.identifier);
    }
}
cv.addEventListener('touchend', touchUp);
cv.addEventListener('touchcancel', touchUp);
cv.addEventListener('pointerdown', e=>{
    if(!running||auto||e.pointerType==='touch') return;
    e.preventDefault();
    const {x,y}=canvasPos(e);
    onDown(e.pointerId, x, y);
},{passive:false});
cv.addEventListener('pointermove', e=>{
    if(!running||auto||e.pointerType==='touch') return;
    const {x,y}=canvasPos(e);
    cursor.x=x; cursor.y=y; cursor.on=true;
    const p=pointers.get(e.pointerId); if(!p) return;
    p.x=x; p.y=y;
},{passive:false});
cv.addEventListener('pointerleave', ()=>{ cursor.on=false; });
function up(e){
    if(e.pointerType==='touch') return;
    const p=pointers.get(e.pointerId);
    if(p && p.obj) finalizeHold(p.obj, songTime());
    pointers.delete(e.pointerId);
}
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);

// 키보드: 어떤 키든 best-timed 노트 타격 (얼불춤 스타일)
const KB_SKIP = new Set(['Escape','Tab','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12']);
function kbPos(){
    const now=songTime(); let best=null, bd=Infinity;
    for(const o of objects){
        if(o.state==='done'||o.state==='held') continue;
        const dt=Math.abs(o.t-now)*1000;
        if(dt<bd){ bd=dt; best=o; }
    }
    if(best){ const p=P(best); return {x:p.x,y:p.y}; }
    return {x:cv.width/2, y:cv.height/2};
}
window.addEventListener('keydown', e=>{
    if(!running||auto||paused||glitchState) return;
    if(e.ctrlKey||e.metaKey||e.altKey||KB_SKIP.has(e.key)||e.repeat) return;
    const kid='k'+e.code;
    if(pointers.has(kid)) return;
    e.preventDefault();
    const {x,y}=kbPos();
    onDown(kid,x,y);
});
window.addEventListener('keyup', e=>{
    if(!running||auto) return;
    const kid='k'+e.code;
    const p=pointers.get(kid);
    if(p&&p.obj) finalizeHold(p.obj,songTime());
    pointers.delete(kid);
});

function onDown(id,x,y){
    if(glitchState){ pointers.set(id,{x,y}); return; }
    const now=songTime();
    hitSound();
    let best=null,bd=Infinity;
    for(const o of objects){
        if(o.state==='done'||o.state==='held') continue;
        const dt=Math.abs(o.t-now)*1000;
        if(dt>HIT.miss) continue;
        const p=P(o);
        // raining: any screen touch hits the best-timed note (Rizline style)
        // crowning: require spatial proximity to the fixed note position
        if(gameMode==='crowning'){
            if(Math.hypot(x-p.x,y-p.y)>R*1.75) continue;
        }
        if(dt<bd){ bd=dt; best=o; }
    }
    if(!best){ pointers.set(id,{x,y}); return; }
    const p=P(best);
    // hitting a fake note = MISS penalty
    if(best.type==='fake'){
        best.state='done';
        judgeCount++; judgeSum+=0; cnt.miss++; combo=0;
        addFloat('FAKE!', p, '#ff5ea8');
        syncHUD();
        pointers.set(id,{x,y}); return;
    }
    const j = bd<=HIT.perfect?'perfect': bd<=HIT.good?'good':'miss';
    if(j!=='miss'){ hitErrors.push((now-best.t)*1000); updateTiming(); }
    if(!auto && !replayMode) replayLog.push({t:now, noteIdx:objects.indexOf(best), judge:j});
    if(best.type==='tap'){
        best.state='done';
        applyJudge(j,p,best.color);
        if(j!=='miss') addNextGlow(best);
        pointers.set(id,{x,y});
    } else {
        best.headJudge=j;
        applyJudge(j,p,best.color);
        if(j==='miss'){ best.state='done'; pointers.set(id,{x,y}); }
        else { best.state='held'; pointers.set(id,{x,y,obj:best}); best.lastTick=now; addNextGlow(best); }
    }
}

function finalizeHold(o, endTime){
    if(o.state!=='held') return;
    const frac = Math.max(0,Math.min(1,(endTime-o.t)/(o.dur||0.001)));
    const p=P(o);
    const tail = frac>=0.85?'perfect': frac>=0.5?'good':'miss';
    if(!auto && !replayMode) replayLog.push({t:endTime, noteIdx:objects.indexOf(o), judge:tail, isHold:true});
    applyTail(tail,p,o.color);
    o.state='done';
}

function addNextGlow(hitObj){
    const idx=objects.indexOf(hitObj);
    for(let i=idx+1;i<objects.length;i++){
        const o=objects[i];
        if(o.state==='done') continue;
        const p=P(o);
        nextGlows.push({x:p.x, y:p.y, color:o.color, life:1.0});
        break;
    }
}

// ════════════════ JUDGE / SCORE ════════════════
function applyJudge(kind,p,color){
    judgeCount++;
    if(kind==='miss'){
        cnt.miss++; combo=0; judgeSum+=0;
        addFloat('MISS',p,'#ff5ea8');
    } else {
        if(kind==='perfect'){ cnt.perfect++; judgeSum+=1; addFloat('PERFECT',p,'#5ee0ff'); }
        else { cnt.good++; judgeSum+=0.6; addFloat('GOOD',p,'#ffd166'); }
        combo++; if(combo>maxCombo) maxCombo=combo;
        score += kind==='perfect' ? scorePerJudge : Math.floor(scorePerJudge/2);
        bloom(p,color, kind==='perfect'?1:0.6);
        ripples.push({x:p.x,y:p.y,r:R,a:1,color});
        const ce=document.getElementById('combo'); ce.classList.remove('combo-pop'); void ce.offsetWidth; ce.classList.add('combo-pop');
    }
    syncHUD();
}
function applyTail(kind,p,color){
    judgeCount++;
    if(kind==='miss'){ cnt.miss++; combo=0; judgeSum+=0; addFloat('LET GO',p,'#ff5ea8'); }
    else {
        if(kind==='perfect') judgeSum+=1; else judgeSum+=0.6;
        combo++; if(combo>maxCombo) maxCombo=combo;
        score += kind==='perfect' ? scorePerJudge : Math.floor(scorePerJudge/2);
        bloom(p,color,1.2);
        ripples.push({x:p.x,y:p.y,r:R*1.4,a:1,color});
    }
    syncHUD();
}
function syncHUD(){
    document.getElementById('score').textContent = score.toLocaleString();
    document.getElementById('combo').textContent = combo>0? combo : '';
    const acc = judgeCount? (judgeSum/judgeCount*100):100;
    document.getElementById('acc').textContent = acc.toFixed(2)+'%';
}
function median(arr){ if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }
function updateTiming(){
    const el=document.getElementById('timing-live');
    if(auto || hitErrors.length<3){ el.textContent=''; return; }
    const m=Math.round(median(hitErrors));
    if(Math.abs(m)<=8){ el.textContent='타이밍 정확'; el.style.color='#5effa0'; }
    else { el.textContent = m>0 ? '늦음 +'+m+'ms' : '빠름 '+m+'ms'; el.style.color = m>0?'#ff8fd0':'#5ee0ff'; }
}

// ════════════════ VISUAL FX ════════════════
const isDense = ()=> APPROACH < 1.0;
function addFloat(txt,p,color){
    if(isDense() && txt!=='MISS' && txt!=='LET GO') return;
    floats.push({txt,x:p.x,y:p.y,color,life:1});
}
function bloom(p,color,strength=1){
    const n = isDense() ? Math.round(5*strength)+3 : Math.round(10*strength)+6;
    for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2;
        const sp=(Math.random()*2+1)*(1+strength);
        petals.push({
            x:p.x, y:p.y,
            vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-0.5,
            r:Math.random()*4+2, color, life:1,
            decay:0.012+Math.random()*0.02
        });
    }
}

// ════════════════ GAME FLOW ════════════════
function startGame(){
    stopPreview();
    paused=false;
    history.pushState({game:true}, '');
    score=0; combo=0; maxCombo=0;
    cnt={perfect:0,good:0,miss:0}; judgeSum=0; judgeCount=0;
    floats=[]; petals=[]; ripples=[]; nextGlows=[]; pointers.clear(); hitErrors=[];
    if(!replayMode) replayLog=[]; else replayIdx=0;
    document.getElementById('timing-live').textContent='';
    buildObjects(); syncHUD();
    // ??? event system reset
    dynJLINE=JLINE_BASE;
    _hiddenModeBase=hiddenMode;
    const _evSrc=SONG.charts[diff];
    chartEvents=(_evSrc.events||[]).map(e=>({...e})).sort((a,b)=>a.t-b.t);
    nextEventIdx=0; glitchState=null; jlineAnim=null;
    if(practiceMode && !replayMode && practiceStartSec>0)
        objects.forEach(o=>{ if(o.t<practiceStartSec) o.state='done'; });

    document.getElementById('ov-start').classList.add('hidden');
    document.getElementById('ov-result').classList.add('hidden');
    document.getElementById('auto-badge').classList.toggle('on', auto && !replayMode);
    document.getElementById('replay-badge').classList.toggle('on', replayMode);
    document.getElementById('crowning-badge').classList.toggle('on', gameMode==='crowning');
    document.getElementById('random-badge').classList.toggle('on', randomMode);
    document.getElementById('mirror-badge').classList.toggle('on', mirrorMode);
    document.getElementById('hidden-badge').classList.toggle('on', hiddenMode);
    const sbEl=document.getElementById('speed-badge');
    sbEl.textContent='⚡ '+speedMod+'×';
    sbEl.classList.toggle('on', speedMod!==1.0);

    if(ctx.state==='closed'){ ctx=null; previewFadeGain=null; previewFilter=null; initAudio(); }
    srcNode = ctx.createBufferSource();
    srcNode.buffer = audioBuffer;
    srcNode.connect(musicGain);
    srcNode.playbackRate.value = speedMod;
    const pStart = (practiceMode && !replayMode) ? practiceStartSec : 0;
    leadIn = pStart > 0 ? 0.5 : APPROACH/speedMod + LEAD_EXTRA;
    audioStart = ctx.currentTime + leadIn - pStart/speedMod;
    const _startAudio=()=>{
        audioStart = ctx.currentTime + leadIn - pStart/speedMod;
        srcNode.start(ctx.currentTime + leadIn, pStart);
    };
    ctx.state==='suspended' ? ctx.resume().then(_startAudio).catch(_startAudio) : _startAudio();

    running=true;
    document.getElementById('pause-btn').classList.add('active');
    if(raf) cancelAnimationFrame(raf);
    loop();
}

function loop(){
    if(!running || paused) return;
    const now=songTime();
    update(now);
    render(now);
    if(now > SONG.duration + 1.2 && objects.every(o=>o.state==='done')){
        endGame(); return;
    }
    raf=requestAnimationFrame(loop);
}

function update(now){
    if(analyser){
        analyser.getByteFrequencyData(freqData);
        let s=0; for(let i=0;i<6;i++) s+=freqData[i];
        const target=(s/6)/255;
        bassPulse += (target-bassPulse)*0.25;
    }

    // ??? event processing
    if(!glitchState){
        while(nextEventIdx<chartEvents.length && now>=chartEvents[nextEventIdx].t){
            processChartEvent(chartEvents[nextEventIdx], now);
            nextEventIdx++;
        }
    }
    // jline animation
    if(jlineAnim){
        const prog=Math.max(0,Math.min(1,(now-jlineAnim.startT)/jlineAnim.dur));
        dynJLINE=jlineAnim.from+(jlineAnim.to-jlineAnim.from)*prog;
        if(prog>=1) jlineAnim=null;
    }

    for(const o of objects){
        if(o.state==='done') continue;
        const dt = o.t-now;
        if(o.state==='wait' && dt<=APPROACH){ o.state='approach'; }

        if(auto){
            if(o.type==='fake'){
                // auto avoids fakes — silent perfect when they expire
                if(o.state==='approach' && now > o.t+HIT.miss/1000){
                    o.state='done';
                    judgeCount++; judgeSum+=1; combo++; if(combo>maxCombo) maxCombo=combo;
                    score+=scorePerJudge; syncHUD();
                }
                continue;
            }
            if(o.state==='approach' && now>=o.t){
                const p=P(o);
                if(o.type==='tap'){ o.state='done'; applyJudge('perfect',p,o.color); addNextGlow(o); }
                else { o.headJudge='perfect'; applyJudge('perfect',p,o.color); o.state='held'; o.lastTick=now; addNextGlow(o); }
                hitSound();
            }
            if(o.state==='held' && now>=o.t+o.dur){ finalizeHold(o, o.t+o.dur); }
        } else {
            if(hoverMode && o.state==='approach' && cursor.on && now >= o.t - HIT.perfect/1000){
                const p=P(o);
                const onLn=gameMode!=='crowning';
                const hd=onLn?Math.abs(cursor.x-p.x):Math.hypot(cursor.x-p.x,cursor.y-p.y);
                if(hd <= R*(onLn?3.2:1.75)){
                    const bd=Math.abs(now-o.t)*1000;
                    const j = bd<=HIT.perfect?'perfect': bd<=HIT.good?'good':'miss';
                    if(j!=='miss'){
                        hitSound(); hitErrors.push((now-o.t)*1000); updateTiming();
                        if(o.type==='tap'){ o.state='done'; applyJudge(j,p,o.color); addNextGlow(o); }
                        else { o.headJudge=j; applyJudge(j,p,o.color); o.state='held'; o.hoverHeld=true; o.lastTick=now; addNextGlow(o); }
                    }
                }
            }
            if((o.state==='approach') && now > o.t + HIT.miss/1000 && !glitchState){
                const p=P(o);
                o.state='done';
                if(o.type==='fake'){
                    // successfully avoided — silent perfect
                    judgeCount++; judgeSum+=1; combo++; if(combo>maxCombo) maxCombo=combo;
                    score+=scorePerJudge; syncHUD();
                } else {
                    applyJudge('miss',p,o.color);
                    if(o.type==='hold'){ applyTail('miss',p,o.color); }
                }
            }
            if(o.state==='held' && o.hoverHeld){
                const p=P(o);
                if(!cursor.on || Math.hypot(cursor.x-p.x, cursor.y-p.y) > R*1.9){ finalizeHold(o, now); }
            }
            if(o.state==='held'){
                if(now - o.lastTick > 0.09){
                    o.lastTick=now;
                    const base=P(o);
                    bloom({x:base.x+(Math.random()*20-10), y:base.y+(Math.random()*20-10)}, o.color, 0.5);
                    score+=8; syncHUD();
                }
                if(now>=o.t+o.dur){ finalizeHold(o, o.t+o.dur); }
            }
        }
    }

    if(auto){
        let target=null,bt=Infinity;
        for(const o of objects){
            if(o.state==='done') continue;
            if(o.t<bt){ bt=o.t; target=o; }
        }
        if(target){ const p=P(target);
            if(!autoCursor.has){ autoCursor.x=p.x; autoCursor.y=p.y; autoCursor.has=true; }
            autoCursor.x+=(p.x-autoCursor.x)*0.18;
            autoCursor.y+=(p.y-autoCursor.y)*0.18;
        }
    }

    if(replayMode){
        while(replayIdx < replayPlayLog.length){
            const ev = replayPlayLog[replayIdx];
            if(ev.t > now) break;
            replayIdx++;
            const ro = objects[ev.noteIdx];
            if(!ro || ro.state==='done') continue;
            const rp = P(ro);
            if(ev.isHold){
                if(ro.state==='held'){ applyTail(ev.judge,rp,ro.color); ro.state='done'; }
            } else {
                hitSound();
                applyJudge(ev.judge,rp,ro.color);
                if(ev.judge!=='miss'){
                    if(ro.type==='tap'){ ro.state='done'; addNextGlow(ro); }
                    else { ro.headJudge=ev.judge; ro.state='held'; ro.lastTick=now; addNextGlow(ro); }
                } else {
                    if(ro.type==='hold') applyTail('miss',rp,ro.color);
                    ro.state='done';
                }
            }
        }
    }

    for(const pt of petals){ pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.06; pt.vx*=0.98; pt.life-=pt.decay; }
    petals=petals.filter(p=>p.life>0);
    if(petals.length>260) petals.splice(0, petals.length-260);
    for(const r of ripples){ r.r+=6; r.a-=0.045; }
    ripples=ripples.filter(r=>r.a>0);
    if(ripples.length>28) ripples.splice(0, ripples.length-28);
    for(const f of floats){ f.y-=0.7; f.life-=0.022; }
    floats=floats.filter(f=>f.life>0);
    for(const ng of nextGlows){ ng.life-=0.035; }
    nextGlows=nextGlows.filter(ng=>ng.life>0);
}

function drawFollowPoints(now){
    // notes share judgment-line Y, so connectors add no spatial info — intentionally empty
}

function drawWaves(now){
    const cx=W/2, cy=H/2;
    g.save();
    g.globalCompositeOperation='lighter';
    for(const o of objects){
        if(o.state==='wait'||o.state==='done') continue;
        const dt=o.t-now;
        if(dt>APPROACH||dt<-0.12) continue;
        const dist=Math.hypot(o.cnx*W-cx, o.cny*H-cy);
        if(dist<R*0.9) continue;
        const prog=Math.max(0, 1-Math.max(0,dt)/APPROACH);
        const waveR=dist*prog;
        if(waveR<2) continue;
        const alpha=prog*0.5*(dt<0?Math.max(0,1+dt/0.12):1);
        const thickness=4;
        const wg=g.createRadialGradient(cx,cy,Math.max(0,waveR-thickness),cx,cy,waveR+thickness);
        wg.addColorStop(0,hexA(o.color,0));
        wg.addColorStop(0.5,hexA(o.color,alpha));
        wg.addColorStop(1,hexA(o.color,0));
        g.fillStyle=wg;
        g.beginPath(); g.arc(cx,cy,waveR+thickness,0,Math.PI*2); g.fill();
    }
    g.globalCompositeOperation='source-over';
    g.restore();
}

function drawCrowningArrows(now){
    const vis=[];
    for(const o of objects){
        if(gameMode!=='crowning' && o.phase!=='crowning') continue;
        if(o.state==='done'||o.state==='wait') continue;
        const dt=o.t-now;
        if(dt < -HIT.miss/1000) continue;
        vis.push(o);
    }
    if(vis.length<2) return;
    for(let i=0;i<vis.length-1;i++){
        const a=vis[i], b=vis[i+1];
        const pa=P(a), pb=P(b);
        const dx=pb.x-pa.x, dy=pb.y-pa.y;
        const dist=Math.hypot(dx,dy);
        if(dist<4) continue;
        const ux=dx/dist, uy=dy/dist;
        const dtA=a.t-now;
        const prog=1-Math.max(0,dtA/APPROACH);
        const alpha=0.38*(prog>0.8?(1-prog)/0.2:1);
        if(alpha<0.02) continue;

        const margin=R*1.1;
        const sx=pa.x+ux*margin, sy=pa.y+uy*margin;
        const ex=pb.x-ux*margin, ey=pb.y-uy*margin;
        if(Math.hypot(ex-sx,ey-sy)<R) continue;

        g.save();
        g.strokeStyle=`rgba(255,255,255,${alpha})`; g.lineWidth=1.5;
        g.setLineDash([5,8]); g.lineDashOffset=-prog*14;
        g.beginPath(); g.moveTo(sx,sy); g.lineTo(ex,ey); g.stroke();

        g.setLineDash([]);
        const hw=7, hl=12;
        const ax=ex-ux*hl, ay=ey-uy*hl;
        const px2=-uy*hw, py2=ux*hw;
        g.beginPath();
        g.moveTo(ex,ey);
        g.lineTo(ax+px2,ay+py2);
        g.lineTo(ax-px2,ay-py2);
        g.closePath();
        g.fillStyle=`rgba(255,255,255,${alpha*1.4})`; g.fill();
        g.restore();
    }
}

function render(now){
    g.clearRect(0,0,W,H);
    const cx=W/2, cy=H/2;
    const glow=0.10+bassPulse*0.22;
    const bg=g.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*0.7);
    bg.addColorStop(0,`rgba(60,25,90,${glow})`);
    bg.addColorStop(1,'rgba(5,3,10,0)');
    g.fillStyle=bg; g.fillRect(0,0,W,H);

    for(const r of ripples){
        g.beginPath(); g.arc(r.x,r.y,r.r,0,Math.PI*2);
        g.strokeStyle=hexA(r.color, r.a*0.7); g.lineWidth=2.5; g.stroke();
    }

    g.globalCompositeOperation='lighter';
    for(const pt of petals){
        g.beginPath(); g.arc(pt.x,pt.y,pt.r*(0.4+pt.life),0,Math.PI*2);
        g.fillStyle=hexA(pt.color, pt.life*0.8); g.fill();
    }
    g.globalCompositeOperation='source-over';

    const hasActive=objects.some(o=>o.state!=='wait'&&o.state!=='done');
    if(hasActive && gameMode!=='crowning'){
        g.save();
        const jy=H*dynJLINE;
        for(const o of objects){
            if(o.state==='wait'||o.state==='done') continue;
            const dt=o.t-now;
            const prox=1-Math.max(0,Math.min(1,dt/APPROACH));
            if(prox<0.55) continue;
            const ga=(prox-0.55)/0.45;
            const rg=g.createRadialGradient(o.cnx*W,jy,0,o.cnx*W,jy,R*3);
            rg.addColorStop(0,hexA(o.color,0.35*ga));
            rg.addColorStop(1,hexA(o.color,0));
            g.globalCompositeOperation='lighter';
            g.fillStyle=rg; g.fillRect(o.nx*W-R*3,jy-R*1.5,R*6,R*3);
            g.globalCompositeOperation='source-over';
        }
        g.strokeStyle='rgba(255,255,255,0.10)'; g.lineWidth=1.5;
        g.beginPath(); g.moveTo(0,jy); g.lineTo(W,jy); g.stroke();
        const lg=g.createLinearGradient(0,jy-14,0,jy+14);
        lg.addColorStop(0,'rgba(180,120,255,0)');
        lg.addColorStop(0.5,'rgba(180,120,255,0.07)');
        lg.addColorStop(1,'rgba(180,120,255,0)');
        g.fillStyle=lg; g.fillRect(0,jy-14,W,28);
        g.restore();
    }

    drawFollowPoints(now);
    if(gameMode==='crowning') drawCrowningArrows(now);

    g.globalCompositeOperation='lighter';
    for(const ng of nextGlows){
        const r=R*(1.2+(1-ng.life)*1.6);
        const grad=g.createRadialGradient(ng.x,ng.y,0,ng.x,ng.y,r);
        grad.addColorStop(0, hexA(ng.color, ng.life*0.45));
        grad.addColorStop(0.5, hexA(ng.color, ng.life*0.12));
        grad.addColorStop(1, hexA(ng.color,0));
        g.fillStyle=grad; g.beginPath(); g.arc(ng.x,ng.y,r,0,Math.PI*2); g.fill();
    }
    g.globalCompositeOperation='source-over';

    for(const o of objects){
        if(o.state==='wait'||o.state==='done') continue;
        const dt=o.t-now;
        const appT=Math.max(0,Math.min(1, dt/APPROACH));
        const p=gameMode==='crowning'
            ? {x:o.cnx*W, y:o.cny*H}
            : {x:o.cnx*W, y:H*dynJLINE*(1-appT)};
        if(hiddenMode) g.globalAlpha=Math.min(1, appT/0.38);
        drawObject(o,p,appT,now);
        if(hiddenMode) g.globalAlpha=1;
    }

    if(auto && autoCursor.has){ drawCursor(autoCursor.x,autoCursor.y,'#5ee0ff'); }
    if(!auto && hoverMode && cursor.on){ drawCursor(cursor.x,cursor.y,'#ffd166'); }

    g.textAlign='center'; g.textBaseline='middle';
    for(const f of floats){
        g.font='700 '+Math.round(R*0.42)+'px Segoe UI, sans-serif';
        g.fillStyle=hexA(f.color, f.life);
        g.fillText(f.txt, f.x, f.y);
    }

    if(captions.length){
        for(const c of captions){
            if(now>=c.t0 && now<=c.t1){
                const edge=Math.min(now-c.t0, c.t1-now);
                drawCaption(c.text, Math.min(1, edge/0.45));
                break;
            }
        }
    }

    if(now<0){
        const c=Math.ceil(-now);
        if(c<=3){
            g.textAlign='center'; g.textBaseline='middle';
            g.font='800 '+Math.round(Math.min(W,H)*0.3)+'px Segoe UI, sans-serif';
            g.fillStyle='rgba(255,255,255,'+(0.25+0.4*(-now-(c-1)))+')';
            g.fillText(c, W/2, H/2);
        }
    }

    // ??? glitch overlay (rewind effect)
    if(glitchState && ctx && ctx.currentTime < glitchState.endWebTime){
        drawGlitchOverlay(now);
    } else if(glitchState && ctx && ctx.currentTime >= glitchState.endWebTime){
        glitchState=null;
    }
}

function drawObject(o,p,appT,now){
    if(o.type==='fake'){ drawFakeNote(o,p,appT,now); return; }
    if(gameMode==='crowning') drawCrowningNote(o,p,appT,now);
    else drawRainingNote(o,p,appT,now);
}

function drawCrowningNote(o,p,appT,now){
    const isHold=o.type==='hold', col=o.color;
    const ringR=R*(1+appT*(isDense()?2.2:3.0));
    g.beginPath(); g.arc(p.x,p.y,ringR,0,Math.PI*2);
    g.strokeStyle=hexA(col,0.85*(1-appT*0.3)); g.lineWidth=3; g.stroke();
    g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2);
    if(isHold){
        g.strokeStyle=hexA(col,0.95); g.lineWidth=4; g.stroke();
        const ig=g.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
        ig.addColorStop(0,hexA(col,0.18)); ig.addColorStop(1,hexA(col,0));
        g.fillStyle=ig; g.fill();
    } else {
        const rg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
        rg.addColorStop(0,hexA(col,0.9)); rg.addColorStop(0.7,hexA(col,0.5)); rg.addColorStop(1,hexA(col,0.05));
        g.fillStyle=rg; g.fill();
        g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2);
        g.strokeStyle=hexA('#ffffff',0.5); g.lineWidth=2; g.stroke();
    }
    if(o.state==='held'){
        const frac=Math.max(0,Math.min(1,(now-o.t)/(o.dur||0.001)));
        g.beginPath(); g.arc(p.x,p.y,R*1.25,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
        g.strokeStyle=hexA('#ffffff',0.9); g.lineWidth=5; g.stroke();
        g.beginPath(); g.arc(p.x,p.y,R*(0.5+0.15*Math.sin(now*20)),0,Math.PI*2);
        g.fillStyle=hexA(col,0.5); g.fill();
    }
    if(isHold && o.state==='approach'){
        g.font='600 '+Math.round(R*0.5)+'px Segoe UI'; g.textAlign='center'; g.textBaseline='middle';
        g.fillStyle=hexA('#ffffff',0.6); g.fillText('HOLD', p.x, p.y);
    }
    if(o.hint && (o.state==='approach'||o.state==='held')){
        const pl=0.5+0.4*Math.sin(now*7);
        g.beginPath(); g.arc(p.x,p.y,R*(1.55+0.12*Math.sin(now*7)),0,Math.PI*2);
        g.strokeStyle=hexA('#ffffff',pl); g.lineWidth=2; g.stroke();
        const ly=p.y-R*1.9;
        g.font='700 '+Math.round(R*0.42)+'px Segoe UI'; g.textAlign='center'; g.textBaseline='bottom';
        g.fillStyle='#fff'; g.fillText(o.hint, p.x, ly);
        g.beginPath(); g.moveTo(p.x,p.y-R*1.5); g.lineTo(p.x-7,p.y-R*1.5-11); g.lineTo(p.x+7,p.y-R*1.5-11);
        g.closePath(); g.fillStyle=hexA('#ffffff',pl); g.fill();
    }
}

function drawRainingNote(o,p,appT,now){
    const col=o.color, isHold=o.type==='hold';
    const jy=H*dynJLINE;
    const dt=o.t-now;
    const missFrac=dt<0?Math.min(1,Math.abs(dt)/(HIT.miss/1000)):0;
    const a=1-missFrac*0.55;

    if(p.y>4 && appT>0.02){
        const tailLen=Math.min(R*3, p.y*0.35);
        g.save();
        const tg=g.createLinearGradient(p.x,p.y-tailLen,p.x,p.y);
        tg.addColorStop(0,hexA(col,0));
        tg.addColorStop(1,hexA(col,0.32*a));
        g.strokeStyle=tg; g.lineWidth=3;
        g.beginPath(); g.moveTo(p.x,p.y-tailLen); g.lineTo(p.x,p.y);
        g.stroke(); g.restore();
    }

    if(!isHold){
        const rg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
        rg.addColorStop(0,hexA(col,0.9*a)); rg.addColorStop(0.65,hexA(col,0.45*a)); rg.addColorStop(1,hexA(col,0.04));
        g.fillStyle=rg; g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2); g.fill();
        g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2);
        g.strokeStyle=hexA('#ffffff',0.45*a); g.lineWidth=1.8; g.stroke();
    } else {
        g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2);
        g.strokeStyle=hexA(col,0.92*a); g.lineWidth=3.5; g.stroke();
        const ig=g.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
        ig.addColorStop(0,hexA(col,0.18*a)); ig.addColorStop(1,hexA(col,0));
        g.fillStyle=ig; g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2); g.fill();
    }

    if(o.state==='held'){
        const frac=Math.max(0,Math.min(1,(now-o.t)/(o.dur||0.001)));
        const maxBarH=Math.min(R*5.5,H*0.22);
        const remH=maxBarH*(1-frac);
        const bgG=g.createLinearGradient(p.x,jy-maxBarH,p.x,jy);
        bgG.addColorStop(0,hexA(col,0)); bgG.addColorStop(1,hexA(col,0.1));
        g.fillStyle=bgG; g.fillRect(p.x-R*0.19,jy-maxBarH,R*0.38,maxBarH);
        if(remH>2){
            const fg=g.createLinearGradient(p.x,jy-remH,p.x,jy);
            fg.addColorStop(0,hexA(col,0)); fg.addColorStop(0.5,hexA(col,0.82)); fg.addColorStop(1,hexA(col,0.5));
            g.fillStyle=fg; g.fillRect(p.x-R*0.19,jy-remH,R*0.38,remH);
        }
        g.beginPath(); g.arc(p.x,jy,R*1.22,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
        g.strokeStyle=hexA('#ffffff',0.88); g.lineWidth=5; g.stroke();
        g.beginPath(); g.arc(p.x,jy,R*(0.48+0.14*Math.sin(now*20)),0,Math.PI*2);
        g.fillStyle=hexA(col,0.5); g.fill();
    }
    if(isHold && o.state==='approach'){
        g.font='600 '+Math.round(R*0.5)+'px Segoe UI'; g.textAlign='center'; g.textBaseline='middle';
        g.fillStyle=hexA('#ffffff',0.6*a); g.fillText('HOLD', p.x, p.y);
    }
    if(o.hint && (o.state==='approach'||o.state==='held')){
        const pl=0.5+0.4*Math.sin(now*7);
        const ly=p.y-R*2.0;
        g.font='700 '+Math.round(R*0.42)+'px Segoe UI'; g.textAlign='center'; g.textBaseline='bottom';
        g.fillStyle=hexA('#fff',a*pl); g.fillText(o.hint, p.x, ly);
    }
}

function drawFakeNote(o,p,appT,now){
    const col='#ff2244';
    const jitter=(Math.random()-0.5)*R*0.12;
    const px=p.x+jitter, py=p.y+jitter;
    // draw as a ×-marked reddish circle that flickers
    const flicker=0.7+0.3*Math.sin(now*31+o.t*19);
    const rg=g.createRadialGradient(px,py,0,px,py,R);
    rg.addColorStop(0,hexA(col,0.55*flicker)); rg.addColorStop(0.5,hexA(col,0.28*flicker)); rg.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=rg; g.beginPath(); g.arc(px,py,R,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(px,py,R,0,Math.PI*2);
    g.strokeStyle=hexA(col,0.85*flicker); g.lineWidth=2.5; g.stroke();
    // × mark
    g.save(); g.strokeStyle=hexA('#ffffff',0.85*flicker); g.lineWidth=3;
    const s=R*0.42;
    g.beginPath(); g.moveTo(px-s,py-s); g.lineTo(px+s,py+s); g.stroke();
    g.beginPath(); g.moveTo(px+s,py-s); g.lineTo(px-s,py+s); g.stroke();
    g.restore();
    // dashed tail for fake notes in raining mode
    if(gameMode!=='crowning'){
        const tailLen=Math.min(R*2.5,p.y*0.3);
        if(p.y>4 && appT>0.02){
            const tg=g.createLinearGradient(px,py-tailLen,px,py);
            tg.addColorStop(0,'rgba(0,0,0,0)'); tg.addColorStop(1,hexA(col,0.28*flicker));
            g.save(); g.strokeStyle=tg; g.lineWidth=2;
            g.setLineDash([4,4]);
            g.beginPath(); g.moveTo(px,py-tailLen); g.lineTo(px,py); g.stroke();
            g.setLineDash([]); g.restore();
        }
    }
}

// ════════════════ ??? EVENT SYSTEM ════════════════
function processChartEvent(ev, now){
    if(ev.type==='mode_switch'){
        gameMode=ev.to;
        document.getElementById('crowning-badge').classList.toggle('on', gameMode==='crowning');
    } else if(ev.type==='jline_move'){
        jlineAnim={from:dynJLINE, to:ev.y, startT:now, dur:1.5};
    } else if(ev.type==='lane_shuffle'){
        const upcoming=objects.filter(o=>o.state==='wait'||o.state==='approach');
        const cxs=upcoming.map(o=>o.cnx), cys=upcoming.map(o=>o.cny);
        for(let i=cxs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [cxs[i],cxs[j]]=[cxs[j],cxs[i]]; [cys[i],cys[j]]=[cys[j],cys[i]]; }
        upcoming.forEach((o,i)=>{ o.cnx=cxs[i]; o.cny=cys[i]; });
        addFloat('SHUFFLE!', {x:W/2,y:H*0.5}, '#ffd166');
    } else if(ev.type==='rewind'){
        if(!ev._fired){ ev._fired=true; doRewind(ev, now); }
    } else if(ev.type==='hidden_mode'){
        hiddenMode = ev.on ? true : _hiddenModeBase;
        document.getElementById('hidden-badge').classList.toggle('on', hiddenMode);
        addFloat(ev.on ? 'HIDDEN ON' : 'HIDDEN OFF', {x:W/2,y:H*0.5}, '#b07cff');
    }
}

function doRewind(ev, now){
    if(!ctx||!audioBuffer) return;
    const glitchDur=ev.glitchDur||2.0;
    const rewindTo=ev.to;
    const glitchEndWT=ctx.currentTime+glitchDur;

    // Audio starts exactly at glitch end, from (rewindTo - APPROACH) in the song.
    // So at glitch end: songTime = rewindTo - APPROACH → notes at rewindTo are at screen top.
    // APPROACH seconds later: songTime = rewindTo → those notes hit the judgment line.
    // No silence gap — music plays while notes fall.
    const audioOffset=Math.max(0, rewindTo-APPROACH);
    audioStart=glitchEndWT-(audioOffset+inputOffset/1000)/speedMod;

    // Reset objects from rewindTo onwards so they re-approach after glitch
    objects.forEach(o=>{
        if(o.t>=rewindTo && o.t<=now+0.1){
            o.state='wait'; o.headJudge=null; o.holdEnd=0; o.lastTick=0; o.hoverHeld=false;
        }
    });

    // Event index: re-fire events after rewindTo
    nextEventIdx=chartEvents.findIndex(e=>e.t>rewindTo);
    if(nextEventIdx===-1) nextEventIdx=chartEvents.length;

    // Restart audio: begins at glitch end, plays from audioOffset
    try{ srcNode.stop(); }catch(e){}
    srcNode=ctx.createBufferSource();
    srcNode.buffer=audioBuffer;
    srcNode.connect(musicGain);
    srcNode.playbackRate.value=speedMod;
    srcNode.start(glitchEndWT, audioOffset);

    // Glitch blocks input + auto-miss until glitch visual ends
    glitchState={endWebTime:glitchEndWT};
}

function drawGlitchOverlay(now){
    g.save();
    // scanlines
    g.fillStyle='rgba(0,0,0,0.55)';
    for(let y=0;y<H;y+=4){ g.fillRect(0,y,W,2); }
    // horizontal displacement strips
    const strips=18;
    for(let i=0;i<strips;i++){
        const sy=Math.random()*H;
        const sh=Math.random()*H*0.05+4;
        const dx=(Math.random()-0.5)*W*0.08;
        g.drawImage(cv, 0,sy,W,sh, dx,sy,W,sh);
    }
    // RGB fringe overlay
    g.globalCompositeOperation='lighter';
    g.fillStyle=`rgba(255,0,80,0.08)`; g.fillRect(-6,0,W,H);
    g.fillStyle=`rgba(0,200,255,0.08)`; g.fillRect(6,0,W,H);
    g.globalCompositeOperation='source-over';
    // REWIND text
    const flash=Math.sin(now*26)>0;
    if(flash){
        g.font=`900 ${Math.round(Math.min(W,H)*0.10)}px Segoe UI`;
        g.textAlign='center'; g.textBaseline='middle';
        g.fillStyle='rgba(255,60,60,0.92)';
        g.fillText('◀◀ REWIND', W/2, H/2);
    }
    g.restore();
}

function drawCursor(x,y,col){
    g.beginPath(); g.arc(x,y,10,0,Math.PI*2);
    g.fillStyle=hexA(col,0.9); g.fill();
    g.beginPath(); g.arc(x,y,18,0,Math.PI*2);
    g.strokeStyle=hexA(col,0.5); g.lineWidth=2; g.stroke();
}

function drawCaption(text, alpha){
    g.font='600 '+Math.round(Math.min(W,H)*0.032)+'px Segoe UI, sans-serif';
    g.textAlign='center'; g.textBaseline='middle';
    const padX=24, w=g.measureText(text).width+padX*2, h=Math.min(W,H)*0.07;
    const x=W/2, y=H*0.86;
    g.fillStyle=`rgba(10,6,20,${0.7*alpha})`;
    roundRect(x-w/2, y-h/2, w, h, h/2); g.fill();
    g.strokeStyle=hexA('#b07cff', 0.5*alpha); g.lineWidth=1.5;
    roundRect(x-w/2, y-h/2, w, h, h/2); g.stroke();
    g.fillStyle=`rgba(255,255,255,${alpha})`;
    g.fillText(text, x, y);
}

function endGame(){
    running=false; paused=false;
    hiddenMode=_hiddenModeBase;
    document.getElementById('pause-btn').classList.remove('active');
    if(raf) cancelAnimationFrame(raf);
    const acc = judgeCount? judgeSum/judgeCount*100 : 0;
    const isAP = cnt.miss===0 && cnt.good===0;
    const isFC = cnt.miss===0;
    if(isAP && !replayMode) score = 1000000;
    let grade,color;
    if(isAP)             {grade='AP'; color='';}
    else if(acc>=98)     {grade='SS'; color='#ffd166';}
    else if(acc>=95)     {grade='S';  color='#5ee0ff';}
    else if(acc>=90)     {grade='A';  color='#5effa0';}
    else if(acc>=80)     {grade='B';  color='#b07cff';}
    else if(acc>=70)     {grade='C';  color='#ff8fd0';}
    else if(acc>=55)     {grade='D';  color='#ffd166';}
    else                 {grade='F';  color='#ff5ea8';}
    const gradeEl=document.getElementById('grade');
    gradeEl.textContent=grade; gradeEl.style.color=color; gradeEl.className=isAP?'ap':'';
    const fcEl=document.getElementById('r-fc-badge');
    if(isAP){ fcEl.textContent='ALL PERFECT'; fcEl.className='ap'; }
    else if(isFC){ fcEl.textContent='FULL COMBO'; fcEl.className='fc'; }
    else { fcEl.className='hidden'; }
    animateScore(document.getElementById('r-score'), score);

    const snEl=document.getElementById('r-song-name');
    const sdEl=document.getElementById('r-diff-name');
    if(snEl) snEl.textContent=SONG.title||'';
    if(sdEl && DIFF_META[diff]){
        sdEl.textContent=DIFF_META[diff][0];
        sdEl.style.color=DIFF_META[diff][1]||'#fff';
    }

    const pbKey=SONG.id+'|'+diff;
    const prevPB=progress.pbs[pbKey];
    const nrEl=document.getElementById('r-newrecord'), pbEl=document.getElementById('r-pb-line');
    if(testMode){
        nrEl.textContent='🔧 에디터 테스트 — 기록 저장 안 됨'; nrEl.className=''; pbEl.className='hidden';
    } else if(replayMode){
        nrEl.textContent='▶ REPLAY'; nrEl.className=''; pbEl.className='hidden';
    } else if(!auto){
        if(!prevPB || score>prevPB.score){
            progress.pbs[pbKey]={score,acc:parseFloat(acc.toFixed(2)),grade};
            saveProgress();
            nrEl.textContent = prevPB ? '🏆 신기록! +'+(score-prevPB.score).toLocaleString()+'점' : '🎉 첫 클리어!';
            nrEl.className=''; pbEl.className='hidden';
        } else {
            nrEl.className='hidden';
            document.getElementById('r-pb-val').textContent=prevPB.score.toLocaleString()+' ('+prevPB.grade+' · '+prevPB.acc.toFixed(2)+'%)';
            pbEl.className='';
        }
    } else { nrEl.className='hidden'; pbEl.className='hidden'; }
    if(!auto && !replayMode && !practiceMode && !testMode){
        try{ localStorage.setItem('pb_replay_'+pbKey, JSON.stringify(replayLog)); }catch(e){}
    }
    const replayBtnEl=document.getElementById('r-replay');
    if(!replayMode && !practiceMode && !testMode && localStorage.getItem('pb_replay_'+pbKey))
        replayBtnEl.style.display='';
    else replayBtnEl.style.display='none';
    if(!testMode){
        checkAchievements({
            cleared:!auto&&!replayMode, isFC, isAP, maxCombo, score,
            mirrorMode, hiddenMode, speedMod, practiceMode,
            dailyCompleted: dailyMode&&!replayMode&&!!dailyChallenge,
            replayWatched: replayMode
        });
    }
    if(dailyMode && !replayMode && dailyChallenge){
        setDailyDone(dailyChallenge.date, score, grade);
        dailyMode=false; dailyChallenge=null;
    }

    document.getElementById('r-acc').textContent=acc.toFixed(2)+'%';
    document.getElementById('r-combo').textContent=maxCombo;
    document.getElementById('r-perfect').textContent=cnt.perfect;
    document.getElementById('r-good').textContent=cnt.good;
    document.getElementById('r-miss').textContent=cnt.miss;

    const tl=document.getElementById('r-timing-line'), cb=document.getElementById('r-cal');
    cb.disabled=false;
    if(!auto && hitErrors.length>=5){
        const m=Math.round(median(hitErrors));
        document.getElementById('r-timing').textContent=(m>0?'+':'')+m+'ms '+(Math.abs(m)<=8?'(정확)':m>0?'(늦게 누름)':'(빨리 누름)');
        tl.style.display='';
        if(Math.abs(m)>8){ cb.textContent='📡 이 결과로 보정 ('+(m>0?'+':'')+m+'ms)'; cb.dataset.adj=m; cb.style.display=''; }
        else cb.style.display='none';
    } else { tl.style.display='none'; cb.style.display='none'; }

    const bloomLine = document.getElementById('r-bloom-line');
    if(!replayMode && !testMode && !auto){
        const bloomEarned = awardBloom();
        bloomLine.style.display = '';
        document.getElementById('r-bloom').textContent = '+' + bloomEarned;
        document.getElementById('r-bloom-total').textContent = '(합계 ' + progress.bloom.toLocaleString() + ' / ' + BLOOM_MAX.toLocaleString() + ')';
    } else { bloomLine.style.display='none'; }

    document.getElementById('ov-result').classList.remove('hidden');
}

function stopAudio(){ try{ srcNode && srcNode.stop(); }catch(e){} }

function pauseGame(){
    if(!running || paused) return;
    paused=true;
    try{ ctx.suspend(); }catch(e){}
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    document.getElementById('ov-pause').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('active');
}
function resumeGame(){
    if(!paused) return;
    paused=false;
    document.getElementById('ov-pause').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('active');
    try{ ctx.resume(); }catch(e){}
    loop();
}
