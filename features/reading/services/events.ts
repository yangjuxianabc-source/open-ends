import type {ReadingEventType,ReadingStatus} from "@/types";

export function readingTransition(from:ReadingStatus,to:ReadingStatus):ReadingEventType|undefined{
  if(to==="reading")return from==="finished"?"restarted":from==="paused"?"resumed":"started";
  if(to==="finished")return "finished";
  if(to==="paused")return "paused";
  if(to==="dropped")return "dropped";
  return undefined;
}
