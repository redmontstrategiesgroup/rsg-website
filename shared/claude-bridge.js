/* ============================================================
   RSG // claude-bridge.js — one Anthropic browser bridge for the
   whole portfolio. Classic script, exposes window.RSGClaude.
   Zero build: Forge (ES modules) reads the global after a <script>
   tag; NEXUS / Observatory (IIFEs) use it directly.

   Consumers must guard `window.RSGClaude || <legacy path>` so an app
   served standalone (no shared/ on the path) still works.
   ============================================================ */
(function () {
  "use strict";

  var SHARED_KEY = "rsg.anthropic_key";

  // Shared key first; caller may pass a legacy fallback key.
  function getKey(legacy) {
    return localStorage.getItem(SHARED_KEY) || legacy || "";
  }

  /* Build a valid Anthropic `messages` array from a running conversation.
     Fixes the class of bug where the in-flight user turn is sent twice and
     where a front-truncated window can start on an assistant turn (which the
     API rejects, first message must be `user`).

     prior         : array of { role:"user"|"assistant", content:string }
                     — the conversation so far. MAY already include the
                       in-flight user message; it is de-duplicated.
     currentText   : the user's current message (appended exactly once).
     opts.max      : max prior turns to keep (default 12). */
  function windowMessages(prior, currentText, opts) {
    var max = (opts && opts.max) || 12;
    var turns = (prior || []).slice();
    // drop a trailing user turn that duplicates the in-flight message
    while (turns.length && turns[turns.length - 1].role === "user" &&
           turns[turns.length - 1].content === currentText) {
      turns.pop();
    }
    turns = turns.slice(-max);
    // the API requires the first message to be `user`
    while (turns.length && turns[0].role !== "user") turns.shift();
    turns.push({ role: "user", content: currentText });
    return turns;
  }

  /* Perform a Messages API call with the portfolio's shared semantics:
     structured outputs, the browser-access header, the Fable-5 server-side
     refusal fallback beta, and refusal detection.

     req: { key, model, system, messages, schema, maxTokens, effort }
     Returns { text, msg } (text = first text block) or throws Error. */
  async function request(req) {
    var key = req.key;
    var model = req.model || "claude-fable-5";
    if (!key) throw new Error("no-key");

    var body = {
      model: model,
      max_tokens: req.maxTokens || 1024,
      messages: req.messages,
    };
    if (req.system) body.system = req.system;
    var oc = {};
    if (req.effort) oc.effort = req.effort;
    if (req.schema) oc.format = { type: "json_schema", schema: req.schema };
    if (oc.effort || oc.format) body.output_config = oc;

    var headers = {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    if (model === "claude-fable-5") {
      // opt into the server-side refusal fallback → Opus 4.8 re-serves declines
      headers["anthropic-beta"] = "server-side-fallback-2026-06-01";
      body.fallbacks = [{ model: "claude-opus-4-8" }];
    }

    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: headers, body: JSON.stringify(body),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error((err && err.error && err.error.message) || ("API error " + res.status));
    }
    var msg = await res.json();
    if (msg.stop_reason === "refusal") {
      throw new Error("The model declined this request" +
        (msg.stop_details && msg.stop_details.explanation ? ": " + msg.stop_details.explanation : "."));
    }
    var block = (msg.content || []).find(function (b) { return b.type === "text"; });
    return { text: block ? block.text : "", msg: msg };
  }

  window.RSGClaude = {
    version: 1,
    sharedKeyName: SHARED_KEY,
    getKey: getKey,
    windowMessages: windowMessages,
    request: request,
  };
})();
