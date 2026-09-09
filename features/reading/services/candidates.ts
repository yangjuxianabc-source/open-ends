import {searchBookCovers,type DesktopCoverCandidate} from "@/lib/desktop/tauri-client";

export type ReadingCandidate=DesktopCoverCandidate;

const punctuation=/[\s·:：,，.。!?！？'“”"《》()（）[\]【】\-_—]/g;

export function normalizeReadingText(value:string){
  return value.normalize("NFKC").toLocaleLowerCase().replace(punctuation,"");
}

function titleStem(value:string){
  return normalizeReadingText(value.split(/[:：]/,1)[0]);
}

function hasChinese(value:string){
  return /[\u3400-\u9fff]/u.test(value);
}

function candidateScore(title:string,author:string|undefined,candidate:ReadingCandidate){
  const query=normalizeReadingText(title);
  const queryStem=titleStem(title);
  const candidateTitle=normalizeReadingText(candidate.title);
  const candidateStem=titleStem(candidate.title);
  const authors=candidate.authors.map(normalizeReadingText);
  let score=0;
  if(candidateTitle===query)score+=100;
  else if(candidateStem===queryStem)score+=82;
  else if(candidateTitle.includes(query)||query.includes(candidateStem))score+=50;
  if(author){
    const queryAuthor=normalizeReadingText(author);
    if(authors.some(value=>value===queryAuthor))score+=60;
    else if(authors.some(value=>value.includes(queryAuthor)||queryAuthor.includes(value)))score+=35;
  }
  if(hasChinese(title)){
    if(hasChinese(candidate.title))score+=24;
    if(candidate.authors.some(hasChinese))score+=12;
  }else if(!hasChinese(candidate.title))score+=12;
  if(candidate.url)score+=3;
  return score;
}

export function rankReadingCandidates(title:string,author:string|undefined,candidates:ReadingCandidate[]){
  return candidates.map((candidate,index)=>({candidate,index,score:candidateScore(title,author,candidate)}))
    .sort((left,right)=>right.score-left.score||left.index-right.index)
    .slice(0,5)
    .map(item=>item.candidate);
}

export async function searchReadingCandidates(title:string,author?:string):Promise<ReadingCandidate[]>{
  const candidates=await searchBookCovers(title,author);
  return rankReadingCandidates(title,author,candidates);
}
