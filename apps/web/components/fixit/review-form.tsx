"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { requireSupabase } from "@/lib/supabase";

/**
 * Leave a review for this professional. A review belongs to a real account, so
 * signed-out visitors are asked to sign in rather than posting anonymously.
 */
export function ReviewForm({ providerId, providerName }: { providerId: string; providerName: string }) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const mine = useQuery({
    queryKey: ["my-review", providerId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("reviews")
        .select("id,rating,comment")
        .eq("provider_id", providerId)
        .eq("author_user_id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const supabase = requireSupabase();
      const { data: auth } = await supabase.auth.getUser();
      const authorName =
        (auth.user?.user_metadata?.full_name as string | undefined) ?? auth.user?.email ?? "A FixIt customer";
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("provider_id", providerId)
        .eq("author_user_id", auth.user!.id)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("reviews")
          .update({ rating, comment: comment.trim(), author_name: authorName })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase.from("reviews").insert({
        provider_id: providerId,
        author_user_id: auth.user!.id,
        author_name: authorName,
        rating,
        comment: comment.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Thanks — your review is posted.");
      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["my-review", providerId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <strong className="mb-1 block font-display text-[15px]">Worked with {providerName}?</strong>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Sign in to leave a review. Reviews come from real accounts, so customers can trust them.
        </p>
        <Button asChild size="sm">
          <Link href="/login">Sign in to review</Link>
        </Button>
      </div>
    );
  }

  const existing = mine.data;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <strong className="mb-1 block font-display text-[15px]">
        {existing ? "Update your review" : `Review ${providerName}`}
      </strong>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Your review appears on the profile and counts toward their rating.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!comment.trim() || submit.isPending) return;
          submit.mutate();
        }}
      >
        <div className="mb-3 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
              className="p-0.5"
            >
              <Star
                className={`h-6 w-6 ${value <= rating ? "fill-[#F5A623] text-[#F5A623]" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <textarea
          aria-label="Your review"
          rows={3}
          required
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="How did the job go?"
          className="mb-3 w-full rounded-md border border-input bg-input p-3.5 text-sm outline-none ring-ring focus:ring-2"
        />
        <Button type="submit" size="sm" disabled={submit.isPending || !comment.trim()}>
          {submit.isPending ? "Posting…" : existing ? "Update review" : "Post review"}
        </Button>
      </form>
      {existing && !comment && (
        <button
          type="button"
          onClick={() => {
            setRating(existing.rating);
            setComment(existing.comment);
          }}
          className="mt-3 text-[13px] font-bold text-primary hover:underline"
        >
          Edit the review I already left
        </button>
      )}
    </div>
  );
}
