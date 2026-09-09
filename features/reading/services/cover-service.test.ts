import {describe,expect,it,vi} from "vitest";
import {selectCover} from "./cover-service";

describe("desktop cover service",()=>{
  it("keeps matching decisions in the reading service",()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00Z"));
    expect(selectCover("The Hobbit","Tolkien",[{provider:"openlibrary",externalId:"ol1",title:"The Hobbit",authors:["J. R. R. Tolkien"],url:"https://covers.example/1.jpg"}])).toEqual({cover:{provider:"openlibrary",externalId:"ol1",url:"https://covers.example/1.jpg",matchedAt:"2026-08-24T00:00:00.000Z"}});
    vi.useRealTimers();
  });
  it("returns no_match for weak candidates",()=>expect(selectCover("The Hobbit",undefined,[{provider:"openlibrary",externalId:"ol2",title:"Another Book",authors:[],url:"https://covers.example/2.jpg"}])).toEqual({cover:null,reason:"no_match"}));
});
