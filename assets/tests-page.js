const root=document.getElementById('test-library');
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
function link(test,selection,label){const a=node('a',label,'account-link-button');a.href='/assignment?'+new URLSearchParams({test:test.id,module:String(selection)});return a;}
async function show(){
 try{
 const r=await fetch('/practice-tests.json',{cache:'no-store'});if(!r.ok)throw Error('Could not load the test library.');
 const tests=await r.json();root.replaceChildren();
 if(!tests.length){root.append(node('p','No practice tests have been published yet. Captured modules will appear here once they’re published.','account-empty'));return;}
 for(const test of tests){
  const card=node('article','','test-library-card'),heading=node('div','','test-library-heading'),title=node('div');title.append(node('h2',test.title),node('p',test.modules.filter(m=>m.complete).length+' of 4 modules ready'));heading.append(title);
  if(test.complete)heading.append(link(test,'all','Take full test'));else heading.append(node('span','Full test pending','test-library-status'));card.append(heading);
  const grid=node('div','','test-library-modules');
  for(const m of test.modules){const slot=node('section','','test-library-module');slot.append(node('h3',m.title),node('p',m.complete?m.count+(m.count===1?' question · ':' questions · ')+m.minutes+' minutes':m.published?m.published+' of '+m.count+' questions published':'Not published yet'));if(m.complete)slot.append(link(test,m.number,'Start module'));grid.append(slot);}
  card.append(grid);root.append(card);
 }
 }catch(error){root.textContent=error.message;}
}
void show();
