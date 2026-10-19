import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import { observeBackupReminder, readBackupReminder, saveBackupReminder, advanceBackupWork, backupReminderDue, markBackupCreated, type BackupReminderState } from "./backupReminder";
export function useBackupReminder(project:ComicProject|null){
  const current=useRef<{id:string;state:BackupReminderState}|null>(null),[due,setDue]=useState(false);
  useEffect(()=>{
    if(!project){current.current=null;setDue(false);return;}
    const previous=current.current?.id===project.id?current.current.state:readBackupReminder(project.id);
    const state=observeBackupReminder(previous,project);current.current={id:project.id,state};saveBackupReminder(project.id,state);setDue(backupReminderDue(state));
  },[project]);
  useEffect(()=>{
    if(!project)return;
    let last=performance.now(),activity=last;
    const active=()=>{activity=performance.now();};
    const events=["pointerdown","keydown","input","wheel"] as const;
    events.forEach(name=>window.addEventListener(name,active,{passive:true}));
    const timer=window.setInterval(()=>{
      const now=performance.now(),elapsed=now-last;last=now;
      if(document.visibilityState==="hidden"||!document.hasFocus()||now-activity>60_000||current.current?.id!==project.id)return;
      const state=advanceBackupWork(current.current.state,elapsed);current.current={id:project.id,state};saveBackupReminder(project.id,state);setDue(backupReminderDue(state));
    },15_000);
    return()=>{window.clearInterval(timer);events.forEach(name=>window.removeEventListener(name,active));};
  },[project?.id]);
  return {due,created:()=>{if(project){const state=markBackupCreated(project);current.current={id:project.id,state};setDue(false);}}};
}
