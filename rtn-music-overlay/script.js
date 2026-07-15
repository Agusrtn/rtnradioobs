(function(){
  const API_DEFAULT = 'https://rtn-music.vercel.app/api/radio-stream?format=json';
  const params = new URLSearchParams(location.search);
  const API = params.get('api') || API_DEFAULT;
  const STREAM_URL = params.get('stream') || null;

  const coverEl = document.getElementById('cover');
  const titleEl = document.getElementById('title');
  const artistEl = document.getElementById('artist');
  const elapsedBigEl = document.getElementById('elapsed-big');
  const progressEl = document.getElementById('progress');
  const elapsedEl = document.getElementById('elapsed');
  const remainingEl = document.getElementById('remaining');
  const overlay = document.getElementById('overlay');
  const coverGlow = document.getElementById('cover-glow');
  const equalizer = document.getElementById('equalizer');
  const player = document.getElementById('player');
  const streamLink = document.getElementById('stream-link');
  const streamStatus = document.getElementById('stream-status');

  let state = {
    songId: null,
    title: '',
    artist: '',
    coverUrl: '',
    elapsed: 0,
    duration: 1,
    lastFetch: 0,
    lastServerElapsed: 0
  };

  // utility
  function fmt(s){
    if (!isFinite(s) || s<0) s=0;
    const m = Math.floor(s/60);
    const sec = Math.floor(s%60).toString().padStart(2,'0');
    return `${m}:${sec}`;
  }

  // Smooth 60 FPS progress using rAF
  let rafId=null;
  function animateProgress(){
    let elapsed;
    const now = performance.now()/1000;
    const since = now - state.lastFetch; // seconds since last fetch
    // if audio is playing prefer player.currentTime for accuracy
    if (window.player && !window.player.paused && !isNaN(window.player.currentTime) && window.player.currentTime>0){
      elapsed = window.player.currentTime;
    } else {
      elapsed = state.lastServerElapsed + since;
    }
    const pct = Math.min(1, elapsed / Math.max(1, state.duration));
    progressEl.style.width = `${(pct*100).toFixed(3)}%`;
    elapsedEl.textContent = fmt(elapsed);
    remainingEl.textContent = `-${fmt(Math.max(0, state.duration - elapsed))}`;
    if (elapsedBigEl) elapsedBigEl.textContent = fmt(elapsed);
    rafId = requestAnimationFrame(animateProgress);
  }

  function pickDominantColor(img){
    return new Promise((resolve)=>{
      try{
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w=40,h=40;canvas.width=w;canvas.height=h;
        ctx.drawImage(img,0,0,w,h);
        const data = ctx.getImageData(0,0,w,h).data;
        let r=0,g=0,b=0,count=0;
        for(let i=0;i<data.length;i+=4){
          const a = data[i+3];
          if (a<128) continue;
          r+=data[i];g+=data[i+1];b+=data[i+2];count++;
        }
        if (!count) return resolve('#7b61ff');
        r=Math.floor(r/count);g=Math.floor(g/count);b=Math.floor(b/count);
        resolve(`rgb(${r},${g},${b})`);
      }catch(e){resolve('#7b61ff')}
    });
  }

  function setStreamStatus(state, text){
    if (!streamStatus) return;
    streamStatus.className = 'stream-status';
    if (state) streamStatus.classList.add(state);
    streamStatus.textContent = 'Estado: ' + (text || state || '—');
  }

  // load image with CORS handling
  function loadImage(url){
    return new Promise((resolve,reject)=>{
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = ()=> resolve(img);
      img.onerror = ()=> reject(new Error('image load error'));
      img.src = url;
    });
  }

  let lastSongKey = '';
  async function applySong(data){
    if (!data || !data.currentSong) return;
    const s = data.currentSong;
    const newKey = `${s.title}:::${s.artist}:::${s.coverUrl}`;
    const isChange = newKey !== lastSongKey;

    state.lastServerElapsed = Number(data.currentSongElapsedSeconds || 0);
    state.duration = Number(data.currentSongDuration) || 1;
    state.lastFetch = performance.now()/1000;

    if (isChange){
      lastSongKey = newKey;
      // animate out
      titleEl.classList.add('song-fade-out');
      artistEl.classList.add('song-fade-out');
      coverEl.style.transition = 'transform 500ms ease, opacity 320ms ease';
      coverEl.style.opacity = '0.6';

      setTimeout(async ()=>{
        titleEl.textContent = s.title || 'RTN MUSIC';
        artistEl.textContent = s.artist || 'RTN RADIO';
        // load cover
        try{
          const img = await loadImage(s.coverUrl || 'assets/fallback-cover.svg');
          coverEl.src = s.coverUrl || 'assets/fallback-cover.svg';
          const color = await pickDominantColor(img);
          document.documentElement.style.setProperty('--accent', color);
          coverGlow.style.boxShadow = `0 12px 40px ${color}`;
        }catch(e){
          // fallback
          coverEl.src = 'assets/fallback-cover.svg';
          document.documentElement.style.setProperty('--accent','#7b61ff');
          coverGlow.style.boxShadow = '';
        }

        // small zoom
        coverEl.style.transform = 'scale(1.06)';
        setTimeout(()=>{coverEl.style.opacity='1';coverEl.style.transform='scale(1)';},420);

        titleEl.classList.remove('song-fade-out');
        artistEl.classList.remove('song-fade-out');

        // marquee if text overflow
        requestAnimationFrame(()=>{
          if (titleEl.scrollWidth > titleEl.clientWidth) titleEl.classList.add('marquee'); else titleEl.classList.remove('marquee');
          if (artistEl.scrollWidth > artistEl.clientWidth) artistEl.classList.add('marquee'); else artistEl.classList.remove('marquee');
        });

        // pulse equalizer
        pulseEqualizer();
        // update big elapsed immediately
        if (elapsedBigEl) elapsedBigEl.textContent = fmt(state.lastServerElapsed);
      },160);
    }
  }

  // Player sync: when stream is present, keep player time close to server elapsed
  function trySyncPlayerWithServer(){
    try{
      const desired = Number(state.lastServerElapsed || 0);
      if (!player || !player.src || isNaN(player.duration)) return;
      // if difference greater than 1s, seek
      if (Math.abs((player.currentTime||0) - desired) > 1.0){
        player.currentTime = Math.max(0, Math.min(desired, player.duration || desired));
      }
    }catch(e){/* ignore */}
  }

  function pulseEqualizer(){
    const bars = equalizer.querySelectorAll('.bar');
    bars.forEach((b,i)=>{
      b.animate([
        {transform:`scaleY(${0.2 + Math.random()*0.5})`},
        {transform:`scaleY(${0.8 + Math.random()*1.0})`}
      ],{duration:300 + i*80,iterations:5 + Math.floor(Math.random()*6),direction:'alternate'});
    });
  }

  // Polling loop
  let pollTimer=null;
  async function poll(){
    try{
      const res = await fetch(API,{cache:'no-store'});
      if (!res.ok) throw new Error('bad');
      const data = await res.json();
      await applySong(data);
      // If API returns a stream URL use it; otherwise use configured STREAM_URL
      const apiStream = data && data.currentSong && data.currentSong.streamUrl;
      const apiTopStream = data && data.streamUrl;
      const streamToUse = apiStream || STREAM_URL;
      const finalStream = apiTopStream || streamToUse;
      if (finalStream && player.src !== finalStream){
        player.src = finalStream;
        player.preload = 'auto';
        // update UI with stream URL
        if (streamLink){
          streamLink.href = finalStream;
          streamLink.textContent = finalStream;
        }
        setStreamStatus('connecting','Conectando...');
        // try autoplay; if blocked we won't show any play button (overlay is silent until user/OBS allows playback)
        tryAutoPlay();
      } else if (!finalStream && streamLink){
        streamLink.href = '#'; streamLink.textContent = '—';
        setStreamStatus(null,'No hay stream');
      }
      // try syncing player with server after updating state
      trySyncPlayerWithServer();
    }catch(e){
      // ignore and keep previous, optionally show fallback text
      console.warn('API fetch failed',e);
      setStreamStatus('error','Error al consultar API');
    }
  }

  async function tryAutoPlay(){
    if (!player.src) return;
    try{
      await player.play();
      // autoplay succeeded
      setStreamStatus('playing','Reproduciendo');
    }catch(e){
      // Autoplay blocked; overlay stays muted until user allows playback in browser/OBS
      setStreamStatus('connecting','Autoplay bloqueado');
    }
  }

  // no manual play/pause button in overlay; playback is handled automatically

  // startup
  (function start(){
    poll();
    pollTimer = setInterval(poll, 1000);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(animateProgress);
    // Expose player globally for checks in animateProgress
    window.player = player;
    // Player event listeners for status
    player.addEventListener('waiting', ()=> setStreamStatus('buffering','Buffering'));
    player.addEventListener('playing', ()=> setStreamStatus('playing','Reproduciendo'));
    player.addEventListener('pause', ()=> setStreamStatus('connecting','Pausado'));
    player.addEventListener('stalled', ()=> setStreamStatus('buffering','Stalled'));
    player.addEventListener('error', (ev)=>{ setStreamStatus('error','Error de reproducción'); console.error('Audio error', ev); });
    player.addEventListener('suspend', ()=> setStreamStatus('connecting','Suspendido'));
    player.addEventListener('canplay', ()=> setStreamStatus('connecting','Listo'));
    player.addEventListener('canplaythrough', ()=> setStreamStatus('playing','Listo para reproducir'));
    // Sync on metadata load
    player.addEventListener('loadedmetadata', ()=>{
      trySyncPlayerWithServer();
    });
    // Keep UI updated from player time while playing
    player.addEventListener('timeupdate', ()=>{
      // animateProgress already updates via rAF, but we ensure big time updates
      if (elapsedBigEl) elapsedBigEl.textContent = fmt(player.currentTime || 0);
    });
  })();

  // Expose for debug
  window._rtn = {state, poll};
})();
