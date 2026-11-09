import katex from 'katex';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Only source-delimited equations are interpreted. All surrounding question text
// stays escaped, and TeX cannot insert external links, HTML, or remote images.
export function formatMathText(value){
  const text=String(value??''),pattern=/(?<!\\)(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\n$]+?)\$(?!\d))/g;
  let html='',last=0;
  for(const match of text.matchAll(pattern)){
    html+=escape(text.slice(last,match.index)).replace(/\\\$/g,'$');
    const tex=match[2]??match[3]??match[4]??match[5],display=match[2]!=null||match[3]!=null;
    if(!display&&tex.trim()!==tex)html+=escape(match[0]);
    else html+=katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false,strict:'ignore',maxExpand:500,maxSize:20});
    last=match.index+match[0].length;
  }
  return html+escape(text.slice(last)).replace(/\\\$/g,'$');
}
