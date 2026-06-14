"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — title screen animation
// ════════════════════════════════════════════════════════════

function resizeTitleCv(){
    if(!titleCv) return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    titleCv.width  = window.innerWidth  * dpr;
    titleCv.height = window.innerHeight * dpr;
    titleG.setTransform(dpr,0,0,dpr,0,0);
}

function startTitleAnim(){
    if(titleRaf||!titleG) return;
    resizeTitleCv();

    const titleEl=document.querySelector('#ov-title .title');
    const startEl=document.querySelector('.title-start');
    const bloomEl=document.getElementById('title-bloom-display');

    if(!_titleStars){
        _titleStars=[];
        const SW=window.innerWidth, SH=window.innerHeight;
        for(let i=0;i<80;i++) _titleStars.push({
            x:Math.random()*SW, y:Math.random()*SH,
            r:Math.random()*1.4+0.4, a:Math.random(), da:0.006+Math.random()*0.012
        });
    }

    const isFirst=!_titleIntroPlayed;
    _titleIntroPlayed=true;

    if(isFirst){
        titleEl.style.cssText='opacity:0;transform:scale(0.88) translateY(12px);transition:none';
        startEl.style.cssText='opacity:0;transition:none;animation:none';
        bloomEl.style.cssText='opacity:0;transition:none';
    }

    _titlePetals=[]; _titleBurstDone=false;
    let introRevealed=!isFirst;

    function revealTitleHTML(){
        if(introRevealed) return;
        introRevealed=true;
        titleEl.style.cssText='opacity:1;transform:scale(1) translateY(0);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)';
        setTimeout(()=>{
            startEl.style.cssText='';
            bloomEl.style.cssText='opacity:1;transition:opacity .6s';
        }, 680);
    }

    function drawIntroAnim(t,cx,cy,W,H){
        const noteR=26;
        for(const bt of [0.28,0.62,0.96]){
            if(t<bt) continue;
            const age=t-bt; if(age>1.5) continue;
            titleG.beginPath(); titleG.arc(cx,cy,age*76,0,Math.PI*2);
            titleG.strokeStyle=`rgba(176,124,255,${Math.max(0,0.55-age*0.38)})`; titleG.lineWidth=1.8; titleG.stroke();
        }
        if(t>0.2){
            const gn=titleG.createRadialGradient(cx,cy,0,cx,cy,noteR*1.8);
            gn.addColorStop(0,'rgba(176,124,255,.8)');
            gn.addColorStop(0.5,'rgba(176,124,255,.28)');
            gn.addColorStop(1,'rgba(176,124,255,0)');
            titleG.fillStyle=gn; titleG.beginPath(); titleG.arc(cx,cy,noteR*1.8,0,Math.PI*2); titleG.fill();
            titleG.beginPath(); titleG.arc(cx,cy,noteR,0,Math.PI*2);
            titleG.strokeStyle=`rgba(210,185,255,${0.7+Math.sin(t*9)*0.2})`; titleG.lineWidth=2.6; titleG.stroke();
        }
        if(t>0.72){
            const ap=Math.min(1,(t-0.72)/1.48);
            const maxR=Math.min(W,H)*0.42;
            const ringR=maxR-(maxR-noteR-2)*ap;
            if(ringR>noteR+4){
                const rp=0.55+Math.sin(t*9)*0.24;
                titleG.beginPath(); titleG.arc(cx,cy,ringR,0,Math.PI*2);
                titleG.strokeStyle=`rgba(255,94,168,${rp})`; titleG.lineWidth=3.5; titleG.stroke();
                titleG.beginPath(); titleG.arc(cx,cy,ringR,0,Math.PI*2);
                titleG.strokeStyle=`rgba(255,94,168,${rp*0.25})`; titleG.lineWidth=10; titleG.stroke();
            }
            for(const b of [1.05,1.45,1.85]){
                if(t<b) continue;
                const ia=t-b; if(ia>0.85) continue;
                titleG.beginPath(); titleG.arc(cx,cy,noteR+ia*42,0,Math.PI*2);
                titleG.strokeStyle=`rgba(94,224,255,${Math.max(0,0.44-ia*0.54)})`; titleG.lineWidth=1.5; titleG.stroke();
            }
        }
    }

    function drawBurstAnim(bt,cx,cy,W,H){
        if(bt<0.45){
            titleG.fillStyle=`rgba(225,205,255,${Math.max(0,0.88-bt*2.1)})`; titleG.fillRect(0,0,W,H);
        }
        for(const sw of [0,0.12,0.26]){
            if(bt<sw) continue;
            const sa=bt-sw; if(sa>1.5) continue;
            const al=Math.max(0,0.8-sa*0.56);
            const sr=sa*Math.min(W,H)*0.65;
            titleG.beginPath(); titleG.arc(cx,cy,sr,0,Math.PI*2);
            titleG.strokeStyle=`rgba(255,143,208,${al})`; titleG.lineWidth=3.5; titleG.stroke();
            titleG.beginPath(); titleG.arc(cx,cy,sr,0,Math.PI*2);
            titleG.strokeStyle=`rgba(176,124,255,${al*0.33})`; titleG.lineWidth=10; titleG.stroke();
        }
    }

    function drawIdleAnim(t,cx,cy,W,H){
        const period=2.4;
        const i0=Math.floor(t/period);
        for(let i=Math.max(0,i0-2);i<=i0;i++){
            const age=t-i*period; if(age<0) continue;
            const a=Math.max(0,0.32-age*0.08); if(a<=0) continue;
            titleG.beginPath(); titleG.arc(cx,cy,age*50,0,Math.PI*2);
            titleG.strokeStyle=`rgba(176,124,255,${a})`; titleG.lineWidth=1.5; titleG.stroke();
        }
        const bRatio=Math.min(progress.bloom/BLOOM_MAX,1);
        if(bRatio>0){
            const growP=Math.min(1,t*0.6);
            drawTitleBeam(W,H,bRatio*growP);
            drawTitleFlower(cx,H,bRatio*growP,t);
        }
    }

    const t0=performance.now();
    function frame(ts){
        const t=(ts-t0)/1000;
        const W=window.innerWidth, H=window.innerHeight;
        const cx=W/2, cy=H/2;
        const cRatio=getClearedRatio();

        titleG.clearRect(0,0,W,H);
        titleG.fillStyle='rgba(5,3,10,0.97)';
        titleG.fillRect(0,0,W,H);

        for(const s of _titleStars){
            s.a+=s.da; if(s.a>=1||s.a<=0) s.da*=-1;
            titleG.beginPath(); titleG.arc(s.x,s.y,s.r,0,Math.PI*2);
            titleG.fillStyle=`rgba(210,200,255,${Math.max(0,s.a)*0.55})`; titleG.fill();
        }

        if(!isFirst){
            if(!introRevealed) revealTitleHTML();
            drawIdleAnim(t,cx,cy,W,H);
        } else if(t<2.2){
            drawIntroAnim(t,cx,cy,W,H);
        } else {
            if(!_titleBurstDone){
                _titleBurstDone=true;
                revealTitleHTML();
                const cs=['#ff5ea8','#b07cff','#5ee0ff','#ffd166','#5effa0'];
                for(let i=0;i<110;i++){
                    const a=Math.random()*Math.PI*2, sp=2.5+Math.random()*7;
                    _titlePetals.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,
                        r:Math.random()*4.5+1.5,color:cs[Math.floor(Math.random()*5)],
                        a:1,decay:0.005+Math.random()*0.012});
                }
            }
            drawBurstAnim(t-2.2,cx,cy,W,H);
            drawIdleAnim(t-2.2,cx,cy,W,H);
        }

        for(const p of _titlePetals){
            p.x+=p.vx; p.y+=p.vy; p.vy+=0.04; p.vx*=0.993; p.a-=p.decay;
            if(p.a<=0) continue;
            titleG.beginPath(); titleG.arc(p.x,p.y,p.r,0,Math.PI*2);
            titleG.fillStyle=hexA(p.color,p.a); titleG.fill();
        }

        document.getElementById('ov-title').style.filter=
            `grayscale(${(1-cRatio).toFixed(3)}) brightness(${(0.62+0.38*cRatio).toFixed(3)})`;
        document.getElementById('title-bloom-val').textContent=progress.bloom.toLocaleString();
        titleRaf=requestAnimationFrame(frame);
    }
    titleRaf=requestAnimationFrame(frame);
}

