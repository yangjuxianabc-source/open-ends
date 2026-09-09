import {describe,expect,it} from "vitest";
import {createEmptyStore} from "@/lib/storage/migrate";
import type {PeriodSnapshot} from "@/types";
import {buildReviewGenerationInput,reviewInputHash} from "./comparison";

const snapshot=(type:PeriodSnapshot["periodType"],key:string,start:string,end:string,sourceHash=key):PeriodSnapshot=>({
  id:`${type}-${key}`,periodType:type,periodKey:key,periodStart:start,periodEnd:end,revision:1,sourceHash,factsJson:JSON.stringify({key}),createdAt:`${end}T23:00:00Z`,
});

describe("Review historical comparison input",()=>{
  it("uses the previous four weeks and six months",()=>{
    const data=createEmptyStore();
    data.periodSnapshots=[
      ...Array.from({length:6},(_,index)=>snapshot("weekly",`w${index}`,`2026-07-${String(6+index*7).padStart(2,"0")}`,`2026-07-${String(12+index*7).padStart(2,"0")}`)),
      ...Array.from({length:8},(_,index)=>snapshot("monthly",`2026-${String(index+1).padStart(2,"0")}`,`2026-${String(index+1).padStart(2,"0")}-01`,`2026-${String(index+1).padStart(2,"0")}-28`)),
    ];
    const weekly=snapshot("weekly","current","2026-08-24","2026-08-30");
    const monthly=snapshot("monthly","2026-09","2026-09-01","2026-09-30");
    expect(buildReviewGenerationInput(data,weekly).comparison.previous).toHaveLength(4);
    expect(buildReviewGenerationInput(data,monthly).comparison.previous).toHaveLength(6);
  });

  it("changes the input hash when historical facts change",async()=>{
    const data=createEmptyStore();
    const current=snapshot("weekly","current","2026-08-24","2026-08-30","same-current");
    data.periodSnapshots=[snapshot("weekly","previous","2026-08-17","2026-08-23","old-history")];
    const first=await reviewInputHash(buildReviewGenerationInput(data,current));
    data.periodSnapshots=[snapshot("weekly","previous","2026-08-17","2026-08-23","new-history")];
    const second=await reviewInputHash(buildReviewGenerationInput(data,current));
    expect(second).not.toBe(first);
  });

  it("includes monthly trajectory, previous year and long-term baseline for yearly review",()=>{
    const data=createEmptyStore();
    data.periodSnapshots=[
      snapshot("monthly","2026-01","2026-01-01","2026-01-31"),
      snapshot("monthly","2026-02","2026-02-01","2026-02-28"),
      snapshot("yearly","2025","2025-01-01","2025-12-31"),
      snapshot("yearly","2024","2024-01-01","2024-12-31"),
    ];
    const input=buildReviewGenerationInput(data,snapshot("yearly","2026","2026-01-01","2026-12-31"));
    expect(input.comparison.monthlyTrajectory).toHaveLength(2);
    expect(input.comparison.previousYear?.periodKey).toBe("2025");
    expect(input.comparison.longTermBaseline.map(item=>item.periodKey)).toEqual(["2024","2025"]);
  });
});
