import {describe,expect,it} from "vitest";
import {createEmptyStore} from "@/lib/storage/migrate";
import {reconcileEndedSnapshots} from "./backfill";

describe("snapshot backfill",()=>{it("fills only ended periods and is idempotent",async()=>{const data=createEmptyStore();data.tasks=[{id:"t",title:"x",contextPoints:[],status:"open",domain:"work",createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z"}];let sequence=0;const first=await reconcileEndedSnapshots(data,"2026-02-03","2026-02-03T00:00:00Z",()=>`id-${++sequence}`);expect(first.periodSnapshots.some(item=>item.periodType==="monthly"&&item.periodKey==="2026-01")).toBe(true);expect(first.periodSnapshots.some(item=>item.periodType==="monthly"&&item.periodKey==="2026-02")).toBe(false);const second=await reconcileEndedSnapshots(first,"2026-02-03","2026-02-03T00:00:00Z",()=>`again-${++sequence}`);expect(second.periodSnapshots).toHaveLength(first.periodSnapshots.length)})});
