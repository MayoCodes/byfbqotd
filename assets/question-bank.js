import {responseMatches} from './answer-check.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sparkle='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 3c1 5.5 3.5 8 9 9-5.5 1-8 3.5-9 9-1-5.5-3.5-8-9-9 5.5-1 8-3.5 9-9Z"/></svg>';
const arrow='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
let questions=[],activeId=null,page=0,busy=false,lastFetched=null;
const states=new Map(),PAGE_SIZE=10;
const fingerprint=q=>JSON.stringify([q.prompt,q.passage,q.options,q.correctAnswer,q.explanation,q.images]);
function content(value,q){return escape(value).replace(/\[(Table|Figure) (\d+)\]/g,(match,kind,index)=>{const label=kind+' '+index;const image=(q.images||[]).find(image=>image.label===label&&/^\/question-assets\/[a-f0-9-]+\/\d+-[a-f0-9]+\.png$/.test(image.url));return image?`<span class="question-visual"><img src="${escape(image.url)}" alt="${label}" loading="lazy"><span>${label}</span></span>`:match;});}

function filtered(){const term=$('#search').value.trim().toLowerCase(),topic=$('#topic').value,difficulty=$('#difficulty').value;return questions.filter(q=>(!topic||(q.topic||q.subject)===topic)&&(!difficulty||q.difficulty===difficulty)&&(!term||[q.title,q.prompt,q.passage,q.topic,q.subject,...q.options].join(' ').toLowerCase().includes(term)));}
function tags(q){return [q.topic||q.subject,q.difficulty].filter(Boolean).map(t=>`<span class="tag">${escape(t)}</span>`).join('');}
function updateFilters(){for(const [selector,values,label] of [['#topic',questions.map(q=>q.topic||q.subject),'All topics'],['#difficulty',questions.map(q=>q.difficulty),'All difficulties']]){const current=$(selector).value;$(selector).innerHTML=`<option value="">${label}</option>`+[...new Set(values.filter(Boolean))].sort().map(v=>`<option value="${escape(v)}">${escape(v)}</option>`).join('');if(values.includes(current))$(selector).value=current;}}
function renderList(){
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.min(page,pages-1);
  $('#question-count').textContent=`${rows.length} QUESTION${rows.length===1?'':'S'}`;
  $('#page-count').textContent=`${page+1} / ${pages}`;$('#previous').disabled=page===0;$('#next').disabled=page===pages-1;
  if(!rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).some(q=>q.id===activeId))activeId=rows[page*PAGE_SIZE]?.id||null;
  $('#question-list').innerHTML=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(q=>`<button class="question-item" data-id="${escape(q.id)}" aria-current="${q.id===activeId}"><span class="number">${escape(q.title||'Question '+(questions.indexOf(q)+1))}</span><strong>${escape(q.prompt||q.passage)}</strong><span class="tags">${tags(q)}</span></button>`).join('');
  $('#question-list').querySelectorAll('button').forEach(button=>button.onclick=()=>{activeId=button.dataset.id;renderList();renderDetail();if(matchMedia('(max-width:650px)').matches)$('#detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});});
  renderDetail();
}
function renderDetail(){
  const q=questions.find(q=>q.id===activeId);
  if(!q){$('#detail').innerHTML='<h2>No matching questions.</h2><p class="intro">Try another search or clear your filters.</p>';return;}
  const state=states.get(q.id)||{selected:null,checked:false};states.set(q.id,state);
  const typed=q.responseFormat==='student-produced';
  const correct=state.checked&&(typed?responseMatches(state.selected,q.correctAnswer):state.selected===q.correctAnswer);
  const response=typed?`<label class="written-label" for="written-answer">Your answer</label><input id="written-answer" class="written-answer" type="text" inputmode="decimal" autocomplete="off" value="${escape(state.selected||'')}" placeholder="Enter a number or fraction" ${state.checked?'disabled':''}>`:`<div class="choices" role="radiogroup" aria-labelledby="prompt">${q.options.map((text,i)=>{const letter='ABCD'[i],cls=state.checked?(letter===q.correctAnswer?'correct':state.selected===letter?'incorrect':''):state.selected===letter?'selected':'';return `<button class="choice ${cls}" role="radio" aria-checked="${state.selected===letter}" data-choice="${letter}" ${state.checked?'disabled':''}><span class="letter">${letter}</span><span class="choice-text">${content(text,q)}</span></button>`;}).join('')}</div>`;
  $('#detail').innerHTML=`<div class="detail-top"><p class="eyebrow">${escape(q.title||'QUESTION '+(questions.indexOf(q)+1))}</p><span class="practice-label">Practice · Untimed</span></div>${q.passage?`<div class="passage">${content(q.passage,q)}</div>`:''}${q.prompt?`<h2 class="prompt" id="prompt">${content(q.prompt,q)}</h2>`:'<h2 class="prompt" id="prompt">Choose your answer.</h2>'}${response}${!state.checked?`<button class="primary" id="check" ${!state.selected||!q.correctAnswer?'disabled':''}>Check my answer ${arrow}</button>`:''}<div id="feedback" role="status" aria-live="polite">${state.checked?`<div class="feedback"><h3>${correct?'Good thinking.':'Keep following the clues.'}</h3><p>The correct answer is ${escape(q.correctAnswer)}.${q.explanation?'\n\n'+content(q.explanation,q):''}</p></div>`:''}</div><p class="source-row">${q.correctAnswer?'':'The source has no recognized answer key for this question yet. '}Friprep practice</p>`;
  if(typed){$('#written-answer').oninput=()=>{state.selected=$('#written-answer').value;$('#check').disabled=!state.selected.trim()||!q.correctAnswer;};}
  else{const buttons=$('#detail').querySelectorAll('.choice');buttons.forEach((button,i)=>{
    button.onclick=()=>{state.selected=button.dataset.choice;buttons.forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-checked',String(b===button));});$('#check').disabled=!q.correctAnswer;};
    button.onkeydown=event=>{if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key)&&!state.checked){event.preventDefault();const next=(i+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+4)%4;buttons[next].focus();buttons[next].click();}};
  });}
  if($('#check'))$('#check').onclick=()=>{if(state.selected&&q.correctAnswer){state.checked=true;renderDetail();}};
}
function showError(message,code){
  $('#status-dot').classList.add('offline');$('#feed-status').textContent=lastFetched?'Update unavailable':'Question bank unavailable';
  if(questions.length){$('#notice').hidden=false;$('#notice').textContent=`${message} Showing the saved question bank from ${new Date(lastFetched).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.`;return;}
  $('#empty').className='message';$('#empty').innerHTML=`${sparkle}<h2>Your question bank is getting connected.</h2><p>${escape(message)}</p><p>Questions will appear here automatically once the host publishes the question bank.</p><button class="primary" id="retry">Retry connection ${arrow}</button>`;$('#retry').onclick=()=>load(true);
}
async function load(force=false){
  if(busy)return;busy=true;$('#refresh').disabled=true;
  try{
    const response=await fetch('/question-bank.json'+(force?'?refresh='+Math.floor(Date.now()/30000):''),{cache:'no-store',signal:AbortSignal.timeout(20000)});
    let result;try{result=await response.json();}catch{throw Error('The question-bank file is not available yet. Run the site build and deploy its public output.');}
    if(!response.ok){const error=Error(result.message||'The linked questions could not be loaded.');error.code=result.error;throw error;}
    const old=new Map(questions.map(q=>[q.id,q]));
    for(const q of result.questions)if(old.has(q.id)&&fingerprint(old.get(q.id))!==fingerprint(q))states.delete(q.id);
    questions=result.questions;lastFetched=result.fetchedAt;updateFilters();
    $('#status-dot').classList.remove('offline');$('#feed-status').textContent=`Question bank · Updated ${new Date(lastFetched).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    $('#notice').hidden=!result.skippedRows;$('#notice').textContent=result.skippedRows?`${result.skippedRows} incomplete or duplicate source row${result.skippedRows===1?' was':'s were'} skipped.`:'';
    $('#workspace').hidden=!questions.length;$('#empty').hidden=!!questions.length;
    if(questions.length)renderList();else{$('#empty').className='message';$('#empty').innerHTML=`${sparkle}<h2>A fresh page for your practice.</h2><p>There are no published questions yet. New questions will appear here after the next site update.</p>`;}
  }catch(error){showError(error.name==='TimeoutError'?'The question-bank file took too long to respond. Please try again.':error.message,error.code);}
  finally{busy=false;$('#refresh').disabled=false;}
}
for(const selector of ['#search','#topic','#difficulty'])$(selector).addEventListener(selector==='#search'?'input':'change',()=>{page=0;renderList();});
$('#previous').onclick=()=>{page--;renderList();};$('#next').onclick=()=>{page++;renderList();};$('#refresh').onclick=()=>load(true);
setInterval(()=>{if(!document.hidden)void load();},300000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!lastFetched||Date.now()-Date.parse(lastFetched)>300000))void load();});
void load();
