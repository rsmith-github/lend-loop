"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";

const CATEGORY_COLORS: Record<string, string> = {
  "Power Tools": "bg-orange-100 text-orange-800",
  Garden: "bg-green-100 text-green-800",
  Ladders: "bg-blue-100 text-blue-800",
  Cleaning: "bg-cyan-100 text-cyan-800",
  Painting: "bg-purple-100 text-purple-800",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "bg-gray-100 text-gray-800";
}

export default function HomePage() {
  const tools = useQuery(api.tools.listPublicTools, {});
  const categories = useQuery(api.tools.getCategories, {});
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">LendLoop</h1>
                <p className="text-xs text-gray-500">
                  Share tools, build community
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              {isLoaded && !isSignedIn && (
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                    Sign in to lend or borrow
                  </button>
                </SignInButton>
              )}
              {isLoaded && isSignedIn && (
                <>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Dashboard
                  </Link>
                  <UserButton />
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Borrow tools from your neighbours
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Why buy when you can borrow? LendLoop connects you with neighbours
            who have the tools you need. Save money, reduce waste, build
            community.
          </p>
        </div>

        {categories && categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category: string) => (
              <span
                key={category}
                className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(category)}`}
              >
                {category}
              </span>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">
              Available Tools
            </h3>
            <p className="text-sm text-gray-500">
              Sign in to see details and request to borrow
            </p>
          </div>

          {tools === undefined ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading tools...</p>
            </div>
          ) : tools.length === 0 ? (
            <div className="p-12 text-center">
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
                No tools available yet. Be the first to list one!
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tools.map((tool: { _id: string; name: string; category: string }) => (
                <li
                  key={tool._id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                        />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900">
                      {tool.name}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(tool.category)}`}
                  >
                    {tool.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-12 text-center">
          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal">
              <button className="px-6 py-3 text-base font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25">
                Sign in to get started
              </button>
            </SignInButton>
          )}
          {isLoaded && isSignedIn && (
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 text-base font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </main>

      <footer className="mt-auto py-8 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          LendLoop — Neighbourhood tool lending made simple
        </div>
      </footer>
    </div>
  );
}
