export function assignmentVisibleTo(task,uid){return task.audience!=='students'||Array.isArray(task.studentIds)&&task.studentIds.includes(uid);}
export function assignmentAudience(scope,ids,members){
 if(scope==='classroom')return {audience:'classroom',studentIds:[]};
 const studentIds=[...new Set(ids)],allowed=new Set(members.map(m=>m.id));
 if(scope!=='students'||!studentIds.length||studentIds.length>100||studentIds.some(id=>!allowed.has(id)))throw Error('Choose between 1 and 100 students from this classroom.');
 return {audience:'students',studentIds};
}
export function answeredQuestionIds(progress={},attempts=[],aliases={}){
 const ids=new Set(Object.entries(progress).filter(([,p])=>p.checked&&typeof p.selected==='string'&&p.selected.trim()).map(([id])=>aliases[id]||id));
 for(const attempt of attempts)if(attempt.source==='practice'||attempt.status==='submitted')for(const id of attempt.questionIds||[])if(typeof attempt.answers?.[id]==='string'&&attempt.answers[id].trim())ids.add(aliases[id]||id);
 return [...ids];
}
export function completionIndex(byStudent,aliases={}){const index={};for(const [uid,ids]of Object.entries(byStudent))for(const id of new Set(ids.map(id=>aliases[id]||id)))(index[id]??=[]).push(uid);return index;}
export function filterByCompletion(questions,history,filter){if(!history.ready||!history.total||filter==='all')return questions;return questions.filter(q=>{const n=(history.byQuestion[history.aliases?.[q.id]||q.id]||[]).length;return filter==='none'?n===0:filter==='not-all'?n<history.total:filter==='some'?n>0:true;});}
