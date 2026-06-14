"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — audio engine (Web Audio API)
// ════════════════════════════════════════════════════════════

function initAudio(){
    if(ctx) return;
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    ctx.resume();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    musicGain = ctx.createGain(); musicGain.gain.value = musicVol;
    sfxGain   = ctx.createGain(); sfxGain.gain.value   = sfxVol;
    musicGain.connect(analyser); analyser.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
}

document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && ctx && ctx.state==='suspended')
        ctx.resume().catch(()=>{});
});

function sfx(freq){
    if(!sfxGain) return;
    const o=ctx.createOscillator(), gg=ctx.createGain();
    o.connect(gg); gg.connect(sfxGain);
    o.type='triangle'; o.frequency.value=freq;
    gg.gain.setValueAtTime(0.13, ctx.currentTime);
    gg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12);
    o.start(); o.stop(ctx.currentTime+0.13);
}
function hitSound(){ if(ctx) sfx(800); }

function initPreviewGraph(){
    if(previewFilter) return;
    previewFadeGain = ctx.createGain(); previewFadeGain.gain.value = 0;
    previewFilter = ctx.createBiquadFilter();
    previewFilter.type = 'lowpass'; previewFilter.frequency.value = 700; previewFilter.Q.value = 6;
    previewFadeGain.connect(previewFilter); previewFilter.connect(musicGain);
}
function schedulePreviewChunk(){
    if(!previewActive || !audioBuffer || !ctx) return;
    const startSec = PREVIEW_STARTS[previewSong.id] ?? 0;
    initPreviewGraph();
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer; src.connect(previewFadeGain);
    const now = ctx.currentTime;
    previewFadeGain.gain.cancelScheduledValues(now);
    previewFadeGain.gain.setValueAtTime(0, now);
    previewFadeGain.gain.linearRampToValueAtTime(1, now + PREVIEW_FADE);
    previewFadeGain.gain.setValueAtTime(1, now + PREVIEW_DUR - PREVIEW_FADE);
    previewFadeGain.gain.linearRampToValueAtTime(0, now + PREVIEW_DUR);
    src.start(now, startSec, PREVIEW_DUR);
    src.onended = ()=>{ src.disconnect(); if(previewActive) schedulePreviewChunk(); };
    previewSrc = src;
}
function startPreview(song){
    if(!ctx || !audioBuffer) return;
    if(ctx.state==='suspended') ctx.resume();
    previewSong = song; previewActive = true;
    schedulePreviewChunk();
}
function stopPreview(){
    previewActive = false;
    if(previewSrc){ try{ previewSrc.stop(); }catch(e){} previewSrc = null; }
    if(previewFadeGain && ctx){
        const now = ctx.currentTime;
        previewFadeGain.gain.cancelScheduledValues(now);
        previewFadeGain.gain.setValueAtTime(0, now);
    }
}

function loadAudio(s){
    return new Promise((resolve,reject)=>{
        if(s.id==='__test__' && window._testAudioBuffer){ audioBuffer=window._testAudioBuffer; resolve(); return; }
        const decode=()=>{
            const b64 = window.AUDIO && window.AUDIO[s.id];
            if(!b64){ reject(new Error('오디오 누락')); return; }
            ctx.decodeAudioData(b64ToArrayBuffer(b64)).then(buf=>{ audioBuffer=buf; resolve(); }).catch(reject);
        };
        if(window.AUDIO && window.AUDIO[s.id]){ decode(); return; }
        const sc=document.createElement('script');
        sc.src='assets/'+s.id.replace(/-/g,'')+'_audio.js';
        sc.onload=decode; sc.onerror=()=>reject(new Error('오디오 스크립트 로드 실패'));
        document.head.appendChild(sc);
    });
}
