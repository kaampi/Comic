import type { Locale } from "./settings";

export function PageGridControls({columns,rows,custom,locale,onChange}:{columns:number;rows:number;custom:boolean;locale:Locale;onChange:(columns:number,rows:number)=>void}) {
  const sv=locale==="sv";
  const fields=[{value:columns,min:2,max:6,label:sv?"Kolumner":"Columns"},{value:rows,min:2,max:8,label:sv?"Rader":"Rows"}];
  return <div className="grid-settings page-grid-dimensions" role="group" aria-label={sv?"Sidans rutnät":"Page grid"}>
    {fields.map((field,index)=><div className="page-grid-field" key={field.label}>
      {index===1?<span className="page-grid-times" aria-hidden="true">×</span>:null}
      <div className="page-grid-number">
        <input type="number" aria-label={field.label} min={field.min} max={field.max} step="1" value={field.value} onChange={e=>{const value=e.currentTarget.valueAsNumber;if(Number.isFinite(value))onChange(index?columns:value,index?value:rows);}}/>
        <div className="page-grid-steppers">
          <button type="button" aria-label={`${sv?"Öka":"Increase"} ${field.label.toLowerCase()}`} disabled={field.value>=field.max} onClick={()=>onChange(index?columns:field.value+1,index?field.value+1:rows)}>▴</button>
          <button type="button" aria-label={`${sv?"Minska":"Decrease"} ${field.label.toLowerCase()}`} disabled={field.value<=field.min} onClick={()=>onChange(index?columns:field.value-1,index?field.value-1:rows)}>▾</button>
        </div>
      </div>
    </div>)}
    <span className="page-grid-mode">({custom?"Custom":"Preset"})</span>
  </div>;
}
