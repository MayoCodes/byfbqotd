const fs=require('node:fs');
const path=require('node:path');
const {buildQuestionBank,mergeCaptures}=require('./lib/question-bank.cjs');
const output=path.join(__dirname,'public');
let bank=buildQuestionBank(fs.readFileSync(path.join(__dirname,'data/questions.csv'),'utf8'));
const captureDirectory=path.join(__dirname,'data/captures');
const captures=fs.existsSync(captureDirectory)?fs.readdirSync(captureDirectory).filter(name=>name.endsWith('.json')).sort().map(name=>JSON.parse(fs.readFileSync(path.join(captureDirectory,name),'utf8'))):[];
bank=mergeCaptures(bank,captures);
fs.mkdirSync(output,{recursive:true});
for(const name of ['index.html','question-bank.html'])fs.copyFileSync(path.join(__dirname,name),path.join(output,name));
fs.cpSync(path.join(__dirname,'assets'),path.join(output,'assets'),{recursive:true});
for(const capture of captures){
  if(capture.published===false)continue;
  for(const image of capture.images||[]){
    // mergeCaptures validates image paths before any source files are read.
    const relative=image.path.slice('data/capture-assets/'.length);
    const target=path.join(output,'question-assets',relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(__dirname,image.path),target);
  }
}
fs.writeFileSync(path.join(output,'question-bank.json'),JSON.stringify(bank));
fs.writeFileSync(path.join(output,'_headers'),'/question-bank.json\n  Cache-Control: no-cache, must-revalidate\n');
console.log(`Built Friprep: ${bank.questions.length} questions; ${bank.skippedRows} incomplete/duplicate CSV rows skipped.`);
