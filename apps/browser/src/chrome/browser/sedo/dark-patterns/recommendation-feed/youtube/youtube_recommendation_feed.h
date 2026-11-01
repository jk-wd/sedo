// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_BROWSER_SEDO_DARK_PATTERNS_RECOMMENDATION_FEED_YOUTUBE_YOUTUBE_RECOMMENDATION_FEED_H_
#define CHROME_BROWSER_SEDO_DARK_PATTERNS_RECOMMENDATION_FEED_YOUTUBE_YOUTUBE_RECOMMENDATION_FEED_H_

#include <string>
#include <string_view>

namespace sedo {

// Pattern recommendation-feed, site youtube. The folder README lists the
// surfaces this removes. selectors.json and block.template.js are the
// sources; block.js is what runs in the page.
class YouTubeRecommendationFeed {
 public:
  static constexpr std::string_view kPattern = "recommendation-feed";
  static constexpr std::string_view kSite = "youtube";

  // True for youtube.com, www.youtube.com, and m.youtube.com.
  static bool HandlesHost(std::string_view host);

  // True for a home-feed or watch-recommendation selector. False for the
  // player, the playlist queue, search, and the guide.
  static bool MatchesFeed(std::string_view signature);

  // Document-start script. It leaves other hosts and /embed/ alone.
  static std::string BlockScript();

 private:
  YouTubeRecommendationFeed() = delete;
};

}  // namespace sedo

#endif  // CHROME_BROWSER_SEDO_DARK_PATTERNS_RECOMMENDATION_FEED_YOUTUBE_YOUTUBE_RECOMMENDATION_FEED_H_
