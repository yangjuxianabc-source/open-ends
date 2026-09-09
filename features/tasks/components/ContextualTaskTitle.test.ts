import {describe,expect,it} from "vitest";
import {parseContextualTaskTitle} from "./ContextualTaskTitle";

describe("parseContextualTaskTitle",()=>{
  it("separates square and Chinese bracket project prefixes",()=>{
    expect(parseContextualTaskTitle("[inktrail] 统一正文显示")).toEqual({context:"inktrail",title:"统一正文显示"});
    expect(parseContextualTaskTitle("【未了】收口 1.0")).toEqual({context:"未了",title:"收口 1.0"});
  });
  it("does not invent a context for ordinary titles",()=>{expect(parseContextualTaskTitle("整理桌面")).toEqual({title:"整理桌面"})});
});
