import { describe,expect,it } from "vitest";
import { isConfidentCoverMatch,type CoverCandidate } from "./cover-match";
const candidate:CoverCandidate={provider:"openlibrary",externalId:"/works/1",title:"百年孤独",authors:["加西亚·马尔克斯"],url:"https://example.com/cover.jpg"};
describe("cover confidence",()=>{
  it("accepts normalized title and author",()=>expect(isConfidentCoverMatch("《百年孤独》","加西亚 马尔克斯",candidate)).toBe(true));
  it("allows an exact translated title when the source uses another author language",()=>expect(isConfidentCoverMatch("百年孤独","另一位作者",candidate)).toBe(true));
  it("still rejects a near-title result when author differs",()=>expect(isConfidentCoverMatch("百年孤独插图版","另一位作者",candidate)).toBe(false));
  it("requires an exact title when no author is supplied",()=>expect(isConfidentCoverMatch("百年",undefined,candidate)).toBe(false));
});
