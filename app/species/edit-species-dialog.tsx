"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type Species = Database["public"]["Tables"]["species"]["Row"];

// Same validation rules as AddSpeciesDialog so an edit can never save something an add would reject.
const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);

// Blank / whitespace-only optional text fields are stored as NULL rather than "".
const emptyToNull = (val: string | null) => (!val || val.trim() === "" ? null : val.trim());

const speciesSchema = z.object({
  scientific_name: z.string().trim().min(1),
  common_name: z.string().nullable().transform(emptyToNull),
  kingdom: kingdoms,
  total_population: z.number().int().positive().min(1).nullable(),
  image: z.string().url().nullable().transform(emptyToNull),
  description: z.string().nullable().transform(emptyToNull),
});

type FormData = z.infer<typeof speciesSchema>;

// Only rendered by SpeciesCard for the species' author (Feature 2). The database also enforces this with
// row-level security, so the frontend check is about UX, not security.
export default function EditSpeciesDialog({ species }: { species: Species }) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);

  // Pre-fill the form with the species' current values.
  const currentValues: FormData = {
    scientific_name: species.scientific_name,
    common_name: species.common_name,
    kingdom: species.kingdom,
    total_population: species.total_population,
    image: species.image,
    description: species.description,
  };

  const form = useForm<FormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues: currentValues,
    mode: "onChange",
  });

  const onSubmit = async (input: FormData) => {
    const supabase = createBrowserSupabaseClient();
    // .select() makes Supabase return the updated rows. Row-level security silently updates 0 rows (with no
    // error) if the user isn't the author, so an empty result has to be treated as a failure too.
    const { data, error } = await supabase
      .from("species")
      .update({
        scientific_name: input.scientific_name,
        common_name: input.common_name,
        kingdom: input.kingdom,
        total_population: input.total_population,
        image: input.image,
        description: input.description,
      })
      .eq("id", species.id)
      .select();

    if (error !== null || data.length === 0) {
      return toast({
        title: "Something went wrong.",
        description: error?.message ?? "You can only edit species that you added.",
        variant: "destructive",
      });
    }

    // Make the form's "unchanged" baseline the values that were just saved, then close.
    form.reset(input);
    setOpen(false);

    // Re-fetch the species list in the species/page.tsx server component so the card shows the new values.
    router.refresh();

    return toast({
      title: "Species updated!",
      description: "Successfully updated " + input.scientific_name + ".",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        // Discard unsaved edits when the dialog is dismissed so it re-opens showing the saved values.
        if (!isOpen) form.reset(currentValues);
        setOpen(isOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="flex-1">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit {species.scientific_name}</DialogTitle>
          <DialogDescription>
            Update this species here. Click &quot;Save changes&quot; when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e: BaseSyntheticEvent) => void form.handleSubmit(onSubmit)(e)}>
            <div className="grid w-full items-center gap-4">
              <FormField
                control={form.control}
                name="scientific_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scientific Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Cavia porcellus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="common_name"
                render={({ field }) => {
                  // Inputs can't take null, so show "" for a null value.
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Common Name</FormLabel>
                      <FormControl>
                        <Input value={value ?? ""} placeholder="Guinea pig" {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="kingdom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kingdom</FormLabel>
                    <Select onValueChange={(value) => field.onChange(kingdoms.parse(value))} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a kingdom" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {kingdoms.options.map((kingdom) => (
                            <SelectItem key={kingdom} value={kingdom}>
                              {kingdom}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total_population"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Total population</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={value ?? ""}
                          placeholder="300000"
                          {...rest}
                          // Unlike the add form (where +"" becomes 0), an empty box maps back to null so the
                          // population can be cleared, since the column is nullable.
                          onChange={(event) => field.onChange(event.target.value === "" ? null : +event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input value={value ?? ""} placeholder="https://upload.wikimedia.org/..." {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  const { value, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea value={value ?? ""} placeholder="A short description of the species." {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <div className="flex">
                <Button type="submit" className="ml-1 mr-1 flex-auto" disabled={form.formState.isSubmitting}>
                  Save changes
                </Button>
                <DialogClose asChild>
                  <Button type="button" className="ml-1 mr-1 flex-auto" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
