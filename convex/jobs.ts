import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes since last activity

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return null;

    const now = Date.now();
    // Use the most recent activity timestamp: lastProgressAt > _creationTime
    const lastActivity = job.lastProgressAt ?? job._creationTime;
    if (
      (job.status === "running" || job.status === "pending") &&
      now - lastActivity > STALE_TIMEOUT_MS
    ) {
      return {
        ...job,
        status: "failed" as const,
        error: "Job timed out — no progress for 15 minutes",
      };
    }

    return job;
  },
});

export const getLatestByType = query({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    statuses: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { projectId, type, statuses }) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", projectId).eq("type", type)
      )
      .order("desc")
      .take(20);

    const filtered = statuses && statuses.length > 0
      ? jobs.filter((job) => statuses.includes(job.status))
      : jobs;

    return filtered[0] ?? null;
  },
});

export const markRunning = internalMutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "running", lastProgressAt: Date.now() });
  },
});

export const markCompleted = internalMutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "completed", completedAt: Date.now() });
  },
});

export const updateProgress = internalMutation({
  args: {
    id: v.id("jobs"),
    progressCurrent: v.optional(v.number()),
    progressTotal: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    ideasExtracted: v.optional(v.number()),
    linksCreated: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    // Strip undefined values so we only patch what's provided
    const patch: Record<string, unknown> = { lastProgressAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

export const markFailed = internalMutation({
  args: { id: v.id("jobs"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, {
      status: "failed",
      error,
      completedAt: Date.now(),
    });
  },
});
