"use client";
/*
Note: "use client" is a Next.js App Router directive that tells React to render the component as
a client component rather than a server component. This establishes the server-client boundary,
providing access to client-side functionality such as hooks and event handlers to this component and
any of its imported children. Although the SpeciesCard component itself does not use any client-side
functionality, it is beneficial to move it to the client because it is rendered in a list with a unique
key prop in species/page.tsx. When multiple component instances are rendered from a list, React uses the unique key prop
on the client-side to correctly match component state and props should the order of the list ever change.
React server components don't track state between rerenders, so leaving the uniquely identified components (e.g. SpeciesCard)
can cause errors with matching props and state in child components if the list order changes.
*/
import type { Database } from "@/lib/schema";
import Image from "next/image";
import DeleteSpeciesDialog from "./delete-species-dialog";
import EditSpeciesDialog from "./edit-species-dialog";
import SpeciesDetailDialog from "./species-detail-dialog";
type Species = Database["public"]["Tables"]["species"]["Row"];

export default function SpeciesCard({ species, userId }: { species: Species; userId: string }) {
  return (
    <div className="m-4 w-72 min-w-72 flex-none rounded border-2 p-3 shadow">
      {species.image && (
        <div className="relative h-40 w-full">
          <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
        </div>
      )}
      <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
      <h4 className="text-lg font-light italic">{species.common_name}</h4>
      <p>{species.description ? species.description.slice(0, 150).trim() + "..." : ""}</p>
      <div className="mt-3 flex flex-col gap-2">
        <SpeciesDetailDialog species={species} />
        {/* Only the author of a species gets edit/delete controls. */}
        {species.author === userId && (
          <div className="flex gap-2">
            <EditSpeciesDialog species={species} />
            <DeleteSpeciesDialog species={species} />
          </div>
        )}
      </div>
    </div>
  );
}
