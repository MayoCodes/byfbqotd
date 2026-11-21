const {test}=require('node:test');
const assert=require('node:assert/strict');
const format=()=>import('../assets/math-format.js');
test('inline fractions and exponents preserve mathematical structure',async()=>{const {formatMathText}=await format();const html=formatMathText(String.raw`The function $g(x)=\frac{a}{b}(x-2)^2+c$.`);assert.match(html,/class="katex"/);assert.match(html,/<mfrac>/);assert.match(html,/<msup>/);assert.match(html,/The function/);});
test('display equations are distinguished from inline equations',async()=>{const {formatMathText}=await format();assert.match(formatMathText('$$x=3$$'),/katex-display/);assert.doesNotMatch(formatMathText('$x=3$'),/katex-display/);assert.match(formatMathText(String.raw`\[x=3\]`),/katex-display/);});
test('unsafe HTML and TeX commands cannot insert scripts or links',async()=>{const {formatMathText}=await format();const html=formatMathText(String.raw`<script>alert(1)</script> $\href{javascript:alert(1)}{x}$`);assert.doesNotMatch(html,/<script|<a\s|href="javascript/i);assert.match(html,/&lt;script&gt;/);});
test('malformed math remains readable instead of crashing the question',async()=>{const {formatMathText}=await format();assert.doesNotThrow(()=>formatMathText('$\\frac{$'));assert.match(formatMathText('$\\frac{$'),/katex-error/);});
test('ordinary currency remains plain text',async()=>{const {formatMathText}=await format();assert.equal(formatMathText('A ticket costs $5 and lunch costs $10.'),'A ticket costs $5 and lunch costs $10.');assert.equal(formatMathText(String.raw`A ticket costs \$5.`),'A ticket costs $5.');});
test('subscripts, radicals, summations, and matrices render as structured notation',async()=>{const {formatMathText}=await format();const html=formatMathText(String.raw`$$x_{n+1}=\sqrt{x_n^2+1}+\sum_{i=1}^{3}i\quad\begin{pmatrix}1&2\\3&4\end{pmatrix}$$`);assert.match(html,/<msub>/);assert.match(html,/<msqrt>/);assert.match(html,/<msubsup>/);assert.match(html,/<mtable/);assert.match(html,/katex-display/);});
test('ordinary variables use the italic math alphabet while numerals remain upright',async()=>{const {formatMathText}=await format();const html=formatMathText('$x_1+2=5$');assert.match(html,/mathnormal/);assert.match(html,/<mi>x<\/mi>/);assert.match(html,/<mn>2<\/mn>/);});
test('diagram viewer accepts only built question assets',async()=>{const {isQuestionFigureURL}=await import('../assets/figure-viewer.js');assert.equal(isQuestionFigureURL('/question-assets/abcdef12/1-ab12cd34.png'),true);for(const url of ['javascript:alert(1)','https://example.com/graph.png','/question-assets/../private.png',null])assert.equal(isQuestionFigureURL(url),false);});

test('scraped sqrt notation renders radicals in prompts, coordinates and coefficients',async()=>{const {formatMathText}=await format();for(const text of ['$h(x)=sqrt(5x+4)$','$(-sqrt(3),0)$','$a=2sqrt(3)$']){const html=formatMathText(text);assert.match(html,/<msqrt>/);assert.doesNotMatch(html,/<mi>s<\/mi><mi>q/);}});
test('nested roots and parenthesized radicands retain their full scope',async()=>{const {formatMathText}=await format();const html=formatMathText('$sqrt((x+1)^2+sqrt(9))$');assert.equal((html.match(/<msqrt>/g)||[]).length,2);assert.match(html,/<msup>/);assert.match(html,/<mn>9<\/mn>/);});
test('existing TeX roots, prose and incomplete sqrt expressions remain intact',async()=>{const {formatMathText}=await format();assert.match(formatMathText(String.raw`$\sqrt{x+1}$`),/<msqrt>/);assert.equal(formatMathText('The notation sqrt(x) names a root.'),'The notation sqrt(x) names a root.');assert.doesNotThrow(()=>formatMathText('$sqrt(x$'));assert.doesNotMatch(formatMathText('$mysqrt(x)$'),/<msqrt>/);});


test('literal percent signs and following math survive inline and display rendering',async()=>{
 const {formatMathText}=await format();
 for(const source of ['$25%+x=40%$','$$25%+x=40%$$',String.raw`\(25%+x=40%\)`]){
  const html=formatMathText(source),mathml=html.match(/<math[\s\S]*?<\/math>/)?.[0]||'';
  assert.doesNotMatch(html,/katex-error/);
  assert.equal((mathml.match(/<mi(?: [^>]*)?>%<\/mi>/g)||[]).length,2);
  assert.match(mathml,/<mi>x<\/mi>/);assert.match(mathml,/<mn>40<\/mn>/);
 }
});
test('percent signs inside fractions and text render without double escaping existing TeX',async()=>{
 const {formatMathText}=await format();
 const raw=formatMathText(String.raw`$\frac{20%}{100%}+\text{50% off}$`);
 const escaped=formatMathText(String.raw`$\frac{20\%}{100\%}+\text{50\% off}$`);
 assert.equal(raw,escaped);assert.match(raw,/<mfrac>/);assert.doesNotMatch(raw,/katex-error/);
 assert.equal(formatMathText('A discount of 20% applies.'),'A discount of 20% applies.');
});

test('indexed accessibility roots render with an index and a complete radicand',async()=>{
 const {formatMathText}=await format();
 for(const source of ['$n-root(5x^n+150)$','$3-root(x^{2})$','$100-root(x^{70})$','$2m-root(4y^m+32)$','$5-root((x+1)^2+sqrt(9))$']){
  const html=formatMathText(source);assert.match(html,/<mroot>/);assert.doesNotMatch(html,/katex-error|<mi>r<\/mi><mi>o/);
 }
 const html=formatMathText('$n-root(5x^n+150)$');assert.match(html,/<mn>150<\/mn>/);assert.match(html,/<mroot>[\s\S]*<mi>n<\/mi><\/mroot>/);
});
test('existing indexed TeX, ordinary prose and incomplete roots stay intact',async()=>{
 const {formatMathText}=await format();assert.match(formatMathText(String.raw`$\sqrt[12]{x+1}$`),/<mroot>/);
 assert.equal(formatMathText('Use n-root(x) notation.'),'Use n-root(x) notation.');
assert.doesNotThrow(()=>formatMathText('$n-root(x$'));
});
test('reported radical question preserves the full 3n exponent in its prompt',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{formatMathText}=await format();
 const q=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/test-captures/70e0c204f55d29f294860fa67cbc202d.json'),'utf8'));
 const html=formatMathText(q.prompt);assert.match(html,/<mroot>/);assert.match(html,/<msup><mi>x<\/mi><mrow><mn>3<\/mn><mi>n<\/mi><\/mrow><\/msup>/);assert.doesNotMatch(html,/katex-error/);assert.equal(q.correctAnswer,'$$3375$$');
});
