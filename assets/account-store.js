import {firebaseConfig} from './firebase-config.js';
import {codeHash,newCode,isTeacher,friendlyAccountError} from './account-model.js';
let sdk,auth,db,boot,version=0,unsubProfile,unsubProgress,unsubPlanner;
let state={loading:true,user:null,profile:null,progress:{},planner:{},error:''};const listeners=new Set();
const emit=patch=>{state={...state,...patch};for(const listener of listeners)listener(state);};
export const subscribeAccount=listener=>{listeners.add(listener);listener(state);return ()=>listeners.delete(listener);};
export const getAccount=()=>state;
const ref=(...path)=>sdk.doc(db,...path),now=()=>sdk.serverTimestamp();
export function startAccount(){return boot??=(async()=>{try{
 const base='https://www.gstatic.com/firebasejs/13.2.0/';
 const [app,authSDK,firestore]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
 sdk={...authSDK,...firestore};const instance=app.getApps().find(a=>a.name==='[DEFAULT]')||app.initializeApp(firebaseConfig);auth=sdk.getAuth(instance);db=sdk.getFirestore(instance);
 await sdk.setPersistence(auth,sdk.browserLocalPersistence);
 sdk.onAuthStateChanged(auth,async user=>{
  const ticket=++version;unsubProfile?.();unsubProgress?.();unsubPlanner?.();unsubProfile=null;unsubProgress=null;unsubPlanner=null;emit({user,profile:null,progress:{},planner:{},loading:!!user,error:''});
  window.dispatchEvent(new CustomEvent('friprep-account-progress',{detail:{uid:user?.uid||null,progress:{}}}));
  if(!user)return;
  try{
   const profile=ref('friprepUsers',user.uid),snapshot=await sdk.getDoc(profile);if(ticket!==version)return;
   if(!snapshot.exists())await sdk.setDoc(profile,{name:user.displayName||'Student',email:user.email||'',mode:null,classroomId:null,createdAt:now()});
   if(ticket!==version)return;
   unsubProfile=sdk.onSnapshot(profile,doc=>{if(ticket!==version)return;emit({profile:doc.data(),loading:false});if(!unsubProgress&&(isTeacher(user)||state.profile?.activated))unsubProgress=sdk.onSnapshot(sdk.collection(db,'friprepUsers',user.uid,'progress'),snap=>{if(ticket!==version)return;const progress=Object.fromEntries(snap.docs.map(doc=>[doc.id,doc.data()]));emit({progress});window.dispatchEvent(new CustomEvent('friprep-account-progress',{detail:{uid:user.uid,progress}}));},error=>emit({error:friendlyAccountError(error)}));if(!unsubPlanner&&(isTeacher(user)||state.profile?.activated))unsubPlanner=sdk.onSnapshot(sdk.collection(db,'friprepUsers',user.uid,'planner'),snap=>{if(ticket!==version)return;emit({planner:Object.fromEntries(snap.docs.map(doc=>[doc.id,{...doc.data(),updatedAtMs:doc.data().updatedAt?.toMillis?.()||0}]))});},error=>emit({error:'Your daily focus couldn’t sync. Device-saved focus labels are still available.'}));},error=>emit({loading:false,error:friendlyAccountError(error)}));
  }catch(error){if(ticket===version)emit({loading:false,error:friendlyAccountError(error)});}
 },error=>emit({loading:false,error:friendlyAccountError(error)}));
 }catch(error){emit({loading:false,error:friendlyAccountError(error)});throw error;}})();}
