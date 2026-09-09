export function parseContextualTaskTitle(title:string){const match=title.trim().match(/^[\[【]([^\]】]{1,32})[\]】]\s*(.*)$/);return match?{context:match[1].trim(),title:match[2].trim()||title}:{title};}

export function ContextualTaskTitle({title}:{title:string}){const parsed=parseContextualTaskTitle(title);return <span className="contextual-task-title">{parsed.context?<span className="contextual-task-prefix">[{parsed.context}]</span>:null}<span>{parsed.title}</span></span>}
