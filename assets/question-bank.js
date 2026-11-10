import './desmos-panel.js';
import {formatQuestionContent} from './content-format.js';
import {updateFilterControls} from './filter-controls.js';
import {DEFAULT_FILTERS,metadata,filterQuestions} from './bank-model.js';
import {responseMatches} from './answer-check.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sparkle='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 3c1 5.5 3.5 8 9 9-5.5 1-8 3.5-9 9-1-5.5-3.5-8-9-9 5.5-1 8-3.5 9-9Z"/></svg>';
const arrow='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
let questions=[],activeId=null,page=0,busy=false,lastFetched=null;
const states=new Map(),PAGE_SIZE=24;
let selectionMode=false,selectedQuestions=new Set();
function emitBank(){window.dispatchEvent(new CustomEvent('friprep-bank-loaded',{detail:{questions,visibleIds:filtered().slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(q=>q.id)}}));}
let filters={...DEFAULT_FILTERS},progress={},accountUid=null;
const progressKey=()=>accountUid?'friprep-bank-progress:'+accountUid:'friprep-bank-progress';
try{progress=JSON.parse(localStorage.getItem('friprep-bank-progress')||'{}');if(!progress||typeof progress!=='object'||Array.isArray(progress))progress={};}catch{}
function saveProgress(){try{localStorage.setItem(progressKey(),JSON.stringify(progress));}catch{}}
function refreshControls(){updateFilterControls({questions,filters,progress,matched:filtered().length});}

const fingerprint=q=>JSON.stringify([q.prompt,q.passage,q.options,q.correctAnswer,q.explanation,(q.images||[]).map(image=>[image.label,image.url])]);
function content(value,q){return formatQuestionContent(value,q);}

