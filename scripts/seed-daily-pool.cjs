// Uses the existing Firebase CLI login; no credential is exported or stored in this repo.
const fs=require('node:fs'),path=require('node:path');
async function main(){const cli=process.env.FIREBASE_TOOLS_LIB||'/usr/local/lib/node_modules/firebase-tools/lib';const auth=require(path.join(cli,'auth')), {requireAuth}=require(path.join(cli,'requireAuth')), {Client}=require(path.join(cli,'apiv2'));
 const options={project:'broyourefriedbro'},account=auth.findAccountByEmail('ryan.yapper@gmail.com');if(!account)throw Error('Sign into the Firebase CLI project account first.');auth.setActiveAccount(options,account);await requireAuth(options);
 const client=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1'}),pool=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/daily-pool.json')));
 const configId=pool.configId||'main';if(!/^[A-Za-z0-9_-]{1,80}$/.test(configId))throw Error('Invalid daily pool ID.');
 const route='/projects/broyourefriedbro/databases/(default)/documents/byfbDailyConfig/'+configId;
 function encode(v){return typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};}
 let existing;try{existing=(await client.get(route)).body;}catch(e){if(e.status!==404&&e.original?.status!==404&&!String(e.message).includes('404'))throw e;}
 if(existing){const ids=existing.fields?.questions?.arrayValue?.values?.map(x=>x.mapValue.fields.id.stringValue);if(JSON.stringify(ids)!==JSON.stringify(pool.questions.map(x=>x.id)))throw Error('Daily pool already exists with a different sequence. Refusing to change active challenges.');console.log('Daily pool already initialized:',ids.length,'questions');return;}
 await client.patch(route,encode(pool).mapValue,{queryParams:{'currentDocument.exists':'false'}});console.log('Initialized daily pool:',pool.questions.length,'questions.');}
main().catch(e=>{console.error('Daily pool initialization failed:',e.message);process.exitCode=1;});
