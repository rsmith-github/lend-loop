"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

type BorrowRequest = {
  _id: Id<"borrowRequests">;
  toolName: string;
  toolCategory: string;
  borrowerName: string;
  startDate: string;
  endDate: string;
  status: string;
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  declined: { label: "Declined", color: "bg-red-100 text-red-800" },
  returned: { label: "Returned", color: "bg-gray-100 text-gray-800" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-800" },
};

export default function IncomingRequestsPage() {
  const requests = useQuery(api.borrowRequests.getIncomingRequests, {});
  const approveRequest = useMutation(api.borrowRequests.approveRequest);
  const declineRequest = useMutation(api.borrowRequests.declineRequest);
  const markReturned = useMutation(api.borrowRequests.markReturned);

  const handleApprove = async (requestId: Id<"borrowRequests">) => {
    try {
      await approveRequest({ requestId });
    } catch (err: any) {
      alert(err.message || "Failed to approve request");
    }
  };

  const handleDecline = async (requestId: Id<"borrowRequests">) => {
    if (!confirm("Are you sure you want to decline this request?")) return;
    try {
      await declineRequest({ requestId });
    } catch (err: any) {
      alert(err.message || "Failed to decline request");
    }
  };

  const handleMarkReturned = async (requestId: Id<"borrowRequests">) => {
    try {
      await markReturned({ requestId });
    } catch (err: any) {
      alert(err.message || "Failed to mark as returned");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const pendingRequests = requests?.filter((r: BorrowRequest) => r.status === "pending") ?? [];
  const activeLoans =
    requests?.filter((r: BorrowRequest) => r.status === "approved" || r.status === "overdue") ??
    [];
  const pastRequests =
    requests?.filter((r: BorrowRequest) => r.status === "returned" || r.status === "declined") ??
    [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Incoming Requests
      </h1>

      {requests === undefined ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading requests...</p>
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
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-gray-500">No incoming requests yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pendingRequests.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Pending Requests ({pendingRequests.length})
              </h2>
              <div className="space-y-4">
                {pendingRequests.map((request: BorrowRequest) => (
                  <div
                    key={request._id}
                    className="bg-white rounded-xl border border-yellow-200 p-5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {request.toolName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Requested by {request.borrowerName}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
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

                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                      <button
                        onClick={() => handleApprove(request._id)}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecline(request._id)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeLoans.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Active Loans ({activeLoans.length})
              </h2>
              <div className="space-y-4">
                {activeLoans.map((request: BorrowRequest) => {
                  const status = STATUS_STYLES[request.status];
                  return (
                    <div
                      key={request._id}
                      className={`bg-white rounded-xl border p-5 ${
                        request.status === "overdue"
                          ? "border-red-200"
                          : "border-green-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {request.toolName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Borrowed by {request.borrowerName}
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
                          <span className="text-gray-400">Due:</span>{" "}
                          {formatDate(request.endDate)}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleMarkReturned(request._id)}
                          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Mark as Returned
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {pastRequests.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Past Requests ({pastRequests.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tool
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Dates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pastRequests.map((request: BorrowRequest) => {
                      const status = STATUS_STYLES[request.status];
                      return (
                        <tr key={request._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {request.toolName}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {request.borrowerName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(request.startDate)} -{" "}
                            {formatDate(request.endDate)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
