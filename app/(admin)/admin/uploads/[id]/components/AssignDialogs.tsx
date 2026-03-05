"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Tele } from "../lib/types";

export default function AssignDialogs(props: {
  loading: boolean;
  memberTeles: Tele[];

  // single
  assignOpen: boolean;
  setAssignOpen: (b: boolean) => void;
  assignTeleId: string;
  setAssignTeleId: (v: string) => void;
  onConfirmAssign: () => Promise<void>;

  // bulk
  bulkAssignOpen: boolean;
  setBulkAssignOpen: (b: boolean) => void;
  bulkAssignTeleId: string;
  setBulkAssignTeleId: (v: string) => void;
  selectedCount: number;
  onConfirmBulkAssign: () => Promise<void>;
}) {
  const {
    loading,
    memberTeles,

    assignOpen,
    setAssignOpen,
    assignTeleId,
    setAssignTeleId,
    onConfirmAssign,

    bulkAssignOpen,
    setBulkAssignOpen,
    bulkAssignTeleId,
    setBulkAssignTeleId,
    selectedCount,
    onConfirmBulkAssign,
  } = props;

  return (
    <>
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Assign Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto pr-2">
            <div className="text-sm opacity-70">Pick a tele agent (only agents with campaign access)</div>

            <Select value={assignTeleId} onValueChange={setAssignTeleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tele" />
              </SelectTrigger>
              <SelectContent>
                {memberTeles.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={onConfirmAssign} disabled={loading}>
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Bulk Assign</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto pr-2">
            <div className="text-sm opacity-70">
              Assign <b>{selectedCount}</b> contacts to:
            </div>

            <Select value={bulkAssignTeleId} onValueChange={setBulkAssignTeleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tele" />
              </SelectTrigger>
              <SelectContent>
                {memberTeles.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={onConfirmBulkAssign} disabled={loading || selectedCount === 0}>
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}