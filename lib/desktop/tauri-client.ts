export type DesktopWindowLabel="main"|"todo-panel"|"spark-capture";
export interface CredentialStatus{configured:boolean;verification?:"verified"|"unverified";updatedAt?:string;model?:string}
export interface ShortcutSettings{todoPanel:string;sparkCapture:string;issues:string[]}
export interface DesktopCoverCandidate{provider:"google"|"openlibrary";externalId:string;title:string;authors:string[];url?:string;publisher?:string;publishedDate?:string;isbn10?:string;isbn13?:string}
export interface DesktopMediaCandidate{tmdbId:number;mediaType:"movie"|"tv";title:string;originalTitle?:string;releaseDate?:string;releaseYear?:number;posterPath?:string;genreIds:number[];originalLanguage?:string}

export function isDesktopRuntime(){return typeof window!=="undefined"&&"__TAURI_INTERNALS__" in window}

async function invokeDesktop<T>(command:string,args:Record<string,unknown>={}):Promise<T>{
  if(!isDesktopRuntime())throw new Error("DESKTOP_RUNTIME_REQUIRED");
  const {invoke}=await import("@tauri-apps/api/core");return invoke<T>(command,args);
}

export const showDesktopWindow=(label:DesktopWindowLabel,route?:string)=>invokeDesktop<void>("show_desktop_window",{label,route});
export const hideCurrentWindow=()=>invokeDesktop<void>("hide_current_window");
export const minimizeCurrentWindow=()=>invokeDesktop<void>("minimize_current_window");
export const toggleMaximizeCurrentWindow=()=>invokeDesktop<boolean>("toggle_maximize_current_window");
export const isCurrentWindowMaximized=()=>invokeDesktop<boolean>("is_current_window_maximized");
export const startCurrentWindowDragging=()=>invokeDesktop<void>("start_current_window_dragging");
export const getTodoPanelPinned=()=>invokeDesktop<boolean>("get_todo_panel_pinned");
export const setTodoPanelPinned=(pinned:boolean)=>invokeDesktop<void>("set_todo_panel_pinned",{pinned});
export const setTodoPanelInteraction=(pointerInside:boolean,interactionLock:boolean)=>invokeDesktop<void>("set_todo_panel_interaction",{pointerInside,interactionLock});
export const getShortcutSettings=()=>invokeDesktop<ShortcutSettings>("get_shortcut_settings");
export const updateShortcutSettings=(settings:ShortcutSettings)=>invokeDesktop<ShortcutSettings>("update_shortcut_settings",{settings});
export const getAutostartEnabled=()=>invokeDesktop<boolean>("get_autostart_enabled");
export const setAutostartEnabled=(enabled:boolean)=>invokeDesktop<boolean>("set_autostart_enabled",{enabled});
export const getCredentialStatus=(kind:"deepseek"|"tmdb")=>invokeDesktop<CredentialStatus>("credential_status",{kind});
export const saveCredential=(kind:"deepseek"|"tmdb",value:string)=>invokeDesktop<CredentialStatus>("save_credential",{kind,value});
export const deleteCredential=(kind:"deepseek"|"tmdb")=>invokeDesktop<CredentialStatus>("delete_credential",{kind});
export const deepseekRequest=<T>(payload:unknown)=>invokeDesktop<T>("deepseek_request",{payload});
export const writeDataBackup=(contents:string,manual=false)=>invokeDesktop<string>("write_data_backup",{contents,manual});
export const searchBookCovers=(title:string,author?:string)=>invokeDesktop<DesktopCoverCandidate[]>("search_book_covers",{title,author});
export const searchTmdb=(query:string,mediaTypeHint?:"movie"|"tv"|"unknown")=>invokeDesktop<DesktopMediaCandidate[]>("search_tmdb",{query,mediaTypeHint});

export async function emitStoreChanged(origin:string){if(!isDesktopRuntime())return;const {emit}=await import("@tauri-apps/api/event");await emit("open-ends:store-changed",{origin})}
export async function listenStoreChanged(handler:(origin:string)=>void){
  if(!isDesktopRuntime())return ()=>{};
  const {listen}=await import("@tauri-apps/api/event");return listen<{origin:string}>("open-ends:store-changed",event=>handler(event.payload.origin));
}
export async function listenDesktopNavigation(handler:(route:string)=>void){
  if(!isDesktopRuntime())return ()=>{};
  const {listen}=await import("@tauri-apps/api/event");return listen<string>("desktop:navigate",event=>handler(event.payload));
}
