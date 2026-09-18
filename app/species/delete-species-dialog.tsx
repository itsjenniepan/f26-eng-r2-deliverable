"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Species = Database["public"]["Tables"]["species"]["Row"];

// Stretch goal: delete a species. Only rendered for the author, and requires an explicit confirmation click.
export default function DeleteSpeciesDialog({ species }: { species: Species }) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createBrowserSupabaseClient();
    // As in the edit dialog, .select() lets us detect a row-level-security no-op (0 rows deleted, no error).
    const { data, error } = await supabase.from("species").delete().eq("id", species.id).select();
    setIsDeleting(false);

    if (error !== null || data.length === 0) {
      return toast({
        title: "Something went wrong.",
        description: error?.message ?? "You can only delete species that you added.",
        variant: "destructive",
      });
    }

    setOpen(false);
    router.refresh();
    return toast({
      title: "Species deleted",
      description: "Successfully deleted " + species.scientific_name + ".",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="flex-1">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {species.scientific_name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the species from Biodiversity Hub and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void handleDelete()}>
            {isDeleting ? "Deleting..." : "Yes, delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
