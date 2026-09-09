import {describe,expect,it} from "vitest";
import {sha256Hex,stableStringify} from "./hash";

describe("stableStringify",()=>{it("sorts object keys recursively without reordering arrays",()=>{expect(stableStringify({z:1,a:{d:2,b:3},items:[{y:1,x:2}]})).toBe('{"a":{"b":3,"d":2},"items":[{"x":2,"y":1}],"z":1}')})});
describe("sha256Hex",()=>{it("returns a stable SHA-256 digest",async()=>{expect(await sha256Hex("open-ends")).toBe("5b880fc3867fc505f719054af5cd1e8d7ea40356a5da32ac193f880ec05d1760")})});
