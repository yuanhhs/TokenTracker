import React from "react";

/**
 * SVG icon data for AI provider tools.
 * Extracted from @lobehub/icons to avoid heavy dependencies.
 * Mono variants use currentColor for dark/light mode support.
 */

function ClaudeIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

function CodexIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" className={className}>
      <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
    </svg>
  );
}

function CursorIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z" />
    </svg>
  );
}

function GeminiIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
    </svg>
  );
}

function GrokIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
    </svg>
  );
}

function KiroIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 -1 22 28" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M4.125 20.149c-2.69 5.959 3.036 7.453 7.26 3.966 1.24 3.91 5.898.993 7.569-2.036 3.682-6.678 2.195-13.49 1.813-14.895-2.617-9.582-15.699-9.592-17.95.049-.526 1.687-.535 3.606-.833 5.598-.15 1.005-.256 1.646-.645 2.703-.223.607-.53 1.147-1.014 2.056-.75 1.412-.434 4.138 3.434 2.724v.001ZM11.895 11.332c-1.073 0-1.234-1.283-1.234-2.048 0-.69.124-1.239.358-1.586a1 1 0 0 1 .876-.462c.375 0 .697.158.924.47.259.354.395.9.395 1.578 0 1.283-.493 2.048-1.319 2.048Zm4.416 0c-1.073 0-1.234-1.283-1.234-2.048 0-.69.124-1.239.358-1.586a1 1 0 0 1 .876-.462c.375 0 .697.158.924.47.259.354.396.9.396 1.578 0 1.283-.494 2.048-1.32 2.048Z" />
    </svg>
  );
}

function KimiIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z" />
      <path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" />
    </svg>
  );
}

function CopilotIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M19.245 5.364c1.322 1.36 1.877 3.216 2.11 5.817.622 0 1.2.135 1.592.654l.73.964c.21.278.323.61.323.955v2.62c0 .339-.173.669-.453.868C20.239 19.602 16.157 21.5 12 21.5c-4.6 0-9.205-2.583-11.547-4.258-.28-.2-.452-.53-.453-.868v-2.62c0-.345.113-.679.321-.956l.73-.963c.392-.517.974-.654 1.593-.654l.029-.297c.25-2.446.81-4.213 2.082-5.52 2.461-2.54 5.71-2.851 7.146-2.864h.198c1.436.013 4.685.323 7.146 2.864zm-7.244 4.328c-.284 0-.613.016-.962.05-.123.447-.305.85-.57 1.108-1.05 1.023-2.316 1.18-2.994 1.18-.638 0-1.306-.13-1.851-.464-.516.165-1.012.403-1.044.996a65.882 65.882 0 00-.063 2.884l-.002.48c-.002.563-.005 1.126-.013 1.69.002.326.204.63.51.765 2.482 1.102 4.83 1.657 6.99 1.657 2.156 0 4.504-.555 6.985-1.657a.854.854 0 00.51-.766c.03-1.682.006-3.372-.076-5.053-.031-.596-.528-.83-1.046-.996-.546.333-1.212.464-1.85.464-.677 0-1.942-.157-2.993-1.18-.266-.258-.447-.661-.57-1.108-.32-.032-.64-.049-.96-.05zm-2.525 4.013c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zm5 0c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zM7.635 5.087c-1.05.102-1.935.438-2.385.906-.975 1.037-.765 3.668-.21 4.224.405.394 1.17.657 1.995.657h.09c.649-.013 1.785-.176 2.73-1.11.435-.41.705-1.433.675-2.47-.03-.834-.27-1.52-.63-1.813-.39-.336-1.275-.482-2.265-.394zm6.465.394c-.36.292-.6.98-.63 1.813-.03 1.037.24 2.06.675 2.47.968.957 2.136 1.104 2.776 1.11h.044c.825 0 1.59-.263 1.995-.657.555-.556.765-3.187-.21-4.224-.45-.468-1.335-.804-2.385-.906-.99-.088-1.875.058-2.265.394zM12 7.615c-.24 0-.525.015-.84.044.03.16.045.336.06.526l-.001.159a2.94 2.94 0 01-.014.25c.225-.022.425-.027.612-.028h.366c.187 0 .387.006.612.028-.015-.146-.015-.277-.015-.409.015-.19.03-.365.06-.526a9.29 9.29 0 00-.84-.044z" />
    </svg>
  );
}

