const fs=require('node:fs');
const path=require('node:path');
const {buildQuestionBank,mergeCaptures}=require('./lib/question-bank.cjs');
async function build(){
await require('esbuild').build({entryPoints:[path.join(__dirname,'src/filter-controls.jsx')],bundle:true,minify:true,format:'esm',outfile:path.join(__dirname,'assets/filter-controls.js'),define:{'process.env.NODE_ENV':'"production"'}});
require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'node_modules/@tailwindcss/cli/dist/index.mjs'),'--input','src/heroui.css','--output','assets/heroui.css','--minify'],{stdio:'inherit',cwd:__dirname});
const output=path.join(__dirname,'public');
let bank=buildQuestionBank(fs.readFileSync(path.join(__dirname,'data/questions.csv'),'utf8'));
const captureDirectory=path.join(__dirname,'data/captures');
const captures=fs.existsSync(captureDirectory)?fs.readdirSync(captureDirectory).filter(name=>name.endsWith('.json')).sort().map(name=>JSON.parse(fs.readFileSync(path.join(captureDirectory,name),'utf8'))):[];
bank=mergeCaptures(bank,captures);
require('./lib/visual-layout.cjs').addVisualLayout(bank,captures,relative=>fs.readFileSync(path.join(__dirname,relative)));
fs.mkdirSync(output,{recursive:true});
fs.copyFileSync(path.join(__dirname,'index.html'),path.join(output,'index.html'));
fs.cpSync(path.join(__dirname,'assets'),path.join(output,'assets'),{recursive:true});
const mathAssets=path.join(output,'assets/katex');
fs.mkdirSync(mathAssets,{recursive:true});
fs.copyFileSync(require.resolve('katex/dist/katex.min.css'),path.join(mathAssets,'katex.min.css'));
fs.cpSync(path.join(path.dirname(require.resolve('katex/dist/katex.min.css')),'fonts'),path.join(mathAssets,'fonts'),{recursive:true});
// One content-addressed module includes its dependencies, so a cached module cannot
// ask the new page for controls that existed only in an earlier layout.
const bundle=await require('esbuild').build({entryPoints:[path.join(__dirname,'assets/question-bank.js')],bundle:true,minify:true,format:'esm',entryNames:'question-bank-[hash]',outdir:path.join(output,'assets'),metafile:true});
const entry=Object.entries(bundle.metafile.outputs).find(([,info])=>info.entryPoint)[0];
let html=fs.readFileSync(path.join(__dirname,'question-bank.html'),'utf8').replace('/assets/question-bank.js','/assets/'+path.basename(entry));
const accountBundle=await require('esbuild').build({entryPoints:[path.join(__dirname,'src/account-app.jsx')],bundle:true,minify:true,format:'esm',entryNames:'account-app-[hash]',outdir:path.join(output,'assets'),metafile:true});
const accountEntry=path.basename(Object.entries(accountBundle.metafile.outputs).find(([,info])=>info.entryPoint)[0]);
const runBundle=await require('esbuild').build({entryPoints:[path.join(__dirname,'assets/assignment-run.js')],bundle:true,minify:true,format:'esm',entryNames:'assignment-run-[hash]',outdir:path.join(output,'assets'),metafile:true});
const runEntry=path.basename(Object.entries(runBundle.metafile.outputs).find(([,info])=>info.entryPoint)[0]);
const pages={
 'question-bank.html':html,
 'assignment.html':fs.readFileSync(path.join(__dirname,'assignment.html'),'utf8'),
 'dashboard.html':fs.readFileSync(path.join(__dirname,'dashboard.html'),'utf8'),
 'index.html':fs.readFileSync(path.join(__dirname,'index.html'),'utf8')
};
for(const [filename,source] of Object.entries(pages)){
 let page=source.replace('/assets/account-app.js','/assets/'+accountEntry).replace('/assets/assignment-run.js','/assets/'+runEntry);
 for(const name of ['heroui.css','question-bank.css','account.css','assignment.css','katex/katex.min.css']){
  const bytes=fs.readFileSync(path.join(output,'assets',name));
  const hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex').slice(0,12);
  const versioned=name.replace('.css','-'+hash+'.css');
  fs.writeFileSync(path.join(output,'assets',versioned),bytes);
  page=page.replace('/assets/'+name,'/assets/'+versioned);
 }
 fs.writeFileSync(path.join(output,filename),page);
}

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
fs.writeFileSync(path.join(output,'_headers'),'/question-bank.json\n  Cache-Control: no-cache, must-revalidate\n/question-bank\n  Cache-Control: no-cache, must-revalidate\n/question-bank.html\n  Cache-Control: no-cache, must-revalidate\n/assets/*\n  Cache-Control: no-cache, must-revalidate\n');
console.log(`Built Friprep: ${bank.questions.length} questions; ${bank.skippedRows} incomplete/duplicate CSV rows skipped.`);

}
build().catch(error=>{console.error(error);process.exitCode=1;});
