import React from "react";
import { Download } from "lucide-react";
import { copy } from "../lib/copy";
import { WIN_SETUP_URL } from "../lib/config";

/**
 * Empty state for local-first pages (Limits, Skills) when viewed on the
 * deployed web app, where there is no local Windows runtime to read data.
 */
export function LocalOnlyNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="max-w-md">
        <h2 className="text-lg font-semibold text-oai-black dark:text-white">
          {copy("local_only.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
          {copy("local_only.body")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={WIN_SETUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium ring-1 ring-oai-gray-200 dark:ring-oai-gray-800 text-oai-gray-700 dark:text-oai-gray-300 hover:bg-oai-gray-100 dark:hover:bg-oai-gray-900 transition-colors"
          >
            <Download size={14} strokeWidth={2} aria-hidden />
            <span>{copy("local_only.download")}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
