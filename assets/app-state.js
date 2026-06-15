"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — shared state, constants, utility functions
// ════════════════════════════════════════════════════════════

const cv = document.getElementById('cv');
const g  = cv.getContext('2d');
let W=0, H=0, DPR=1, R=60;
let noteScale=1.0;

function hexA(hex,a){
    if(hex[0]!=='#') return hex;
    const n=parseInt(hex.slice(1),16);
    const r=(n>>16)&255,gn=(n>>8)&255,b=n&255;
    return `rgba(${r},${gn},${b},${Math.max(0,Math.min(1,a))})`;
}
function roundRect(x,y,w,h,r){
    g.beginPath();
    g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
function animateScore(el, target, dur=1100){
    const t0=performance.now();
    (function tick(now){
        const p=Math.min((now-t0)/dur,1), e=1-Math.pow(1-p,3);
        el.textContent=Math.floor(target*e).toLocaleString();
        if(p<1) requestAnimationFrame(tick); else el.textContent=target.toLocaleString();
    })(t0);
}
function b64ToArrayBuffer(b64){
    const bin=atob(b64), len=bin.length, bytes=new Uint8Array(len);
    for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i);
    return bytes.buffer;
}
function songTime(){ return ctx ? (ctx.currentTime - audioStart)*speedMod - inputOffset/1000 : -99; }

function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.floor(W*DPR); cv.height = Math.floor(H*DPR);
    g.setTransform(DPR,0,0,DPR,0,0);
    R = Math.max(34, Math.min(W,H)*0.066) * noteScale;
}
window.addEventListener('resize', resize); resize();

// ── audio ──
let ctx=null, audioBuffer=null, srcNode=null, analyser=null, freqData=null;
let musicGain=null, sfxGain=null;
let audioStart=0;

// ── player settings ──
let musicVol=0.8, sfxVol=0.7, inputOffset=0;
let hoverMode=false;
(function loadSettings(){ try{
    const s=JSON.parse(localStorage.getItem('pulsebloom_settings')||'{}');
    if(typeof s.musicVol==='number')    musicVol=s.musicVol;
    if(typeof s.sfxVol==='number')      sfxVol=s.sfxVol;
    if(typeof s.inputOffset==='number') inputOffset=s.inputOffset;
    if(typeof s.hoverMode==='boolean')  hoverMode=s.hoverMode;
    if(typeof s.noteScale==='number')   noteScale=s.noteScale;
}catch(e){} })();
function saveSettings(){ try{
    localStorage.setItem('pulsebloom_settings', JSON.stringify({musicVol,sfxVol,inputOffset,hoverMode,noteScale}));
}catch(e){} }

// ── bloom progress ──
const BLOOM_MAX    = 1000;
const BLOOM_FIRST  = {normal:10, chaotic:20, end:30, torment:40, '???':50};
const BLOOM_REPEAT = {normal:3,  chaotic:5,  end:10, torment:15, '???':20};
let progress = {clears:{}, bloom:0, pbs:{}, dailies:{}, achievements:{}, unlocks:{}};

// ── daily / practice / replay / test ──
let dailyMode=false, dailyChallenge=null;
let practiceMode=false, practiceStartSec=0;
let replayMode=false, replayLog=[], replayPlayLog=[], replayIdx=0;
let testMode=false;

// ── game data ──
let SONG=null, SONGS=[];
const COLORS=['#ff5ea8','#5ee0ff','#b07cff','#ffd166','#5effa0'];
const JLINE_BASE=0.82;
let dynJLINE=0.82;  // mutable for ??? jline_move events
const BLOOM_ZONES=[0.12, 0.30, 0.50, 0.70, 0.88];
function snapToZone(x){ return BLOOM_ZONES.reduce((b,z)=>Math.abs(x-z)<Math.abs(x-b)?z:b); }
let objects=[];
let diff='normal';
let APPROACH=1.2;
let auto=false;
let gameMode='raining';
let randomMode=false, mirrorMode=false, hiddenMode=false;
let speedMod=1.0;
let scorePerJudge=1000;
const LEAD_EXTRA=1.0;
let leadIn=0;

// ── runtime ──
let running=false, paused=false, raf=0;
let score=0, combo=0, maxCombo=0;
let cnt={perfect:0, good:0, miss:0};
let judgeSum=0, judgeCount=0;
let hitErrors=[];
let floats=[], petals=[], ripples=[], nextGlows=[], bassPulse=0;
const pointers=new Map();
let autoCursor={x:0,y:0,has:false};
let cursor={x:0,y:0,on:false};
const HIT={perfect:80, good:170, miss:270};
let captions=[];

// ── ??? chart event system ──
let chartEvents=[], nextEventIdx=0;
let glitchState=null;   // {endWebTime} during rewind glitch
let jlineAnim=null;     // {from,to,startT,dur}

// ── title canvas ──
const titleCv = document.getElementById('title-cv');
const titleG  = titleCv ? titleCv.getContext('2d') : null;
let titleRaf=0;
let _titleStars=null, _titlePetals=[], _titleBurstDone=false, _titleIntroPlayed=false;

// ── preview ──
const PREVIEW_STARTS={'miss-master':46,'want-you':125,'cut-your-string':53};
const PREVIEW_DUR=30, PREVIEW_FADE=0.5;
let previewActive=false, previewSrc=null, previewSong=null;
let previewFadeGain=null, previewFilter=null;

// ── difficulty meta ──
const DIFF_META={
    normal:  ['NORMAL',  '#5effa0'],
    chaotic: ['CHAOTIC', '#ffd166'],
    end:     ['END',     '#ff5ea8'],
    torment: ['TORMENT', '#b07cff'],
    '???':   ['? ? ?',   '#8a7da6'],
    test:    ['TEST',    '#5ee0ff']
};

let settingsOrigin='songs';