export async function signIn(){await startAccount();if(!auth)throw Error('Google sign-in is unavailable. Please try again.');const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await sdk.signInWithPopup(auth,provider);}
export const signOut=()=>sdk.signOut(auth);
function requireTeacher(){if(!isTeacher(state.user))throw Error('Teacher access is required.');}
export async function generateActivation(label='Student access'){
 requireTeacher();const code=newCode(),hash=await codeHash(code);await sdk.setDoc(ref('friprepActivationCodes',hash),{label:label.trim().slice(0,100)||'Student access',createdBy:state.user.uid,createdAt:now(),expiresAt:sdk.Timestamp.fromMillis(Date.now()+30*86400000),usedBy:null,enabled:true});return code;
}
export async function activate(code){
 const uid=state.user.uid,hash=await codeHash(code),codeRef=ref('friprepActivationCodes',hash);
 await sdk.runTransaction(db,async tx=>{const snap=await tx.get(codeRef),value=snap.data();if(!snap.exists()||!value.enabled||value.usedBy||value.expiresAt.toMillis()<Date.now())throw Error('That activation code is invalid, expired, or already used. Ask your teacher for a new code.');tx.update(codeRef,{usedBy:uid});tx.set(ref('friprepActivationClaims',uid),{codeHash:hash,activatedAt:now()});tx.update(ref('friprepUsers',uid),{activated:true});});
}
export const chooseSelfStudy=()=>sdk.updateDoc(ref('friprepUsers',state.user.uid),{mode:'self-study'});
export async function joinClass(code){const hash=await codeHash(code),invite=await sdk.getDoc(ref('friprepClassInvites',hash)),data=invite.data();if(!invite.exists()||!data.enabled)throw Error('That classroom code is not active. Check it with your teacher.');const batch=sdk.writeBatch(db),uid=state.user.uid;batch.set(ref('friprepClassrooms',data.classroomId,'members',uid),{name:state.user.displayName||'Student',email:state.user.email,joinedAt:now(),inviteHash:hash});batch.update(ref('friprepUsers',uid),{mode:'classroom',classroomId:data.classroomId});await batch.commit();}
export async function createClass(title){requireTeacher();const classroom=sdk.doc(sdk.collection(db,'friprepClassrooms')),code=newCode(),hash=await codeHash(code),batch=sdk.writeBatch(db);batch.set(classroom,{title:title.trim(),teacherId:state.user.uid,createdAt:now()});batch.set(ref('friprepClassInvites',hash),{classroomId:classroom.id,enabled:true,createdAt:now()});await batch.commit();return {id:classroom.id,code};}
export async function makeClassInvite(classroomId){requireTeacher();const code=newCode(),hash=await codeHash(code);await sdk.setDoc(ref('friprepClassInvites',hash),{classroomId,enabled:true,createdAt:now()});return code;}
const docs=snap=>snap.docs.map(doc=>({id:doc.id,...doc.data()}));
export async function loadDashboard(classroomId){const teacher=isTeacher(state.user),uid=state.user.uid;if(!classroomId)return {classes:teacher?docs(await sdk.getDocs(sdk.collection(db,'friprepClassrooms'))):[],assignments:[],grades:[],members:[],submissions:[]};const root=['friprepClassrooms',classroomId];const [room,assignments,grades,members,submissions]=await Promise.all([sdk.getDoc(ref(...root)),sdk.getDocs(sdk.collection(db,...root,'assignments')),sdk.getDocs(teacher?sdk.collection(db,...root,'grades'):sdk.query(sdk.collection(db,...root,'grades'),sdk.where('studentId','==',uid))),teacher?sdk.getDocs(sdk.collection(db,...root,'members')):null,sdk.getDocs(teacher?sdk.collection(db,...root,'submissions'):sdk.query(sdk.collection(db,...root,'submissions'),sdk.where('studentId','==',uid)))]);return {room:room.data(),assignments:docs(assignments),grades:docs(grades),members:members?docs(members):[],submissions:docs(submissions)};}
export async function addAssignment(classroomId,value){requireTeacher();await sdk.addDoc(sdk.collection(db,'friprepClassrooms',classroomId,'assignments'),{...value,createdAt:now()});}
export async function addGrade(classroomId,value){requireTeacher();await sdk.setDoc(ref('friprepClassrooms',classroomId,'grades',value.assignmentId+'_'+value.studentId),{...value,gradedAt:now()});}

