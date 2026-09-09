import {describe,expect,it} from "vitest";
import {mediaTransition} from "./events";

describe("Media event semantics",()=>{
  it("records start, resume and rewatch distinctly",()=>{
    expect(mediaTransition("want","watching")).toBe("started");
    expect(mediaTransition("paused","watching")).toBe("resumed");
    expect(mediaTransition("finished","watching")).toBe("restarted");
  });
  it("records finish, pause and drop",()=>{
    expect(mediaTransition("watching","finished")).toBe("finished");
    expect(mediaTransition("watching","paused")).toBe("paused");
    expect(mediaTransition("watching","dropped")).toBe("dropped");
  });
});
