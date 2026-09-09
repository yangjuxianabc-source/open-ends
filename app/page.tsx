"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
export default function Home(){const router=useRouter();useEffect(()=>router.replace("/today"),[router]);return <main className="page"><p className="muted">正在打开今天…</p></main>}