export async function savePractice(question,progress){if(!state.user||!state.profile||(!state.profile.activated&&!isTeacher(state.user)))return;await sdk.setDoc(ref('friprepUsers',state.user.uid,'progress',question.id),{selected:String(progress.selected??'').slice(0,200),checked:!!progress.checked,correct:!!progress.correct,bookmarked:!!progress.bookmarked,subject:question.subject||'',domain:question.domain||'',skill:question.skill||'',updatedAt:now()});}
window.addEventListener('friprep-practice-save',event=>{savePractice(event.detail.question,event.detail.progress).catch(error=>emit({error:'Practice is saved on this device, but cloud sync failed. '+friendlyAccountError(error)}));});
export async function saveFocusNote(date,label){
 if(!state.user||(!state.profile?.activated&&!isTeacher(state.user)))throw Error('Activate your account to save focus labels.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof label!=='string'||label.length>140)throw Error('Choose a valid day and a focus label of up to 140 characters.');
 await sdk.setDoc(ref('friprepUsers',state.user.uid,'planner',date),{label:label.trim(),updatedAt:now()});
}

const sessionRef=(classroomId,assignmentId,uid)=>ref('friprepClassrooms',classroomId,'assignments',assignmentId,'sessions',uid);
function sessionData(snapshot){const value=snapshot.data();return value?{...value,startedAtMs:value.startedAt?.toMillis?.()||0,deadlineMs:value.durationSeconds>0?(value.startedAt?.toMillis?.()||0)+value.durationSeconds*1000:null,clockAtMs:value.clockAt?.toMillis?.()||0}:null;}
export async function assignmentContext(classroomId,assignmentId){await startAccount();await auth.authStateReady();const user=auth.currentUser;if(!user)throw Error('Sign in to open this classroom assignment.');const snap=await sdk.getDoc(ref('friprepClassrooms',classroomId,'assignments',assignmentId));if(!snap.exists())throw Error('This assignment is no longer available.');const teacher=isTeacher(user),existing=teacher?null:await sdk.getDoc(sessionRef(classroomId,assignmentId,user.uid));return {assignment:{id:assignmentId,...snap.data()},user:{uid:user.uid,name:user.displayName||'Student'},teacher,existingSession:existing?.exists()?sessionData(existing):null};}
function requireRunOwner(uid){if(auth?.currentUser?.uid!==uid)throw Error('Sign back into the account that started this assignment.');}
export async function beginAssignment(classroomId,assignmentId,uid){
 requireRunOwner(uid);const session=sessionRef(classroomId,assignmentId,uid),assignment=ref('friprepClassrooms',classroomId,'assignments',assignmentId),submitted=ref('friprepClassrooms',classroomId,'submissions',assignmentId+'_'+uid);
 await sdk.runTransaction(db,async tx=>{const [existing,work,task]=await Promise.all([tx.get(session),tx.get(submitted),tx.get(assignment)]);if(existing.exists())return;if(work.exists())throw Error('This assignment was already submitted. Your teacher has the existing submission.');const value=task.data(),seconds=value.timingMode==='timed'?value.timeLimitSeconds:0;tx.set(session,{status:'active',startedAt:now(),clockAt:now(),durationSeconds:seconds,questionIds:value.questionIds,answers:{},stats:{},marked:[],eliminated:{},events:[],awayCount:0,lastQuestionId:value.questionIds[0],revision:0});});
 // Deadline derives from the immutable server start and frozen time limit.
 let snap=await sdk.getDocFromServer(session);if(snap.data().status!=='active')return {session:sessionData(snap),serverNowMs:Date.now()};
 const prior=sessionData(snap);await sdk.updateDoc(session,{clockAt:now()});snap=await sdk.getDocFromServer(session);const value=sessionData(snap);if(value.revision===prior.revision)value.clockAtMs=prior.clockAtMs;return {session:value,serverNowMs:snap.data().clockAt.toMillis()};
}
export async function saveAssignmentRun(classroomId,assignmentId,uid,checkpoint){requireRunOwner(uid);const session=sessionRef(classroomId,assignmentId,uid);return sdk.runTransaction(db,async tx=>{const existing=await tx.get(session),value=existing.data();if(value.status!=='active')throw Error('This assignment has already been submitted.');tx.update(session,{answers:checkpoint.answers,stats:checkpoint.stats,marked:checkpoint.marked,eliminated:checkpoint.eliminated,events:checkpoint.events,awayCount:checkpoint.awayCount,lastQuestionId:checkpoint.lastQuestionId,revision:value.revision+1,clockAt:now()});});}
export async function finishAssignmentRun(classroomId,assignmentId,uid,checkpoint,reason='manual'){
 requireRunOwner(uid);const session=sessionRef(classroomId,assignmentId,uid),submission=ref('friprepClassrooms',classroomId,'submissions',assignmentId+'_'+uid);
 await sdk.runTransaction(db,async tx=>{const [existing,work]=await Promise.all([tx.get(session),tx.get(submission)]),value=existing.data();if(value.status==='submitted')return;const closed=reason==='time-expired';tx.update(session,{...(closed?{}:{answers:checkpoint.answers,marked:checkpoint.marked,eliminated:checkpoint.eliminated}),stats:checkpoint.stats,events:checkpoint.events,awayCount:checkpoint.awayCount,lastQuestionId:checkpoint.lastQuestionId,status:'submitted',submitReason:reason,submittedAt:now(),clockAt:now(),revision:value.revision+1});if(!work.exists())tx.set(submission,{studentId:uid,assignmentId,submittedAt:now()});});return sessionData(await sdk.getDocFromServer(session));
}
export function watchAssignmentActivity(classroomId,assignmentId,onUpdate,onError){
 requireTeacher();return sdk.onSnapshot(sdk.collection(db,'friprepClassrooms',classroomId,'assignments',assignmentId,'sessions'),snap=>onUpdate(docs(snap).map(value=>({...value,startedAtMs:value.startedAt?.toMillis?.()||0,submittedAtMs:value.submittedAt?.toMillis?.()||null}))),onError);
}
