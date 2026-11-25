const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,writeBatch,serverTimestamp,Timestamp}=require('firebase/firestore');
let env,student,other,teacher;
const room=['friprepClassrooms','room'];
const assignment=(db,id)=>doc(db,...room,'assignments',id);
const run=(db,id,uid='student')=>doc(db,...room,'assignments',id,'sessions',uid);
const submission=(db,id,uid='student')=>doc(db,...room,'submissions',id+'_'+uid);
const auth=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
const initial=(seconds=0)=>({status:'active',startedAt:serverTimestamp(),clockAt:serverTimestamp(),durationSeconds:seconds,questionIds:['q1','q2'],answers:{},stats:{},marked:[],eliminated:{},events:[],awayCount:0,lastQuestionId:'q1',revision:0});
const task=(seconds=0)=>({title:'Practice',category:'Math',dueDate:'',questionIds:['q1','q2'],createdAt:serverTimestamp(),timingMode:seconds?'timed':'untimed',timeLimitSeconds:seconds});
const checkpoint=(revision=1,answers={q1:'B'})=>({answers,stats:{q1:{activeMs:2000,answerMs:1500,awayMs:1200,awayCount:1}},marked:[],eliminated:{},events:[{type:'away',questionId:'q1',atMs:2100}],awayCount:1,lastQuestionId:'q1',revision,clockAt:serverTimestamp()});
function complete(db,id,patch,reason='manual'){const batch=writeBatch(db);batch.update(run(db,id),{...patch,status:'submitted',submitReason:reason,submittedAt:serverTimestamp()});batch.set(submission(db,id),{studentId:'student',assignmentId:id,submittedAt:serverTimestamp()});return batch.commit();}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-friprep',firestore:{rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});student=env.authenticatedContext('student',auth('student@example.test')).firestore();other=env.authenticatedContext('other',auth('other@example.test')).firestore();teacher=env.authenticatedContext('teacher',auth('ray.r.hossain@gmail.com')).firestore();await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await Promise.all(['student','other'].flatMap(uid=>[setDoc(doc(db,'friprepUsers',uid),{activated:true}),setDoc(doc(db,...room,'members',uid),{name:uid})]));await setDoc(assignment(db,'expired'),task(60));await setDoc(run(db,'expired'),{...initial(60),startedAt:Timestamp.fromMillis(Date.now()-120000),answers:{q1:'B'}});});});
after(async()=>{await env?.cleanup();});
test('teacher can publish timing options and only the student or teacher can see private activity',async()=>{await assertSucceeds(setDoc(assignment(teacher,'timed'),task(120)));await assertFails(setDoc(assignment(teacher,'invalid-time'),task(5)));await assertFails(setDoc(assignment(student,'unauthorized'),task()));await assertSucceeds(getDoc(submission(student,'timed')));await assertFails(setDoc(run(student,'timed'),initial(3600)));await assertSucceeds(setDoc(run(student,'timed'),initial(120)));await assertSucceeds(updateDoc(run(student,'timed'),checkpoint()));await assertFails(updateDoc(run(student,'timed'),{durationSeconds:600,clockAt:serverTimestamp()}));await assertFails(getDoc(run(other,'timed')));await assertFails(getDocs(collection(student,...room,'assignments','timed','sessions')));const rows=await assertSucceeds(getDocs(collection(teacher,...room,'assignments','timed','sessions')));assert.equal(rows.size,1);assert.equal(rows.docs[0].data().awayCount,1);});
test('after the fixed deadline new answers are denied and only saved answers can be submitted',async()=>{await assertSucceeds(updateDoc(run(student,'expired'),{clockAt:serverTimestamp()}));await assertFails(updateDoc(run(student,'expired'),checkpoint(1,{q1:'C'})));await assertFails(complete(student,'expired',checkpoint(1,{q1:'C'}),'time-expired'));await assertFails(complete(student,'expired',checkpoint(),'manual'));await assertSucceeds(complete(student,'expired',checkpoint(),'time-expired'));const result=(await getDoc(run(student,'expired'))).data();assert.deepEqual(result.answers,{q1:'B'});assert.equal(result.submitReason,'time-expired');assert.equal((await getDoc(submission(student,'expired'))).exists(),true);});
test('untimed submission and final answers are saved atomically, and completed work cannot be edited',async()=>{await assertSucceeds(setDoc(assignment(teacher,'untimed'),task()));await assertSucceeds(setDoc(run(student,'untimed'),initial()));await assertFails(setDoc(submission(student,'untimed'),{studentId:'student',assignmentId:'untimed',submittedAt:serverTimestamp()}));await assertFails(updateDoc(run(student,'untimed'),{...checkpoint(),status:'submitted',submitReason:'manual',submittedAt:serverTimestamp()}));await assertSucceeds(complete(student,'untimed',checkpoint()));await assertFails(updateDoc(run(student,'untimed'),checkpoint(2,{q1:'D'})));});
test('production store starts, resumes without resetting the clock, and submits through the emulator',async()=>{
 const esbuild=require('esbuild'),entry=path.join(__dirname,'../assets/account-store.js');
 const source=fs.readFileSync(entry,'utf8').replaceAll("import(base+'firebase-app.js')",'Promise.resolve(testSDK.app)').replaceAll("import(base+'firebase-auth.js')",'Promise.resolve(testSDK.auth)').replaceAll("import(base+'firebase-firestore.js')",'Promise.resolve(testSDK.firestore)');
 const bundle=esbuild.buildSync({stdin:{contents:source,sourcefile:entry,resolveDir:path.dirname(entry)},bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
 const user={uid:'student',displayName:'Student',email:'student@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]},authInstance={currentUser:user,authStateReady:async()=>{}};
 const fixture={app:{getApps:()=>[],initializeApp:()=>({})},auth:{getAuth:()=>authInstance,setPersistence:async()=>{},onAuthStateChanged:(_,fn)=>{void fn(user);}},firestore:{...require('firebase/firestore'),getFirestore:()=>student}};
 const module={exports:{}};new Function('testSDK','window','module','exports',bundle)(fixture,{addEventListener:()=>{},dispatchEvent:()=>{}},module,module.exports);const store=module.exports;
 await setDoc(assignment(teacher,'store-integration'),task(120));await store.startAccount();const context=await store.assignmentContext('room','store-integration');assert.equal(context.teacher,false);
 const first=await store.beginAssignment('room','store-integration','student');assert.equal(first.session.deadlineMs-first.session.startedAtMs,120000);
 await store.saveAssignmentRun('room','store-integration','student',checkpoint());
 const resumed=await store.beginAssignment('room','store-integration','student');assert.equal(resumed.session.startedAtMs,first.session.startedAtMs);assert.equal(resumed.session.deadlineMs,first.session.deadlineMs);assert.equal(resumed.session.answers.q1,'B');assert.ok(resumed.serverNowMs>=first.serverNowMs);
 const finished=await store.finishAssignmentRun('room','store-integration','student',checkpoint(2,{q1:'D',q2:'A'}),'manual');assert.equal(finished.status,'submitted');assert.equal(finished.answers.q1,'D');assert.equal((await getDoc(submission(student,'store-integration'))).exists(),true);
 const reopened=await store.assignmentContext('room','store-integration');assert.equal(reopened.existingSession.status,'submitted');assert.equal(reopened.existingSession.answers.q1,'D');
 authInstance.currentUser={...user,uid:'other'};await assert.rejects(store.saveAssignmentRun('room','store-integration','student',checkpoint()),/Sign back/);
});

test('shared practice reports are private, immutable, bounded, and only writable by classroom members',async()=>{
 const target=db=>doc(db,...room,'practiceReports','student_12345678-1234-1234-1234-123456789abc');
 const report={studentId:'student',attemptId:'12345678-1234-1234-1234-123456789abc',testId:'6',title:'Practice Test 6',moduleNumbers:[1,2,3,4],questionIds:['q1','q2'],answers:{q1:'B'},stats:{q1:{activeMs:5000,awayMs:1000,awayCount:1}},events:[{module:1,type:'away',questionId:'q1',atMs:1000}],awayCount:1,completedAtMs:0,sharedAt:serverTimestamp()};
 await assertSucceeds(getDoc(target(student)));await assertFails(setDoc(target(other),report));
 await assertFails(setDoc(doc(student,'friprepClassrooms','not-joined','practiceReports','student_'+report.attemptId),report));
 await assertFails(setDoc(target(student),{...report,questionIds:Array(101).fill('q1')}));
 await assertFails(setDoc(target(student),{...report,stats:{foreign:{activeMs:1}}}));
 await assertSucceeds(setDoc(target(student),report));await assertFails(updateDoc(target(student),{answers:{q1:'C'}}));await assertFails(getDoc(target(other)));await assertSucceeds(getDoc(target(teacher)));
 const {query,where}=require('firebase/firestore');await assertSucceeds(getDocs(query(collection(student,...room,'practiceReports'),where('studentId','==','student'))));await assertFails(getDocs(collection(student,...room,'practiceReports')));
});
test('students can save only their actual classroom memberships as sharing destinations',async()=>{
 await assertSucceeds(setDoc(doc(student,'friprepUsers','student','classrooms','room'),{joinedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(student,'friprepUsers','student','classrooms','not-joined'),{joinedAt:serverTimestamp()}));
 await assertFails(getDocs(collection(other,'friprepUsers','student','classrooms')));
});

test('production share store sends once, preserves activity, and lists only classroom work',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'friprepClassrooms','room'),{title:'SAT group',teacherId:'teacher'});await setDoc(doc(ctx.firestore(),'friprepUsers','student'),{activated:true,classroomId:'room'});});
 const esbuild=require('esbuild'),entry=path.join(__dirname,'../assets/account-store.js'),source=fs.readFileSync(entry,'utf8').replaceAll("import(base+'firebase-app.js')",'Promise.resolve(testSDK.app)').replaceAll("import(base+'firebase-auth.js')",'Promise.resolve(testSDK.auth)').replaceAll("import(base+'firebase-firestore.js')",'Promise.resolve(testSDK.firestore)');
 const bundle=esbuild.buildSync({stdin:{contents:source,sourcefile:entry,resolveDir:path.dirname(entry)},bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
 const user={uid:'student',displayName:'Student',email:'student@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]},authInstance={currentUser:user,authStateReady:async()=>{}};
 const fixture={app:{getApps:()=>[],initializeApp:()=>({})},auth:{getAuth:()=>authInstance,setPersistence:async()=>{},onAuthStateChanged:(_,fn)=>{void fn(user);}},firestore:{...require('firebase/firestore'),getFirestore:()=>student}},module={exports:{}};
 new Function('testSDK','window','module','exports',bundle)(fixture,{addEventListener:()=>{},dispatchEvent:()=>{}},module,module.exports);const store=module.exports;await store.startAccount();
 const report={attemptId:'abcdefgh-1234-1234-1234-123456789abc',testId:'6',title:'Practice Test 6',moduleNumbers:[3],questionIds:['q1'],answers:{q1:'B'},stats:{q1:{activeMs:3000,awayMs:1000,answerMs:2000}},events:[{module:3,type:'away',questionId:'q1',atMs:1000}],awayCount:1,completedAtMs:0};
 assert.equal(await store.sharePracticeReport('room',report),true);assert.equal(await store.sharePracticeReport('room',report),false);
 const attempts=await store.loadClassroomAttempts('room');assert.ok(attempts.some(r=>r.attemptId===report.attemptId&&r.stats.q1.activeMs===3000&&r.events.length===1));
 await assert.rejects(store.sharePracticeReport('not-joined',report));
});

test('a new verified Google student can create their profile before activation without gaining classroom or teacher access',async()=>{
 const fresh=env.authenticatedContext('new-google-student',auth('new-student@example.test')).firestore();
 const profile=doc(fresh,'friprepUsers','new-google-student');
 await assertSucceeds(getDoc(profile));
 await assertSucceeds(setDoc(profile,{name:'New student',email:'new-student@example.test',mode:null,classroomId:null,createdAt:serverTimestamp()}));
 assert.equal((await assertSucceeds(getDoc(profile))).data().name,'New student');
 await assertFails(getDoc(doc(fresh,'friprepUsers','student')));
 await assertFails(getDoc(doc(fresh,...room)));
 await assertFails(updateDoc(profile,{activated:true}));
 const unverified=env.authenticatedContext('unverified',{...auth('new-student@example.test'),email_verified:false}).firestore();
 await assertFails(setDoc(doc(unverified,'friprepUsers','unverified'),{name:'New student',email:'new-student@example.test',mode:null,classroomId:null,createdAt:serverTimestamp()}));
});

test('daily questions have one immutable timed attempt per day and rankings use that day’s bank answer key',async()=>{
 const pool=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/daily-pool.json'),'utf8')),{dailySelection}=await import('../assets/daily-model.js'),spec=dailySelection(pool);
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'byfbDailyConfig','main'),pool);});
 const attempt=doc(student,'byfbDailyChallenges',spec.id,'attempts','student'),score=doc(student,'byfbDailyChallenges',spec.id,'leaderboard','student');
 await assertSucceeds(setDoc(attempt,{name:'Reader',status:'active',startedAt:serverTimestamp()}));
 await assertFails(updateDoc(attempt,{startedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(student,'byfbDailyChallenges',String(Number(spec.id)+1),'attempts','student'),{name:'Reader',status:'active',startedAt:serverTimestamp()}));
 await assertFails(setDoc(score,{name:'Reader',elapsed:0,finishedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(attempt,{status:'answered',answer:spec.correctAnswer,response:spec.correctAnswer,finishedAt:serverTimestamp()}));
 const saved=(await getDoc(attempt)).data(),elapsed=Math.floor(saved.finishedAt.toMillis())-Math.floor(saved.startedAt.toMillis());
 await assertSucceeds(setDoc(score,{name:saved.name,elapsed,finishedAt:saved.finishedAt}));
 await assertFails(updateDoc(attempt,{answer:'A',response:'A',finishedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(student,'byfbDailyConfig','main'),pool));
 const expired=doc(other,'byfbDailyChallenges',spec.id,'attempts','other');await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'byfbDailyChallenges',spec.id,'attempts','other'),{name:'Reader',status:'active',startedAt:Timestamp.fromMillis(Date.now()-80000)});});
 await assertFails(updateDoc(expired,{status:'answered',answer:spec.correctAnswer,response:spec.correctAnswer,finishedAt:serverTimestamp()}));
});

