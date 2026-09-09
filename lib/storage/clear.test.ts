import {describe,expect,it} from "vitest";
import {clearBusinessData,createEmptyStore} from "./migrate";

describe("clearBusinessData",()=>{
  it("clears every business collection while preserving app settings",()=>{
    const store=createEmptyStore();
    store.appSettings={"credential.deepseek.updatedAt":"2026-08-24T00:00:00Z","desktop.autostart":true};
    store.tasks=[{id:"t",title:"task",contextPoints:[],status:"open",domain:"work",createdAt:"2026-08-24T00:00:00Z",updatedAt:"2026-08-24T00:00:00Z"}];
    store.taskEvents=[{id:"te",taskId:"t",type:"created",occurredAt:"2026-08-24T00:00:00Z",localDate:"2026-08-24",timezone:"Asia/Shanghai"}];
    store.dailyFocus=[{date:"2026-08-24",taskId:"t",assignedAt:"2026-08-24T00:00:00Z"}];
    store.sparks=[{id:"s",content:"idea",status:"inbox",createdAt:"2026-08-24T00:00:00Z"}];
    store.readingItems=[{id:"r",title:"book",type:"book",status:"want",createdAt:"2026-08-24T00:00:00Z",updatedAt:"2026-08-24T00:00:00Z"}];
    store.mediaItems=[{id:"m",tmdbId:1,mediaType:"movie",title:"film",genreIds:[],status:"want",createdAt:"2026-08-24T00:00:00Z",updatedAt:"2026-08-24T00:00:00Z"}];
    store.periodSnapshots=[{id:"p",periodType:"weekly",periodKey:"2026-W34",periodStart:"2026-08-17",periodEnd:"2026-08-23",revision:1,sourceHash:"hash",factsJson:"{}",createdAt:"2026-08-24T00:00:00Z"}];
    const cleared=clearBusinessData(store);

    expect(cleared).toEqual({...createEmptyStore(),appSettings:store.appSettings});
    expect(cleared).not.toBe(store);
    expect(cleared.appSettings).not.toBe(store.appSettings);
  });
});