function filtered(){return filterQuestions(questions,filters,progress,$('#search').value);}
function tags(q){const m=metadata(q);return [m.domain,m.skill,m.difficulty].filter(Boolean).map(t=>`<span class="tag">${escape(t)}</span>`).join('');}
function renderChips(){
 const labels={subject:'Section',domain:'Domain',skill:'Skill',difficulty:'Difficulty',status:'Status',format:'Format',sort:'Order'};
 const values={new:'Not attempted',review:'Needs review',saved:'Saved questions',correct:'Answered correctly',easy:'Easiest first',hard:'Hardest first'};
 $('#active-filters').innerHTML=Object.entries(filters).filter(([,v])=>v).map(([key,value])=>`<button class="filter-chip" data-filter="${key}" aria-label="Remove ${escape(labels[key])} filter">${escape(values[value]||value)} <span aria-hidden="true">×</span></button>`).join('');
 $('#active-filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{filters[button.dataset.filter]='';if(button.dataset.filter==='subject'){filters.domain='';filters.skill='';}if(button.dataset.filter==='domain')filters.skill='';page=0;renderList();});
}
function renderList(keepActive=false){
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.min(page,pages-1);
  $('#question-count').textContent='YOUR QUESTION SET';
  $('#result-summary').textContent=`${rows.length} matching question${rows.length===1?'':'s'} · ${questions.length} in the bank`;
  $('#shuffle').disabled=!rows.length;renderChips();refreshControls();
  $('#page-count').textContent=`${page+1} / ${pages}`;$('#previous').disabled=page===0;$('#next').disabled=page===pages-1;
  if(!keepActive&&!rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).some(q=>q.id===activeId))activeId=rows[page*PAGE_SIZE]?.id||null;
  $('#question-list').classList.toggle('is-selecting',selectionMode);
  $('#question-list').innerHTML=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(q=>{const p=progress[q.id]||{},num=questions.indexOf(q)+1,status=p.checked?(p.correct?'Answered correctly':'Needs review'):'Not attempted';
    if(selectionMode)return `<div class="selection-question ${selectedQuestions.has(q.id)?'is-picked':''}"><label class="question-select-control"><input type="checkbox" data-select-id="${escape(q.id)}" aria-label="Select question ${num}" ${selectedQuestions.has(q.id)?'checked':''}><span>Question ${num}</span></label><button class="selection-question-preview" data-id="${escape(q.id)}" aria-current="${q.id===activeId?'true':'false'}"><span class="selection-preview-tags">${escape([metadata(q).skill,metadata(q).difficulty].filter(Boolean).join(' · '))}</span><span class="selection-preview-text">${content(q.prompt,q)}</span><span class="selection-preview-link">Preview question ↗</span></button></div>`;
    return `<button class="question-item ${p.checked?(p.correct?'is-correct':'is-review'):''}" data-id="${escape(q.id)}" aria-current="${q.id===activeId?'true':'false'}" aria-label="Question ${num}, ${status}${p.bookmarked?', saved':''}" title="${escape(metadata(q).skill||q.prompt)}"><span>${num}</span>${p.bookmarked?'<span class="saved-marker" aria-hidden="true"></span>':''}</button>`;}).join('');
  $('#question-list').querySelectorAll('[data-select-id]').forEach(input=>input.onchange=()=>{input.checked=selectedQuestions.has(input.dataset.selectId);window.dispatchEvent(new CustomEvent('friprep-selection-toggle',{detail:{id:input.dataset.selectId}}));});
  $('#navigator-hint').textContent=rows.length?'SELECT A NUMBER TO PRACTICE':'NO MATCHES';
  $('#question-list').querySelectorAll('button').forEach(button=>button.onclick=()=>{activeId=button.dataset.id;renderList();});
  renderDetail();emitBank();
}
function renderDetail(){
  const q=questions.find(q=>q.id===activeId);
  if(!q){$('#detail').innerHTML='<div class="no-matches"><h2>A fresh angle?</h2><p class="intro">No questions match this combination. Try a broader skill or reset your filters.</p><button class="primary" id="clear-empty">Reset filters</button></div>';$('#clear-empty').onclick=resetFilters;return;}
  $('#detail').dataset.subject=(q.subject||'').toLowerCase();
  const saved=progress[q.id]||{};const state=states.get(q.id)||{selected:saved.selected??null,checked:!!saved.checked};states.set(q.id,state);
  const typed=q.responseFormat==='student-produced';
  const correct=state.checked&&(typed?responseMatches(state.selected,q.correctAnswer):state.selected===q.correctAnswer);
  const response=typed?`<label class="written-label" for="written-answer">Your answer</label><input id="written-answer" class="written-answer" type="text" inputmode="decimal" autocomplete="off" value="${escape(state.selected||'')}" placeholder="Enter a number or fraction" ${state.checked?'disabled':''}>`:`<div class="choices" role="radiogroup" aria-labelledby="prompt">${q.options.map((text,i)=>{const letter='ABCD'[i],cls=state.checked?(letter===q.correctAnswer?'correct':state.selected===letter?'incorrect':''):state.selected===letter?'selected':'';return `<button class="choice ${cls}" role="radio" aria-checked="${state.selected===letter}" data-choice="${letter}" ${state.checked?'disabled':''}><span class="letter">${letter}</span><span class="choice-text">${content(text,q)}</span></button>`;}).join('')}</div>`;
  $('#detail').innerHTML=`<div class="detail-top"><p class="eyebrow">${escape(q.title||'QUESTION '+(questions.indexOf(q)+1))}</p><div class="detail-actions">${selectionMode?`<button id="select-for-assignment" class="teacher-add-question ${selectedQuestions.has(q.id)?'is-picked':''}" aria-pressed="${selectedQuestions.has(q.id)}">${selectedQuestions.has(q.id)?'Added to assignment':'Add to assignment'}</button>`:''}<span class="practice-label">Untimed practice</span><button id="bookmark" class="bookmark-button ${saved.bookmarked?'bookmarked':''}" aria-pressed="${!!saved.bookmarked}" aria-label="${saved.bookmarked?'Unsave question':'Save question'}"><svg class="icon" viewBox="0 0 24 24" fill="${saved.bookmarked?'currentColor':'none'}" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg></button></div></div><div class="detail-tags">${tags(q)}</div>${q.passage?`<div class="passage">${content(q.passage,q)}</div>`:''}${q.prompt?`<h2 class="prompt" id="prompt">${content(q.prompt,q)}</h2>`:'<h2 class="prompt" id="prompt">Choose your answer.</h2>'}${response}${!state.checked?`<button class="primary" id="check" ${!state.selected||!q.correctAnswer?'disabled':''}>Check my answer ${arrow}</button>`:''}<div id="feedback" role="status" aria-live="polite">${state.checked?`<div class="feedback"><h3>${correct?'Good thinking.':'Keep following the clues.'}</h3><p>The correct answer is ${content(q.correctAnswer,q)}.${q.explanation?'\n\n'+content(q.explanation,q):''}</p><button class="text-button" id="retry-question">Try this question again</button></div>`:''}</div><div class="question-navigation"><button id="back-question" class="text-button">← Previous question</button><button id="next-question" class="text-button">Next question →</button></div><p class="source-row">${q.correctAnswer?'':'The source has no recognized answer key for this question yet. '}Friprep practice</p>`;
  if($('#select-for-assignment'))$('#select-for-assignment').onclick=()=>window.dispatchEvent(new CustomEvent('friprep-selection-toggle',{detail:{id:q.id}}));
  if(typed&&!state.checked){$('#written-answer').oninput=()=>{state.selected=$('#written-answer').value;$('#check').disabled=!state.selected.trim()||!q.correctAnswer;};}
  else if(!typed){const buttons=$('#detail').querySelectorAll('.choice');buttons.forEach((button,i)=>{
    button.onclick=()=>{state.selected=button.dataset.choice;buttons.forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-checked',String(b===button));});$('#check').disabled=!q.correctAnswer;};
    button.onkeydown=event=>{if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key)&&!state.checked){event.preventDefault();const next=(i+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+4)%4;buttons[next].focus();buttons[next].click();}};
  });}
  if($('#check'))$('#check').onclick=()=>{if(state.selected&&q.correctAnswer){state.checked=true;progress[q.id]={...progress[q.id],selected:state.selected,checked:true,correct:typed?responseMatches(state.selected,q.correctAnswer):state.selected===q.correctAnswer};saveProgress();window.dispatchEvent(new CustomEvent('friprep-practice-save',{detail:{question:q,progress:progress[q.id]}}));renderList(true);}};
  if($('#retry-question'))$('#retry-question').onclick=()=>{state.checked=false;state.selected=null;renderDetail();};
  $('#bookmark').onclick=()=>{progress[q.id]={...progress[q.id],bookmarked:!progress[q.id]?.bookmarked};saveProgress();window.dispatchEvent(new CustomEvent('friprep-practice-save',{detail:{question:q,progress:progress[q.id]}}));renderList(true);};
  const rows=filtered(),index=rows.findIndex(row=>row.id===q.id);
  $('#back-question').disabled=index<=0;$('#next-question').disabled=index>=rows.length-1;
  for(const [id,offset] of [['#back-question',-1],['#next-question',1]])$(id).onclick=()=>{const target=rows[index+offset];if(target){activeId=target.id;page=Math.floor((index+offset)/PAGE_SIZE);renderList();$('#detail').scrollIntoView({block:'start',behavior:'instant'});}};

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
    for(const q of result.questions)if(old.has(q.id)&&fingerprint(old.get(q.id))!==fingerprint(q)){states.delete(q.id);progress[q.id]={bookmarked:!!progress[q.id]?.bookmarked};saveProgress();}
    questions=result.questions;lastFetched=result.fetchedAt;refreshControls();
    $('#status-dot').classList.remove('offline');$('#feed-status').textContent=`Question bank · Updated ${new Date(lastFetched).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    $('#notice').hidden=!result.skippedRows;$('#notice').textContent=result.skippedRows?`${result.skippedRows} incomplete or duplicate source row${result.skippedRows===1?' was':'s were'} skipped.`:'';
    $('#workspace').hidden=!questions.length;$('#empty').hidden=!!questions.length;
    if(questions.length)renderList();else{$('#result-summary').textContent='No published questions yet';$('#shuffle').disabled=true;$('#empty').className='message';$('#empty').innerHTML=`${sparkle}<h2>A fresh page for your practice.</h2><p>There are no published questions yet. New questions will appear here after the next site update.</p>`;}
  }catch(error){showError(error.name==='TimeoutError'?'The question-bank file took too long to respond. Please try again.':error.message,error.code);}
  finally{busy=false;$('#refresh').disabled=false;}
}
function resetFilters(){filters={...DEFAULT_FILTERS};$('#search').value='';page=0;renderList();}
window.addEventListener('bank-filter-change',event=>{filters=event.detail;page=0;renderList();});
window.addEventListener('bank-reset',resetFilters);
$('#search').addEventListener('input',()=>{page=0;renderList();});
$('#shuffle').onclick=()=>{const rows=filtered();if(!rows.length)return;const alternatives=rows.filter(q=>q.id!==activeId);const q=(alternatives.length?alternatives:rows)[Math.floor(Math.random()*(alternatives.length||rows.length))];activeId=q.id;page=Math.floor(rows.indexOf(q)/PAGE_SIZE);renderList();};
$('#previous').onclick=()=>{page--;renderList();};$('#next').onclick=()=>{page++;renderList();};$('#refresh').onclick=()=>load(true);
setInterval(()=>{if(!document.hidden)void load();},300000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!lastFetched||Date.now()-Date.parse(lastFetched)>300000))void load();});
void load();

window.addEventListener('friprep-account-progress',event=>{
 const {uid,progress:cloud}=event.detail;
 if(accountUid!==uid){accountUid=uid;states.clear();try{progress=JSON.parse(localStorage.getItem(progressKey())||'{}');if(!progress||typeof progress!=='object'||Array.isArray(progress))progress={};}catch{progress={};}}
 if(uid){for(const [id,row] of Object.entries(cloud||{})){progress[id]=row;if(row.checked)states.delete(id);}saveProgress();}
 if(questions.length)renderList(true);
});
const oldAssignmentLink=new URLSearchParams(location.search);
if(oldAssignmentLink.has('assignment')&&oldAssignmentLink.has('classroom'))location.replace('/assignment?'+oldAssignmentLink);

window.addEventListener('friprep-bank-request',emitBank);
window.addEventListener('friprep-selection-state',event=>{selectionMode=!!event.detail.enabled;selectedQuestions=new Set(event.detail.ids);if(questions.length)renderList(true);});
window.addEventListener('friprep-question-open',event=>{if(!questions.some(q=>q.id===event.detail.id))return;activeId=event.detail.id;renderList(true);$('#detail').scrollIntoView({block:'start',behavior:'smooth'});});
