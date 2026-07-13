import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODEL_OPTIONS, type ModelOption } from "./generation-options";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: ModelOption;
  onSelect: (option: ModelOption) => void;
  darkMode: boolean;
};

export function ModelPicker({ open, onOpenChange, selected, onSelect, darkMode }: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-14 min-w-0 items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 text-left text-slate-700 transition-colors hover:border-emerald-500/45 hover:bg-emerald-500/[0.09] dark:text-slate-100"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-medium text-slate-400 dark:text-slate-500">
              模型
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className="truncate text-[10px] font-semibold">{selected.name}</span>
              {selected.recommended && (
                <span className="hidden shrink-0 rounded-md border border-rose-400/25 bg-rose-400/15 px-1 py-0.5 text-[7px] font-medium text-rose-500 dark:text-rose-300 2xl:inline">
                  ★推荐
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[8px] text-slate-400 dark:text-slate-500">
              {selected.summary}
            </span>
          </span>
          <span className="shrink-0 rounded-md bg-emerald-500/[0.08] px-1.5 py-1 font-mono text-[8px] font-semibold text-emerald-700 dark:text-emerald-300">
            {selected.costCredits}点
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className={`${darkMode ? "dark" : ""} max-h-[min(70vh,430px)] w-[min(410px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-border bg-popover/95 p-2 text-popover-foreground shadow-elevated backdrop-blur-2xl`}
      >
        <p className="px-2 pb-2 pt-1 text-[10px] font-medium text-muted-foreground">选择模型</p>
        <div role="radiogroup" aria-label="选择模型" className="space-y-1">
          {MODEL_OPTIONS.map((option) => {
            const active = option.value === selected.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(option)}
                className={`flex min-h-[62px] w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? "border-emerald-500/25 bg-emerald-500/[0.10]"
                    : "border-transparent hover:border-border hover:bg-white/55 dark:hover:bg-white/[0.045]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${active ? "border-emerald-500/25 bg-emerald-500/85 text-white dark:bg-emerald-300/90 dark:text-[#07120e]" : "border-slate-300/60 bg-white/65 text-slate-400 dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-slate-500"}`}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${active ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}
                    >
                      {option.name}
                    </span>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[8px] font-medium ${option.tagClassName}`}
                    >
                      {option.tag}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[9px] text-slate-500 dark:text-slate-400">
                    {option.description}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md bg-emerald-500/[0.08] px-1.5 py-1 font-mono text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {option.costCredits} 点
                  </span>
                  <Check
                    className={`h-3.5 w-3.5 ${active ? "text-emerald-700 dark:text-emerald-300" : "text-transparent"}`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
