import {assignmentResults} from './assignment-results.js';
const ms=value=>Number.isFinite(value)&&value>=0?Math.min(value,86400000*7):0;
export function attemptAnalytics(attempt,questionMap){
 const questions=attempt.questionIds.map(id=>questionMap.get(id)).filter(Boolean);
 const result=assignmentResults(questions,attempt.answers);
 const rows=result.rows.map(row=>{const raw=attempt.stats?.[row.question.id],timed=!!raw&&Number.isFinite(raw.activeMs)&&raw.activeMs>=0;return {...row,activeMs:ms(raw?.activeMs),awayMs:ms(raw?.awayMs),answerMs:Number.isFinite(raw?.answerMs)?ms(raw.answerMs):null,awayCount:ms(raw?.awayCount),timed};});
 const events=(Array.isArray(attempt.events)?attempt.events:[]).filter(e=>e&&['away','return','resume'].includes(e.type)).slice(-800).map(e=>({type:e.type,questionId:attempt.questionIds.includes(e.questionId)?e.questionId:null,atMs:ms(e.atMs),...(Number.isInteger(e.module)&&e.module>=1&&e.module<=4?{module:e.module}:{})}));
 return {...attempt,events,result,rows,missingQuestions:attempt.questionIds.length-questions.length,activeMs:rows.reduce((n,r)=>n+r.activeMs,0),awayMs:rows.reduce((n,r)=>n+r.awayMs,0)};
}
export function summarizeAttempts(attempts,questionMap){
 const reports=attempts.map(a=>attemptAnalytics(a,questionMap)),rows=reports.flatMap(r=>r.rows),scored=rows.filter(r=>r.scorable),timed=rows.filter(r=>r.timed),correct=scored.filter(r=>r.correct).length;
 const group=field=>{const groups=new Map();for(const row of rows){const q=row.question,subject=q.subject||'SAT',domain=q.domain||'Not categorized',skill=q.skill||'Not categorized',name=field==='domain'?domain:field==='skill'?skill:q.subskill||q.topic||'Not categorized',key=JSON.stringify([subject,domain,...(field==='domain'?[]:[skill]),...(field==='subskill'?[name]:[])]);if(!groups.has(key))groups.set(key,{key,name,subject,domain,skill,total:0,correct:0,activeMs:0,timed:0});const item=groups.get(key);if(row.scorable){item.total++;if(row.correct)item.correct++;}if(row.timed){item.timed++;item.activeMs+=row.activeMs;}}return [...groups.values()].map(g=>({...g,percentage:g.total?Math.round(100*g.correct/g.total):null,averageMs:g.timed?g.activeMs/g.timed:null})).sort((a,b)=>(a.percentage??-1)-(b.percentage??-1)||a.name.localeCompare(b.name));};
 const answeredTimes=rows.filter(r=>r.answerMs!==null);
 return {averageAnswerMs:answeredTimes.length?answeredTimes.reduce((n,r)=>n+r.answerMs,0)/answeredTimes.length:null,reports,domains:group('domain'),skills:group('skill'),subskills:group('subskill'),correct,scored:scored.length,percentage:scored.length?Math.round(correct/scored.length*100):null,activeMs:timed.reduce((n,r)=>n+r.activeMs,0),averageMs:timed.length?timed.reduce((n,r)=>n+r.activeMs,0)/timed.length:null,awayMs:rows.reduce((n,r)=>n+r.awayMs,0),awayCount:reports.reduce((n,r)=>n+ms(r.awayCount),0)};
}
export function makePracticeReport({attemptId,test,modules,progress,completedAtMs}){
 if(!progress.done||progress.completed.length!==modules.length)throw Error('Finish the selected test or module before sharing it.');
 const questionIds=modules.flatMap(m=>m.questionIds);
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(attemptId)||questionIds.length>100||new Set(questionIds).size!==questionIds.length)throw Error('This test attempt cannot be shared.');
 const completed=progress.completed,stats=Object.assign({},...completed.map(m=>m.stats||{})),answers=Object.assign({},...completed.map(m=>m.answers||{}));
 const events=completed.flatMap((m,i)=>(m.events||[]).map(event=>({...event,module:modules[i].number}))).slice(-800);
 return {attemptId,testId:String(test.id),title:(test.title+(modules.length===1?' · '+modules[0].title:'')).slice(0,200),moduleNumbers:modules.map(m=>m.number),questionIds,answers,stats,events,awayCount:completed.reduce((n,m)=>n+(m.awayCount??Object.values(m.stats||{}).reduce((sum,s)=>sum+ms(s.awayCount),0)),0),completedAtMs};
}
