export function isQuestionFigureURL(url){return typeof url==='string'&&/^\/question-assets\/[a-f0-9-]+\/\d+-[a-f0-9]+\.png$/.test(url);}
export function openFigure(image){
  if(!isQuestionFigureURL(image?.url))return;
  const dialog=document.querySelector('#figure-viewer');
  if(!dialog)return;
  dialog.querySelector('#figure-title').textContent=image.label||'Question diagram';
  const picture=dialog.querySelector('img');picture.src=image.url;picture.alt=image.label||'Question diagram';
  dialog.querySelector('.original-figure').href=image.url;
  if(!dialog.open)dialog.showModal();
}
