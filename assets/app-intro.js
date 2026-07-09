"use strict";
// ════════════════════════════════════════════════════════════
//  PULSE BLOOM — intro cutscene (위로)
// ════════════════════════════════════════════════════════════

(function(){
    const introCv = document.getElementById('intro-cv');
    const introG  = introCv ? introCv.getContext('2d') : null;
    let introRaf = 0;
    let introSrc = null;

    const TOTAL_DUR = 169.88;
    const CI = ['#ff5ea8','#5ee0ff','#b07cff','#ffd166','#5effa0'];

    const TEXTS = [
        { t:  5, text:'어디선가 소리가 들려요.',          wind:true  },
        { t: 20, text:'멀리서, 아주 조용히.',              wind:false },
        { t: 38, text:'괜찮지 않아도 괜찮아요.',            wind:false },
        { t: 58, text:'그냥 이 자리에 있어도 돼요.',         wind:false },
        { t: 78, text:'숨 한번 쉬어보세요.',                wind:false },
        { t: 98, text:'이 리듬처럼, 다시 시작할 수 있어요.', wind:false },
        { t:118, text:'꽃은 언제나 피어나니까요.',            wind:false },
        { t:145, text:'당신 곁에 있을게요.',                wind:false },
        { t:162, text:'— Pulse Bloom',                    wind:false },
    ];

    function startIntroAudio(){
        initAudio();
        if(!ctx) return;
        fetch('assets/intro.mp3')
            .then(r => r.arrayBuffer())
            .then(buf => ctx.decodeAudioData(buf))
            .then(decoded => {
                if(!introRaf) return;
                introSrc = ctx.createBufferSource();
                introSrc.buffer = decoded;
                introSrc.connect(musicGain);
                introSrc.start(0);
            }).catch(()=>{});
    }

    function stopIntroAudio(){
        try{ if(introSrc){ introSrc.stop(); introSrc.disconnect(); } }catch(e){}
        introSrc = null;
    }

    window.startIntro = function(){
        if(!introCv || !introG){ startTitleAnim(); return; }

        document.getElementById('ov-title').classList.add('hidden');
        document.getElementById('ov-intro').classList.remove('hidden');

        function resize(){
            const dpr = Math.min(window.devicePixelRatio||1, 2);
            introCv.width  = window.innerWidth  * dpr;
            introCv.height = window.innerHeight * dpr;
            introG.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);

        // Upward-drifting particles — two layers (small + large)
        const particles = [];
        for(let i=0; i<110; i++) particles.push({
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + Math.random() * window.innerHeight,
            vx: (Math.random()-0.5)*0.55,
            vy: -(0.22+Math.random()*0.9),
            r: Math.random()*2.8+0.3,
            color: CI[Math.floor(Math.random()*CI.length)],
            phase: Math.random()*Math.PI*2,
            bright: Math.random() < 0.18  // occasional brighter spark
        });

        // Wind text
        let windChars = null;
        let windEntryT = -1;

        // Fade text states
        const textStates = TEXTS.map(e => ({ ...e, alpha: 0 }));

        const t0 = performance.now();

        function doSkip(){
            introCv.removeEventListener('click', handleClick);
            window.removeEventListener('resize', resize);
            if(introRaf){ cancelAnimationFrame(introRaf); introRaf=0; }
            stopIntroAudio();
            document.getElementById('ov-intro').classList.add('hidden');
            document.getElementById('ov-title').classList.remove('hidden');
            startTitleAnim();
            startTitleMusic();
        }

        // Draw "tap to start" prompt before animation begins
        let gestureReceived = false;
        (function drawPrompt(ts){
            const W = window.innerWidth, H = window.innerHeight;
            introG.clearRect(0, 0, W, H);
            introG.fillStyle = 'rgba(5,3,10,1)';
            introG.fillRect(0, 0, W, H);
            const pulse = 0.5 + 0.5*Math.sin((ts||0)*0.002);
            introG.save();
            introG.globalAlpha = 0.45 + 0.35*pulse;
            introG.textAlign = 'center'; introG.textBaseline = 'middle';
            introG.font = `300 ${Math.min(18, W*0.03)}px 'Noto Sans KR',sans-serif`;
            introG.fillStyle = '#f0eaff';
            introG.fillText('탭하여 시작', W/2, H/2);
            introG.restore();
            if(!gestureReceived) introRaf = requestAnimationFrame(drawPrompt);
        })();

        function handleClick(){
            if(!gestureReceived){
                gestureReceived = true;
                cancelAnimationFrame(introRaf); introRaf = 0;
                startIntroAudio();
                const t0 = performance.now();
                introRaf = requestAnimationFrame(ts => frame(ts, t0));
                return;
            }
            doSkip();
        }

        introCv.addEventListener('click', handleClick);

        function frame(ts, t0){
            const t = (ts-t0)/1000;
            if(t >= TOTAL_DUR){ doSkip(); return; }

            const W = window.innerWidth, H = window.innerHeight;
            const cx = W/2, cy = H/2;

            introG.clearRect(0, 0, W, H);

            // Dark background
            introG.fillStyle = `rgba(5,3,10,${Math.min(1, t/1.5)})`;
            introG.fillRect(0, 0, W, H);

            // ── Ambient center pulse ──
            // Slow breathing glow that gets stronger as the flower grows
            const flowerProgress = t > 8 ? Math.min(1, (t-8)/120) : 0;
            const breathe = 0.5+0.5*Math.sin(t*0.72);
            const glowR = Math.min(W,H)*0.28*(0.4+0.6*flowerProgress);
            const glowA = 0.05+0.08*breathe*flowerProgress;
            if(glowA > 0.005){
                const gl = introG.createRadialGradient(cx, H*0.42, 0, cx, H*0.42, glowR);
                gl.addColorStop(0, `rgba(176,124,255,${glowA})`);
                gl.addColorStop(0.5, `rgba(94,224,255,${glowA*0.4})`);
                gl.addColorStop(1, `rgba(176,124,255,0)`);
                introG.beginPath(); introG.arc(cx, H*0.42, glowR, 0, Math.PI*2);
                introG.fillStyle = gl; introG.fill();
            }

            // ── Particles ──
            for(const p of particles){
                p.x += p.vx; p.y += p.vy;
                if(p.y < -8){ p.y = H+8; p.x = Math.random()*W; }
                const baseA = p.bright ? 0.55 : 0.16;
                const swing = p.bright ? 0.28 : 0.12;
                const pa = baseA + swing*Math.sin(t*1.8+p.phase);
                introG.beginPath();
                introG.arc(p.x, p.y, p.r, 0, Math.PI*2);
                introG.fillStyle = hexA(p.color, pa);
                introG.fill();
            }

            // ── Flower (t≥8, blooms slowly over 120s) ──
            if(flowerProgress > 0){
                drawIntroFlower(cx, H*0.42, flowerProgress, t);
            }

            // ── Wind text (first text, t=5) ──
            if(t >= 5){
                if(!windChars){
                    windEntryT = t;
                    const txt = '어디선가 소리가 들려요.';
                    const fs = Math.min(24, W*0.038);
                    introG.font = `300 ${fs}px 'Noto Sans KR',sans-serif`;
                    introG.textBaseline = 'middle';
                    const charW = []; let total = 0;
                    for(const ch of txt){
                        const w = introG.measureText(ch).width;
                        charW.push(w); total += w;
                    }
                    windChars = [];
                    let sx = cx - total/2;
                    for(let i=0; i<txt.length; i++){
                        windChars.push({
                            ch: txt[i], tx: sx, ty: H*0.72,
                            x: sx - 150 - Math.random()*200,
                            y: H*0.72 + (Math.random()-0.5)*42,
                            a: 0
                        });
                        sx += charW[i];
                    }
                }
                const age = t - windEntryT;
                const outA = age > 8 ? Math.max(0, 1-(age-8)/3) : 1;
                const fs = Math.min(24, W*0.038);
                for(const c of windChars){
                    c.x += (c.tx - c.x)*0.075;
                    c.y += (c.ty - c.y)*0.075;
                    c.a = Math.min(1, c.a+0.038) * outA;
                    if(c.a <= 0.01) continue;
                    introG.save();
                    introG.globalAlpha = c.a;
                    introG.font = `300 ${fs}px 'Noto Sans KR',sans-serif`;
                    introG.textBaseline = 'middle';
                    introG.fillStyle = '#f0eaff';
                    introG.fillText(c.ch, c.x, c.y);
                    introG.restore();
                }
            }

            // ── Fade-in texts (t=20 onward) ──
            for(const tx of textStates){
                if(tx.wind || t < tx.t) continue;
                const age = t - tx.t;
                const inA  = Math.min(1, age/1.8);
                const outA = age > 10 ? Math.max(0, 1-(age-10)/2.5) : 1;
                tx.alpha = inA * outA;
                if(tx.alpha < 0.01) continue;
                introG.save();
                introG.globalAlpha = tx.alpha;
                introG.textAlign = 'center'; introG.textBaseline = 'middle';
                const fs2 = Math.min(20, W*0.033);
                introG.font = `300 ${fs2}px 'Noto Sans KR',sans-serif`;
                introG.shadowColor = 'rgba(176,124,255,0.45)';
                introG.shadowBlur = 12;
                introG.fillStyle = '#f0eaff';
                introG.fillText(tx.text, cx, H*0.72);
                introG.restore();
            }

            // ── Skip hint ──
            const hintA = Math.min(0.4, t/4*0.4);
            if(hintA > 0.02){
                introG.save();
                introG.globalAlpha = hintA;
                introG.textAlign = 'right'; introG.textBaseline = 'bottom';
                introG.font = `11px sans-serif`;
                introG.fillStyle = '#fff';
                introG.fillText('클릭하면 스킵', W-16, H-14);
                introG.restore();
            }

            introRaf = requestAnimationFrame(ts => frame(ts, t0));
        }
    };

    function drawIntroFlower(cx, cy, progress, t){
        const stemGrow = Math.min(1, progress/0.35);
        const stemH = 100 * stemGrow;
        const sway = Math.sin(t*0.88)*5*stemGrow;
        const tipX = cx+sway, tipY = cy-stemH;

        introG.save();
        introG.beginPath();
        introG.moveTo(cx, cy);
        introG.quadraticCurveTo(cx+10+sway*0.5, cy-stemH*0.5, tipX, tipY);
        introG.strokeStyle = '#5effa0';
        introG.lineWidth = 3.5*stemGrow+0.5;
        introG.lineCap = 'round';
        introG.stroke();
        introG.restore();

        if(progress <= 0.35) return;
        const fp = Math.min(1, (progress-0.35)/0.65);
        const petalLen = 22+16*fp;
        const spread = fp*petalLen*0.55;

        for(let i=0; i<6; i++){
            const angle = (i/6)*Math.PI*2 - Math.PI/2;
            const px = tipX+Math.cos(angle)*spread;
            const py = tipY+Math.sin(angle)*spread;
            introG.save();
            introG.translate(px, py);
            introG.rotate(angle+Math.PI/2);
            const w = petalLen*0.36;
            introG.beginPath();
            introG.moveTo(0, 0);
            introG.bezierCurveTo(-w,-petalLen*0.32,-w,-petalLen*0.82,0,-petalLen);
            introG.bezierCurveTo( w,-petalLen*0.82, w,-petalLen*0.32,0, 0);
            introG.fillStyle = `rgba(176,124,255,${0.7+0.3*fp})`;
            introG.fill();
            introG.restore();
        }

        const cr = 7+5*fp;
        introG.beginPath(); introG.arc(tipX, tipY, cr, 0, Math.PI*2);
        introG.fillStyle = '#ffd166'; introG.fill();

        if(fp > 0.6){
            const ga = (fp-0.6)/0.4;
            const gl = introG.createRadialGradient(tipX,tipY,0,tipX,tipY,cr*3.5);
            gl.addColorStop(0, `rgba(255,209,102,${0.5*ga})`);
            gl.addColorStop(1, `rgba(255,209,102,0)`);
            introG.beginPath(); introG.arc(tipX,tipY,cr*3.5,0,Math.PI*2);
            introG.fillStyle = gl; introG.fill();
        }
    }
})();
