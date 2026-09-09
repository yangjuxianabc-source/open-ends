/* eslint-disable @next/next/no-img-element -- TMDB poster hosts are external and have an immediate local fallback */
"use client";

import Link from "next/link";
import {useState} from "react";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {StarRating} from "@/components/ui/StarRating";
import {useOpenEnds} from "@/lib/storage/store";
import type {MediaItem,MediaStatus} from "@/types";
import {mediaPosterUrl,mediaYearLabel} from "../services/media";
import {SelectMenu} from "@/components/ui/SelectMenu";

const statuses:Record<MediaStatus,{label:string;note:string}>={
  want:{label:"想看",note:"它还在等待一个合适的时刻。"},
  watching:{label:"在看",note:"一点点往前，正在形成自己的节奏。"},
  finished:{label:"看完",note:"这段观看已经在生活里留下位置。"},
  paused:{label:"暂停",note:"暂时放在这里，不必急着给它结论。"},
  dropped:{label:"放下",note:"不再继续，也是一种清楚的选择。"},
};
const typeLabels={movie:"电影",tv:"剧集"} as const;
const posterClass=(index:number)=>`media-poster media-poster-${index%5}`;

export function MediaItemCard({item,index=0,onDelete}:{item:MediaItem;index?:number;onDelete:()=>void}){
  const {data,updateMedia}=useOpenEnds();
  const [failedUrl,setFailedUrl]=useState<string>();
  const state=statuses[item.status];
  const poster=mediaPosterUrl(item.posterPath);
  const sourceLink=data.sparkLinks.find(link=>link.targetType==="media"&&link.targetId===item.id);
  const source=sourceLink?data.sparks.find(spark=>spark.id===sourceLink.sparkId):undefined;

  return <Card className={`media-card media-card-${item.status}`}>
    <div className="media-top">
      <div className="media-poster-frame">{poster&&failedUrl!==poster?<img className="media-poster media-poster-image" src={poster} alt={`${item.title}海报`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailedUrl(poster)}/>:<div className={posterClass(index)}><span>{item.title}</span></div>}</div>
      <div className="media-meta"><div className="media-meta-top"><span className="tiny-label">{typeLabels[item.mediaType]} · {mediaYearLabel(item.releaseYear,item.releaseDate)}</span><span className={`media-status-chip status-${item.status}`}>{state.label}</span></div><h3>{item.title}</h3>{item.originalTitle&&item.originalTitle!==item.title&&<p>{item.originalTitle}</p>}</div>
    </div>
    {source?<div className="source-spark"><span>来源</span><Link href={`/spark?id=${encodeURIComponent(source.id)}`}>闪念 · {new Date(source.createdAt).toLocaleDateString("zh-CN",{month:"long",day:"numeric"})}</Link></div>:null}
     <div className="media-card-controls"><div className="media-card-choice-row"><SelectMenu className="state-select" label="影视状态" value={item.status} onChange={value=>updateMedia(item.id,{status:value as MediaStatus})} options={Object.entries(statuses).map(([value,option])=>({value,label:option.label}))}/><div className="item-rating"><span className="item-rating-label">喜好</span><StarRating value={item.rating} onChange={rating=>updateMedia(item.id,{rating})} label={`《${item.title}》喜好`}/></div></div><div className="media-tools">{item.status==="finished"&&<Button type="button" variant="secondary" onClick={()=>updateMedia(item.id,{status:"watching"})}>再看一次</Button>}<Button type="button" variant="danger" onClick={onDelete}><span className="tool-icon" aria-hidden>×</span><span>删除</span></Button></div></div>
  </Card>;
}
