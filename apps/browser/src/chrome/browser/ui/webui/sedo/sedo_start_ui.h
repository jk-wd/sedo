// Copyright 2026 The Sedo Authors. All rights reserved.
// Use of this source code is governed by a BSD-3-clause license that can be
// found in the upstream LICENSE file. This project adds no Google telemetry.

#ifndef CHROME_BROWSER_UI_WEBUI_SEDO_SEDO_START_UI_H_
#define CHROME_BROWSER_UI_WEBUI_SEDO_SEDO_START_UI_H_

#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/memory/ref_counted_memory.h"
#include "base/path_service.h"
#include "base/strings/string_util.h"
#include "base/time/time.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/sedo/sedo_prefs.h"
#include "chrome/common/chrome_paths.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/browser_context.h"
#include "content/public/browser/storage_partition.h"
#include "content/public/browser/url_data_source.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "content/public/browser/webui_config.h"
#include "net/cookies/canonical_cookie.h"
#include "net/cookies/cookie_constants.h"
#include "net/cookies/cookie_options.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"
#include "services/network/public/mojom/cookie_manager.mojom.h"
#include "url/gurl.h"

// chrome://sedo/ serves the static start page copied into the framework
// Resources directory at build time. The YouTube switch is stored in the
// profile and mirrored to a cookie the recommendation-feed script reads. The
// short-form video and endless-scroll settings are profile prefs that reach
// every renderer.

inline constexpr char kSedoYouTubeFeedCookie[] =
    "sedo-recommendation-feed-youtube";

inline base::FilePath SedoStartPageDir() {
  base::FilePath resources;
  if (!base::PathService::Get(chrome::DIR_RESOURCES, &resources)) {
    return base::FilePath();
  }
  return resources.AppendASCII("sedo-start");
}

inline base::FilePath SedoStartSettingsPath(Profile* profile) {
  return profile->GetPath().AppendASCII("sedo-start-settings.json");
}

// Prefs for the switches that reach every renderer.
inline PrefService* SedoRendererPrefs(Profile* profile) {
  return profile->GetOriginalProfile()->GetPrefs();
}

inline base::DictValue ReadSedoRecommendationFeed(Profile* profile) {
  base::DictValue defaults =
      base::DictValue().Set("enabled", true).Set("youtube", true);
  std::string raw;
  if (!base::ReadFileToString(SedoStartSettingsPath(profile), &raw)) {
    return defaults;
  }
  std::optional<base::Value> parsed =
      base::JSONReader::Read(raw, base::JSON_PARSE_CHROMIUM_EXTENSIONS);
  if (!parsed || !parsed->is_dict()) {
    return defaults;
  }
  const base::DictValue* feed =
      parsed->GetDict().FindDict("recommendationFeed");
  if (!feed) {
    return defaults;
  }
  return base::DictValue()
      .Set("enabled", feed->FindBool("enabled").value_or(true))
      .Set("youtube", feed->FindBool("youtube").value_or(true));
}

inline base::DictValue ReadSedoStartSettings(Profile* profile) {
  PrefService* prefs = SedoRendererPrefs(profile);
  return base::DictValue()
      .Set("recommendationFeed", ReadSedoRecommendationFeed(profile))
      .Set("shortFormVideo",
           base::DictValue().Set(
               "enabled",
               prefs->GetBoolean(sedo::prefs::kShortFormVideoBlocking)))
      .Set("endlessScroll",
           base::DictValue()
               .Set("enabled",
                    prefs->GetBoolean(sedo::prefs::kEndlessScrollLimiting))
               .Set("limit",
                    prefs->GetInteger(sedo::prefs::kEndlessScrollLimit)));
}

inline bool SedoYouTubeFeedEnabled(const base::DictValue& settings) {
  const base::DictValue* feed = settings.FindDict("recommendationFeed");
  if (!feed) {
    return true;
  }
  return feed->FindBool("enabled").value_or(true) &&
         feed->FindBool("youtube").value_or(true);
}

