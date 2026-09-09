import {describe,expect,it} from "vitest";
import type {Task,TaskEvent} from "@/types";
import {generateMonthlyReport} from "./monthlyReport";

const task:Task={id:"t",title:"完成数据基座",contextPoints:[],status:"done",domain:"project",plannedDate:"2026-07-05",createdAt:"2026-07-01T00:00:00Z",updatedAt:"2026-07-05T00:00:00Z",completedAt:"2026-07-05T00:00:00Z"};
const event:TaskEvent={id:"e",taskId:"t",type:"completed",occurredAt:"2026-07-04T16:30:00Z",localDate:"2026-07-05",timezone:"Asia/Shanghai"};
describe("monthly report",()=>{it("exports deterministic facts without legacy subjective text",()=>{const output=generateMonthlyReport({tasks:[task],taskEvents:[event],dailyFocus:[{date:"2026-07-05",taskId:"t",assignedAt:""}],readingItems:[],readingEvents:[]},2026,6);expect(output).toContain("唯一完成任务：1");expect(output).toContain("Daily Focus：1 / 1");expect(output).toContain("完成数据基座（项目）");expect(output).toContain("未调用 AI")})});
