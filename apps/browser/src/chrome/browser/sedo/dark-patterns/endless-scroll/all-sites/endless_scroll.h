// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_BROWSER_SEDO_DARK_PATTERNS_ENDLESS_SCROLL_ALL_SITES_ENDLESS_SCROLL_H_
#define CHROME_BROWSER_SEDO_DARK_PATTERNS_ENDLESS_SCROLL_ALL_SITES_ENDLESS_SCROLL_H_

#include <string>
#include <string_view>

namespace sedo {

// Pattern endless-scroll, every site. The folder README describes the
// detection. selectors.json and block.template.js are the sources; block.js
// is the page function the browser calls with the start-page limit.
class EndlessScroll {
 public:
  static constexpr std::string_view kPattern = "endless-scroll";
  static constexpr std::string_view kSite = "all-sites";

  // The start-page limit, kept between 0 and kMaxLimit.
  static int ClampLimit(int max_scrolls);

  // Document-start script for any http(s) document. A feed loads more at most
  // max_scrolls times; the next load is held back.
  static std::string BlockScript(int max_scrolls);

 private:
  EndlessScroll() = delete;
};

}  // namespace sedo

#endif  // CHROME_BROWSER_SEDO_DARK_PATTERNS_ENDLESS_SCROLL_ALL_SITES_ENDLESS_SCROLL_H_
