"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AddCompanySheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success(`${name.trim()} added`);
        setName("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Couldn't add that company — try again");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus />
          Add company
        </Button>
      </SheetTrigger>
      <SheetContent>
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Add a company</SheetTitle>
            <SheetDescription>
              You&apos;ll send reports for this company&apos;s employees separately from your other companies.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 px-4">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Manufacturing Ltd"
              autoFocus
            />
          </div>
          <SheetFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Adding…" : "Add company"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
