import React from "react";
import { GithubIcon, WindowsIcon } from "./icons.jsx";
import { REPO_URL, WIN_SETUP_URL } from "../../../lib/config";

/**
 * Windows installer CTA plus the source repository link.
 * `githubLabel` is resolved by the caller (MarketingLanding) so the literal
 * copy("landing.cta.secondary") call stays in the file the repo tests pin.
 */
export function DownloadButtons({ copy, githubLabel }) {
  const secondaryLinks = [
    { key: REPO_URL, href: REPO_URL, Icon: GithubIcon, label: githubLabel },
  ];

  return (
    <div className="flex justify-center">
      {/* The primary pill sets the column width; the secondary pills split it
          exactly, so the whole group reads as one aligned block. */}
      <div className="flex min-w-[16rem] flex-col items-stretch">
        <a
          href={WIN_SETUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-oai-gray-950 shadow-lg shadow-black/30 transition-all duration-200 hover:bg-oai-gray-100 active:scale-[0.98]"
        >
          <WindowsIcon className="h-4 w-4" />
          {copy("landing.v2.install.win_cta")}
        </a>
        <div className="mt-3 flex gap-3">
          {secondaryLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-oai-black/60 px-3 text-sm font-medium text-oai-gray-200 backdrop-blur-sm transition-colors hover:border-white/25 hover:text-white"
            >
              <link.Icon className="h-4 w-4 shrink-0 text-oai-gray-400 group-hover:text-white" />
              <span className="truncate">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