// Official CodeBuddy mascot mark. Provided by Tencent. Mono variant — the
// outer rounded rect is set to fill="none" so the icon picks up currentColor
// from the surrounding text colour, matching the other monochrome provider
// icons and adapting to dark/light mode automatically.
function CodeBuddyIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 60"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M37.2114 3.75318C37.6821 3.33106 37.7106 3.31457 38.0558 3.29385C38.6149 3.2531 39.1272 3.52199 39.9989 4.31564C42.0356 6.16652 44.8714 9.97183 46.6346 13.2212L47.3163 14.4819L48.2782 14.9605C49.2072 15.4299 50.7308 16.3923 51.3672 16.9085C51.655 17.1464 51.6956 17.1508 51.9947 17.0344C53.3454 16.5084 55.2803 17.206 56.9869 18.8432C58.5231 20.3155 59.9943 22.8312 60.558 24.9308C60.6403 25.2687 60.7493 25.9952 60.7891 26.5362C60.9177 28.4358 60.3092 29.9532 59.1362 30.64C58.8965 30.7784 58.8801 30.8158 58.8868 31.4132C58.9409 34.2583 58.1741 37.0985 56.6335 39.8679C54.8946 42.9773 51.7981 46.1938 47.6074 49.2243C45.357 50.8619 40.0323 53.964 37.6248 55.0532C31.8578 57.6496 27.2346 58.646 23.2188 58.154C20.8236 57.8638 18.1124 56.9287 16.5082 55.8433C16.086 55.5515 16.0191 55.5329 15.6966 55.6251C13.9793 56.1185 11.73 55.1053 9.81931 52.9844C9.05725 52.1366 7.82714 50.0548 7.42839 48.9409C6.50606 46.3339 6.68976 43.9816 7.91836 42.5767C8.23573 42.2149 8.2453 42.1995 8.17598 41.5912C8.06148 40.5951 8.00971 39.1206 8.06202 38.1692L8.10361 37.2803L6.76977 34.9212C4.70378 31.2451 3.3912 28.1582 2.88489 25.7998C2.61762 24.5066 2.63385 23.9324 2.96214 23.5078C3.16198 23.2515 3.81796 22.9866 4.60785 22.8407C6.59665 22.4917 10.9334 22.8076 15.7581 23.6595L16.259 23.7458L17.3608 22.7713C19.1891 21.1519 20.4038 20.244 22.6429 18.8478C24.9768 17.3876 27.6108 16.1858 30.577 15.2346L31.5295 14.9294L32.0526 13.5561C33.9257 8.61146 35.8437 4.96584 37.2114 3.75318ZM21.5208 29.0919C19.404 30.314 18.3453 30.9251 17.5676 31.6099C14.4179 34.3835 13.2414 38.777 14.5823 42.7537C14.9135 43.7357 15.5247 44.7942 16.7469 46.9111C17.9691 49.0279 18.5801 50.0865 19.2649 50.8643C22.0385 54.014 26.4316 55.1918 30.4084 53.8509C31.3904 53.5198 32.4489 52.9085 34.5657 51.6863L46.7442 44.6551C48.8613 43.4328 49.9205 42.8214 50.6983 42.1365C53.8479 39.363 55.0245 34.9695 53.6835 30.9927C53.3524 30.0107 52.7412 28.9522 51.519 26.8354C50.2968 24.7185 49.6858 23.66 49.0009 22.8822C46.2274 19.7325 41.8342 18.5547 37.8575 19.8956C36.8754 20.2267 35.8163 20.8383 33.6993 22.0606L21.5208 29.0919Z"
      />
      <g transform="rotate(-30 22.6953 37.6011)">
        <rect x="22.6953" y="37.6011" width="4.81084" height="9.99175" rx="2.40542" fill="currentColor" />
      </g>
      <g transform="rotate(-30 35.6748 30.1074)">
        <rect x="35.6748" y="30.1074" width="4.81084" height="9.99175" rx="2.40542" fill="currentColor" />
      </g>
    </svg>
  );
}

