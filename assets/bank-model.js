export const DEFAULT_FILTERS={subject:'',domain:'',skill:'',difficulty:'',status:'',format:'',sort:''};
export const ALL='__all__';
export function metadata(q){return {...q,subject:q.subject||'',domain:q.domain||'',skill:q.skill||q.subskill||(q.topic!==q.domain?q.topic:'')||'',difficulty:q.difficulty||'',format:q.responseFormat==='student-produced'?'Written response':'Multiple choice'};}
export function matches(q,filters,progress={},term='',omit=''){
  const m=metadata(q),p=progress[q.id]||{};
  for(const key of ['subject','domain','skill','difficulty','format'])if(key!==omit&&filters[key]&&m[key]!==filters[key])return false;
  if(omit!=='status'&&filters.status){if(filters.status==='new'&&p.checked)return false;if(filters.status==='review'&&(!p.checked||p.correct))return false;if(filters.status==='correct'&&(!p.checked||!p.correct))return false;if(filters.status==='saved'&&!p.bookmarked)return false;}
  const text=[q.id,q.title,q.passage,q.prompt,m.subject,m.domain,m.skill,q.subskill,...(q.options||[])].join(' ').toLowerCase();
  return !term||text.includes(term.trim().toLowerCase());
}
export function filterQuestions(questions,filters,progress={},term=''){
  const rows=questions.filter(q=>matches(q,filters,progress,term));
  if(filters.sort==='easy')rows.sort((a,b)=>compareDifficulty(a,b,1));
  if(filters.sort==='hard')rows.sort((a,b)=>compareDifficulty(a,b,-1));
  return rows;
}
function compareDifficulty(a,b,direction){const x=rank(a),y=rank(b);return x===3?(y===3?0:1):y===3?-1:(x-y)*direction;}
function rank(q){return {easy:0,medium:1,hard:2}[q.difficulty?.toLowerCase()]??3;}
export function facetOptions(questions,filters,key){
  // A hierarchy lets a learner switch domains without an old skill hiding the alternatives.
  const parents=key==='domain'?['subject']:key==='skill'?['subject','domain']:key==='subject'?[]:['subject','domain','skill'];
  const counts=new Map();
  for(const q of questions){const m=metadata(q);if(parents.some(p=>filters[p]&&m[p]!==filters[p]))continue;if(m[key])counts.set(m[key],(counts.get(m[key])||0)+1);}
  return [...counts].map(([value,count])=>({value,count})).sort((a,b)=>a.value.localeCompare(b.value));
}
export function changeFilter(filters,key,value){
  const next={...filters,[key]:value};
  if(key==='subject'){next.domain='';next.skill='';}if(key==='domain')next.skill='';
  return next;
}
