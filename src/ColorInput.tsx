import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "onInput" | "onBlur"> & { value: string; onChange: (color: string) => void };

// Native pickers emit many updates while dragging. Keep those updates local;
// publish only after a short pause or when leaving the control.
export function ColorInput({ value, onChange, ...props }: Props) {
  const [draft, setDraft] = useState(value);
  const pending = useRef(value), dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(onChange);
  callback.current = onChange;
  const cancel = () => { if (timer.current !== undefined) clearTimeout(timer.current); timer.current = undefined; };
  const flush = () => { cancel(); if (dirty.current) { dirty.current = false; callback.current(pending.current); } };
  useEffect(() => { cancel(); dirty.current = false; pending.current = value; setDraft(value); }, [value]);
  useEffect(() => () => flush(), []);
  return <input {...props} type="color" value={draft} onChange={event => {
    pending.current = event.target.value;
    dirty.current = pending.current !== value;
    setDraft(pending.current);
    cancel();
    if (dirty.current) timer.current = setTimeout(flush, 150);
  }} onBlur={flush}/>;
}
