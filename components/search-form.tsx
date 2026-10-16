"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import type { EmploymentPreference, SeniorityPreference } from "@/lib/types";

export interface FormState {
  role: string;
  location: string;
  seniority: SeniorityPreference;
  employment: EmploymentPreference;
  keywords: string;
}

export const DEFAULT_FORM: FormState = {
  role: "Software Engineer",
  location: "Bengaluru, India",
  seniority: "entry",
  employment: "internship",
  keywords: "React, TypeScript, Python",
};

interface Props {
  value: FormState;
  onChange: (v: FormState) => void;
  onSubmit: () => void;
  busy: boolean;
  disabledReason?: string;
}

export function SearchForm({ value, onChange, onSubmit, busy, disabledReason }: Props) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => onChange({ ...value, [k]: v });
  const invalid = value.role.trim().length < 2;

  return (
    <form
      aria-labelledby="search-h"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2 id="search-h" className="mb-4 text-sm font-medium">What are you looking for?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="role">Role / title</Label>
          <Input id="role" value={value.role} onChange={(e) => set("role", e.target.value)} required minLength={2} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="loc">Location</Label>
          <Input id="loc" value={value.location} onChange={(e) => set("location", e.target.value)} placeholder="City, country or Remote" maxLength={120} />
        </div>
        <div>
          <Label htmlFor="sen">Seniority</Label>
          <Select id="sen" value={value.seniority} onChange={(e) => set("seniority", e.target.value as SeniorityPreference)}>
            <option value="any">Any</option>
            <option value="intern">Intern</option>
            <option value="entry">Entry / graduate</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead / manager</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="emp">Type</Label>
          <Select id="emp" value={value.employment} onChange={(e) => set("employment", e.target.value as EmploymentPreference)}>
            <option value="any">Internship or full-time</option>
            <option value="internship">Internship</option>
            <option value="full-time">Full-time</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="kw">Skills / keywords (comma-separated)</Label>
          <Input id="kw" value={value.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="React, TypeScript, Python" maxLength={300} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || invalid || !!disabledReason}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {busy ? "Searching…" : "Find Opportunities"}
        </Button>
        {disabledReason && <span className="text-xs text-muted">{disabledReason}</span>}
      </div>
    </form>
  );
}