inline void ApplySedoYouTubeFeedCookie(Profile* profile, bool enabled) {
  network::mojom::CookieManager* cookie_manager =
      profile->GetDefaultStoragePartition()->GetCookieManagerForBrowserProcess();
  if (!cookie_manager) {
    return;
  }
  if (enabled) {
    auto filter = network::mojom::CookieDeletionFilter::New();
    filter->cookie_name = kSedoYouTubeFeedCookie;
    cookie_manager->DeleteCookies(std::move(filter), base::DoNothing());
    return;
  }
  const GURL url("https://www.youtube.com/");
  const std::string line =
      std::string(kSedoYouTubeFeedCookie) +
      "=0; Domain=youtube.com; Path=/; Secure; SameSite=Lax; Max-Age=34560000";
  std::unique_ptr<net::CanonicalCookie> cookie = net::CanonicalCookie::Create(
      url, line, base::Time::Now(), std::nullopt, std::nullopt,
      net::CookieSourceType::kOther, nullptr);
  if (!cookie) {
    return;
  }
  cookie_manager->SetCanonicalCookie(*cookie, url,
                                     net::CookieOptions::MakeAllInclusive(),
                                     base::DoNothing());
}

inline bool WriteSedoStartSettings(Profile* profile,
                                   const base::DictValue& settings) {
  std::optional<std::string> json = base::WriteJson(settings);
  if (!json) {
    return false;
  }
  const base::FilePath path = SedoStartSettingsPath(profile);
  if (!base::CreateDirectory(path.DirName())) {
    return false;
  }
  return base::WriteFile(path, *json);
}

class SedoStartHandler : public content::WebUIMessageHandler {
 public:
  SedoStartHandler() = default;
  SedoStartHandler(const SedoStartHandler&) = delete;
  SedoStartHandler& operator=(const SedoStartHandler&) = delete;

  void RegisterMessages() override {
    web_ui()->RegisterMessageCallback(
        "getSettings",
        base::BindRepeating(&SedoStartHandler::HandleGetSettings,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setSettings",
        base::BindRepeating(&SedoStartHandler::HandleSetSettings,
                            base::Unretained(this)));
  }

 private:
  void Reply(const std::string& id, base::DictValue settings) {
    AllowJavascript();
    CallJavascriptFunction("sedoOnReply", base::Value(id),
                           base::Value(std::move(settings)));
  }

  void HandleGetSettings(const base::ListValue& args) {
    if (args.empty() || !args[0].is_string()) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    Reply(*args[0].GetIfString(), ReadSedoStartSettings(profile));
  }

  void HandleSetSettings(const base::ListValue& args) {
    if (args.size() < 2 || !args[0].is_string() || !args[1].is_dict()) {
      return;
    }
    const base::DictValue& incoming = args[1].GetDict();
    const base::DictValue* feed = incoming.FindDict("recommendationFeed");
    if (!feed || !feed->FindBool("enabled") || !feed->FindBool("youtube")) {
      return;
    }
    const base::DictValue* short_form = incoming.FindDict("shortFormVideo");
    if (!short_form || !short_form->FindBool("enabled")) {
      return;
    }
    const base::DictValue* endless = incoming.FindDict("endlessScroll");
    if (!endless || !endless->FindBool("enabled") ||
        !endless->FindInt("limit")) {
      return;
    }
    const int limit = *endless->FindInt("limit");
    if (limit < 0 || limit > sedo::prefs::kEndlessScrollMaxLimit) {
      return;
    }
    base::DictValue settings = base::DictValue().Set(
        "recommendationFeed",
        base::DictValue()
            .Set("enabled", *feed->FindBool("enabled"))
            .Set("youtube", *feed->FindBool("youtube")));
    Profile* profile = Profile::FromWebUI(web_ui());
    WriteSedoStartSettings(profile, settings);
    ApplySedoYouTubeFeedCookie(profile, SedoYouTubeFeedEnabled(settings));
    PrefService* prefs = SedoRendererPrefs(profile);
    prefs->SetBoolean(sedo::prefs::kShortFormVideoBlocking,
                      *short_form->FindBool("enabled"));
    prefs->SetBoolean(sedo::prefs::kEndlessScrollLimiting,
                      *endless->FindBool("enabled"));
    prefs->SetInteger(sedo::prefs::kEndlessScrollLimit, limit);
    Reply(*args[0].GetIfString(), ReadSedoStartSettings(profile));
  }
};

class SedoStartDataSource : public content::URLDataSource {
 public:
  SedoStartDataSource() = default;
  SedoStartDataSource(const SedoStartDataSource&) = delete;
  SedoStartDataSource& operator=(const SedoStartDataSource&) = delete;

