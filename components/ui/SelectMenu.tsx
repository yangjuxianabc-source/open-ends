"use client";

import {createPortal} from "react-dom";
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from "react";

export interface SelectMenuOption{value:string;label:string;disabled?:boolean}

export function SelectMenu({value,options,onChange,label,ariaLabel,className,disabled,onOpenChange}:{value:string;options:readonly SelectMenuOption[];onChange:(value:string)=>void;label?:string;ariaLabel?:string;className?:string;disabled?:boolean;onOpenChange?:(open:boolean)=>void}){
  const id=useId();const buttonRef=useRef<HTMLButtonElement>(null);const menuRef=useRef<HTMLDivElement>(null);
  const [open,setOpenState]=useState(false);const [active,setActive]=useState(Math.max(0,options.findIndex(option=>option.value===value)));const [position,setPosition]=useState({left:0,top:0,width:180,maxHeight:260});
  const selected=options.find(option=>option.value===value)??options[0];
  const setOpen=useCallback((next:boolean)=>{setOpenState(next);onOpenChange?.(next)},[onOpenChange]);
  const place=useCallback(()=>{const rect=buttonRef.current?.getBoundingClientRect();if(!rect)return;const gutter=8;const gap=6;const width=Math.min(Math.max(rect.width,180),window.innerWidth-gutter*2);const below=Math.max(0,window.innerHeight-rect.bottom-gap-gutter);const above=Math.max(0,rect.top-gap-gutter);const openBelow=below>=Math.min(180,above);const available=openBelow?below:above;const maxHeight=Math.max(72,Math.min(280,available));const top=openBelow?Math.min(rect.bottom+gap,window.innerHeight-gutter-maxHeight):Math.max(gutter,rect.top-gap-maxHeight);const left=Math.max(gutter,Math.min(rect.left,window.innerWidth-width-gutter));setPosition({left,top,width,maxHeight})},[]);
  useLayoutEffect(()=>{if(open)place()},[open,place]);
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!buttonRef.current?.contains(event.target as Node)&&!menuRef.current?.contains(event.target as Node))setOpen(false)};const reposition=()=>place();document.addEventListener("pointerdown",close);window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);return()=>{document.removeEventListener("pointerdown",close);window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true)}},[open,place,setOpen]);
  const choose=(index:number)=>{const option=options[index];if(!option||option.disabled)return;onChange(option.value);setOpen(false);buttonRef.current?.focus()};
  const move=(direction:1|-1)=>{let next=active;for(let i=0;i<options.length;i++){next=(next+direction+options.length)%options.length;if(!options[next]?.disabled){setActive(next);break}}};
  const onKeyDown=(event:React.KeyboardEvent)=>{if(event.key==="Escape"){if(open){event.preventDefault();setOpen(false);buttonRef.current?.focus()}return}if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();if(!open)setOpen(true);else move(event.key==="ArrowDown"?1:-1);return}if((event.key==="Enter"||event.key===" ")&&open){event.preventDefault();choose(active)}};
  return <div className={`select-menu ${className??""}`}>
    {label?<span className="select-menu-label">{label}</span>:null}
    <button ref={buttonRef} type="button" className="select-menu-trigger" disabled={disabled} aria-label={ariaLabel??label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-listbox`} onClick={()=>{if(!open)setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(!open)}} onKeyDown={onKeyDown}><span>{selected?.label??"请选择"}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6"/></svg></button>
    {open&&typeof document!=="undefined"?createPortal(<div ref={menuRef} id={`${id}-listbox`} className="select-menu-popup" role="listbox" aria-label={ariaLabel??label} style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}} onKeyDown={onKeyDown}>{options.map((option,index)=><button type="button" role="option" aria-selected={option.value===value} disabled={option.disabled} className={`${index===active?"is-active ":""}${option.value===value?"is-selected":""}`} key={option.value} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===value?<span aria-hidden="true">✓</span>:null}</button>)}</div>,document.body):null}
  </div>;
}
