// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#include "chrome/browser/sedo/dark-patterns/short-form-video/all-sites/short_form_video.h"

#include <cmath>
#include <string>
#include <string_view>

namespace sedo {
namespace {

#include "chrome/browser/sedo/dark-patterns/short-form-video/all-sites/selectors.inc"

}  // namespace

bool ShortFormVideo::IsShortForm(double width,
                                 double height,
                                 double duration_seconds) {
  if (!(width > 0) || !(height > 0)) {
    return false;
  }
  if (!std::isfinite(duration_seconds) || duration_seconds <= 0) {
    return false;
  }
  return height / width >= kMinPortraitRatio &&
         duration_seconds <= kMaxDurationSeconds;
}

std::string ShortFormVideo::BlockScript() {
  return std::string(
#include "chrome/browser/sedo/dark-patterns/short-form-video/all-sites/block_script.inc"
  );
}

}  // namespace sedo
