const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('daily store reads per-day attempts and grades using the selected bank key instead of a fixed answer',async()=>{
 const html=fs.readFileSync('daily-challenge.html','utf8'),body=html.slice(html.indexOf('function createQuizStore('),html.indexOf('\nconst DURATION='));
 const make=new Function(body+'; return createQuizStore;')(),records=new Map(),writes=[];let clock=100000;
 const sdk={doc:(_,path)=>path,collection:(_,path)=>path,serverTimestamp:()=>{const stamp=clock;return {toMillis:()=>stamp};},getDoc:async ref=>({exists:()=>records.has(ref),data:()=>records.get(ref)}),runTransaction:async(_,fn)=>fn({get:sdkRef=>sdk.getDoc(sdkRef),set:(ref,data)=>{records.set(ref,data);writes.push(ref);},update:(ref,data)=>records.set(ref,{...records.get(ref),...data})})};
 const q={id:'question',options:['one','two','three','four']};
 const store=new Function('question','responseMatches',body+'; return createQuizStore;')(q,()=>false)(sdk,{}, {uid:'student',displayName:'Reader'},()=>clock,{id:'today',correctAnswer:'D'});
 await store('byfbAttempt',{action:'start'});clock+=5000;const result=await store('byfbAttempt',{action:'answer',answer:'D'});assert.equal(result.attempt.correct,true);assert.ok(records.has('byfbDailyChallenges/today/leaderboard/student'));
 const tomorrow=make(sdk,{}, {uid:'student',displayName:'Reader'},()=>clock,{id:'tomorrow',correctAnswer:'A'});assert.equal((await tomorrow('byfbAttempt',{action:'get'})).attempt,null);
 assert.equal(result.attempt.deadline,170000);assert.equal(result.attempt.elapsed,5000);
});
