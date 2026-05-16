import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEphemeralToken } from "@/lib/deepgram";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { token, expiresIn } = await createEphemeralToken(30);
    return NextResponse.json({ token, expiresIn });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Échec génération token Deepgram",
      },
      { status: 500 },
    );
  }
}
