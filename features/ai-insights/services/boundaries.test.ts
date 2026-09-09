import {describe,expect,it} from "vitest";
import {latestCompletedProfileBoundaries,pendingProfileBoundaries} from "./boundaries";

describe("Living Profile completed boundaries",()=>{
  it("returns only the latest completed week, month and year",()=>{
    expect(latestCompletedProfileBoundaries("2026-08-28")).toEqual(["2026-08-23","2026-07-31","2025-12-31"]);
  });
  it("deduplicates the same evidence end and skips existing profiles",()=>{
    expect(latestCompletedProfileBoundaries("2027-01-01")).toEqual(["2026-12-27","2026-12-31"]);
    expect(pendingProfileBoundaries("2027-01-01",["2026-12-31"])).toEqual(["2026-12-27"]);
  });
});