  std::string GetSource() override { return "sedo"; }

  void StartDataRequest(const GURL& url,
                        const content::WebContents::Getter&,
                        GotDataCallback callback) override {
    std::string request = content::URLDataSource::URLToRequestPath(url);
    if (request.empty()) {
      request = "index.html";
    }
    base::FilePath relative = base::FilePath::FromUTF8Unsafe(request);
    base::FilePath root = SedoStartPageDir();
    if (root.empty() || relative.IsAbsolute() || relative.ReferencesParent() ||
        relative.empty()) {
      std::move(callback).Run(MissingPage());
      return;
    }
    base::FilePath full = root.Append(relative);
    if (!root.IsParent(full)) {
      std::move(callback).Run(nullptr);
      return;
    }
    std::string contents;
    if (!base::ReadFileToString(full, &contents)) {
      if (request == "index.html") {
        std::move(callback).Run(MissingPage());
        return;
      }
      std::move(callback).Run(nullptr);
      return;
    }
    std::move(callback).Run(
        base::MakeRefCounted<base::RefCountedString>(std::move(contents)));
  }

  std::string GetMimeType(const GURL& url) override {
    const std::string path = content::URLDataSource::URLToRequestPath(url);
    if (path.empty() || base::EndsWith(path, ".html")) {
      return "text/html";
    }
    if (base::EndsWith(path, ".js")) {
      return "text/javascript";
    }
    if (base::EndsWith(path, ".css")) {
      return "text/css";
    }
    if (base::EndsWith(path, ".svg")) {
      return "image/svg+xml";
    }
    if (base::EndsWith(path, ".json")) {
      return "application/json";
    }
    if (base::EndsWith(path, ".png")) {
      return "image/png";
    }
    if (base::EndsWith(path, ".woff2")) {
      return "font/woff2";
    }
    return "text/plain";
  }

  bool AllowCaching() override { return false; }

  bool ShouldServeMimeTypeAsContentTypeHeader() override { return true; }

  std::string GetContentSecurityPolicy(
      network::mojom::CSPDirectiveName directive) override {
    switch (directive) {
      case network::mojom::CSPDirectiveName::RequireTrustedTypesFor:
      case network::mojom::CSPDirectiveName::TrustedTypes:
        return std::string();
      case network::mojom::CSPDirectiveName::StyleSrc:
        return "style-src 'self' 'unsafe-inline';";
      case network::mojom::CSPDirectiveName::StyleSrcAttr:
        return "style-src-attr 'unsafe-inline';";
      default:
        return content::URLDataSource::GetContentSecurityPolicy(directive);
    }
  }

 private:
  static scoped_refptr<base::RefCountedMemory> MissingPage() {
    std::string html =
        "<!DOCTYPE html><title>Sedo</title>"
        "<p>The start page has not been copied into this browser yet.</p>";
    return base::MakeRefCounted<base::RefCountedString>(std::move(html));
  }
};

class SedoStartUI : public content::WebUIController {
 public:
  explicit SedoStartUI(content::WebUI* web_ui) : WebUIController(web_ui) {
    web_ui->AddMessageHandler(std::make_unique<SedoStartHandler>());
    content::URLDataSource::Add(Profile::FromWebUI(web_ui),
                                std::make_unique<SedoStartDataSource>());
  }

  SedoStartUI(const SedoStartUI&) = delete;
  SedoStartUI& operator=(const SedoStartUI&) = delete;
};

class SedoStartUIConfig : public content::DefaultWebUIConfig<SedoStartUI> {
 public:
  SedoStartUIConfig() : DefaultWebUIConfig("chrome", "sedo") {}
};

#endif  // CHROME_BROWSER_UI_WEBUI_SEDO_SEDO_START_UI_H_
