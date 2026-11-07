export function responseMatches(value,answer){
  const clean=text=>String(text).trim().replace(/[−–]/g,'-').replace(/\$/g,'').replace(/\\(?:d?frac)\{([-+\d.]+)\}\{([-+\d.]+)\}/g,'$1/$2').replace(/\s+/g,'');
  function numeric(text){if(!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[-+]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(text))return null;const pieces=text.split('/').map(Number),n=pieces.length===2?pieces[0]/pieces[1]:pieces[0];return Number.isFinite(n)?n:null;}
  const input=clean(value);if(!input)return false;
  return String(answer).split(/\s*(?:;|\bor\b)\s*/i).some(key=>{const expected=clean(key);if(input.toLowerCase()===expected.toLowerCase())return true;const a=numeric(input),b=numeric(expected);return a!==null&&b!==null&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b));});
}
