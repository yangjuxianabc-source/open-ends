import {deleteCredential,getCredentialStatus,isDesktopRuntime,saveCredential} from "@/lib/desktop/tauri-client";

export const providerAvailable=isDesktopRuntime;
export const getDeepSeekStatus=()=>getCredentialStatus("deepseek");
export const saveDeepSeekKey=(apiKey:string)=>saveCredential("deepseek",apiKey);
export const deleteDeepSeekKey=()=>deleteCredential("deepseek");
export const getTmdbStatus=()=>getCredentialStatus("tmdb");
export const saveTmdbToken=(token:string)=>saveCredential("tmdb",token);
export const deleteTmdbToken=()=>deleteCredential("tmdb");
