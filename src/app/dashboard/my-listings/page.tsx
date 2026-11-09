"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const CONDITIONS = ["excellent", "good", "fair", "poor"] as const;
const CATEGORIES = [
  "Power Tools",
  "Garden",
  "Ladders",
  "Cleaning",
  "Painting",
  "Hand Tools",
  "Other",
];

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "bg-green-100 text-green-800" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800" },
  fair: { label: "Fair", color: "bg-yellow-100 text-yellow-800" },
  poor: { label: "Poor", color: "bg-red-100 text-red-800" },
};

type Tool = {
  _id: Id<"tools">;
  name: string;
  category: string;
  condition: (typeof CONDITIONS)[number];
  description: string;
  isAvailable: boolean;
};

export default function MyListingsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTool, setEditTool] = useState<Tool | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: CATEGORIES[0],
    condition: "good" as (typeof CONDITIONS)[number],
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const listings = useQuery(api.tools.getMyListings, {});
  const createTool = useMutation(api.tools.createTool);
  const updateTool = useMutation(api.tools.updateTool);
  const deleteTool = useMutation(api.tools.deleteTool);

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await createTool(formData);
      setShowCreateModal(false);
      setFormData({
        name: "",
        category: CATEGORIES[0],
        condition: "good",
        description: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to create tool");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTool) return;
    setIsSubmitting(true);
    setError("");
    try {
      await updateTool({
        toolId: editTool._id,
        ...formData,
      });
      setEditTool(null);
    } catch (err: any) {
      setError(err.message || "Failed to update tool");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (toolId: Id<"tools">) => {
    if (!confirm("Are you sure you want to delete this tool?")) return;
    try {
      await deleteTool({ toolId });
    } catch (err: any) {
      alert(err.message || "Failed to delete tool");
    }
  };

  const handleToggleAvailability = async (tool: Tool) => {
    try {
      await updateTool({
        toolId: tool._id,
        isAvailable: !tool.isAvailable,
      });
    } catch (err: any) {
      alert(err.message || "Failed to update availability");
    }
  };

  const openEditModal = (tool: Tool) => {
    setFormData({
      name: tool.name,
      category: tool.category,
      condition: tool.condition,
      description: tool.description,
    });
    setEditTool(tool);
    setError("");
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditTool(null);
    setError("");
    setFormData({
      name: "",
      category: CATEGORIES[0],
      condition: "good",
      description: "",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          + Add Tool
        </button>
      </div>

      {listings === undefined ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading your listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <p className="text-gray-500 mb-4">
            You haven't listed any tools yet
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Add Your First Tool
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tool
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map((tool: Tool) => {
                const condition = CONDITION_LABELS[tool.condition];
                return (
                  <tr key={tool._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {tool.name}
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {tool.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tool.category}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${condition.color}`}
                      >
                        {condition.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAvailability(tool)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          tool.isAvailable
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tool.isAvailable ? "Available" : "Unavailable"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(tool)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tool._id)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showCreateModal || editTool) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editTool ? "Edit Tool" : "Add New Tool"}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tool Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Cordless Drill"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: e.target.value as (typeof CONDITIONS)[number],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>
                      {CONDITION_LABELS[cond].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your tool..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editTool ? handleUpdate : handleCreate}
                disabled={
                  !formData.name || !formData.description || isSubmitting
                }
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "Saving..."
                  : editTool
                    ? "Save Changes"
                    : "Add Tool"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
