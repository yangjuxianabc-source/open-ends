import type {ReadingCover} from "@/types";
import {searchBookCovers,type DesktopCoverCandidate} from "@/lib/desktop/tauri-client";
import {bestCoverMatch,isConfidentCoverMatch} from "./cover-match";

export type CoverLookupResult={cover:ReadingCover|null;reason?:"source_unavailable"|"no_match"};

export async function lookupReadingCover(title:string,author?:string):Promise<CoverLookupResult>{
  try{return selectCover(title,author,await searchBookCovers(title,author))}
  catch{return {cover:null,reason:"source_unavailable"}}
}

export function selectCover(title:string,author:string|undefined,candidates:DesktopCoverCandidate[]):CoverLookupResult{
  const match=bestCoverMatch(title,author,candidates);
  if(!match||!isConfidentCoverMatch(title,author,match)||!match.url)return {cover:null,reason:"no_match"};
  return {cover:{provider:match.provider,externalId:match.externalId,url:match.url,matchedAt:new Date().toISOString()}};
}
