import {firebaseConfig} from './firebase-config.js';
import {codeHash,newCode,isTeacher,friendlyAccountError} from './account-model.js';
let sdk,auth,db,boot,version=0,unsubProfile,unsubProgress;
let state={loading:true,user:null,profile:null,progress:{},error:''};const listeners=new Set();
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
  const ticket=++version;unsubProfile?.();unsubProgress?.();unsubProfile=null;unsubProgress=null;emit({user,profile:null,progress:{},loading:!!user,error:''});
  window.dispatchEvent(new CustomEvent('friprep-account-progress',{detail:{uid:user?.uid||null,progress:{}}}));
  if(!user)return;
  try{
   const profile=ref('friprepUsers',user.uid),snapshot=await sdk.getDoc(profile);if(ticket!==version)return;
   if(!snapshot.exists())await sdk.setDoc(profile,{name:user.displayName||'Student',email:user.email||'',mode:null,classroomId:null,createdAt:now()});
   if(ticket!==version)return;
   unsubProfile=sdk.onSnapshot(profile,doc=>{if(ticket!==version)return;emit({profile:doc.data(),loading:false});if(!unsubProgress&&(isTeacher(user)||state.profile?.activated))unsubProgress=sdk.onSnapshot(sdk.collection(db,'friprepUsers',user.uid,'progress'),snap=>{if(ticket!==version)return;const progress=Object.fromEntries(snap.docs.map(doc=>[doc.id,doc.data()]));emit({progress});window.dispatchEvent(new CustomEvent('friprep-account-progress',{detail:{uid:user.uid,progress}}));},error=>emit({error:friendlyAccountError(error)}));},error=>emit({loading:false,error:friendlyAccountError(error)}));
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
export async function submitAssignment(classroomId,assignmentId){const uid=state.user.uid;await sdk.setDoc(ref('friprepClassrooms',classroomId,'submissions',assignmentId+'_'+uid),{studentId:uid,assignmentId,submittedAt:now()});}
export async function savePractice(question,progress){if(!state.user||!state.profile||(!state.profile.activated&&!isTeacher(state.user)))return;await sdk.setDoc(ref('friprepUsers',state.user.uid,'progress',question.id),{selected:String(progress.selected??'').slice(0,200),checked:!!progress.checked,correct:!!progress.correct,bookmarked:!!progress.bookmarked,subject:question.subject||'',domain:question.domain||'',skill:question.skill||'',updatedAt:now()});}
window.addEventListener('friprep-practice-save',event=>{savePractice(event.detail.question,event.detail.progress).catch(error=>emit({error:'Practice is saved on this device, but cloud sync failed. '+friendlyAccountError(error)}));});
window.addEventListener('friprep-assignment-request',async event=>{
 const {classroomId,assignmentId}=event.detail;
 try{await startAccount();await auth.authStateReady();if(!auth.currentUser)throw Error('Sign in and activate your account to open classroom assignments.');const snap=await sdk.getDoc(ref('friprepClassrooms',classroomId,'assignments',assignmentId));if(!snap.exists())throw Error('This assignment is no longer available.');window.dispatchEvent(new CustomEvent('friprep-assignment-loaded',{detail:{id:assignmentId,...snap.data()}}));}
 catch(error){window.dispatchEvent(new CustomEvent('friprep-assignment-loaded',{detail:{error:friendlyAccountError(error)}}));}
});
window.dispatchEvent(new Event('friprep-account-store-ready'));
