// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_BROWSER_SEDO_FEED_BLOCKER_H_
#define CHROME_BROWSER_SEDO_FEED_BLOCKER_H_

#include <string>
#include <string_view>

namespace sedo {

// Start-page switches the browser sends to every renderer in DynamicParams.
struct FeedBlockerSwitches {
  bool short_form_video = true;
  bool endless_scroll = true;
  int endless_scroll_limit = 3;
};

// Registry of dark-pattern blockers. Each policy lives in
// dark-patterns/<pattern>/<site>/, with a README and a proof/ folder.
// recommendation-feed / youtube runs on YouTube hosts. short-form-video /
// all-sites and endless-scroll / all-sites run on every http(s) page while
// their start-page switch is on.
class FeedBlocker {
 public:
  // True when signature is a feed surface for an installed policy.
  static bool MatchesFeed(std::string_view signature);

  // Document-start script for a document on host. Empty when no policy
  // applies.
  static std::string BlockFeed(std::string_view host,
                               const FeedBlockerSwitches& switches);

 private:
  FeedBlocker() = delete;
};

}  // namespace sedo

#endif  // CHROME_BROWSER_SEDO_FEED_BLOCKER_H_
