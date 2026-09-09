"use client";
import { useState } from "react";
import { useOpenEnds } from "@/lib/storage/store";
import type { TaskDomain } from "@/types";
import { taskDomainOptions } from "./taskDomains";
import {SelectMenu} from "@/components/ui/SelectMenu";

export function TaskInput({ date }: { date?: string }) {
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<TaskDomain>("other");
  const { addTask } = useOpenEnds();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTask(title, date, domain);
    setTitle("");
    setDomain("other");
  }
  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-add-fields">
        <label className="sr-only" htmlFor="new-task">任务标题</label>
        <input id="new-task" className="field" value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="写下一件最小的事…" />
        <SelectMenu className={`quick-add-domain domain-${domain}`} label="领域" ariaLabel="任务领域" value={domain} onChange={value=>setDomain(value as TaskDomain)} options={taskDomainOptions.map(([value,label])=>({value,label}))}/>
      </div>
      <button className="primary-button" type="submit">添加到今天</button>
    </form>
  );
}
