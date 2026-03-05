"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CampaignOption = { id: string; campaign_name: string };

type AddForm = {
  upload_id: string;

  external_person_id: string;
  company_name: string;
  given_name: string;
  family_name: string;

  email: string;
  email_second: string;

  telephone_number: string;
  mobile_country_code: string;
  mobile_number: string;

  job_title: string;
  department: string;
  country: string;

  address_line1: string;
  city_ward: string;
  state: string;

  company_info: string;
  registered_event: string;
  visited_event: string;
};

export function AddContactDialog({
  open,
  onOpenChange,
  adding,
  addForm,
  setAddForm,
  campaignOptions,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adding: boolean;
  addForm: AddForm;
  setAddForm: React.Dispatch<React.SetStateAction<AddForm>>;
  campaignOptions: CampaignOption[];
  onCreate: () => void;
}) {
  const set = (k: keyof AddForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setAddForm((p) => ({ ...p, [k]: e.target.value }));

  const canCreate = !!addForm.upload_id && !adding;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          p-0 gap-0
          w-[min(980px,calc(100vw-24px))]
          max-h-[90vh]
          overflow-hidden
          rounded-2xl
        "
      >
        {/* ===== Header (sticky) ===== */}
        <div className="px-6 pt-6 pb-4 border-b bg-background">
          <DialogHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl">Add Contact</DialogTitle>
                <DialogDescription className="text-sm">
                  Create a new contact and <span className="font-medium">assign to me</span> with a 4h30 lease.
                </DialogDescription>
              </div>

              <div className="shrink-0">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
                  Close
                </Button>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ===== Body (scroll) ===== */}
        <ScrollArea className="h-[calc(90vh-170px)]">
          <div className="px-6 py-5">
            {/* Campaign */}
            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium mb-3">Campaign</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs opacity-70">Select campaign</div>
                  <Select
                    value={addForm.upload_id}
                    onValueChange={(v) => setAddForm((p) => ({ ...p, upload_id: v }))}
                    disabled={adding}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.campaign_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs opacity-60">Only campaigns you are assigned to are shown.</div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs opacity-70">Person ID</div>
                  <Input value={addForm.external_person_id} onChange={set("external_person_id")} disabled={adding} />
                </div>
              </div>
            </div>

            <div className="my-5">
              <Separator />
            </div>

            {/* Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Company Name">
                <Input value={addForm.company_name} onChange={set("company_name")} disabled={adding} />
              </Field>

              <Field label="Given Name">
                <Input value={addForm.given_name} onChange={set("given_name")} disabled={adding} />
              </Field>

              <Field label="Family Name">
                <Input value={addForm.family_name} onChange={set("family_name")} disabled={adding} />
              </Field>

              <Field label="Job Title">
                <Input value={addForm.job_title} onChange={set("job_title")} disabled={adding} />
              </Field>

              <Field label="Department">
                <Input value={addForm.department} onChange={set("department")} disabled={adding} />
              </Field>

              <Field label="Country">
                <Input value={addForm.country} onChange={set("country")} disabled={adding} />
              </Field>
            </div>

            <div className="my-5">
              <Separator />
            </div>

            {/* Contact channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Email">
                <Input value={addForm.email} onChange={set("email")} disabled={adding} />
              </Field>

              <Field label="Email (Second)">
                <Input value={addForm.email_second} onChange={set("email_second")} disabled={adding} />
              </Field>

              <Field label="Telephone Number">
                <Input value={addForm.telephone_number} onChange={set("telephone_number")} disabled={adding} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile CC">
                  <Input value={addForm.mobile_country_code} onChange={set("mobile_country_code")} disabled={adding} />
                </Field>
                <Field label="Mobile Number">
                  <Input value={addForm.mobile_number} onChange={set("mobile_number")} disabled={adding} />
                </Field>
              </div>
            </div>

            <div className="my-5">
              <Separator />
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Field label="Address Line 1">
                  <Input value={addForm.address_line1} onChange={set("address_line1")} disabled={adding} />
                </Field>
              </div>

              <Field label="City">
                <Input value={addForm.city_ward} onChange={set("city_ward")} disabled={adding} />
              </Field>

              <Field label="State">
                <Input value={addForm.state} onChange={set("state")} disabled={adding} />
              </Field>
            </div>

            <div className="my-5">
              <Separator />
            </div>

            {/* Extra */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Field label="Company Info">
                  <Textarea
                    value={addForm.company_info}
                    onChange={set("company_info")}
                    disabled={adding}
                    rows={3}
                  />
                </Field>
              </div>

              <Field label="Registered Event">
                <Input value={addForm.registered_event} onChange={set("registered_event")} disabled={adding} />
              </Field>

              <Field label="Visited Event">
                <Input value={addForm.visited_event} onChange={set("visited_event")} disabled={adding} />
              </Field>
            </div>

            <div className="mt-6 rounded-xl bg-muted/30 border p-4 text-sm">
              <div className="font-medium">Behavior</div>
              <div className="mt-1 text-xs opacity-70">
                The new contact is created with status <span className="font-medium">NEW</span>, assigned to you, and leased for{" "}
                <span className="font-medium">4h30</span> — it will appear in “My Queue” immediately.
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* ===== Footer (sticky) ===== */}
        <div className="border-t bg-background px-6 py-4">
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!canCreate}>
              {adding ? "Creating..." : "Create & Assign to Me"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs opacity-70">{label}</div>
      {children}
    </div>
  );
}