function stopTitleAnim(){
    if(titleRaf){ cancelAnimationFrame(titleRaf); titleRaf=0; }
    if(titleCv) titleG.clearRect(0,0,titleCv.width,titleCv.height);
    document.getElementById('ov-title').style.filter='';
    const _te=document.querySelector('#ov-title .title');
    const _se=document.querySelector('.title-start');
    const _be=document.getElementById('title-bloom-display');
    if(_te) _te.style.cssText='';
    if(_se) _se.style.cssText='';
    if(_be) _be.style.cssText='';
}

function drawTitleBeam(tw, th, bRatio){
    if(bRatio<0.08) return;
    const alpha=(bRatio-0.08)/0.92;
    const cx=tw/2, fy=th*0.76;
    const topW=tw*0.44, botW=44;
    const g2=titleG.createLinearGradient(cx,0,cx,fy);
    g2.addColorStop(0,   `rgba(255,245,210,0)`);
    g2.addColorStop(0.45,`rgba(255,245,210,${alpha*0.04})`);
    g2.addColorStop(1,   `rgba(255,255,255,${alpha*0.13})`);
    titleG.beginPath();
    titleG.moveTo(cx-topW/2,0); titleG.lineTo(cx+topW/2,0);
    titleG.lineTo(cx+botW/2,fy); titleG.lineTo(cx-botW/2,fy);
    titleG.closePath();
    titleG.fillStyle=g2; titleG.fill();
}

