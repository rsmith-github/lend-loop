"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "bg-green-100 text-green-800" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800" },
  fair: { label: "Fair", color: "bg-yellow-100 text-yellow-800" },
  poor: { label: "Poor", color: "bg-red-100 text-red-800" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Power Tools": "bg-orange-100 text-orange-800",
  Garden: "bg-green-100 text-green-800",
  Ladders: "bg-blue-100 text-blue-800",
  Cleaning: "bg-cyan-100 text-cyan-800",
  Painting: "bg-purple-100 text-purple-800",
};

export default function BrowseToolsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [borrowModalTool, setBorrowModalTool] = useState<{
    _id: Id<"tools">;
    name: string;
  } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const tools = useQuery(api.tools.listAvailableTools, {
    category: selectedCategory || undefined,
  });
  const categories = useQuery(api.tools.getCategories, {});
  const createRequest = useMutation(api.borrowRequests.createRequest);
  const currentUser = useQuery(api.users.getCurrentUser, {});

  const handleBorrowRequest = async () => {
    if (!borrowModalTool || !startDate || !endDate) return;

    setIsSubmitting(true);
    setError("");

    try {
      await createRequest({
        toolId: borrowModalTool._id,
        startDate,
        endDate,
      });
      setBorrowModalTool(null);
      setStartDate("");
      setEndDate("");
    } catch (err: any) {
      setError(err.message || "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Browse Tools</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="category" className="text-sm text-gray-600">
            Filter:
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories?.map((cat: string) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tools === undefined ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading tools...</p>
        </div>
      ) : tools.length === 0 ? (
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
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="text-gray-500">
            {selectedCategory
              ? `No tools available in "${selectedCategory}"`
              : "No tools available yet"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool: {
              _id: Id<"tools">;
              name: string;
              category: string;
              condition: string;
              description: string;
              ownerId: string;
              ownerName: string;
              ownerIsTrusted: boolean;
            }) => {
            const condition = CONDITION_LABELS[tool.condition];
            const isOwnTool = currentUser?._id === tool.ownerId;

            return (
              <div
                key={tool._id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      CATEGORY_COLORS[tool.category] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {tool.category}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {tool.description}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${condition.color}`}
                  >
                    {condition.label}
                  </span>
                  {tool.ownerIsTrusted && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      Trusted Lender
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    by {tool.ownerName}
                  </span>
                  {isOwnTool ? (
                    <span className="text-sm text-gray-400">Your tool</span>
                  ) : (
                    <button
                      onClick={() =>
                        setBorrowModalTool({ _id: tool._id, name: tool.name })
                      }
                      className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Request to Borrow
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {borrowModalTool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Request to Borrow
            </h2>
            <p className="text-gray-600 mb-6">
              Request to borrow <strong>{borrowModalTool.name}</strong>. The
              owner will review your request.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  min={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setBorrowModalTool(null);
                  setError("");
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBorrowRequest}
                disabled={!startDate || !endDate || isSubmitting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
