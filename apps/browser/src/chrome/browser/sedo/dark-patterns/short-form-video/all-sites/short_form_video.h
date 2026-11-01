// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_BROWSER_SEDO_DARK_PATTERNS_SHORT_FORM_VIDEO_ALL_SITES_SHORT_FORM_VIDEO_H_
#define CHROME_BROWSER_SEDO_DARK_PATTERNS_SHORT_FORM_VIDEO_ALL_SITES_SHORT_FORM_VIDEO_H_

#include <string>
#include <string_view>

namespace sedo {

// Pattern short-form-video, every site. The folder README lists what this
// blocks. selectors.json and block.template.js are the sources; block.js is
// what runs in the page. The start-page switch decides whether it runs.
class ShortFormVideo {
 public:
  static constexpr std::string_view kPattern = "short-form-video";
  static constexpr std::string_view kSite = "all-sites";

  // True for a portrait video with a finite length of at most
  // kMaxDurationSeconds. The page script applies the same rule.
  static bool IsShortForm(double width, double height, double duration_seconds);

  // Document-start script for any http(s) document.
  static std::string BlockScript();

 private:
  ShortFormVideo() = delete;
};

}  // namespace sedo

#endif  // CHROME_BROWSER_SEDO_DARK_PATTERNS_SHORT_FORM_VIDEO_ALL_SITES_SHORT_FORM_VIDEO_H_
