/* Keep loaded players alive across selections; only the active one plays.
   No third-party embeds, polling, or source reassignment on an already-loaded clip. */
(() => {
  'use strict';
  // Keep the overview film and rollout demos from playing simultaneously.
  document.addEventListener('play',event=>{
    const active=event.target;
    if(!(active instanceof HTMLVideoElement))return;
    document.querySelectorAll('video').forEach(video=>{if(video!==active)video.pause();});
  },true);
  const demos=window.ROBOBUILDER_DEMOS;
  if (!demos?.length) return;
  const stage=document.getElementById('demo-stage'), buttons=[...document.querySelectorAll('[data-demo]')];
  const notice=document.getElementById('play-notice'), playButton=document.getElementById('play-toggle');
  const loop=document.getElementById('loop-toggle'), status=document.getElementById('warmup');
  const players=new Map(); let selected=0, generation=0;
  const constrained=!!navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');
  function getPlayer(index) {
    if (players.has(index)) return players.get(index);
    const demo=demos[index];
    const video=index===0 ? document.getElementById('initial-video') : document.createElement('video');
    video.muted=true; video.defaultMuted=true; video.loop=loop.checked; video.playsInline=true;
    video.controls=true; video.preload='auto'; video.poster=demo.poster;
    video.setAttribute('aria-label',`${demo.label} — ${demo.detail}`);
    if(index!==0) {video.hidden=true;video.src=demo.video;stage.insertBefore(video,notice);}
    video.addEventListener('play',()=>{if(selected===index){playButton.textContent='Pause';notice.hidden=true;}});
    video.addEventListener('pause',()=>{if(selected===index) playButton.textContent='Play';});
    video.addEventListener('error',()=>{if(selected===index){status.textContent='This clip could not load. Use the download link or try again.';notice.hidden=false;}});
    players.set(index,video); return video;
  }
  function tryPlay(video,token) {
    video.play().then(()=>{if(token!==generation) video.pause();})
      .catch(()=>{if(token===generation){notice.hidden=false;playButton.textContent='Play';}});
  }
  function choose(index) {
    if(!Number.isInteger(index)||index<0||index>=demos.length)return;
    const old=players.get(selected); if(old&&selected!==index){old.pause();old.hidden=true;}
    const changed=selected!==index;selected=index;generation++;
    const demo=demos[index],video=getPlayer(index);
    video.hidden=false;video.loop=loop.checked;
    if(changed && video.readyState>0)video.currentTime=0;
    notice.hidden=true;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.demo)===index)));
    document.getElementById('demo-title').textContent=demo.group==='Long horizon'?`Long horizon — ${demo.label}`:demo.label;
    document.getElementById('demo-detail').textContent=`${demo.group==='Long horizon'?'RoboBuilder-Long':'RoboBuilder-Short'} · ${demo.detail}`;
    document.getElementById('download-demo').href=demo.video;
    tryPlay(video,generation);
    // Prioritize probable next selections rather than contending with initial playback.
    if(!constrained) setTimeout(()=>getPlayer((index+1)%demos.length),400);
  }
  buttons.forEach((button,index)=>{
    button.addEventListener('click',()=>choose(index));
    button.addEventListener('pointerenter',()=>getPlayer(index),{once:true});
    button.addEventListener('focus',()=>getPlayer(index),{once:true});
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();let next=event.key==='Home'?0:event.key==='End'?buttons.length-1:
        (index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      buttons[next].focus();choose(next);
    });
  });
  playButton.addEventListener('click',()=>{const v=getPlayer(selected);if(v.paused)tryPlay(v,generation);else v.pause();});
  notice.addEventListener('click',()=>tryPlay(getPlayer(selected),generation));
  loop.addEventListener('change',()=>players.forEach(v=>v.loop=loop.checked));
  // Warm the ~60 MB gallery gradually after the first page load, so the videos
  // are normally ready by the time a reader reaches the demos. Persistent media
  // elements reuse the browser's range cache and decoded first frames.
  let warmed=false;
  function warmGallery() {
    if(warmed||constrained)return;warmed=true;
    status.textContent='Preparing the other demos for quick switching…';
    let cursor=0;
    function next(){
      if(cursor>=demos.length){status.textContent='Demo preloading requested. Select any example to play.';return;}
      const video=getPlayer(cursor++);
      if(video.readyState>=3){setTimeout(next,150);return;}
      let done=false;
      const advance=()=>{if(done)return;done=true;video.removeEventListener('canplay',advance);setTimeout(next,150);};
      video.addEventListener('canplay',advance,{once:true});setTimeout(advance,1800);
    }
    next();
  }
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)){warmGallery();observer.disconnect();}
  },{rootMargin:'700px'});observer.observe(document.getElementById('demos'));}
  else warmGallery();
  if(constrained)status.textContent='Data saver enabled: other clips load when selected.';
  else window.addEventListener('load',()=>setTimeout(warmGallery,1200),{once:true});
  choose(0);
})();
