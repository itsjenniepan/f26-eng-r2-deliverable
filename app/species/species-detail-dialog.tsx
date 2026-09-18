"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/schema";
import Image from "next/image";

type Species = Database["public"]["Tables"]["species"]["Row"];

// Read-only "Learn More" popup showing every field of a species (Feature 1).
export default function SpeciesDetailDialog({ species }: { species: Species }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full">Learn More</Button>
      </DialogTrigger>
      {/* max-h + overflow-y-auto keeps long descriptions scrollable on short viewports */}
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{species.scientific_name}</DialogTitle>
          <DialogDescription className="text-lg italic">
            {species.common_name ?? "No common name available"}
          </DialogDescription>
        </DialogHeader>
        {species.image && (
          <div className="relative h-56 w-full">
            <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
          </div>
        )}
        <dl className="grid gap-4">
          <div>
            <dt className="font-semibold">Kingdom</dt>
            <dd>{species.kingdom}</dd>
          </div>
          <div>
            <dt className="font-semibold">Total population</dt>
            {/* `??` (not `||`) so a legitimate population of 0 is still displayed */}
            <dd>{species.total_population?.toLocaleString() ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Description</dt>
            <dd className="whitespace-pre-wrap">{species.description ?? "No description available."}</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
