const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('verified trig choices keep their operators distinct and render fraction denominators',async()=>{
 const {formatMathText}=await import('../assets/math-format.js');
 const files=['data/test-captures/a25c5c24759af82c6380d7748588ce89.json','data/captures/f6f9e026.json','data/captures/0a10b477.json'];
 for(const file of files){const q=JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8')),choices=Object.values(q.choices);assert.equal(new Set(choices).size,4);for(const choice of choices){const html=formatMathText(choice);assert.match(html,/<mi(?: [^>]*)?>(?:sin|cos|tan)<\/mi>/);assert.doesNotMatch(html,/katex-error/);if(choice.includes('\\frac'))assert.match(html,/<mfrac>/);}}
});
