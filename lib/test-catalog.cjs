function buildTestCatalog(captures,questions){
 const tests=new Map(), ids=new Set(questions.map(q=>q.id));
 for(const capture of captures){
  const m=capture.testModule;
  if(!m||capture.published===false||!ids.has(capture.id.toLowerCase()))continue;
  if(!/^\d{1,8}$/.test(m.testId)||typeof m.title!=='string'||!m.title.trim()||!Number.isInteger(m.module)||m.module<1||m.module>4||!Number.isInteger(m.number)||!Number.isInteger(m.count)||m.number<1||m.number>m.count||m.count>60||m.minutes!==(m.module<=2?32:35))throw Error('Invalid test module metadata: '+capture.id);
  const test=tests.get(m.testId)||{id:m.testId,title:m.title,modules:new Map()};tests.set(m.testId,test);
  const module=test.modules.get(m.module)||{number:m.module,count:m.count,minutes:m.minutes,slots:new Map()};
  if(module.count!==m.count||module.slots.has(m.number))throw Error('Conflicting module positions in test '+m.testId);
  module.slots.set(m.number,capture.id.toLowerCase());test.modules.set(m.module,module);
 }
 return [...tests.values()].sort((a,b)=>Number(a.id)-Number(b.id)).map(test=>{
  const modules=Array.from({length:4},(_,i)=>{
   const m=test.modules.get(i+1),complete=!!m&&m.slots.size===m.count;
   return {number:i+1,title:(i<2?'Reading & Writing':'Math')+' · Module '+(i%2+1),minutes:i<2?32:35,published:m?.slots.size||0,count:m?.count||null,complete,questionIds:complete?[...m.slots].sort((a,b)=>a[0]-b[0]).map(([,id])=>id):[]};
  });
  return {id:test.id,title:test.title,modules,complete:modules.every(m=>m.complete)};
 });
}
module.exports={buildTestCatalog};
