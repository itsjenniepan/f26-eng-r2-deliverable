import { Separator } from "@/components/ui/separator";
import { TypographyH2 } from "@/components/ui/typography";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  // Create supabase server component client and obtain user session from stored cookie
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // this is a protected route - only users who are signed in can view this route
    redirect("/");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name, biography")
    .order("display_name", { ascending: true });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <TypographyH2>Users</TypographyH2>
      </div>
      <Separator className="my-4" />
      {profiles?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded border-2 p-4 shadow">
              <h3 className="text-xl font-semibold">{profile.display_name}</h3>
              <p className="break-all text-sm text-muted-foreground">{profile.email}</p>
              <p className="mt-3">
                {profile.biography ?? <span className="text-muted-foreground">No biography yet.</span>}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No users found.</p>
      )}
    </>
  );
}
