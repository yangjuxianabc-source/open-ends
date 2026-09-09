import {describe,expect,it} from "vitest";
import {mediaPosterUrl,mediaYearLabel} from "./media";

describe("Media presentation helpers",()=>{
  it("turns a TMDB poster path into an image URL and preserves full URLs",()=>{
    expect(mediaPosterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(mediaPosterUrl("https://example.test/poster.jpg")).toBe("https://example.test/poster.jpg");
    expect(mediaPosterUrl()).toBeUndefined();
  });
  it("uses release year, then release date, then a stable fallback",()=>{
    expect(mediaYearLabel(2024,"2024-01-01")).toBe("2024");
    expect(mediaYearLabel(undefined,"2023-05-01")).toBe("2023");
    expect(mediaYearLabel()).toBe("年份未知");
  });
});
