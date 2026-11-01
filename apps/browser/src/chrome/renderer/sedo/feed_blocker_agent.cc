// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#include "chrome/renderer/sedo/feed_blocker_agent.h"

#include <string>

#include "chrome/browser/sedo/feed_blocker.h"
#include "content/public/renderer/render_frame.h"
#include "third_party/blink/public/web/web_document.h"
#include "third_party/blink/public/web/web_local_frame.h"
#include "third_party/blink/public/web/web_script_source.h"
#include "url/gurl.h"

namespace sedo {

FeedBlockerAgent::FeedBlockerAgent(content::RenderFrame* render_frame)
    : content::RenderFrameObserver(render_frame) {}

void FeedBlockerAgent::Install(content::RenderFrame* render_frame,
                               const FeedBlockerSwitches& switches) {
  if (!render_frame) {
    return;
  }
  blink::WebLocalFrame* web_frame = render_frame->GetWebFrame();
  if (!web_frame) {
    return;
  }
  const GURL url(web_frame->GetDocument().Url());
  if (!url.SchemeIsHTTPOrHTTPS()) {
    return;
  }
  const std::string script = FeedBlocker::BlockFeed(url.host(), switches);
  if (script.empty()) {
    return;
  }
  web_frame->ExecuteScript(
      blink::WebScriptSource(blink::WebString::FromUtf8(script)));
}

void FeedBlockerAgent::OnDestruct() {
  delete this;
}

}  // namespace sedo
