import {describe,expect,it} from "vitest";
import type {DailyFocus,Task,TaskEvent} from "@/types";
import {buildDailyHistory,buildMonthHistory} from "./history";

const task:Task={id:"t",title:"保留历史",contextPoints:[],status:"done",domain:"project",plannedDate:"2026-08-10",createdAt:"2026-08-01T01:00:00Z",updatedAt:"2026-08-10T01:00:00Z"};
const event=(patch:Partial<TaskEvent>):TaskEvent=>({id:"e",taskId:"t",type:"created",occurredAt:"2026-08-01T01:00:00Z",localDate:"2026-08-01",timezone:"Asia/Shanghai",...patch});
const focus:DailyFocus[]=[{date:"2026-08-01",taskId:"t",assignedAt:"2026-08-01T02:00:00Z"}];

describe("calendar history",()=>{
  it("keeps the original planned date and its dated facts after rescheduling",()=>{const events=[event({toDate:"2026-08-01"}),event({id:"r",type:"rescheduled",fromDate:"2026-08-01",toDate:"2026-08-10"}),event({id:"c",type:"completed",localDate:"2026-08-10"})];const history=buildDailyHistory("2026-08-01",[task],events,focus);expect(history.planned.map(item=>item.id)).toEqual(["t"]);expect(history.rescheduledOut).toMatchObject([{task:{id:"t"},toDate:"2026-08-10"}]);expect(history.added.map(item=>item.id)).toEqual(["t"]);expect(history.completed).toEqual([]);expect(history.focus?.id).toBe("t")});
  it("builds every date in the requested month from events",()=>{const events=[event({id:"c",type:"completed",localDate:"2026-08-10"})];const month=buildMonthHistory(2026,7,[task],events,focus);expect(Object.keys(month)).toHaveLength(31);expect(month["2026-08-10"].completed.map(item=>item.id)).toEqual(["t"])});
});