// TRAE Work CN — official app-logo mark reverse-engineered from
// https://work.trae.cn/ favicon (48×48) and PWA manifest icon-512.png
// (pixel-accurate geometry, 512×512 canvas).
//
// Structure (confirmed against 512px source RGBA raster):
//   • White rounded square (#FFFFFF, corners transparent so the circular
//     alpha mask reads correctly on any browser tab chrome).
//   • Pure black (#000000) bracket-frame glyph over it:
//       – a full-width top crossbar,
//       – two 36px-thick vertical arms (left arm floats; right arm anchors
//         the bottom crossbar which therefore sits 36px inset on the left),
//       – two spindle accents midway inside the arms (rhombic ellipses,
//         rx≈24 ry≈22).
//
// The white plate + solid black ink matches the favicon pixel-for-pixel and
// therefore stays consistent with the brand assets served from work.trae.cn.
function TraeCnIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      data-brand="trae-cn"
      aria-hidden="true"
    >
      {/* White rounded square plate — corners inherit transparent background */}
      <rect x="48" y="48" width="416" height="416" rx="76" fill="#FFFFFF" />

      {/* Top crossbar + right arm + bottom crossbar (one contiguous polygon) */}
      <path
        fill="#000000"
        d="M130 168 H381 V344 H166 V312 H346 V204 H130 Z"
      />

      {/* Free-standing left arm (stops 36px above the bottom crossbar, which
          leaves the characteristic step-clear on the lower-left) */}
      <path
        fill="#000000"
        d="M130 204 H165 V308 H130 Z"
      />

      {/* Left spindle accent (rhombic ellipse, rx≈24 ry≈22) */}
      <path
        fill="#000000"
        d="M231 234 C244 234 254 244 254 256 C254 268 244 278 231 278 C218 278 207 268 207 256 C207 244 218 234 231 234 Z"
      />

      {/* Right spindle accent (rhombic ellipse, rx=24 ry=22) */}
      <path
        fill="#000000"
        d="M302 234 C315 234 326 244 326 256 C326 268 315 278 302 278 C289 278 278 268 278 256 C278 244 289 234 302 234 Z"
      />
    </svg>
  );
}

function GithubIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GitlabIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263c-.135-.423-.73-.423-.867 0L1.388 9.452.045 13.587a.924.924 0 0 0 .331 1.03L12 23.054l11.625-8.436a.92.92 0 0 0 .33-1.031" />
    </svg>
  );
}

// Craft Agents — official brand mark (three stacked rectangle bars in
// Craft purple #9570BE). The brand color reads well on both light and
// dark backgrounds, so it does not adapt to currentColor.
function CraftIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(3.4502, 3)" fill="#9570BE">
        <path
          d="M3.17890888,3.6 L3.17890888,0 L16,0 L16,3.6 L3.17890888,3.6 Z M9.642,7.2 L9.64218223,10.8 L0,10.8 L0,3.6 L16,3.6 L16,7.2 L9.642,7.2 Z M3.17890888,18 L3.178,14.4 L0,14.4 L0,10.8 L16,10.8 L16,18 L3.17890888,18 Z"
          fillRule="nonzero"
        />
      </g>
    </svg>
  );
}

function OmpIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 90" fill="currentColor" className={className}>
      {/* Horizontal bar of pi */}
      <rect x="10" y="8" width="100" height="12" rx="2" />
      {/* Left leg */}
      <rect x="25" y="20" width="12" height="62" rx="2" />
      {/* Right leg (shortened for connector) */}
      <rect x="75" y="20" width="12" height="45" rx="2" />
      {/* Plugin connector block */}
      <rect x="71" y="55" width="20" height="16" rx="3" />
      {/* Connector prongs */}
      <rect x="76" y="71" width="3" height="8" rx="1" />
      <rect x="82" y="71" width="3" height="8" rx="1" />
    </svg>
  );
}

function PiIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 90" fill="currentColor" className={className}>
      <rect x="10" y="8" width="100" height="12" rx="2" />
      <rect x="25" y="20" width="12" height="62" rx="2" />
      <rect x="83" y="20" width="12" height="62" rx="2" />
    </svg>
  );
}

function DroidIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* antennae */}
      <path d="M9 3v2" />
      <path d="M15 3v2" />
      {/* head */}
      <rect x="4" y="6" width="16" height="13" rx="3" />
      {/* eyes */}
      <circle cx="9" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.4" fill="currentColor" stroke="none" />
      {/* mouth slot */}
      <path d="M9 16h6" />
    </svg>
  );
}

// ZCode is Z.ai's coding agent — use the official Z.ai logomark (three diagonal
// slashes forming a "Z"). Mono / currentColor, so it renders through the inline
// component path. Source: @lobehub/icons "zai".
function ZcodeIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z" />
    </svg>
  );
}

// RooCode (Roo-Cline) — official mono logomark from @lobehub/icons.
// A stylized bird/kangaroo silhouette, mono with currentColor for dark/light.
function RoocodeIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M20.113 5.5l-.442 1.557a.157.157 0 01-.196.106l-7.414-2.157a.16.16 0 00-.143.028l-7.342 5.74a.159.159 0 01-.074.032l-4.37.656a.154.154 0 00-.132.162l.02.245c.005.078.071.14.152.141l5.074.128.058.002 3.75-1.953a.16.16 0 01.164.01l2.657 1.847a.152.152 0 01.066.125l-.023 2.45c0 .032.01.063.028.089l3.737 5.227c.03.04.077.065.129.065h1.182a.153.153 0 00.14-.224l-2.664-4.919a.15.15 0 01.005-.152l1.389-2.169a.156.156 0 01.062-.055l4.965-2.456a.16.16 0 01.158.01l1.418.921a.16.16 0 00.087.026h1.289c.125 0 .2-.136.13-.237l-3.578-5.29c-.074-.109-.246-.082-.282.044z" />
    </svg>
  );
}

// Goose (Block) — official mono logomark from @lobehub/icons.
// A goose silhouette in flight, mono with currentColor for dark/light.
function GooseIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M21.595 23.61c1.167-.254 2.405-.944 2.405-.944l-2.167-1.784a12.124 12.124 0 01-2.695-3.131 12.127 12.127 0 00-3.97-4.049l-.794-.462a1.115 1.115 0 01-.488-.815.844.844 0 01.154-.575c.413-.582 2.548-3.115 2.94-3.44.503-.416 1.065-.762 1.586-1.159.074-.056.148-.112.221-.17.003-.002.007-.004.009-.007.167-.131.325-.272.45-.438.453-.524.563-.988.59-1.193-.061-.197-.244-.639-.753-1.148.319.02.705.272 1.056.569.235-.376.481-.773.727-1.171.165-.266-.08-.465-.086-.471h-.001V3.22c-.007-.007-.206-.25-.471-.086-.567.35-1.134.702-1.639 1.021 0 0-.597-.012-1.305.599a2.464 2.464 0 00-.438.45l-.007.009c-.058.072-.114.147-.17.221-.397.521-.743 1.083-1.16 1.587-.323.391-2.857 2.526-3.44 2.94a.842.842 0 01-.574.153 1.115 1.115 0 01-.815-.488l-.462-.794a12.123 12.123 0 00-4.049-3.97 12.133 12.133 0 01-3.13-2.695L1.332 0S.643 1.238.39 2.405c.352.428 1.27 1.49 2.34 2.302C1.58 4.167.73 3.75.06 3.4c-.103.765-.063 1.92.043 2.816.726.317 1.961.806 3.219 1.066-1.006.236-2.11.278-2.961.262.15.554.358 1.119.64 1.688.119.263.25.52.39.77.452.125 2.222.383 3.164.171l-2.51.897a27.776 27.776 0 002.544 2.726c2.031-1.092 2.494-1.241 4.018-2.238-2.467 2.008-3.108 2.828-3.8 3.67l-.483.678c-.25.351-.469.725-.65 1.117-.61 1.31-1.47 4.1-1.47 4.1-.154.486.202.842.674.674 0 0 2.79-.861 4.1-1.47.392-.182.766-.4 1.118-.65l.677-.483c.227-.187.453-.37.701-.586 0 0 1.705 2.02 3.458 3.349l.896-2.511c-.211.942.046 2.712.17 3.163.252.142.509.272.772.392.569.28 1.134.49 1.688.64-.016-.853.026-1.956.261-2.962.26 1.258.75 2.493 1.067 3.219.895.106 2.051.146 2.816.043a73.87 73.87 0 01-1.308-2.67c.811 1.07 1.874 1.988 2.302 2.34h-.001z" />
    </svg>
  );
}

