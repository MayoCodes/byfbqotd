const root=document.getElementById('test-library');
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
function action(test,selection,label,cls){const a=node('a',label,cls);a.href='/assignment?'+new URLSearchParams({test:test.id,module:String(selection)});return a;}
function timeLabel(minutes){const hours=Math.floor(minutes/60),rest=minutes%60;return hours?hours+' hr'+(rest?' '+rest+' min':''):minutes+' min';}
function metric(value,label){const group=node('div');group.append(node('dt',label),node('dd',String(value)));return group;}
function testCard(test){
 const card=node('article','','test-library-card'),modules=test.modules,ready=modules.filter(m=>m.complete).length;
 const top=node('header','','test-card-overview'),heading=node('div');heading.append(node('span',test.complete?'Full test available':ready+' of '+modules.length+' modules available','test-availability'),node('h2',test.title));top.append(heading);
 if(test.complete)top.append(action(test,'all','Take full test','test-action test-action-primary'));
 const stats=node('dl','','test-card-stats');stats.append(metric(ready+' / '+modules.length,'Modules ready'),metric(modules.reduce((sum,m)=>sum+m.published,0),'Questions'),metric(timeLabel(modules.reduce((sum,m)=>sum+m.minutes,0)),'Full-test time'));
 const overview=node('div','','test-card-summary');overview.append(top,stats);card.append(overview);
 const section=node('div','','test-module-section');section.append(node('h3','Practice a module'),node('p','Choose a single timed module to focus your practice.','test-module-intro'));const grid=node('div','','test-module-groups');
 for(const [label,list]of [['Reading & Writing',modules.filter(m=>m.number<=2)],['Math',modules.filter(m=>m.number>2)]]){
  if(!list.length)continue;const group=node('section','','test-module-group');group.append(node('h4',label));
  for(const m of list){const row=node('div','','test-module-row'),name='Module '+((m.number-1)%2+1),desc=node('div','','test-module-detail');desc.append(node('h5',name),node('p',m.complete?m.count+(m.count===1?' question · ':' questions · ')+m.minutes+' min':m.published?m.published+' of '+m.count+' questions published':'Not published yet'));row.append(desc);
   if(m.complete){const start=action(test,m.number,'Start','test-action test-action-secondary');start.setAttribute('aria-label','Start '+test.title+' '+label+' '+name);row.append(start);}else row.append(node('span','Pending','test-module-pending'));group.append(row);
  }grid.append(group);
 }section.append(grid);card.append(section);return card;
}
async function show(){root.setAttribute('aria-busy','true');try{const r=await fetch('/practice-tests.json',{cache:'no-store'});if(!r.ok)throw Error('Could not load the test library.');const tests=await r.json();root.replaceChildren(...(tests.length?tests.map(testCard):[node('p','No practice tests have been published yet.','test-library-empty')]));}catch(error){const message=node('div','','test-library-empty'),retry=node('button','Try again','test-action test-action-secondary');retry.type='button';retry.onclick=show;message.append(node('p',error.message),retry);root.replaceChildren(message);}finally{root.setAttribute('aria-busy','false');}}
void show();
