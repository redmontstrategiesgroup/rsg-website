/* ============================================================================
   RSG // rsg-supabase.js — the one Supabase client for all five apps.

   A classic script exposing `window.RSGSupabase`, matching the house pattern in
   claude-bridge.js: build-time reuse, no runtime coupling, consumers guard
   `window.RSGSupabase || <local fallback>` so standalone serving degrades
   instead of breaking.

   WHY NOT @supabase/supabase-js: these apps are zero-build static pages that
   vendor their dependencies (see The forge/vendor/). The official client is a
   ~120KB bundle and an npm toolchain, and the parts these apps use are a thin
   layer over two documented HTTP APIs — PostgREST and GoTrue. This file is that
   layer. No build step, no CDN dependency, no offline break.

   Each app points this at ITS OWN project. There is no shared database; the
   only thing the apps hold in common is the client registry mirror
   (docs/per-app-supabase.md §2).

   Talks to the database with the PUBLISHABLE (anon) key, which is designed to
   be public. Isolation is enforced by RLS in the database, not here. Nothing in
   this file is a security boundary — if a policy is wrong, this client cannot
   save you.
   ============================================================================ */
(function () {
  "use strict";

  var RSG = {};
  var cfg = null;          // { url, anonKey, app }
  var session = null;      // { access_token, refresh_token, expires_at, user }
  var refreshInFlight = null;
  var listeners = [];

  /* ---------------------------------------------------------------- config */

  RSG.init = function (options) {
    if (!options || !options.url || !options.anonKey || !options.app) {
      throw new Error("RSGSupabase.init needs { url, anonKey, app }");
    }
    cfg = {
      url: String(options.url).replace(/\/+$/, ""),
      anonKey: options.anonKey,
      app: options.app,
      timeoutMs: options.timeoutMs || 15000,
      maxRetries: options.maxRetries == null ? 3 : options.maxRetries,
    };
    session = readSession();
    if (session) scheduleRefresh();
    flushOutbox();
    return RSG;
  };

  function need() {
    if (!cfg) throw new Error("RSGSupabase.init() has not been called");
    return cfg;
  }

  RSG.configured = function () { return !!cfg; };

  /* --------------------------------------------------------------- session */

  function sessionKey() { return "rsg.sb." + need().app + ".session"; }

  function readSession() {
    try {
      var raw = localStorage.getItem(sessionKey());
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.access_token ? s : null;
    } catch (e) { return null; }
  }

  function writeSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(sessionKey(), JSON.stringify(s));
      else localStorage.removeItem(sessionKey());
    } catch (e) { /* private mode — session stays in memory for this tab */ }
    listeners.forEach(function (fn) { try { fn(s); } catch (e) {} });
    if (s) scheduleRefresh();
  }

  // GoTrue returns expires_in (seconds). Store an absolute epoch-ms instead:
  // a relative TTL is wrong the moment the page is restored from bfcache or
  // the laptop wakes from sleep.
  function stamp(tok) {
    var ttl = Number(tok.expires_in || 3600);
    tok.expires_at = Date.now() + ttl * 1000;
    return tok;
  }

  RSG.onAuthChange = function (fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  };

  RSG.session = function () { return session; };
  RSG.user = function () { return session && session.user; };
  RSG.userId = function () { return session && session.user && session.user.id; };

  /* ------------------------------------------------------- token refreshing

     Access tokens last an hour. Refresh proactively 60s before expiry, and
     single-flight it: several queries racing a 401 must produce ONE refresh,
     not one per query. A refresh storm is how a refresh-token rotation gets
     invalidated and logs everyone out. */

  var refreshTimer = null;

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (!session || !session.expires_at) return;
    var delay = session.expires_at - Date.now() - 60000;
    if (delay < 0) delay = 0;
    // setTimeout saturates past ~24.8 days; these are always <1h, but clamp anyway.
    refreshTimer = setTimeout(function () { refresh().catch(function () {}); },
                              Math.min(delay, 2147483647));
  }

  function refresh() {
    if (refreshInFlight) return refreshInFlight;
    if (!session || !session.refresh_token) return Promise.reject(new Error("no session"));

    refreshInFlight = rawFetch("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).then(function (tok) {
      writeSession(stamp(tok));
      return tok;
    }).catch(function (err) {
      // A refresh token that is genuinely rejected means the session is over.
      // A network blip does NOT — signing the user out on a flaky connection
      // loses their unsaved work for no reason.
      if (err && err.status >= 400 && err.status < 500) writeSession(null);
      throw err;
    }).then(function (v) { refreshInFlight = null; return v; },
            function (e) { refreshInFlight = null; throw e; });

    return refreshInFlight;
  }

  RSG.refresh = refresh;

  /* ------------------------------------------------------------------ HTTP */

  function headers(extra) {
    var h = Object.assign({
      "apikey": need().anonKey,
      "Content-Type": "application/json",
    }, extra || {});
    if (session && session.access_token) {
      h["Authorization"] = "Bearer " + session.access_token;
    } else {
      h["Authorization"] = "Bearer " + need().anonKey;
    }
    return h;
  }

  function HttpError(status, body, url) {
    var e = new Error((body && (body.message || body.error_description || body.error)) ||
                      ("HTTP " + status));
    e.status = status; e.body = body; e.url = url;
    return e;
  }

  function rawFetch(path, init) {
    var c = need();
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, c.timeoutMs) : null;

    return fetch(c.url + path, Object.assign({}, init, {
      headers: headers(init && init.headers),
      signal: ctl ? ctl.signal : undefined,
    })).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function (text) {
        var body = null;
        if (text) { try { body = JSON.parse(text); } catch (e) { body = text; } }
        if (!res.ok) {
          var err = HttpError(res.status, body, path);
          err.retryAfter = res.headers.get("Retry-After");
          throw err;
        }
        return body;
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      var e = new Error(err && err.name === "AbortError" ? "request timed out" : "network error");
      e.status = 0;             // 0 = never reached the server; always retryable
      e.cause = err;
      throw e;
    });
  }

  function retryable(err) {
    if (!err) return false;
    if (err.status === 0) return true;            // network / timeout
    if (err.status === 429) return true;          // rate limited
    return err.status >= 500 && err.status < 600; // server-side
  }

  // Exponential backoff with full jitter. Jitter matters: NEXUS autosaves on a
  // timer, so without it every open tab retries in lockstep and re-creates the
  // spike that caused the 429.
  function backoffMs(attempt, err) {
    if (err && err.retryAfter) {
      var secs = parseInt(err.retryAfter, 10);
      if (!isNaN(secs)) return Math.min(secs * 1000, 30000);
    }
    var ceiling = Math.min(1000 * Math.pow(2, attempt), 16000);
    return Math.random() * ceiling;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // The workhorse: refresh-on-401 (once), retry on transient failure.
  function request(path, init, attempt, didRefresh) {
    attempt = attempt || 0;
    return rawFetch(path, init).catch(function (err) {
      if (err.status === 401 && session && session.refresh_token && !didRefresh) {
        return refresh().then(function () { return request(path, init, attempt, true); });
      }
      if (retryable(err) && attempt < need().maxRetries) {
        return sleep(backoffMs(attempt, err)).then(function () {
          return request(path, init, attempt + 1, didRefresh);
        });
      }
      throw err;
    });
  }

  RSG.request = request;

  /* ------------------------------------------------------------------ auth */

  RSG.auth = {
    signUp: function (email, password) {
      return rawFetch("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password }),
      }).then(function (out) {
        // With email confirmation on, signup returns a user and NO session.
        if (out && out.access_token) writeSession(stamp(out));
        return out;
      });
    },

    signIn: function (email, password) {
      return rawFetch("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password }),
      }).then(function (tok) { writeSession(stamp(tok)); return tok; });
    },

    signOut: function () {
      var had = session;
      writeSession(null);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (!had) return Promise.resolve();
      // Best-effort server-side revoke; local state is already cleared, so a
      // failure here must not leave the UI looking signed in.
      return rawFetch("/auth/v1/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + had.access_token },
      }).catch(function () {});
    },

    resetPassword: function (email) {
      return rawFetch("/auth/v1/recover", {
        method: "POST", body: JSON.stringify({ email: email }),
      });
    },
  };

  /* ----------------------------------------------------- PostgREST queries

     A minimal, chainable builder over /rest/v1. Only what the apps use. */

  function esc(v) {
    if (v === null) return "is.null";
    return encodeURIComponent(String(v));
  }

  function Query(table) {
    this.table = table;
    this.filters = [];
    this.params = [];
    this._method = "GET";
    this._body = null;
    this._prefer = [];
  }

  Query.prototype.select = function (cols) {
    this.params.push("select=" + encodeURIComponent(cols || "*"));
    return this;
  };
  Query.prototype.eq  = function (c, v) { this.filters.push(c + "=eq." + esc(v)); return this; };
  Query.prototype.neq = function (c, v) { this.filters.push(c + "=neq." + esc(v)); return this; };
  Query.prototype.gt  = function (c, v) { this.filters.push(c + "=gt." + esc(v)); return this; };
  Query.prototype.gte = function (c, v) { this.filters.push(c + "=gte." + esc(v)); return this; };
  Query.prototype.lt  = function (c, v) { this.filters.push(c + "=lt." + esc(v)); return this; };
  Query.prototype.lte = function (c, v) { this.filters.push(c + "=lte." + esc(v)); return this; };
  Query.prototype.is  = function (c, v) { this.filters.push(c + "=is." + String(v)); return this; };
  Query.prototype.in  = function (c, arr) {
    this.filters.push(c + "=in.(" + arr.map(function (v) { return encodeURIComponent(v); }).join(",") + ")");
    return this;
  };
  Query.prototype.order = function (c, opts) {
    this.params.push("order=" + c + "." + ((opts && opts.ascending === false) ? "desc" : "asc"));
    return this;
  };
  Query.prototype.limit = function (n) { this.params.push("limit=" + Number(n)); return this; };
  Query.prototype.range = function (from, to) {
    this.params.push("offset=" + Number(from));
    this.params.push("limit=" + (Number(to) - Number(from) + 1));
    return this;
  };

  Query.prototype.insert = function (rows) {
    this._method = "POST"; this._body = rows;
    this._prefer.push("return=representation");
    return this;
  };
  Query.prototype.upsert = function (rows, opts) {
    this._method = "POST"; this._body = rows;
    this._prefer.push("return=representation");
    this._prefer.push("resolution=merge-duplicates");
    if (opts && opts.onConflict) this.params.push("on_conflict=" + opts.onConflict);
    return this;
  };
  Query.prototype.update = function (patch) {
    this._method = "PATCH"; this._body = patch;
    this._prefer.push("return=representation");
    return this;
  };
  Query.prototype.delete = function () { this._method = "DELETE"; return this; };

  Query.prototype.single = function () { this._single = true; return this; };

  Query.prototype.path = function () {
    var qs = this.filters.concat(this.params).join("&");
    return "/rest/v1/" + this.table + (qs ? "?" + qs : "");
  };

  Query.prototype.then = function (onOk, onErr) {
    var self = this;
    var init = { method: this._method };
    if (this._body !== null) init.body = JSON.stringify(this._body);
    if (this._prefer.length) init.headers = { Prefer: this._prefer.join(",") };
    if (this._single) {
      init.headers = Object.assign(init.headers || {}, { Accept: "application/vnd.pgrst.object+json" });
    }
    return request(this.path(), init).then(function (data) {
      return self._single ? data : (data || []);
    }).then(onOk, onErr);
  };

  RSG.from = function (table) { return new Query(table); };

  RSG.rpc = function (fn, args) {
    return request("/rest/v1/rpc/" + fn, {
      method: "POST",
      body: JSON.stringify(args || {}),
    });
  };

  /* ------------------------------------------------------- edge functions */

  RSG.invoke = function (name, payload, opts) {
    return request("/functions/v1/" + name, {
      method: "POST",
      body: JSON.stringify(payload || {}),
      headers: (opts && opts.headers) || undefined,
    });
  };

  /* --------------------------------------------------------------- outbox

     These apps were built against localStorage, which never fails. The network
     does. A write that fails after the user has already seen the UI update is
     the classic "saved" lie, so failed writes are parked here and replayed.

     Bounded to 200 entries: an outbox that grows without limit fills the same
     storage quota it was meant to protect. */

  function outboxKey() { return "rsg.sb." + need().app + ".outbox"; }

  function readOutbox() {
    try { return JSON.parse(localStorage.getItem(outboxKey()) || "[]"); }
    catch (e) { return []; }
  }
  function writeOutbox(q) {
    try { localStorage.setItem(outboxKey(), JSON.stringify(q.slice(-200))); } catch (e) {}
  }

  RSG.outboxSize = function () { return readOutbox().length; };

  // Queue a write for later. `key` de-dupes: a second autosave of the same
  // world replaces the queued one rather than stacking a hundred stale copies.
  RSG.queueWrite = function (key, path, init) {
    var q = readOutbox().filter(function (e) { return e.key !== key; });
    q.push({ key: key, path: path, init: init, at: Date.now() });
    writeOutbox(q);
  };

  function flushOutbox() {
    if (!cfg) return Promise.resolve(0);
    var q = readOutbox();
    if (!q.length) return Promise.resolve(0);

    var done = 0;
    return q.reduce(function (chain, entry) {
      return chain.then(function () {
        return request(entry.path, entry.init).then(function () {
          done++;
          writeOutbox(readOutbox().filter(function (e) { return e.key !== entry.key; }));
        }, function (err) {
          // 4xx means this entry will never succeed — drop it rather than
          // retrying a malformed payload forever and blocking the queue.
          if (err.status >= 400 && err.status < 500 && err.status !== 429) {
            writeOutbox(readOutbox().filter(function (e) { return e.key !== entry.key; }));
          }
        });
      });
    }, Promise.resolve()).then(function () { return done; });
  }

  RSG.flushOutbox = flushOutbox;

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", function () { flushOutbox(); });
  }

  /* -------------------------------------------------------------- registry */

  // The signed-in user's client, or null for a self-serve account with no RSG
  // client behind it. Null is a normal state — do not treat it as an error.
  RSG.myClient = function () {
    if (!RSG.userId()) return Promise.resolve(null);
    return RSG.from("app_users").select("client_id,role").eq("id", RSG.userId()).single()
      .then(function (row) {
        if (!row || !row.client_id) return null;
        return RSG.from("rsg_clients").select("id,name,status").eq("id", row.client_id).single()
          .catch(function () { return null; });
      })
      .catch(function () { return null; });
  };

  window.RSGSupabase = RSG;
})();