// KiloCode — official mono logomark from @lobehub/icons.
// A stylized grid/maze pattern, mono with currentColor for dark/light.
function KilocodeIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className}>
      <path d="M0 0v24h24V0H0zm22.222 22.222H1.778V1.778h20.444v20.444zm-7.555-4.964h2.222v1.778h-2.794L12.89 17.83v-2.794h1.778v2.222zm4 0h-1.778v-2.222h-2.222v-1.778h2.793l1.207 1.207v2.793zm-7.556-2.591H9.333v-1.778h1.778v1.778zm-5.778-1.778h1.778v4h4v1.778H6.54L5.333 17.46V12.89zm13.334-3.556v1.778h-5.778V9.333h1.987V7.111h-1.987V5.333h2.558l1.206 1.207v2.793h2.014zm-11.556-2h2.222l1.778 1.778v2H9.333v-2H7.111v2H5.333V5.333h1.778v2zm4 0H9.333v-2h1.778v2z" />
    </svg>
  );
}

// Official DeepSeek Harness FishLogo geometry from deepseek-ai/deepseek-harness.
// Harness deliberately renders the shared fish silhouette in currentColor so
// it follows the product's wordmark ink in both light and dark themes.
function DeepSeekHarnessIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 23.16 17.04"
      fill="none"
      className={className}
      data-brand="deepseek-harness"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876.856163 16.5421.597155 16.4591.341647C16.4061.187643 16.3536.0301382 16.1761.00363739C15.9836-.0263635 15.9081.135141 15.8326.270145C15.5306.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028.923165 12.277.833162C12.5375.739159 12.3675.41615 11.5259.42015C10.6844.42365 9.91439.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C.0790928 5.4103-.222916 7.41536.146595 9.50642C.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" />
    </svg>
  );
}

const PROVIDER_ICON_MAP = {
  CLAUDE: ClaudeIcon,
  ZCODE: ZcodeIcon,
  CODEBUDDY: CodeBuddyIcon,
  // WorkBuddy ships the same Tencent "buddy" mascot mark as CodeBuddy.
  WORKBUDDY: CodeBuddyIcon,
  CODEX: CodexIcon,
  COPILOT: CopilotIcon,
  CRAFT: CraftIcon,
  CURSOR: CursorIcon,
  DEEPSEEK: DeepSeekHarnessIcon,
  DSH: DeepSeekHarnessIcon,
  DROID: DroidIcon,
  "EVERY-CODE": CodexIcon,
  GEMINI: GeminiIcon,
  GITHUB: GithubIcon,
  GITLAB: GitlabIcon,
  GOOSE: GooseIcon,
  GROK: GrokIcon,
  KIMI: KimiIcon,
  KIRO: KiroIcon,
  KILOCODE: KilocodeIcon,
  OMP: OmpIcon,
  PI: PiIcon,
  "PI-ANTHROPIC": PiIcon,
  "PI-GITHUB-COPILOT": PiIcon,
  "PI-COPILOT": PiIcon,
  ROOCODE: RoocodeIcon,
  "TRAE-CN": TraeCnIcon,
};

