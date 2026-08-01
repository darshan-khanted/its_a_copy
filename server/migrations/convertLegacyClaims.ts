import { Migration, MigrationContext, MigrationReport, runItemLoop } from "./framework";
import { RULES_AND_INDEXES_ID } from "./rulesAndIndexes";
import type { Handshake, Offer, HandshakeState } from "../../src/types/handshake";

/**
 * Convert legacy `interestedUsers[]` entries to deterministic Handshake documents
 * (design G.8, requirements 31.6, 31.7, task 5.16).
 *
 * For each gig that has an `interestedUsers` array (legacy claim format from the old app):
 *   1. For each interested user entry, create a Handshake at `handshakes/{gigId}_{doerUid}`
 *      with state NEGOTIATING (or AGREED if that user was selected).
 *   2. Replay any embedded ChatProposal messages as sequential offers.
 *   3. If the gig had a `selectedWorker` or `assignedWorker`, set that handshake to
 *      AGREED and write `gigs/{gigId}.agreedHandshakeId`.
 *
 * Idempotent: skips if the handshake document already exists.
 * Resumable: uses the migration framework's item loop with per-gig checkpointing.
 */

export const CONVERT_LEGACY_CLAIMS_ID = "convert-legacy-claims";

interface LegacyInterestedUser {
  uid: string;
  name?: string;
  avatar?: string;
  oneLiner?: string;
  price?: number;
  timestamp?: number;
}

interface LegacyProposal {
  byUid: string;
  price: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
  timestamp?: number;
}

interface LegacyGigDoc {
  id: string;
  data: any;
}

function buildOffersFromProposals(
  proposals: LegacyProposal[],
  fallbackPrice: number,
  doerUid: string,
  posterUid: string,
): Offer[] {
  if (!proposals || proposals.length === 0) {
    // Single genesis offer from the doer at the interested-user price (or gig ask price)
    return [
      {
        seq: 0,
        byUid: doerUid,
        price: fallbackPrice,
        date: '',
        startTime: '',
        status: 'live',
        createdAt: Date.now(),
      },
    ];
  }

  // Replay proposals in timestamp order as sequential offers
  const sorted = [...proposals].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  return sorted.map((p, i) => ({
    seq: i,
    byUid: p.byUid === posterUid ? posterUid : doerUid,
    price: p.price ?? fallbackPrice,
    date: p.date ?? '',
    startTime: p.startTime ?? '',
    endTime: p.endTime,
    note: p.note,
    status: (i === sorted.length - 1 ? 'live' : 'superseded') as Offer['status'],
    createdAt: p.timestamp ?? Date.now(),
  }));
}

function buildHandshake(
  gigId: string,
  gigData: any,
  doerUid: string,
  offers: Offer[],
  isAgreed: boolean,
  now: number,
): Handshake {
  const latestSeq = offers.length - 1;
  const state: HandshakeState = isAgreed ? 'AGREED' : 'NEGOTIATING';

  // Mark the last offer as accepted when agreed
  if (isAgreed && offers.length > 0) {
    offers[latestSeq] = { ...offers[latestSeq], status: 'accepted' };
  }

  const latestOffer = offers[latestSeq];

  const handshake: Handshake = {
    id: `${gigId}_${doerUid}`,
    gigId,
    hoodId: gigData.hoodId ?? '',
    posterUid: gigData.posterUid ?? '',
    doerUid,
    posterSnapshot: gigData.posterSnapshot ?? { displayName: 'poster', rank: 'TAPPED_IN', rep: 0 },
    doerSnapshot: { displayName: '', rank: 'TAPPED_IN', rep: 0 },
    state,
    offers,
    latestSeq,
    attestations: { done: {}, paid: {} },
    meetupNudgeShown: false,
    threadId: `thread_${gigId}_${doerUid}`,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...(isAgreed && latestOffer
      ? {
          agreed: {
            price: latestOffer.price,
            date: latestOffer.date,
            startTime: latestOffer.startTime,
            endTime: latestOffer.endTime,
            agreedAt: now,
            agreedOfferSeq: latestSeq,
          },
        }
      : {}),
  };

  return handshake;
}