test('targeted assignments only permit listed students to start or read a session',async()=>{
 const targeted={...task(),audience:'students',studentIds:['student']};
 await assertSucceeds(setDoc(assignment(teacher,'targeted'),targeted));
 await assertFails(setDoc(assignment(teacher,'empty-target'),{...targeted,studentIds:[]}));
 await assertFails(setDoc(assignment(teacher,'wrong-scope'),{...targeted,audience:'classroom'}));
 await assertSucceeds(setDoc(run(student,'targeted'),initial()));
 await assertFails(setDoc(run(other,'targeted','other'),initial()));
 await assertFails(getDoc(run(other,'targeted','other')));
});
test('completion indexes are private to the student and teacher',async()=>{
 const history=db=>doc(db,'friprepUsers','student','history','questions');
 await assertSucceeds(setDoc(history(student),{questionIds:['q1'],updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(history(teacher)));await assertFails(getDoc(history(other)));
 await assertFails(setDoc(history(other),{questionIds:[],updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(history(teacher),{questionIds:['q1','q2'],updatedAt:serverTimestamp()}));
});

test('Hard English daily attempts rank against the English pool and stay separate from earlier daily attempts',async()=>{
 const pool=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/daily-pool.json'),'utf8')),{dailySelection}=await import('../assets/daily-model.js'),spec=dailySelection(pool);
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'byfbDailyConfig','english-hard-v1'),pool);});
 const attempt=doc(student,'byfbEnglishDailyChallenges',spec.id,'attempts','student'),score=doc(student,'byfbEnglishDailyChallenges',spec.id,'leaderboard','student');
 await assertSucceeds(setDoc(attempt,{name:'Reader',status:'active',startedAt:serverTimestamp()}));
 await assertFails(updateDoc(attempt,{startedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(attempt,{status:'answered',answer:spec.correctAnswer,response:spec.correctAnswer,finishedAt:serverTimestamp()}));
 const saved=(await getDoc(attempt)).data();await assertSucceeds(setDoc(score,{name:saved.name,elapsed:Math.floor(saved.finishedAt.toMillis())-Math.floor(saved.startedAt.toMillis()),finishedAt:saved.finishedAt}));
 await assertFails(updateDoc(attempt,{answer:'wrong',response:'wrong',finishedAt:serverTimestamp()}));
});
