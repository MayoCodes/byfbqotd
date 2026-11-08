const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fromCapture,buildQuestionBank}=require('../lib/question-bank.cjs');
const model=()=>import('../assets/bank-model.js');
const qs=[{id:'a',subject:'English',domain:'Information and Ideas',skill:'Inferences',difficulty:'Easy',prompt:'Birds',options:[]},{id:'b',subject:'English',domain:'Craft and Structure',skill:'Words in Context',difficulty:'Hard',prompt:'Bears',options:[]},{id:'c',subject:'Math',domain:'Algebra',skill:'Linear equations',difficulty:'Medium',responseFormat:'student-produced',prompt:'Birds',options:[]}];
test('domain and skill survive captured question publishing independently',()=>{
 const q=fromCapture({id:'abcdef12',prompt:'Q?',choices:{A:'a',B:'b',C:'c',D:'d'},correctAnswer:'B',domain:'Information and Ideas',skill:'Inferences',subskill:'Conclusions'});
 assert.equal(q.domain,'Information and Ideas');assert.equal(q.skill,'Inferences');assert.equal(q.subskill,'Conclusions');
});
test('CSV domain and skill columns remain separate',()=>{const q=buildQuestionBank('Question,A,B,C,D,Domain,Skill\nQ?,a,b,c,d,Algebra,Linear equations').questions[0];assert.equal(q.domain,'Algebra');assert.equal(q.skill,'Linear equations');});
test('hierarchical domains are not hidden by a previously selected skill',async()=>{const m=await model();assert.deepEqual(m.facetOptions(qs,{subject:'English',skill:'Inferences'},'domain').map(x=>x.value),['Craft and Structure','Information and Ideas']);assert.equal(m.facetOptions(qs,{domain:'Algebra'},'skill')[0].value,'Linear equations');});
test('changing parent filters clears stale children',async()=>{const m=await model(),f={...m.DEFAULT_FILTERS,domain:'Algebra',skill:'Linear equations'};assert.equal(m.changeFilter(f,'domain','Craft and Structure').skill,'');const next=m.changeFilter(f,'subject','English');assert.equal(next.domain,'');assert.equal(next.skill,'');});
test('search, subject, domain, difficulty, and format intersect',async()=>{const m=await model();assert.deepEqual(m.filterQuestions(qs,{subject:'Math',domain:'Algebra',difficulty:'Medium',format:'Written response'},{},'birds').map(q=>q.id),['c']);assert.equal(m.filterQuestions(qs,{skill:'Inferences'},{},'bears').length,0);});
test('saved, unattempted and review filters use independent progress fields',async()=>{const m=await model(),p={a:{checked:true,correct:false,bookmarked:true},b:{checked:true,correct:true}};for(const [status,ids] of [['review',['a']],['correct',['b']],['new',['c']],['saved',['a']]])assert.deepEqual(m.filterQuestions(qs,{status},p).map(q=>q.id),ids);});
test('difficulty sorting is stable and leaves source order untouched',async()=>{const m=await model();assert.deepEqual(m.filterQuestions(qs,{sort:'hard'}).map(q=>q.id),['b','c','a']);assert.deepEqual(qs.map(q=>q.id),['a','b','c']);});

test('a domain without a skill is never presented as a skill',async()=>{const m=await model();assert.equal(m.metadata({domain:'Algebra',topic:'Algebra'}).skill,'');});
