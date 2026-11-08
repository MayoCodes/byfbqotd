const {createHash}=require('node:crypto');
class SourceError extends Error{constructor(code,message,status=503){super(message);this.code=code;this.status=status;}}
function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;
    }else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new SourceError('INVALID_CSV','The linked sheet returned an incomplete CSV file.');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
const normal=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={
  id:['id','questionid','qid'],prompt:['question','questiontext','prompt','questionprompt','stem'],
  passage:['passage','paragraph','stimulus','readingpassage','text'],title:['title','questiontitle'],
  a:['a','optiona','choicea','answerchoicea','answera','option1','choice1'],b:['b','optionb','choiceb','answerchoiceb','answerb','option2','choice2'],
  c:['c','optionc','choicec','answerchoicec','answerc','option3','choice3'],d:['d','optiond','choiced','answerchoiced','answerd','option4','choice4'],
  answer:['answer','correctanswer','correctchoice','answerkey','key'],explanation:['explanation','rationale','solution','answerexplanation'],
  domain:['domain'],skill:['skill','skills'],subskill:['subskill'],subject:['subject','section','testsection'],topic:['topic','skill','category','domain'],difficulty:['difficulty','level'],enabled:['enabled','published','active']
};
function mapQuestions(rows){
  if(!rows.length)return {questions:[],skippedRows:0};
  const headers=rows[0].map(normal),columns={};
  for(const [field,names] of Object.entries(aliases))columns[field]=headers.findIndex(x=>names.includes(x));
  if((columns.prompt<0&&columns.passage<0)||['a','b','c','d'].some(k=>columns[k]<0))throw new SourceError('SHEET_COLUMNS','The question bank is connected, but its columns still need to be mapped by the host.',422);
  const questions=[],seen=new Set();let skippedRows=0;
  for(let i=1;i<rows.length;i++){
    const row=rows[i],get=field=>String(row[columns[field]]??'').trim();
    if(columns.enabled>=0&&['false','no','0','draft'].includes(get('enabled').toLowerCase()))continue;
    const passage=get('passage'),prompt=get('prompt'),options=['a','b','c','d'].map(get);
    if((!prompt&&!passage)||options.some(x=>!x)){skippedRows++;continue;}
    const raw=get('answer');let correctAnswer=null;
    const letter=raw.match(/^\s*(?:option\s*|choice\s*)?([a-d1-4])[\s.)]*$/i);
    if(letter)correctAnswer=/[1-4]/.test(letter[1])?'ABCD'[Number(letter[1])-1]:letter[1].toUpperCase();
    else{const index=options.findIndex(x=>x.toLowerCase()===raw.toLowerCase());if(raw&&index>=0)correctAnswer='ABCD'[index];}
    const id=get('id')||createHash('sha256').update(JSON.stringify([passage,prompt,options])).digest('hex').slice(0,16);
    if(seen.has(id)){skippedRows++;continue;}seen.add(id);
    questions.push({id,title:get('title'),passage,prompt,options,correctAnswer,explanation:get('explanation'),subject:get('subject'),domain:get('domain'),skill:get('skill'),subskill:get('subskill'),topic:get('topic'),difficulty:get('difficulty'),sourceRow:i+1});
  }
  return {questions,skippedRows};
}
function buildQuestionBank(csv,builtAt=new Date().toISOString()){
  const mapped=mapQuestions(parseCSV(csv));
  const questions=mapped.questions.map(q=>({id:q.id,title:q.title,passage:q.passage,prompt:q.prompt,options:q.options,correctAnswer:q.correctAnswer,explanation:q.explanation,subject:q.subject,domain:q.domain,skill:q.skill,subskill:q.subskill,topic:q.topic,difficulty:q.difficulty}));
  return {questions,skippedRows:mapped.skippedRows,fetchedAt:builtAt,refreshSeconds:300};
}

function fromCapture(c){
  if(!c||!/^[a-f0-9-]{8,64}$/i.test(c.id||'')||typeof c.prompt!=='string'||!c.prompt.trim())throw new Error('Invalid capture ID or question text.');
  const id=c.id.toLowerCase(),options='ABCD'.split('').map(key=>String(c.choices?.[key]||'').trim());
  const hasChoices=options.some(Boolean);
  if(hasChoices&&options.some(value=>!value))throw new Error('Capture '+id+' has incomplete answer choices.');
  const raw=String(c.correctAnswer||'').trim();
  if(!raw)throw new Error('Capture '+id+' has no official answer.');
  let correctAnswer=raw;
  if(hasChoices){
    const letter=raw.match(/^(?:answer\s*|option\s*|choice\s*)?([a-d])(?:\s*[.)](?:\s|$)|\s*$)/i);
    const index=options.findIndex(value=>value.toLowerCase()===raw.toLowerCase());
    correctAnswer=letter?letter[1].toUpperCase():index>=0?'ABCD'[index]:null;
  }
  const images=(c.images||[]).map(image=>{
    const match=String(image.path||'').match(/^data\/capture-assets\/([a-f0-9-]+)\/(\d+-[a-f0-9]+\.png)$/);
    if(!match||match[1]!==id||!/^(Figure|Table) [1-9]\d*$/.test(image.label||''))throw new Error('Capture '+id+' has an unsafe image path or label.');
    return {label:image.label,url:'/question-assets/'+id+'/'+match[2]};
  });
  return {id,title:'',prompt:c.prompt,passage:String(c.passage||''),options:hasChoices?options:[],responseFormat:hasChoices?'multiple-choice':'student-produced',correctAnswer,officialAnswer:raw,explanation:String(c.explanation||''),subject:String(c.subject||''),domain:String(c.domain||''),skill:String(c.skill||''),subskill:String(c.subskill||''),topic:String(c.subskill||c.skill||c.domain||''),difficulty:String(c.difficulty||''),images};
}
function mergeCaptures(bank,captures){
  const normalizeId=id=>/^[a-f0-9-]{8,64}$/i.test(id)?id.toLowerCase():id;
  const questions=new Map(bank.questions.map(q=>[normalizeId(q.id),q]));
  for(const capture of captures){if(capture.published===false)continue;const q=fromCapture(capture);questions.set(q.id,q);}
  return {...bank,questions:[...questions.values()]};
}
module.exports={parseCSV,mapQuestions,buildQuestionBank,mergeCaptures,fromCapture,SourceError};

