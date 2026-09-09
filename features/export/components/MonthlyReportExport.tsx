"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { generateMonthlyReport,monthlyReportFileName } from "@/lib/export/monthlyReport";
import { generateReviewMarkdown,reviewReportFileName } from "@/lib/export/reviewReport";
import { useOpenEnds } from "@/lib/storage/store";

export function MonthlyReportExport(){
  const now=new Date();
  const [cursor,setCursor]=useState(new Date(now.getFullYear(),now.getMonth(),1));
  const {data}=useOpenEnds();
  const year=cursor.getFullYear(),month=cursor.getMonth();
  function move(n:number){setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+n,1))}
  function download(){
    const key=`${year}-${String(month+1).padStart(2,"0")}`;const snapshot=data.periodSnapshots.filter(item=>item.periodType==="monthly"&&item.periodKey===key).sort((a,b)=>b.revision-a.revision)[0];const review=snapshot?data.aiReviews.filter(item=>item.snapshotId===snapshot.id).sort((a,b)=>b.revision-a.revision)[0]:undefined;
    const md=snapshot?generateReviewMarkdown(snapshot,review):generateMonthlyReport({tasks:data.tasks,taskEvents:data.taskEvents,dailyFocus:data.dailyFocus,readingItems:data.readingItems,readingEvents:data.readingEvents},year,month);
    const blob=new Blob(["\ufeff"+md],{type:"text/markdown;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=snapshot?reviewReportFileName(snapshot):monthlyReportFileName(year,month);a.click();
    URL.revokeObjectURL(url);
  }
  return <Card className="export-card"><h2>月度回顾导出</h2><p className="muted">把一个月的生活痕迹整理成一份 Markdown 报告，可以存档或贴入自己的日记系统。</p><div className="export-controls"><div className="export-period-nav"><Button variant="ghost" onClick={()=>move(-1)} aria-label="上个月">←</Button><strong className="export-range">{year} 年 {month+1} 月</strong><Button variant="ghost" onClick={()=>move(1)} aria-label="下个月">→</Button></div><Button className="export-submit" onClick={download}>导出 {year} 年 {month+1} 月报告</Button></div></Card>
}
