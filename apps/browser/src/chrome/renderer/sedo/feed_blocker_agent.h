// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_RENDERER_SEDO_FEED_BLOCKER_AGENT_H_
#define CHROME_RENDERER_SEDO_FEED_BLOCKER_AGENT_H_

#include "chrome/browser/sedo/feed_blocker.h"
#include "content/public/renderer/render_frame_observer.h"

namespace content {
class RenderFrame;
}

namespace sedo {

// Renderer observer. Runs the dark-pattern scripts at document start on an
// http(s) document. Policies live under
// chrome/browser/sedo/dark-patterns/<pattern>/<site>/.
// Proof of concept: this calls browser-side FeedBlocker directly. A full
// Chromium link must move that policy into a component both processes link.
class FeedBlockerAgent : public content::RenderFrameObserver {
 public:
  explicit FeedBlockerAgent(content::RenderFrame* render_frame);

  // Runs once the document element exists and scripts are allowed.
  // DidCreateDocumentElement is inside a script-forbidden scope, so injecting
  // there is silently dropped. BlockFeed's script watches later DOM insertions.
  // switches come from the renderer's DynamicParams. A change applies to the
  // next document.
  static void Install(content::RenderFrame* render_frame,
                      const FeedBlockerSwitches& switches);

 private:
  void OnDestruct() override;
};

}  // namespace sedo

#endif  // CHROME_RENDERER_SEDO_FEED_BLOCKER_AGENT_H_
