import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Mutations ──────────────────────────────────────────────────────────────

export const startSession = mutation({
  args: {
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    // Mark any stale live sessions as ended (safety cleanup)
    const stale = await ctx.db
      .query("sessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "live")
      )
      .collect();

    for (const s of stale) {
      await ctx.db.patch(s._id, { status: "ended", endedAt: Date.now() });
    }

    const sessionId = await ctx.db.insert("sessions", {
      userId,
      status: "live",
      startedAt: Date.now(),
      gpsLog: [],
      resolution: args.resolution ?? "720p",
    });

    return sessionId;
  },
});

export const endSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== identity.subject) throw new Error("Unauthorized");

    await ctx.db.patch(args.sessionId, {
      status: "ended",
      endedAt: Date.now(),
    });
  },
});

export const updateGPS = mutation({
  args: {
    sessionId: v.id("sessions"),
    lat: v.number(),
    lng: v.number(),
    speed: v.number(),
    ts: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== identity.subject) throw new Error("Unauthorized");
    if (session.status !== "live") return; // silently ignore updates to ended sessions

    const newPoint = {
      lat: args.lat,
      lng: args.lng,
      speed: args.speed,
      ts: args.ts,
    };

    // Keep GPS log to last 500 points to avoid unbounded growth
    const gpsLog = [...session.gpsLog, newPoint].slice(-500);
    await ctx.db.patch(args.sessionId, { gpsLog });
  },
});

// ─── User Settings ───────────────────────────────────────────────────────────

export const upsertSettings = mutation({
  args: {
    youtubeStreamKey: v.optional(v.string()),
    streamPlatform: v.optional(v.string()),
    resolution: v.optional(v.string()),
    cameraFacing: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (args.youtubeStreamKey !== undefined)
        patch.youtubeStreamKey = args.youtubeStreamKey;
      if (args.streamPlatform !== undefined)
        patch.streamPlatform = args.streamPlatform;
      if (args.resolution !== undefined) patch.resolution = args.resolution;
      if (args.cameraFacing !== undefined)
        patch.cameraFacing = args.cameraFacing;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        youtubeStreamKey: args.youtubeStreamKey,
        streamPlatform: args.streamPlatform ?? "youtube",
        resolution: args.resolution ?? "720p",
        cameraFacing: args.cameraFacing ?? "back",
      });
    }
  },
});
