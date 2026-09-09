import {describe,expect,it} from "vitest";
import {readingTransition} from "./events";

describe("Reading event semantics",()=>{
  it("records start, resume and restart distinctly",()=>{
    expect(readingTransition("want","reading")).toBe("started");
    expect(readingTransition("paused","reading")).toBe("resumed");
    expect(readingTransition("finished","reading")).toBe("restarted");
  });
  it("records terminal and pause transitions",()=>{
    expect(readingTransition("reading","finished")).toBe("finished");
    expect(readingTransition("reading","paused")).toBe("paused");
    expect(readingTransition("reading","dropped")).toBe("dropped");
  });
});
