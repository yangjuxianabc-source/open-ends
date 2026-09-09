import {describe,expect,it} from "vitest";
import {windowControlLabels} from "./WindowControls";

describe("window controls",()=>{
  it("maps maximize and restore labels without changing minimize or close",()=>{
    expect(windowControlLabels(false)).toEqual({minimize:"最小化窗口",maximize:"最大化窗口",close:"关闭到托盘"});
    expect(windowControlLabels(true).maximize).toBe("恢复窗口");
  });
});
