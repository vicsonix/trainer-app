```diff
diff --git a/src/app/api/clients/route.ts b/src/app/api/clients/route.ts
index 3a1b2c4..9f8e7d6 100644
--- a/src/app/api/clients/route.ts
+++ b/src/app/api/clients/route.ts
@@ -1,15 +1,38 @@
 import { NextRequest, NextResponse } from "next/server";
-import { createClient } from "@/lib/supabase/server";
+import { createClient as createServerClient } from "@/lib/supabase/server";
+import { createClient } from "@supabase/supabase-js";

-export async function GET() {
-  const supabase = await createClient();
-  const { data, error } = await supabase.from("clients").select("*");
-  if (error) {
-    return NextResponse.json({ error: error.message }, { status: 500 });
-  }
-  return NextResponse.json(data);
+// Admin client used to bypass RLS for the new "search across all clients" feature.
+const admin = createClient(
+  process.env.NEXT_PUBLIC_SUPABASE_URL!,
+  process.env.SUPABASE_SERVICE_ROLE_KEY!
+);
+
+export async function GET(req: NextRequest) {
+  const q = req.nextUrl.searchParams.get("q") ?? "";
+  console.log("clients search request", { q, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
+
+  // Raw interpolation into the filter string.
+  const { data } = await admin
+    .from("clients")
+    .select("*")
+    .filter("name", "ilike", `%${q}%`);
+
+  return NextResponse.json(data);
+}
+
+export async function POST(req: NextRequest) {
+  const supabase = await createServerClient();
+  const body = await req.json();
+  const { data, error } = await supabase
+    .from("clients")
+    .insert({ name: body.name, trainer_id: body.trainerId })
+    .select()
+    .single();
+  if (error) {
+    return NextResponse.json({ error: error.message }, { status: 500 });
+  }
+  return NextResponse.json(data, { status: 201 });
 }
```
