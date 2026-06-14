"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — dev utilities + auto-update + editor test
// ════════════════════════════════════════════════════════════

window.PBDEV = {
    GRIDS: [4, 6, 8, 12, 16, 24, 32, 48],
    GRID_NAMES: {4:'4분',6:'4분셋',8:'8분',12:'8분셋',16:'16분',24:'16분셋',32:'32분',48:'32분셋'},
    THRESHOLD_MS: 25,

    _bpmMap(song){
        return song.bpmMap || [{bpm: song.bpm, startSec: song.offset||0}];
    },
    _trySnap(t, seg, sub){
        const beat = 60 / seg.bpm / (sub / 4);
        const snapped = Math.round((t - seg.startSec) / beat) * beat + seg.startSec;
        return { snapped, errMs: Math.abs(t - snapped) * 1000 };
    },
    _snapT(t, bpmMap, threshold){
        const th = threshold ?? this.THRESHOLD_MS;
        const segs = [...bpmMap].sort((a,b)=>a.startSec-b.startSec);
        const seg = [...segs].reverse().find(s=>t>=s.startSec) || segs[0];
        let best = null;
        for(const sub of this.GRIDS){
            const r = this._trySnap(t, seg, sub);
            if(!best || r.errMs < best.errMs) best = {...r, sub};
        }
        if(best.errMs > th) return null;
        return best;
    },

    analyze(songId, diff){
        const song = window.SONGS.find(s=>s.id===songId);
        const chart = song?.charts[diff];
        if(!chart){ console.error('Not found:', songId, diff); return; }
        const map = this._bpmMap(song);
        const th = this.THRESHOLD_MS;
        const rows = chart.objects.map((o,i)=>{
            const r = this._snapT(o.t, map, th);
            return r
                ? {i, t:o.t, snapped:Math.round(r.snapped*1000)/1000,
                   errMs:Math.round(r.errMs), grid:this.GRID_NAMES[r.sub]||r.sub, status:'✓'}
                : {i, t:o.t, snapped:'—', errMs:'—', grid:'—', status:'⚠ 엇박/수동확인필요'};
        });
        const snapped = rows.filter(r=>r.status==='✓');
        const skipped = rows.filter(r=>r.status!=='✓');
        const errs = snapped.map(r=>r.errMs);
        console.log(`[PBDEV] ${songId}/${diff} | 총 ${rows.length}개 | 스냅 ${snapped.length}개 | 엇박 보류 ${skipped.length}개`);
        if(errs.length) console.log(`  오차: max ${Math.max(...errs)}ms / avg ${(errs.reduce((a,b)=>a+b,0)/errs.length).toFixed(1)}ms`);
        const gridCount = {};
        snapped.forEach(r=>{ gridCount[r.grid]=(gridCount[r.grid]||0)+1; });
        console.log('  격자 분포:', gridCount);
        if(skipped.length){ console.warn('  엇박/수동확인 필요:'); console.table(skipped); }
        return rows;
    },

    snap(songId, diff, threshold){
        const song = window.SONGS.find(s=>s.id===songId);
        const chart = song?.charts[diff];
        if(!chart){ console.error('Not found:', songId, diff); return; }
        const map = this._bpmMap(song);
        const th = threshold ?? this.THRESHOLD_MS;
        let snapCnt=0, skipCnt=0;
        const out = chart.objects.map(o=>{
            const r = this._snapT(o.t, map, th);
            if(r){ snapCnt++; return {...o, t:Math.round(r.snapped*1000)/1000}; }
            skipCnt++;
            return o;
        });
        console.log(`[PBDEV] 스냅 ${snapCnt}개 / 엇박 원본유지 ${skipCnt}개`);
        console.log(JSON.stringify(out));
        console.info('[PBDEV] 위 JSON을 songs.js의 해당 chart.objects에 붙여넣으세요.');
        return out;
    }
};

// ── auto-update (GitHub SHA) ──
(function autoUpdate(){
    setTimeout(async ()=>{
        try{
            const r=await fetch('https://api.github.com/repos/cometodlite/pulse-bloom/commits?per_page=1',{cache:'no-store'});
            if(!r.ok) return;
            const [c]=await r.json();
            const sha=c.sha;
            const prev=localStorage.getItem('pb_sha');
            localStorage.setItem('pb_sha',sha);
            if(prev && prev!==sha) location.reload();
        }catch(e){}
    },2500);
})();

// ── editor test mode: index.html?test=1 ──
if(location.search.includes('test=1')){
    (async ()=>{
        try{
            const raw=localStorage.getItem('pb_test_chart');
            if(!raw){ alert('에디터에서 테스트를 시작해주세요.'); return; }
            const data=JSON.parse(raw);
            testMode=true;
            const testSong={
                id:'__test__', title:data.meta?.title||'에디터 테스트',
                subtitle:'editor preview', bpm:data.meta?.bpm||120,
                duration:data.meta?.duration||300,
                charts:{ test:{level:0, objects:data.objects||[], offset:0} },
                ladder:['test']
            };
            SONGS.unshift(testSong);
            const rawAudio=window.opener?.rawAudioBuffer;
            if(rawAudio){
                initAudio();
                window._testAudioBuffer=await ctx.decodeAudioData(rawAudio.slice(0));
            }
            stopTitleAnim();
            document.getElementById('ov-title').classList.add('hidden');
            document.getElementById('ov-songs').classList.add('hidden');
            await selectSong(testSong);
            diff='test';
            document.querySelectorAll('#seg-diff button').forEach(b=>{
                b.classList.toggle('sel',b.dataset.d==='test');
                if(b.dataset.d==='test') b.style.color='#fff';
            });
            updateLevelLabel();
        }catch(e){ console.error('테스트 모드 로드 실패:',e); alert('로드 실패: '+e.message); }
    })();
}
