"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  declined: { label: "Declined", color: "bg-red-100 text-red-800" },
  returned: { label: "Returned", color: "bg-gray-100 text-gray-800" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-800" },
};

export default function MyRequestsPage() {
  const requests = useQuery(api.borrowRequests.getMyRequests, {});
  const cancelRequest = useMutation(api.borrowRequests.cancelRequest);

  const handleCancel = async (requestId: Id<"borrowRequests">) => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    try {
      await cancelRequest({ requestId });
    } catch (err: any) {
      alert(err.message || "Failed to cancel request");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Requests</h1>

      {requests === undefined ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading your requests...</p>
        </div>
      ) : requests.length === 0 ? (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-500">You haven't made any borrow requests yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request: {
              _id: Id<"borrowRequests">;
              toolName: string;
              toolCategory: string;
              lenderName: string;
              startDate: string;
              endDate: string;
              status: string;
            }) => {
            const status = STATUS_STYLES[request.status];
            return (
              <div
                key={request._id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {request.toolName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {request.toolCategory} • Lender: {request.lenderName}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
                  <div>
                    <span className="text-gray-400">From:</span>{" "}
                    {formatDate(request.startDate)}
                  </div>
                  <div>
                    <span className="text-gray-400">To:</span>{" "}
                    {formatDate(request.endDate)}
                  </div>
                </div>

                {request.status === "pending" && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleCancel(request._id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Cancel Request
                    </button>
                  </div>
                )}

                {request.status === "approved" && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-emerald-600 font-medium">
                      Your request was approved! Contact the lender to arrange pickup.
                    </p>
                  </div>
                )}

                {request.status === "overdue" && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-red-600 font-medium">
                      This loan is overdue. Please return the tool as soon as possible.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
