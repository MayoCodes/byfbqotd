const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../public');
const port=Number(process.env.PORT||4180);
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const requested=url.pathname==='/'?'index.html':url.pathname==='/question-bank'?'question-bank.html':url.pathname.replace(/^\//,'');
  const file=path.resolve(root,requested);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  try{const body=fs.readFileSync(file);const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type+(type==='image/png'?'':'; charset=utf-8'),'Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Friprep preview: http://127.0.0.1:${port}`));
