// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_BROWSER_SEDO_SEDO_PREFS_H_
#define CHROME_BROWSER_SEDO_SEDO_PREFS_H_

namespace sedo::prefs {

// Profile pref, default true. The start page writes it. RendererUpdater sends
// it to every renderer as DynamicParams.sedo_short_form_video.
inline constexpr char kShortFormVideoBlocking[] =
    "sedo.short_form_video_blocking";

// Profile prefs, default true and 3. The start page writes them.
// RendererUpdater sends them as DynamicParams.sedo_endless_scroll and
// DynamicParams.sedo_endless_scroll_limit. The limit is 0 to 5 feed loads.
inline constexpr char kEndlessScrollLimiting[] =
    "sedo.endless_scroll_limiting";
inline constexpr char kEndlessScrollLimit[] = "sedo.endless_scroll_limit";
inline constexpr int kEndlessScrollDefaultLimit = 3;
inline constexpr int kEndlessScrollMaxLimit = 5;

}  // namespace sedo::prefs

#endif  // CHROME_BROWSER_SEDO_SEDO_PREFS_H_
