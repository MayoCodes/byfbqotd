import {formatMathText} from './math-format.js';
import {isQuestionFigureURL} from './figure-viewer.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=image=>'['+image.label+']';
const mathQuestion=q=>String(q.subject).toLowerCase()==='math';
function validInk(image){const b=image.ink;return b&&['x','y','width','height'].every(key=>Number.isFinite(b[key]))&&b.x>=0&&b.y>=0&&b.width>0&&b.height>0&&b.x+b.width<=image.width&&b.y+b.height<=image.height;}
function hasProse(value,image){const paragraph=String(value||'').split(/\n[ \t]*\n/).find(part=>part.includes(token(image)));return !!paragraph&&/[A-Za-z]{2}/.test(paragraph.replace(/\[(?:Figure|Table) \d+\]/g,''));}
export function isMathImage(image,q){
 if(image.kind==='math')return true;
 if(image.kind==='diagram'||!mathQuestion(q)||!image.label.startsWith('Figure ')||!Number.isFinite(image.height)||image.height>150||(validInk(image)&&image.ink.height>100))return false;
 if([q.prompt,q.passage,q.explanation].some(value=>hasProse(value,image)))return true;
 if((q.options||[]).some(value=>String(value).includes(token(image)))&&image.width<700&&(!validInk(image)||image.ink.height<90))return true;
 // Older captures stored standalone equation lines as figures too. A small
 // image alongside the same capture's tiny numeric answer images is math.
 return (q.images||[]).some(other=>validInk(other)&&other.ink.width<60&&other.ink.height<70&&(q.options||[]).some(value=>String(value).includes(token(other))));
}
function referenceHeight(q){
 const sizes=(q.images||[]).filter(image=>validInk(image)&&image.ink.width<70&&image.ink.height<80&&isMathImage(image,q)).map(image=>image.ink.height).sort((a,b)=>a-b);
 return sizes.length?sizes[Math.floor(sizes.length/2)]:28;
}
function imageMarkup(image,q,inline,interactive){
 if(!isMathImage(image,q)){const figure=`<span class="question-visual"><img src="${escape(image.url)}" alt="${escape(image.label)}" loading="lazy">${mathQuestion(q)?'':`<span>${escape(image.label)}</span>`}</span>`;return interactive?`<a class="question-visual-link" href="${escape(image.url)}" target="_blank" rel="noopener" aria-label="Open ${escape(image.label)} full size">${figure}</a>`:figure;}
 let math;
 if(validInk(image)){
  const b=image.ink,scale=image.kind==='math'&&Number.isFinite(image.emHeight)?image.emHeight/image.height:.85/referenceHeight(q),em=n=>(n*scale).toFixed(4)+'em';
  math=`<span class="math-image" role="img" aria-label="Mathematical expression" style="width:${em(b.width)};height:${em(b.height)}"><img src="${escape(image.url)}" alt="" style="width:${em(image.width)};height:${em(image.height)};left:-${em(b.x)};top:-${em(b.y)}" loading="eager"></span>`;
 }else math=`<img class="math-image-unmeasured" src="${escape(image.url)}" alt="Mathematical expression" style="height:${Number.isFinite(image.emHeight)?Math.min(image.emHeight,5):1.2}em" loading="eager">`;
 return inline?`<span class="math-inline">${math}</span>`:`<span class="math-image-display">${math}</span>`;
}
export function formatQuestionContent(value,q){
 let text=String(value??''),images=(q.images||[]).filter(image=>isQuestionFigureURL(image.url)),inline=new Set();
 for(const image of images){
  if(!isMathImage(image,q))continue;
  const inSentence=[q.prompt,q.passage,q.explanation].some(field=>field===value&&hasProse(field,image));
  if(image.display==='inline'||image.display!=='block'&&((q.options||[]).includes(value)||inSentence))inline.add(image.label);
 }
 // Restore the flow that the old screenshot placeholder inserted newlines into.
 for(const image of images)if(inline.has(image.label)){
  const marker=token(image);text=text.split(marker).map((part,index,all)=>{if(index)part=part.replace(/^[ \t]*\n(?!\n)[ \t]*/,' ');if(index<all.length-1)part=part.replace(/(?<!\n)[ \t]*\n[ \t]*$/,' ');return part;}).join(marker);
 }
 text=text.replace(/[ \t]+([,.;:!?])/g,'$1');
 const pattern=/\[(Table|Figure) (\d+)\]/g;let html='',last=0;
 for(const match of text.matchAll(pattern)){
  html+=formatMathText(text.slice(last,match.index),{paragraphs:mathQuestion(q)});
  const image=images.find(image=>image.label===match[1]+' '+match[2]);
  html+=image?imageMarkup(image,q,inline.has(image.label),!(q.options||[]).includes(value)):escape(match[0]);last=match.index+match[0].length;
 }
 return html+formatMathText(text.slice(last),{paragraphs:mathQuestion(q)});
}
