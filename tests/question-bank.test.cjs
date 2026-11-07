const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseCSV,mapQuestions,buildQuestionBank}=require('../lib/question-bank.cjs');
const header=['ID','Question','Passage','A','B','C','D','Answer','Explanation','Topic','Difficulty'];
const row=['q1','Which choice completes the text?','A passage.','One','Two','Three','Four','B','Follow the evidence.','Inference','Medium'];
test('CSV preserves quoted commas, newlines, escaped quotes, and BOM',()=>{
  const rows=parseCSV('\uFEFFQuestion,A,B,C,D\r\n"A, B\nand ""C""",one,two,three,four\r\n');
  assert.equal(rows.length,2);assert.equal(rows[1][0],'A, B\nand "C"');
});
test('header mapping preserves sheet content and normalizes the answer',()=>{
  const result=mapQuestions([header,row]);assert.equal(result.questions[0].id,'q1');assert.equal(result.questions[0].correctAnswer,'B');assert.equal(result.questions[0].topic,'Inference');assert.equal(result.questions[0].sourceRow,2);assert.equal(result.questions[0].passage,'A passage.');
});
test('numeric and exact choice answer keys work without inventing absent keys',()=>{
  for(const [key,expected] of [['2','B'],['Two','B'],['choice b','B'],['','null']]){const copy=[...row];copy[7]=key;assert.equal(String(mapQuestions([header,copy]).questions[0].correctAnswer),expected);}
});
test('incomplete rows and duplicate IDs are reported; drafts are omitted',()=>{
  const incomplete=[...row];incomplete[0]='q2';incomplete[3]='';
  const result=mapQuestions([[...header,'Published'],[...row,'true'],[...row,'true'],[...incomplete,'true'],[...row.map((v,i)=>i===0?'q3':v),'false']]);
  assert.equal(result.questions.length,1);assert.equal(result.skippedRows,2);
});
test('unmapped sources and malformed CSV get useful errors',()=>{
  assert.throws(()=>mapQuestions([['Link','Notes'],['https://example.com','text']]),e=>e.code==='SHEET_COLUMNS');
  assert.throws(()=>parseCSV('Question\n"unfinished'),e=>e.code==='INVALID_CSV');
});
test('the build produces a static public snapshot with only question fields',()=>{
  const csv=[header,[...row]].map(cells=>cells.join(',')).join('\n');
  const result=buildQuestionBank(csv,'2026-11-07T00:00:00.000Z');
  assert.equal(result.questions.length,1);assert.equal(result.fetchedAt,'2026-11-07T00:00:00.000Z');assert.equal(result.refreshSeconds,300);
  assert.doesNotMatch(JSON.stringify(result),/sourceUrl|sourceRow|client_email|private_key/);
});
test('private source columns are excluded from the static output',()=>{
  const csv=[[...header,'Internal notes'],[...row,'PRIVATE_NOTE_DO_NOT_EXPOSE']].map(cells=>cells.join(',')).join('\n');
  assert.doesNotMatch(JSON.stringify(buildQuestionBank(csv)),/PRIVATE_NOTE_DO_NOT_EXPOSE/);
});
test('header-only sources build an honest empty bank without fake questions',()=>{
  assert.deepEqual(buildQuestionBank(header.join(',')).questions,[]);
});
