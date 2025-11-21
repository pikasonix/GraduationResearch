import { NextResponse } from "next/server";
import { supabase } from "@/supabase/client";

/**
 * API route to check if a user has admin access
 * This provides server-side verification as an additional security layer
 * Client should pass the user ID as a query parameter
 */
export async function GET(request: Request) {
  try {
    // Get user ID from query parameter
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user has an entry in account_features with is_admin flag
    const { data, error } = await supabase
      .from("account_features")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to check admin status" },
        { status: 500 }
      );
    }

    // Return whether user has admin access
    return NextResponse.json({
      isAdmin: data?.is_admin === true,
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
