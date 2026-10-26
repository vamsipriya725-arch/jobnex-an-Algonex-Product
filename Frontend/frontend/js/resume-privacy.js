/**
 * JobNex - Resume Analysis Script (Compatibility Alias)
 * Directs to the core Resume Analyzer logic for instant ATS matching and MySQL Workbench integration.
 */

// If resume-analyzer.js is already running on this page, avoid double-binding
if (!window._resumeAnalyzerLoaded) {
  window._resumeAnalyzerLoaded = true;
  // Load and execute resume-analyzer
  const s = document.createElement("script");
  s.src = "../js/resume-analyzer.js?v=2.2";
  document.head.appendChild(s);
}