// Multi-color brand SVG assets in /public/brand-logos/. Only logos that have
// real brand colors live here — mono logos (cursor/kiro/copilot/kimi all use
// `fill="currentColor"`) must render through the inline component path so they
// inherit the surrounding text color, since <img> doesn't resolve currentColor.
const PROVIDER_LOGO_MAP = {
  ANTIGRAVITY: "/brand-logos/antigravity.svg",
  ANYTHINGLLM: "/brand-logos/anythingllm.svg",
  CLAUDE: "/brand-logos/claude-code.svg",
  "CLAUDE-SCIENCE": "/brand-logos/claude-code.svg",
  CODEX: "/brand-logos/codex.svg",
  GEMINI: "/brand-logos/gemini.svg",
  "KILO-CLI": "/brand-logos/kilo.svg",
  "KILO-CODE": "/brand-logos/kilo.svg",
  MIMO: "/brand-logos/mimo.svg",
  // oh-my-pi: multi-color brand mark (pi letterform + plugin connector). pi
  // itself publishes a white-only mark (pi.dev/logo.svg), so it gets the same
  // <img> luminance treatment as AnythingLLM in PROVIDER_LOGO_CLASS_MAP.
  OMP: "/brand-logos/omp.svg",
  PI: "/brand-logos/pi.svg",
  // Dots Studio's sail mark (right triangle + hull bar), not the chat-app
  // droplet — Dots has its own recognizable brand mark, so it overrides the
  // generic pi fallback below for both the standalone "dots" provider and the
  // pi-routed source.
  DOTS: "/brand-logos/dots.png",
  "PI-DOTS": "/brand-logos/dots.png",
  REASONIX: "/brand-logos/reasonix.png",
};

// AnythingLLM publishes this compact mark in white. Keep the official asset
// and switch its luminance at the <img> boundary so app-controlled dark mode
// (which may differ from the OS preference) always has sufficient contrast.
const PROVIDER_LOGO_CLASS_MAP = {
  ANYTHINGLLM: "brightness-0 dark:brightness-100",
  // pi publishes its mark in white only (pi.dev/logo.svg) — same treatment
  // as AnythingLLM: black on light backgrounds, native white on dark.
  PI: "brightness-0 dark:brightness-100",
  // The sail PNG is solid black on transparent — invert to white in dark
  // mode so it doesn't disappear against the dark dashboard background.
  DOTS: "dark:invert",
  "PI-DOTS": "dark:invert",
};

// pi is a router: rollout.js mints one source per routed backend
// (`pi-anthropic`, `pi-xai`, `pi-custom`, …) from an open-ended provider
// slug, so the brand mark is resolved by prefix rather than by enumerating
// backends — an unlisted one used to fall through to the dashed placeholder.
function piAwareLogoKey(normalized) {
  if (PROVIDER_LOGO_MAP[normalized]) return normalized;
  return normalized.startsWith("PI-") ? "PI" : normalized;
}

function PlaceholderIcon({ size = 16, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="7.5" strokeDasharray="3 3" />
    </svg>
  );
}

/**
 * Renders a provider's brand icon. Prefers the original multi-color logo from
 * /brand-logos/ when available, otherwise falls back to a mono SVG (currentColor).
 */
export function ProviderIcon({ provider, size = 16, color, className = "" }) {
  const normalized = provider?.toUpperCase?.() || "";
  const logoKey = piAwareLogoKey(normalized);
  const logoSrc = PROVIDER_LOGO_MAP[logoKey];

  if (logoSrc) {
    const logoClassName = `${PROVIDER_LOGO_CLASS_MAP[logoKey] || ""} ${className}`.trim();
    return (
      <img
        src={logoSrc}
        alt=""
        width={size}
        height={size}
        className={logoClassName}
        style={{ width: size, height: size, objectFit: "contain" }}
        aria-hidden
      />
    );
  }

  const IconComponent = PROVIDER_ICON_MAP[normalized];

  if (IconComponent) {
    return <IconComponent size={size} className={className} />;
  }

  // Fallback: dashed placeholder circle for unknown/other providers to keep layout aligned
  return (
    <PlaceholderIcon 
      size={size} 
      className={`text-oai-gray-400 dark:text-oai-gray-500 shrink-0 ${className}`} 
    />
  );
}
