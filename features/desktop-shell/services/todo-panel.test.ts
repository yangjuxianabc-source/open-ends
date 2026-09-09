import {describe,expect,it} from "vitest";
import {getTodoPanelViewModel} from "./todo-panel";
import type {DailyFocus,Task} from "@/types";

const task=(id:string,status:Task["status"],plannedDate:string):Task=>({id,title:id,contextPoints:[],status,domain:"work",plannedDate,createdAt:"2026-08-24T00:00:00Z",updatedAt:"2026-08-24T00:00:00Z"});

describe("TodoPanel view model",()=>{
  const focus:DailyFocus[]=[{date:"2026-08-24",taskId:"a",assignedAt:"2026-08-24T00:00:00Z"}];

  it("keeps a completed Daily Focus visible",()=>{
    const result=getTodoPanelViewModel([task("a","done","2026-08-24")],focus,"2026-08-24");
    expect(result.focus?.id).toBe("a");
    expect(result.others).toEqual([]);
  });

  it("keeps completed Focus out of other open tasks",()=>{
    const result=getTodoPanelViewModel([task("a","done","2026-08-24"),task("b","open","2026-08-24")],focus,"2026-08-24");
    expect(result.focus?.id).toBe("a");
    expect(result.others.map(item=>item.id)).toEqual(["b"]);
  });
});
