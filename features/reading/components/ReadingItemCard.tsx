/* eslint-disable @next/next/no-img-element -- remote cover hosts are dynamic and already have an immediate local fallback */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import { useOpenEnds } from "@/lib/storage/store";
import type { ReadingItem, ReadingStatus } from "@/types";
import {SelectMenu} from "@/components/ui/SelectMenu";

const statuses: Record<ReadingStatus, { label: string; note: string }> = {
  want: { label: "想读", note: "它还在等待一个合适的时刻。" },
  reading: { label: "在读", note: "一点点往前，正在形成自己的节奏。" },
  finished: { label: "读完", note: "这段阅读已经在生活里留下位置。" },
  paused: { label: "暂停", note: "暂时放在这里，不必急着给它结论。" },
  dropped: { label: "放下", note: "不再继续，也是一种清楚的选择。" },
};
const typeLabels = { book: "书籍", article: "文章", paper: "论文", other: "阅读对象" } as const;
const coverClass = (index: number) => `cover c${index % 5}`;

export function ReadingItemCard({ item, index = 0, onReplace, onDelete }: { item: ReadingItem; index?: number; onReplace: () => void; onDelete: () => void }) {
  const { data, updateReading } = useOpenEnds();
  const [failedUrl, setFailedUrl] = useState<string>();
  const state = statuses[item.status];
  const sourceLink = data.sparkLinks.find(link => link.targetType === "reading" && link.targetId === item.id);
  const source = sourceLink ? data.sparks.find(spark => spark.id === sourceLink.sparkId) : undefined;

  return (
    <Card className={`reading-card reading-card-${item.status}`}>
      <div className="book-top">
        <div className="book-cover-frame">
          {item.cover && failedUrl !== item.cover.url
            ? <img className="cover cover-image" src={item.cover.url} alt={`《${item.title}》封面`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(item.cover?.url)} />
            : <div className={coverClass(index)}><span>{item.title}</span></div>}
        </div>
        <div className="book-meta">
          <div className="book-meta-top"><span className="tiny-label">{typeLabels[item.type]}</span><span className={`reading-status-chip status-${item.status}`}>{state.label}</span></div>
          <h3>{item.title}</h3>
          {item.author && <p>{item.author}</p>}
        </div>
      </div>

      {source ? <div className="source-spark"><span>来源</span><Link href={`/spark?id=${encodeURIComponent(source.id)}`}>闪念 · {new Date(source.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</Link></div> : null}

      <div className="reading-card-controls">
        <div className="reading-card-choice-row">
          <SelectMenu className="state-select" label="阅读状态" value={item.status} onChange={value=>updateReading(item.id,{status:value as ReadingStatus})} options={Object.entries(statuses).map(([value,option])=>({value,label:option.label}))}/>
          <div className="item-rating"><span className="item-rating-label">喜好</span><StarRating value={item.rating} onChange={rating=>updateReading(item.id,{rating})} label={`《${item.title}》喜好`}/></div>
        </div>
        <div className="book-tools">
          {item.status === "finished" && <Button type="button" variant="secondary" className="cover-tool" onClick={() => updateReading(item.id, { status: "reading" })}>再读一次</Button>}
          {item.type === "book" && <>
            <Button type="button" variant="ghost" className="cover-tool" onClick={onReplace}><span className="tool-icon" aria-hidden>⌕</span><span>{item.cover ? "更换书籍" : "匹配书籍"}</span></Button>
          </>}
          <Button type="button" variant="danger" className="book-delete" onClick={onDelete}><span className="tool-icon" aria-hidden>×</span><span>删除</span></Button>
        </div>
      </div>
    </Card>
  );
}