function drawTitleFlower(cx, th, bRatio, t){
    const groundY = th*0.88;
    const maxH    = Math.min(th*0.32, 190);

    titleG.beginPath();
    titleG.ellipse(cx, groundY, 46+20*bRatio, 9, 0, 0, Math.PI*2);
    titleG.fillStyle=`rgba(55,32,16,${0.18+0.22*bRatio})`; titleG.fill();

    if(bRatio<0.015) return;

    const stemGrow=Math.min(bRatio/0.35,1);
    const stemH=maxH*stemGrow;
    const sway=Math.sin(t*0.9)*4*stemGrow;
    const tipX=cx+sway, tipY=groundY-stemH;

    titleG.beginPath();
    titleG.moveTo(cx, groundY);
    titleG.quadraticCurveTo(cx+12+sway*0.5, groundY-stemH*0.5, tipX, tipY);
    titleG.strokeStyle='#5effa0'; titleG.lineWidth=3.5*stemGrow+0.5;
    titleG.lineCap='round'; titleG.stroke();

    if(bRatio>0.20){
        const lp=Math.min((bRatio-0.20)/0.18,1);
        const ls=30*lp;
        const lx=cx+8, ly=groundY-stemH*0.44;
        titleG.beginPath();
        titleG.moveTo(lx-3,ly);
        titleG.bezierCurveTo(lx-ls*1.15,ly-ls*0.38, lx-ls*1.25,ly+ls*0.28, lx-3,ly+ls*0.52);
        titleG.fillStyle='#5effa0'; titleG.fill();
        const ly2=ly-stemH*0.14;
        titleG.beginPath();
        titleG.moveTo(lx+3,ly2);
        titleG.bezierCurveTo(lx+ls*1.15,ly2-ls*0.38, lx+ls*1.25,ly2+ls*0.28, lx+3,ly2+ls*0.52);
        titleG.fillStyle='#5effa0'; titleG.fill();
    }

    if(bRatio<=0.35) return;
    const fp=Math.min((bRatio-0.35)/0.65,1);

    if(fp<0.22){
        const bp=fp/0.22;
        titleG.beginPath();
        titleG.ellipse(tipX, tipY-14*bp, 9*bp, 16*bp, 0, 0, Math.PI*2);
        titleG.fillStyle='#b07cff'; titleG.fill();
    } else {
        const op=(fp-0.22)/0.78;
        const petalCount=6;
        const petalLen=20+14*op;
        const spread=op*petalLen*0.55;

        for(let i=0;i<petalCount;i++){
            const angle=(i/petalCount)*Math.PI*2-Math.PI/2;
            drawTitlePetal(tipX+Math.cos(angle)*spread, tipY+Math.sin(angle)*spread, angle, petalLen, op);
        }

        const cr=7+4*op;
        titleG.beginPath(); titleG.arc(tipX,tipY,cr,0,Math.PI*2);
        titleG.fillStyle='#ffd166'; titleG.fill();

        if(op>0.65){
            const ga=(op-0.65)/0.35;
            const gl=titleG.createRadialGradient(tipX,tipY,0,tipX,tipY,cr*3.5);
            gl.addColorStop(0,`rgba(255,209,102,${0.55*ga})`);
            gl.addColorStop(1,`rgba(255,209,102,0)`);
            titleG.beginPath(); titleG.arc(tipX,tipY,cr*3.5,0,Math.PI*2);
            titleG.fillStyle=gl; titleG.fill();
        }
    }
}

function drawTitlePetal(cx,cy,angle,len,openness){
    titleG.save();
    titleG.translate(cx,cy); titleG.rotate(angle+Math.PI/2);
    const w=len*0.36;
    titleG.beginPath();
    titleG.moveTo(0,0);
    titleG.bezierCurveTo(-w,-len*0.32, -w,-len*0.82, 0,-len);
    titleG.bezierCurveTo( w,-len*0.82,  w,-len*0.32, 0, 0);
    titleG.fillStyle=`rgba(176,124,255,${0.75+0.25*openness})`; titleG.fill();
    titleG.beginPath();
    titleG.moveTo(0,-len*0.08);
    titleG.bezierCurveTo(-w*0.45,-len*0.38, -w*0.45,-len*0.78, 0,-len*0.88);
    titleG.bezierCurveTo( w*0.45,-len*0.78,  w*0.45,-len*0.38, 0,-len*0.08);
    titleG.fillStyle=`rgba(220,170,255,${0.35*openness})`; titleG.fill();
    titleG.restore();
}

window.addEventListener('resize', ()=>{ if(titleRaf) resizeTitleCv(); });
