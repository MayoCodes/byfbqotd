export function selectPracticeModules(test,selection){
 if(!test)throw Error('This practice test is not available.');
 const modules=selection==='all'?test.modules:test.modules.filter(m=>String(m.number)===selection);
 if(!modules.length||modules.some(m=>!m.complete||!m.questionIds.length)||selection==='all'&&modules.length!==4)throw Error('The selected test or module is not fully published yet.');
 return modules;
}
export function practiceModuleSession(module,startedAtMs){
 return {status:'active',questionIds:module.questionIds,startedAtMs,clockAtMs:startedAtMs,durationSeconds:module.minutes*60,deadlineMs:startedAtMs+module.minutes*60000};
}
export function completePracticeModule(progress,answers,stats,reason,total){
 const completed=[...progress.completed,{answers,stats,reason}];
 return {...progress,completed,draft:null,done:completed.length===total};
}
