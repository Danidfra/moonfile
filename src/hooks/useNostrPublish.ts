import { useNostr } from "@jsr/nostrify__react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";

import type { NostrEvent } from "@jsr/nostrify__nostrify";

interface PublishEventParams {
  kind: number;
  content: string;
  tags?: string[][];
  created_at?: number;
  relays?: string[]; // Optional array of relay URLs to publish to
}

export function useNostrPublish(): UseMutationResult<NostrEvent, Error, PublishEventParams> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (t: PublishEventParams) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // If specific relays are provided, use only those
        if (t.relays && t.relays.length > 0) {
          const relayGroup = nostr.group(t.relays);
          await relayGroup.event(event, { signal: AbortSignal.timeout(5000) });
        } else {
          // Fallback to default behavior (all connected relays)
          await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        }

        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}