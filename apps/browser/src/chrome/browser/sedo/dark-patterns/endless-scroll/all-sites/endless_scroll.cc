// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#include "chrome/browser/sedo/dark-patterns/endless-scroll/all-sites/endless_scroll.h"

#include <algorithm>
#include <string>
#include <string_view>

namespace sedo {
namespace {

#include "chrome/browser/sedo/dark-patterns/endless-scroll/all-sites/selectors.inc"

}  // namespace

int EndlessScroll::ClampLimit(int max_scrolls) {
  return std::clamp(max_scrolls, 0, static_cast<int>(kMaxLimit));
}

std::string EndlessScroll::BlockScript(int max_scrolls) {
  // block_script.inc is a function expression. The call passes the limit.
  return std::string(
#include "chrome/browser/sedo/dark-patterns/endless-scroll/all-sites/block_script.inc"
             ) +
         "(" + std::to_string(ClampLimit(max_scrolls)) + ");\n";
}

}  // namespace sedo
