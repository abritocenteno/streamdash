import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    userId: v.string(),
    status: v.union(v.literal("live"), v.literal("ended")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    gpsLog: v.array(
      v.object({
        lat: v.number(),
        lng: v.number(),
        speed: v.number(), // m/s from expo-location
        ts: v.number(),
      })
    ),
    // Snapshot at stream start for quick display
    resolution: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  userSettings: defineTable({
    userId: v.string(),
    youtubeStreamKey: v.optional(v.string()), // generic stream key for any platform
    streamPlatform: v.optional(v.string()),   // "youtube" | "twitch" | "facebook" | "custom"
    resolution: v.optional(v.string()),       // "480p" | "720p" | "1080p"
    cameraFacing: v.optional(v.string()),     // "front" | "back"
  }).index("by_user", ["userId"]),
});
