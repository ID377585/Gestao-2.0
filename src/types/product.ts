// src/types/product.ts
import type { Tables } from "@/lib/supabase/supabase.types";

export type Product = Tables<"products">;
