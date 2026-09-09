function normalize(value:unknown):unknown{
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,normalize(item)]));
  }
  return value;
}

export const stableStringify=(value:unknown)=>JSON.stringify(normalize(value));

export async function sha256Hex(value:string):Promise<string>{
  const bytes=new TextEncoder().encode(value);
  const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
