// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#include "chrome/browser/sedo/feed_blocker.h"

#include "chrome/browser/sedo/dark-patterns/endless-scroll/all-sites/endless_scroll.h"
#include "chrome/browser/sedo/dark-patterns/recommendation-feed/youtube/youtube_recommendation_feed.h"
#include "chrome/browser/sedo/dark-patterns/short-form-video/all-sites/short_form_video.h"

namespace sedo {

bool FeedBlocker::MatchesFeed(std::string_view signature) {
  // recommendation-feed / youtube
  return YouTubeRecommendationFeed::MatchesFeed(signature);
}

std::string FeedBlocker::BlockFeed(std::string_view host,
                                   const FeedBlockerSwitches& switches) {
  std::string script;
  // recommendation-feed / youtube
  if (YouTubeRecommendationFeed::HandlesHost(host)) {
    script += YouTubeRecommendationFeed::BlockScript();
  }
  // short-form-video / all-sites
  if (switches.short_form_video) {
    script += ShortFormVideo::BlockScript();
  }
  // endless-scroll / all-sites
  if (switches.endless_scroll) {
    script += EndlessScroll::BlockScript(switches.endless_scroll_limit);
  }
  return script;
}

}  // namespace sedo