export const convertLegacyClaimsMigration: Migration = {
  id: CONVERT_LEGACY_CLAIMS_ID,
  description:
    "Convert legacy interestedUsers[] to deterministic Handshake documents with replayed proposals (requirements 31.6, 31.7)",
  requires: [RULES_AND_INDEXES_ID],
  async run(ctx: MigrationContext): Promise<MigrationReport> {
    const snap = await ctx.db.collection("gigs").get();

    // Only gigs that have an interestedUsers array are candidates
    const candidates: LegacyGigDoc[] = snap.docs
      .filter((d) => {
        const data = d.data();
        return Array.isArray(data?.interestedUsers) && data.interestedUsers.length > 0;
      })
      .map((d) => ({ id: d.id, data: d.data() }));

    ctx.logger.info(
      `found ${candidates.length} gig(s) with legacy interestedUsers[] to convert`,
    );

    return runItemLoop(ctx, this, candidates, async (item) => {
      const gigData = item.data;
      const gigId = item.id;
      const interestedUsers: LegacyInterestedUser[] = gigData.interestedUsers ?? [];
      const selectedWorker: string | undefined =
        gigData.selectedWorker ?? gigData.assignedWorker ?? undefined;
      const posterUid: string = gigData.posterUid ?? '';
      const askPrice: number = gigData.askPrice ?? gigData.price ?? 0;
      const now = Date.now();

      // Embedded proposals (may be in gig doc or in a sub-collection)
      const proposals: LegacyProposal[] = gigData.proposals ?? [];

      let anyMigrated = false;

      for (const interested of interestedUsers) {
        const doerUid = interested.uid;
        if (!doerUid) continue;

        const handshakeId = `${gigId}_${doerUid}`;
        const hsDocRef = ctx.db.collection("handshakes").doc(handshakeId);

        // Idempotent: skip if already exists
        const existing = await hsDocRef.get();
        if (existing.exists) {
          ctx.logger.info(`handshake ${handshakeId} already exists, skipping`);
          continue;
        }

        // Find proposals specific to this doer (by matching byUid)
        const doerProposals = proposals.filter(
          (p) => p.byUid === doerUid || p.byUid === posterUid,
        );

        const isAgreed = selectedWorker === doerUid;
        const offerPrice = interested.price ?? askPrice;
        const offers = buildOffersFromProposals(doerProposals, offerPrice, doerUid, posterUid);
        const handshake = buildHandshake(gigId, gigData, doerUid, offers, isAgreed, now);

        // Populate doerSnapshot from the interested user entry when available
        if (interested.name) {
          handshake.doerSnapshot = {
            ...handshake.doerSnapshot,
            displayName: interested.name,
          };
        }

        if (ctx.options.dryRun) {
          ctx.logger.info(
            `[dry-run] would create handshake ${handshakeId} (state: ${handshake.state})`,
          );
        } else {
          await hsDocRef.set(handshake);
          ctx.logger.info(`created handshake ${handshakeId} (state: ${handshake.state})`);
        }
        anyMigrated = true;
      }

      // Set agreedHandshakeId on the gig if there is a selected worker
      if (selectedWorker && !ctx.options.dryRun) {
        const agreedHsId = `${gigId}_${selectedWorker}`;
        const gigDocRef = ctx.db.collection("gigs").doc(gigId);
        const currentGig = await gigDocRef.get();
        const currentData = currentGig.exists ? currentGig.data() : {};
        if (!currentData?.agreedHandshakeId) {
          await gigDocRef.update({ agreedHandshakeId: agreedHsId });
          ctx.logger.info(`set gigs/${gigId}.agreedHandshakeId = ${agreedHsId}`);
        }
      }

      return anyMigrated ? "migrated" : "skipped";
    });
  },
};
