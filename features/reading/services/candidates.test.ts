import {describe,expect,it} from "vitest";
import {rankReadingCandidates,type ReadingCandidate} from "./candidates";

function candidate(overrides:Partial<ReadingCandidate>={}):ReadingCandidate{
  return {provider:"google",externalId:"id",title:"书名",authors:[],...overrides};
}

describe("rankReadingCandidates",()=>{
  it("puts the Chinese title and author before a translated edition",()=>{
    const ranked=rankReadingCandidates("三体","刘慈欣",[
      candidate({externalId:"en",title:"The Three-Body Problem",authors:["Liu Cixin"]}),
      candidate({externalId:"zh",title:"三体",authors:["刘慈欣"]}),
    ]);
    expect(ranked[0].externalId).toBe("zh");
  });

  it("matches a subtitle by its normalized title stem",()=>{
    const ranked=rankReadingCandidates("置身事内","兰小欢",[
      candidate({externalId:"other",title:"置身事外",authors:["其他作者"]}),
      candidate({externalId:"target",title:"置身事内：中国政府与经济发展",authors:["兰小欢"]}),
    ]);
    expect(ranked[0].title).toBe("置身事内：中国政府与经济发展");
  });

  it("keeps the exact English edition first",()=>{
    const ranked=rankReadingCandidates("The Great Gatsby","F. Scott Fitzgerald",[
      candidate({externalId:"translated",title:"了不起的盖茨比",authors:["F. Scott Fitzgerald"]}),
      candidate({externalId:"english",title:"The Great Gatsby",authors:["F. Scott Fitzgerald"]}),
    ]);
    expect(ranked[0].externalId).toBe("english");
  });

  it("limits the returned candidates to five",()=>{
    const ranked=rankReadingCandidates("三体",undefined,Array.from({length:7},(_,index)=>candidate({externalId:`id-${index}`,title:`三体 ${index}`})));
    expect(ranked).toHaveLength(5);
  });
});
