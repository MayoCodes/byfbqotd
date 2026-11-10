// The calculator lives outside the question render tree, so changing questions
// never recreates it or clears its expressions.
const graphIcon='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18M5 16c3 0 3-8 6-8s3 8 6 8c2 0 3-3 4-6"/></svg>';
export const desmosButton=`<button type="button" class="desmos-launch" data-desmos-toggle aria-controls="desmos-panel" aria-expanded="false">${graphIcon}<span>Desmos</span></button>`;

let panel, calculator, loading, sdk, mode='dock', side, floating, dockWidth=465, dockHeight;
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));

export function syncDesmosTrigger(){
  document.querySelectorAll('[data-desmos-toggle]').forEach(button=>button.setAttribute('aria-expanded',String(!!panel&&!panel.hidden)));
}
function loadSDK(){
  return sdk??=(async()=>{
    const configPath='/assets/desmos-config.js';
    const {apiKey}=await import(configPath);
    if(!apiKey)throw Error('Desmos is not configured on this site yet.');
    const url=new URL('https://www.desmos.com/api/v1.12/calculator.js');
    url.searchParams.set('apiKey',apiKey);
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const done=error=>{clearTimeout(timer);if(error){script.remove();reject(error);}else resolve(window.Desmos);};
      const timer=setTimeout(()=>done(Error('Desmos took too long to load.')),15000);
      script.src=url.href;script.async=true;
      script.onload=()=>done(window.Desmos?.GraphingCalculator?null:Error('Desmos could not start.'));
      script.onerror=()=>done(Error('Desmos could not load. Check your connection or try again.'));
      document.head.append(script);
    });
  })().catch(error=>{sdk=null;throw error;});
}
function arrange(){
  document.body.classList.remove('desmos-docked-right','desmos-docked-bottom');
  document.body.style.removeProperty('--desmos-space');
  if(!panel||panel.hidden)return;
  const w=innerWidth,h=innerHeight;
  side=w>=1120?'right':'bottom';
  panel.dataset.placement=mode==='dock'?side:'floating';
  panel.querySelector('[data-dock]').textContent=mode==='dock'?'Float':'Dock';
  if(mode==='dock'){
    const size=side==='right'?clamp(dockWidth,320,w-620):clamp(dockHeight??Math.round(h*.48),Math.min(245,h*.55),h*.65);
    document.body.classList.add('desmos-docked-'+side);
    document.body.style.setProperty('--desmos-space',size+'px');
    Object.assign(panel.style,side==='right'?{left:(w-size)+'px',top:'0px',width:size+'px',height:h+'px'}:{left:'0px',top:(h-size)+'px',width:w+'px',height:size+'px'});
  }else{
    floating??={x:w-490,y:76,w:465,h:465};
    floating.w=clamp(floating.w,Math.min(285,w),w);
    floating.h=clamp(floating.h,Math.min(230,h),h);
    floating.x=clamp(floating.x,0,w-floating.w);
    floating.y=clamp(floating.y,0,h-floating.h);
    Object.assign(panel.style,{left:floating.x+'px',top:floating.y+'px',width:floating.w+'px',height:floating.h+'px'});
  }
}
function floatPanel(x,y){
  if(mode==='floating')return;
  const r=panel.getBoundingClientRect(),w=Math.min(r.width,465),h=Math.min(r.height,465);
  floating={w,h,x:x===undefined?r.left:x-Math.min(x-r.left,w/2),y:y===undefined?Math.min(r.top,76):y-(y-r.top)};
  mode='floating';arrange();
}
function pointerControl(control,move){
  let last;
  control.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    last={x:event.clientX,y:event.clientY};control.setPointerCapture(event.pointerId);
  });
  control.addEventListener('pointermove',event=>{
    if(!last||!control.hasPointerCapture(event.pointerId))return;
    const dx=event.clientX-last.x,dy=event.clientY-last.y;
    if(dx||dy)move(dx,dy,last);
    last={x:event.clientX,y:event.clientY};
  });
  control.addEventListener('lostpointercapture',()=>{last=null;});
}
function resize(dx,dy){
  if(mode==='floating'){floating.w+=dx;floating.h+=dy;}
  else if(side==='right')dockWidth=panel.offsetWidth-dx;
  else dockHeight=panel.offsetHeight-dy;
  arrange();
}
function keyboardControl(control,move){
  control.addEventListener('keydown',event=>{
    const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
    if(!delta)return;event.preventDefault();move(...delta);
  });
}
function createPanel(){
  panel=document.createElement('section');panel.id='desmos-panel';panel.className='desmos-panel';
  panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Desmos graphing calculator');
  panel.innerHTML=`<header class="desmos-panel-bar"><button type="button" class="desmos-grab" aria-label="Move calculator with arrow keys" title="Drag to move calculator">${graphIcon}<strong>Desmos</strong></button><button type="button" data-dock title="Switch between floating and docked calculator">Float</button><button type="button" data-close aria-label="Close calculator" title="Close calculator">×</button></header><div class="desmos-stage"></div><div class="desmos-message" role="status"></div><button type="button" class="desmos-resize" aria-label="Resize calculator with arrow keys" title="Drag to resize calculator"></button>`;
  document.body.append(panel);
  const move=(dx,dy,point)=>{floatPanel(point?.x,point?.y);floating.x+=dx;floating.y+=dy;arrange();};
  const grab=panel.querySelector('.desmos-grab'),grip=panel.querySelector('.desmos-resize');
  pointerControl(grab,move);keyboardControl(grab,move);pointerControl(grip,resize);keyboardControl(grip,resize);
  panel.querySelector('[data-close]').onclick=()=>closeDesmos(true);
  panel.querySelector('[data-dock]').onclick=()=>{if(mode==='dock')floatPanel();else{mode='dock';arrange();}};
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeDesmos(true);}});
  window.addEventListener('resize',arrange);
}
async function startCalculator(){
  if(calculator||loading)return;
  loading=true;
  const message=panel.querySelector('.desmos-message');message.hidden=false;message.textContent='Loading Desmos…';
  try{
    const api=await loadSDK();
    if(panel.hidden)return;
    calculator=api.GraphingCalculator(panel.querySelector('.desmos-stage'),{autosize:true,border:false,pasteGraphLink:false});
    message.hidden=true;
  }catch(error){
    message.textContent=error.message+' ';
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=startCalculator;message.append(retry);
  }finally{loading=false;}
}
function openDesmos(){
  if(!panel)createPanel();
  panel.hidden=false;arrange();syncDesmosTrigger();
  panel.querySelector('.desmos-grab').focus({preventScroll:true});
  if(calculator)requestAnimationFrame(()=>{if(!panel.hidden)calculator.resize();});else void startCalculator();
}
export function closeDesmos(restoreFocus=false){
  if(!panel||panel.hidden)return;
  panel.hidden=true;arrange();syncDesmosTrigger();
  if(restoreFocus)document.querySelector('[data-desmos-toggle]')?.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
  if(!(event.target instanceof Element)||!event.target.closest('[data-desmos-toggle]'))return;
  if(panel&&!panel.hidden)closeDesmos(true);else openDesmos();
});
