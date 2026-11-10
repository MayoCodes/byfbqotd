import katex from 'katex';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// CookSAT accessibility labels sometimes spell radicals as sqrt(...).
// Balance parentheses so nested roots and grouped expressions keep their scope.
function normalizeSquareRoots(tex,level=0){
  if(level>100)return tex;
  const pattern=/(?<![A-Za-z\\])sqrt\s*\(/g;
  let result='',last=0,match;
  while((match=pattern.exec(tex))){
    const start=pattern.lastIndex;let end=start,depth=1;
    for(;end<tex.length;end++){
      if(tex[end]==='\\'){end++;continue;}
      if(tex[end]==='(')depth++;
      else if(tex[end]===')'&&!--depth)break;
    }
    if(depth||!tex.slice(start,end).trim())continue;
    result+=tex.slice(last,match.index)+'\\sqrt{'+normalizeSquareRoots(tex.slice(start,end),level+1)+'}';
    last=end+1;pattern.lastIndex=last;
  }
  return result+tex.slice(last);
}
// Only source-delimited equations are interpreted. All surrounding question text
// stays escaped, and TeX cannot insert external links, HTML, or remote images.
export function formatMathText(value,{paragraphs=false}={}){
  const plain=value=>{const safe=escape(value).replace(/\\\$/g,'$');return paragraphs?safe.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,' '):safe;};
  const text=String(value??''),pattern=/(?<!\\)(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\n$]+?)\$(?!\d))/g;
  let html='',last=0;
  for(const match of text.matchAll(pattern)){
    html+=plain(text.slice(last,match.index));
    const tex=match[2]??match[3]??match[4]??match[5],display=match[2]!=null||match[3]!=null;
    if(!display&&tex.trim()!==tex)html+=escape(match[0]);
    else html+=katex.renderToString(normalizeSquareRoots(tex),{displayMode:display,throwOnError:false,trust:false,strict:'ignore',maxExpand:500,maxSize:20});
    last=match.index+match[0].length;
  }
  return html+plain(text.slice(last));
}
