import {responseMatches} from './answer-check.js';
export function assignmentResults(questions,answers={}){
 const rows=questions.map(question=>{
  const selected=typeof answers[question.id]==='string'?answers[question.id].trim():'',key=String(question.correctAnswer||'').trim();
  const multiple=question.options?.length>0,scorable=!!key&&!/\[(?:Figure|Table) \d+\]/.test(key)&&(!multiple||/^[A-D]$/i.test(key)&&question.options['ABCD'.indexOf(key.toUpperCase())]!=null);
  const correct=scorable&&!!selected&&(multiple?selected.toUpperCase()===key.toUpperCase():responseMatches(selected,key));
  const status=!scorable?'ungraded':!selected?'unanswered':correct?'correct':'incorrect';
  return {question,selected,key,scorable,correct,status};
 });
 const correct=rows.filter(row=>row.status==='correct').length,incorrect=rows.filter(row=>row.status==='incorrect').length,unanswered=rows.filter(row=>row.scorable&&!row.selected).length,ungraded=rows.filter(row=>!row.scorable).length,scored=rows.length-ungraded;
 return {rows,total:rows.length,answered:rows.filter(row=>row.selected).length,correct,incorrect,unanswered,ungraded,scored,percentage:scored?Math.round(100*correct/scored):null};
}
export function cleanResultExplanation(value){return String(value||'').split(/(?:^|\n)\s*Why\s+(?:choice\s+)?[A-D]\s+is\s+incorrect\s*[:：]/i)[0].trim();}
