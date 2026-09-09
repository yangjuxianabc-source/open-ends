export function mediaPosterUrl(posterPath?:string){
  if(!posterPath)return undefined;
  return posterPath.startsWith("http")?posterPath:`https://image.tmdb.org/t/p/w342${posterPath}`;
}

export function mediaYearLabel(releaseYear?:number,releaseDate?:string){
  if(releaseYear)return String(releaseYear);
  return releaseDate?.slice(0,4)||"年份未知";
}
