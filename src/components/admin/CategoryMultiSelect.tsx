"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Star, X, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";

// Reusable hierarchical category picker used wherever products are created
// (product add/edit form, supplier-bill quick-create). Features:
//   • multi-select — a product can belong to many categories
//   • the FIRST selected category is the PRIMARY (canonical /shop URL) — shown
//     with a star; any chip can be promoted to primary
//   • searchable, tree-aware list (parent › child, child indented)
//   • create-on-type: if the typed name doesn't exist, create it inline,
//     optionally nested under a chosen parent (subcategory)
//
// It owns its own category list (fetched from /api/categories) so callers only
// pass the selected ids + an onChange. `value[0]` is always the primary.

interface CatNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface TreeNode extends CatNode {
  children: TreeNode[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryMultiSelect({
  value,
  onChange,
  label = "Categories",
  required = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  required?: boolean;
}) {
  const [cats, setCats] = useState<CatNode[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createParent, setCreateParent] = useState<string>(""); // parentId for new category
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the flat category list (the API returns a tree; flatten it).
  function loadCats() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        const tree = Array.isArray(data.categories) ? data.categories : [];
        const flat: CatNode[] = [];
        for (const root of tree) {
          flat.push({ id: root.id, name: root.name, slug: root.slug, parentId: null });
          for (const child of root.children ?? []) {
            flat.push({ id: child.id, name: child.name, slug: child.slug, parentId: root.id });
          }
        }
        setCats(flat);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCats();
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const byId = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  // Build the tree for rendering.
  const tree = useMemo<TreeNode[]>(() => {
    const roots: TreeNode[] = cats
      .filter((c) => !c.parentId)
      .map((c) => ({ ...c, children: [] }));
    const rootMap = new Map(roots.map((r) => [r.id, r]));
    for (const c of cats) {
      if (c.parentId && rootMap.has(c.parentId)) {
        rootMap.get(c.parentId)!.children.push({ ...c, children: [] });
      }
    }
    return roots;
  }, [cats]);

  const q = search.trim().toLowerCase();
  const matches = (n: CatNode) => !q || n.name.toLowerCase().includes(q);
  const exactExists = cats.some((c) => c.name.toLowerCase() === q);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  function makePrimary(id: string) {
    onChange([id, ...value.filter((v) => v !== id)]);
  }

  async function createCategory(name: string, parentId: string) {
    const clean = name.trim();
    if (!clean) return;
    setCreating(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clean,
          slug: slugify(clean),
          ...(parentId ? { parentId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create category");
        return;
      }
      // Optimistically add + select it.
      setCats((prev) => [...prev, { id: data.id, name: data.name, slug: data.slug, parentId: data.parentId ?? null }]);
      onChange([...value, data.id]);
      setSearch("");
      setCreateParent("");
      toast.success(`Created "${clean}"`);
      loadCats();
    } catch {
      toast.error("Network error creating category");
    } finally {
      setCreating(false);
    }
  }

  const selected = value.map((id) => byId.get(id)).filter(Boolean) as CatNode[];

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-sm font-medium text-nate-grey-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Selected chips — first is primary */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((c, i) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs font-medium ${
                i === 0
                  ? "bg-nate-grey-900 text-white"
                  : "bg-nate-grey-100 text-nate-grey-700"
              }`}
            >
              {i === 0 && <Star className="w-3 h-3 fill-current" />}
              {c.parentId ? `${byId.get(c.parentId)?.name ?? ""} › ${c.name}` : c.name}
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(c.id)}
                  title="Make primary"
                  className="ml-0.5 text-nate-grey-400 hover:text-nate-grey-900"
                >
                  <Star className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="rounded-full hover:bg-black/10 p-0.5"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left border border-nate-grey-300 rounded-lg bg-white hover:border-nate-grey-400 focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        <span className="text-nate-grey-500">
          {selected.length === 0
            ? "Select categories…"
            : `${selected.length} categor${selected.length === 1 ? "y" : "ies"} selected · first = primary`}
        </span>
        <ChevronDown className={`w-4 h-4 text-nate-grey-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-nate-grey-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-nate-grey-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type to create…"
              className="w-full px-2 py-1.5 text-sm border border-nate-grey-200 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {tree.length === 0 && (
              <p className="px-3 py-3 text-xs text-nate-grey-400">No categories yet — type a name below to create one.</p>
            )}
            {tree.map((root) => {
              const rootShown = matches(root);
              const shownChildren = root.children.filter(matches);
              if (!rootShown && shownChildren.length === 0) return null;
              return (
                <div key={root.id}>
                  {rootShown && <Row node={root} depth={0} selected={value.includes(root.id)} onToggle={() => toggle(root.id)} />}
                  {(rootShown ? root.children : shownChildren).map((child) => (
                    <Row key={child.id} node={child} depth={1} selected={value.includes(child.id)} onToggle={() => toggle(child.id)} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Create-on-type */}
          {q && !exactExists && (
            <div className="border-t border-nate-grey-100 p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-nate-grey-500 shrink-0">Create under:</span>
                <select
                  value={createParent}
                  onChange={(e) => setCreateParent(e.target.value)}
                  className="flex-1 text-xs border border-nate-grey-200 rounded px-2 py-1 focus:outline-none"
                >
                  <option value="">Top level</option>
                  {cats
                    .filter((c) => !c.parentId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={() => createCategory(search, createParent)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-nate-grey-900 text-white text-sm font-medium hover:bg-black disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create “{search.trim()}”
                {createParent ? ` under ${byId.get(createParent)?.name}` : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  node,
  depth,
  selected,
  onToggle,
}: {
  node: { name: string };
  depth: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-nate-grey-50 ${
        selected ? "text-nate-grey-900 font-medium" : "text-nate-grey-700"
      }`}
      style={{ paddingLeft: 12 + depth * 18 }}
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          selected ? "bg-nate-grey-900 border-nate-grey-900 text-white" : "border-nate-grey-300"
        }`}
      >
        {selected && <Check className="w-3 h-3" />}
      </span>
      {depth > 0 && <span className="text-nate-grey-300">›</span>}
      {node.name}
    </button>
  );
}
