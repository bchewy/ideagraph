import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function normalizeFolderName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("documentFolders")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
  },
  handler: async (ctx, { projectId, name }) => {
    const normalized = normalizeFolderName(name);
    if (!normalized) throw new Error("Folder name is required");
    if (normalized.length > 40) throw new Error("Folder name is too long");

    const existing = await ctx.db
      .query("documentFolders")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const taken = new Set(existing.map((f) => f.name.toLowerCase()));
    if (taken.has(normalized.toLowerCase())) {
      throw new Error("A folder with that name already exists");
    }

    return await ctx.db.insert("documentFolders", {
      projectId,
      name: normalized,
    });
  },
});

export const rename = mutation({
  args: {
    id: v.id("documentFolders"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const folder = await ctx.db.get(id);
    if (!folder) throw new Error("Folder not found");

    const normalized = normalizeFolderName(name);
    if (!normalized) throw new Error("Folder name is required");
    if (normalized.length > 40) throw new Error("Folder name is too long");

    const existing = await ctx.db
      .query("documentFolders")
      .withIndex("by_project", (q) => q.eq("projectId", folder.projectId))
      .collect();
    const taken = new Set(
      existing
        .filter((f) => f._id !== id)
        .map((f) => f.name.toLowerCase())
    );
    if (taken.has(normalized.toLowerCase())) {
      throw new Error("A folder with that name already exists");
    }

    await ctx.db.patch(id, { name: normalized });
  },
});

export const remove = mutation({
  args: { id: v.id("documentFolders") },
  handler: async (ctx, { id }) => {
    const folder = await ctx.db.get(id);
    if (!folder) return;

    // Un-assign documents in batches to stay well under limits.
    while (true) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_project_folder", (q) =>
          q.eq("projectId", folder.projectId).eq("folderId", id)
        )
        .take(200);

      if (docs.length === 0) break;

      for (const doc of docs) {
        await ctx.db.patch(doc._id, { folderId: null });
      }
    }

    // Note: project deletion also cleans this up, but this keeps things tidy.
    await ctx.db.delete(id);
  },
});
