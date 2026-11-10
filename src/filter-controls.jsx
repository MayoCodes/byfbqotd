import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Select,Label,ListBox} from '@heroui/react';
import {ALL,DEFAULT_FILTERS,facetOptions,changeFilter} from '../assets/bank-model.js';
let setView;
function Field({label,value,options,onChange,placeholder}){
  return <Select className="filter-select" value={value||ALL} onChange={key=>onChange(key===ALL?'':String(key||''))} fullWidth>
    <Label className="filter-label">{label}</Label><Select.Trigger><Select.Value>{value?(options.find(option=>option.value===value)?.label||value):placeholder}</Select.Value><Select.Indicator/></Select.Trigger>
    <Select.Popover className="filter-popover" placement="bottom start"><ListBox>
      <ListBox.Item id={ALL} textValue={placeholder}><Label>{placeholder}</Label><ListBox.ItemIndicator/></ListBox.Item>
      {options.map(({value,count,label})=><ListBox.Item key={value} id={value} textValue={label||value}><Label>{label||value}</Label>{count!=null&&<span className="option-count">{count}</span>}<ListBox.ItemIndicator/></ListBox.Item>)}
    </ListBox></Select.Popover>
  </Select>;
}
function Filters(){
  const [expanded,setExpanded]=useState(()=>!window.matchMedia('(max-width:760px)').matches);
  useEffect(()=>{const media=window.matchMedia('(max-width:760px)'),sync=()=>setExpanded(!media.matches);media.addEventListener('change',sync);return ()=>media.removeEventListener('change',sync);},[]);
  const [view,update]=useState({questions:[],filters:DEFAULT_FILTERS,progress:{},matched:0});setView=update;
  const {questions,filters,progress,matched}=view;
  const change=(key,value)=>window.dispatchEvent(new CustomEvent('bank-filter-change',{detail:changeFilter(filters,key,value)}));
  const done=questions.filter(q=>progress[q.id]?.checked).length,correct=questions.filter(q=>progress[q.id]?.correct&&progress[q.id]?.checked).length;
  return <><details className="filter-disclosure" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Practice filters <span className="mobile-count">{matched} questions</span></summary><div className="filter-fields">
    {[['subject','Section','All sections'],['domain','Domain','All domains'],['skill','Skill','All skills']].map(([key,label,placeholder])=><Field key={key} label={label} placeholder={placeholder} value={filters[key]} options={facetOptions(questions,filters,key)} onChange={value=>change(key,value)}/>)}
    <div className="filter-divider"/>
    <Field label="Difficulty" placeholder="All difficulties" value={filters.difficulty} options={facetOptions(questions,filters,'difficulty')} onChange={value=>change('difficulty',value)}/>
    <Field label="Practice status" placeholder="All questions" value={filters.status} options={[{value:'new',label:'Not attempted'},{value:'review',label:'Needs review'},{value:'saved',label:'Saved questions'},{value:'correct',label:'Answered correctly'}]} onChange={value=>change('status',value)}/>
    <Field label="Answer format" placeholder="All formats" value={filters.format} options={facetOptions(questions,filters,'format')} onChange={value=>change('format',value)}/>
    <Field label="Order" placeholder="Original order" value={filters.sort} options={[{value:'easy',label:'Easiest first'},{value:'hard',label:'Hardest first'}]} onChange={value=>change('sort',value)}/>
    <button className="reset-filters" onClick={()=>window.dispatchEvent(new CustomEvent('bank-reset'))}>Reset all filters</button>
  </div></details><div className="practice-progress"><div><span className="eyebrow">YOUR PRACTICE</span><strong>{done}<span> / {questions.length}</span></strong></div><p>questions attempted</p><progress value={done} max={questions.length||1} aria-label="Questions attempted"/><div className="progress-stats"><span><i className="legend-dot correct-dot"/>{correct} correct</span><span><i className="legend-dot review-dot"/>{done-correct} to review</span></div></div></>;
}
createRoot(document.getElementById('filter-controls')).render(<Filters/>);
export function updateFilterControls(view){setView?.(view);}
