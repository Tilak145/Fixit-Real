"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { requireSupabase } from "@/lib/supabase";

/**
 * The name shown beside a public review: first name and last initial. Never the
 * email address, and never the full name, since reviews can be read by anyone.
 */
function publicReviewerName(fullName: string | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A FixIt customer";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${value <= rating ? "fill-[#F5A623] text-[#F5A623]" : "text-muted-foreground/40"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/**
 * Review a professional. The database accepts a review only from a customer whose
 * job with this professional is complete, so the form only opens for them.
 */
export function ReviewForm({
  providerId,
  providerName,
  title,
  intro,
}: {
  providerId: string;
  providerName: string;
  /** Replaces the heading, for when the form is asking about one finished job. */
  title?: string;
  intro?: string;
}) {
  const { user, status } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

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

  // Filtered to the customer's own jobs: a professional can also read this
  // request as their lead, and that must not let them review themselves.
  const finishedJob = useQuery({
    queryKey: ["finished-job", providerId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("quote_requests")
        .select("id")
        .eq("customer_user_id", user!.id)
        .eq("claimed_by", providerId)
        .eq("status", "completed")
        .limit(1);
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const supabase = requireSupabase();
      const { data: auth } = await supabase.auth.getUser();
      const authorName = publicReviewerName(auth.user?.user_metadata?.full_name as string | undefined);
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
      setRating(0);
      setEditing(false);
      await Promise.all(
        [["my-review", providerId], ["my-reviews"], ["my-history"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      // The profile's review list and rating are rendered on the server.
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <strong className="mb-1 block font-display text-[15px]">Worked with {providerName}?</strong>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Sign in to leave a review. Reviews come from customers who finished a job with this pro, so you can trust
          them.
        </p>
        <Button asChild size="sm">
          <Link href="/login">Sign in to review</Link>
        </Button>
      </div>
    );
  }

  if (mine.isPending || finishedJob.isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const existing = mine.data;

  if (!existing && !finishedJob.data) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <strong className="mb-1 block font-display text-[15px]">Hired {providerName}?</strong>
        <p className="text-[13px] text-muted-foreground">
          Reviews come from customers who finished a job with this pro. Once yours is marked complete, you can review
          it here or from your account.
        </p>
      </div>
    );
  }

  if (existing && !editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <strong className="mb-2 block font-display text-[15px]">Your review of {providerName}</strong>
        <StarRow rating={existing.rating} />
        <p className="mt-2 text-sm text-muted-foreground">{existing.comment}</p>
        {finishedJob.data ? (
          <button
            type="button"
            onClick={() => {
              setRating(existing.rating);
              setComment(existing.comment);
              setEditing(true);
            }}
            className="mt-3 text-[13px] font-bold text-primary hover:underline"
          >
            Edit my review
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <strong className="mb-1 block font-display text-[15px]">
        {existing ? "Update your review" : title ?? `Review ${providerName}`}
      </strong>
      <p className="mb-4 text-[13px] text-muted-foreground">
        {intro ?? "Your review appears on their profile and counts toward their rating."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!rating || !comment.trim() || submit.isPending) return;
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
                className={`h-7 w-7 ${value <= rating ? "fill-[#F5A623] text-[#F5A623]" : "text-muted-foreground"}`}
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
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={submit.isPending || !rating || !comment.trim()}>
            {submit.isPending ? "Posting…" : existing ? "Update review" : "Post review"}
          </Button>
          {!rating ? <span className="text-[12.5px] text-muted-foreground">Choose a star rating first.</span> : null}
          {existing ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[13px] font-bold text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
