// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#include "chrome/browser/sedo/dark-patterns/recommendation-feed/youtube/youtube_recommendation_feed.h"

#include <cstddef>
#include <string>
#include <string_view>

namespace sedo {
namespace {

#include "chrome/browser/sedo/dark-patterns/recommendation-feed/youtube/selectors.inc"

bool Contains(std::string_view haystack, std::string_view needle) {
  return haystack.find(needle) != std::string_view::npos;
}

template <size_t N>
bool ContainsAny(std::string_view signature,
                 const std::string_view (&values)[N]) {
  for (const std::string_view value : values) {
    if (Contains(signature, value)) {
      return true;
    }
  }
  return false;
}

}  // namespace

bool YouTubeRecommendationFeed::HandlesHost(std::string_view host) {
  for (const std::string_view item : kYouTubeHosts) {
    if (host == item) {
      return true;
    }
  }
  return false;
}

bool YouTubeRecommendationFeed::MatchesFeed(std::string_view signature) {
  if (ContainsAny(signature, kProtectedSelectors)) {
    return false;
  }
  if (Contains(signature, kYouTubeMobileWatchRoot) ||
      ContainsAny(signature, kYouTubeWatchSelectors) ||
      ContainsAny(signature, kYouTubeWatchItemSelectors) ||
      ContainsAny(signature, kYouTubeHomeSelectors) ||
      ContainsAny(signature, kYouTubeMobileWatchItems)) {
    return true;
  }
  return false;
}

std::string YouTubeRecommendationFeed::BlockScript() {
  return std::string(
#include "chrome/browser/sedo/dark-patterns/recommendation-feed/youtube/block_script.inc"
  );
}

}  // namespace sedo
