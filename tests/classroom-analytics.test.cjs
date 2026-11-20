const {test}=require('node:test'),assert=require('node:assert/strict');
const questions=new Map([
 ['q1',{id:'q1',subject:'Math',domain:'Algebra',skill:'Equations',subskill:'Linear',options:['1','2','3','4'],correctAnswer:'B'}],
 ['q2',{id:'q2',subject:'Math',domain:'Algebra',skill:'Equations',subskill:'Systems',options:[],correctAnswer:'0.5'}],
 ['q3',{id:'q3',subject:'Math',domain:'Geometry',skill:'Area',subskill:'Triangles',options:['1','2','3','4'],correctAnswer:'C'}],
 ['q4',{id:'q4',subject:'Math',options:[],correctAnswer:''}]
]);
test('classroom charts combine submitted attempts, weight by question, and exclude missing timing and ungraded keys',async()=>{
 const {summarizeAttempts}=await import('../assets/classroom-analytics.js');
 const out=summarizeAttempts([{questionIds:['q1','q2'],answers:{q1:'B',q2:'1/2'},stats:{q1:{activeMs:10000,answerMs:8000,awayMs:5000}},awayCount:1},{questionIds:['q3','q4'],answers:{q3:'A'},stats:{q3:{activeMs:30000}},awayCount:2}],questions);
 assert.equal(out.percentage,67);assert.equal(out.scored,3);assert.equal(out.averageMs,20000);assert.equal(out.awayCount,3);assert.equal(out.awayMs,5000);
 assert.equal(out.domains.find(g=>g.name==='Algebra').percentage,100);assert.equal(out.domains.find(g=>g.name==='Geometry').percentage,0);assert.equal(out.subskills.find(g=>g.name==='Linear').averageMs,10000);assert.equal(out.subskills.find(g=>g.name==='Systems').averageMs,null);
});
test('unanswered scored responses count as wrong; missing questions do not produce a fabricated score',async()=>{
 const {summarizeAttempts}=await import('../assets/classroom-analytics.js');const out=summarizeAttempts([{questionIds:['q1','missing'],answers:{},stats:{}}],questions);assert.equal(out.percentage,0);assert.equal(out.reports[0].missingQuestions,1);assert.equal(out.averageMs,null);
});
test('completed practice reports retain all modules, per-question timing, and activity without sharing unfinished work',async()=>{
 const {makePracticeReport}=await import('../assets/classroom-analytics.js'),{completePracticeModule}=await import('../assets/practice-test.js');
 const modules=[{number:1,title:'Reading',questionIds:['q1']},{number:3,title:'Math',questionIds:['q2']}],test={id:'6',title:'Practice Test 6'},attemptId='12345678-1234-1234-1234-123456789abc';let progress={completed:[],done:false};
 progress=completePracticeModule(progress,{q1:'B'},{q1:{activeMs:1000}},'manual',2,{awayCount:1,events:[{type:'away',questionId:'q1',atMs:100}]});
 assert.throws(()=>makePracticeReport({attemptId,test,modules,progress,completedAtMs:2000}),/Finish/);
 progress=completePracticeModule(progress,{q2:'1/2'},{q2:{activeMs:2000}},'manual',2,{awayCount:2,events:[{type:'return',questionId:'q2',atMs:900}]});
 const report=makePracticeReport({attemptId,test,modules,progress,completedAtMs:2000});assert.deepEqual(report.moduleNumbers,[1,3]);assert.equal(report.awayCount,3);assert.equal(report.events[1].module,3);assert.equal(report.stats.q2.activeMs,2000);assert.deepEqual(report.questionIds,['q1','q2']);assert.equal(report.completedAtMs,2000);
});
