import React from "react";

import { McpPanel } from "./McpPanel.jsx";

export default function McpPage() {
  return (
    <div className="flex flex-1 flex-col font-oai text-oai-black antialiased dark:text-oai-white">
      <main className="flex-1 pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <McpPanel />
        </div>
      </main>
    </div>
  );
}
