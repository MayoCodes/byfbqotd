const {PNG}=require('pngjs');
function pngLayout(bytes){
 if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return {};
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),result={width,height};
 if(!width||!height||width*height>16000000)return result;
 try{
  const png=PNG.sync.read(bytes);let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(png.data[i+3]>24&&Math.min(png.data[i],png.data[i+1],png.data[i+2])<210){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(right>=left&&bottom>=top){left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(width-1,right+2);bottom=Math.min(height-1,bottom+2);result.ink={x:left,y:top,width:right-left+1,height:bottom-top+1};}
 }catch{}
 return result;
}
function addVisualLayout(bank,captures,readBytes){
 const questions=new Map(bank.questions.map(q=>[q.id,q]));
 for(const capture of captures){
  const q=questions.get(capture.id.toLowerCase());if(!q||capture.published===false)continue;
  for(const source of capture.images||[]){
   const image=q.images.find(item=>item.label===source.label);if(!image)continue;
   // Original PNG bytes stay untouched. Bounds are presentation metadata only.
   const layout=pngLayout(readBytes(source.path));Object.assign(image,layout);
  }
 }
 return bank;
}
module.exports={pngLayout,addVisualLayout};
