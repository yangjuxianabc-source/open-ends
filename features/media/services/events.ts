import type {MediaEventType,MediaStatus} from "@/types";

export function mediaTransition(from:MediaStatus,to:MediaStatus):MediaEventType|undefined{
  if(to==="watching")return from==="finished"?"restarted":from==="paused"?"resumed":"started";
  if(to==="finished")return "finished";
  if(to==="paused")return "paused";
  if(to==="dropped")return "dropped";
  return undefined;
}
