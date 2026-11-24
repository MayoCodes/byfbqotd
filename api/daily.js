import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {dailySelection} from '../assets/daily-model.js';
let pool,bank;
export default function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET.'});}try{pool??=JSON.parse(readFileSync(join(process.cwd(),'data/daily-pool.json'),'utf8'));bank??=new Map(JSON.parse(readFileSync(join(process.cwd(),'public/question-bank.json'),'utf8')).questions.map(q=>[q.id,q]));const serverNow=Date.now(),selection=dailySelection(pool,serverNow),question=bank.get(selection.questionId);if(!question||question.correctAnswer!==selection.correctAnswer)throw Error('Daily question is temporarily unavailable.');return res.status(200).json({...selection,serverNow,question});}catch(error){return res.status(503).json({error:error.message});}}
