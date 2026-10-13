(() => {
  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i2 = 0; i2 < 31; ++i2) {
      b[i2] = start += 1 << eb[i2 - 1];
    }
    var r = new i32(b[30]);
    for (var i2 = 1; i2 < 30; ++i2) {
      for (var j = b[i2]; j < b[i2 + 1]; ++j) {
        r[j] = j - b[i2] << 5 | i2;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i2 = 0;
    var l = new u16(mb);
    for (; i2 < s; ++i2) {
      if (cd[i2])
        ++l[cd[i2] - 1];
    }
    var le = new u16(mb);
    for (i2 = 1; i2 < mb; ++i2) {
      le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i2 = 0; i2 < s; ++i2) {
        if (cd[i2]) {
          var sv = i2 << 4 | cd[i2];
          var r_1 = mb - cd[i2];
          var v = le[cd[i2] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i2 = 0; i2 < s; ++i2) {
        if (cd[i2]) {
          co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  var max = function(a) {
    var m = a[0];
    for (var i2 = 1; i2 < a.length; ++i2) {
      if (a[i2] > m)
        m = a[i2];
    }
    return m;
  };
  var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
  };
  var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
  };
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var inflt = function(dat, st, buf, dict) {
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
      return buf || new u8(0);
    var noBuf = !buf;
    var resize = noBuf || st.i != 2;
    var noSt = st.i;
    if (noBuf)
      buf = new u8(sl * 3);
    var cbuf = function(l2) {
      var bl = buf.length;
      if (l2 > bl) {
        var nbuf = new u8(Math.max(bl * 2, l2));
        nbuf.set(buf);
        buf = nbuf;
      }
    };
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    var tbts = sl * 8;
    do {
      if (!lm) {
        final = bits(dat, pos, 1);
        var type = bits(dat, pos + 1, 3);
        pos += 3;
        if (!type) {
          var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
          if (t > sl) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + l);
          buf.set(dat.subarray(s, t), bt);
          st.b = bt += l, st.p = pos = t * 8, st.f = final;
          continue;
        } else if (type == 1)
          lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
        else if (type == 2) {
          var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
          var tl = hLit + bits(dat, pos + 5, 31) + 1;
          pos += 14;
          var ldt = new u8(tl);
          var clt = new u8(19);
          for (var i2 = 0; i2 < hcLen; ++i2) {
            clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
          }
          pos += hcLen * 3;
          var clb = max(clt), clbmsk = (1 << clb) - 1;
          var clm = hMap(clt, clb, 1);
          for (var i2 = 0; i2 < tl; ) {
            var r = clm[bits(dat, pos, clbmsk)];
            pos += r & 15;
            var s = r >> 4;
            if (s < 16) {
              ldt[i2++] = s;
            } else {
              var c = 0, n = 0;
              if (s == 16)
                n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
              else if (s == 17)
                n = 3 + bits(dat, pos, 7), pos += 3;
              else if (s == 18)
                n = 11 + bits(dat, pos, 127), pos += 7;
              while (n--)
                ldt[i2++] = c;
            }
          }
          var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
          lbt = max(lt);
          dbt = max(dt);
          lm = hMap(lt, lbt, 1);
          dm = hMap(dt, dbt, 1);
        } else
          err(1);
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
      }
      if (resize)
        cbuf(bt + 131072);
      var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
      var lpos = pos;
      for (; ; lpos = pos) {
        var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
        pos += c & 15;
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (!c)
          err(2);
        if (sym < 256)
          buf[bt++] = sym;
        else if (sym == 256) {
          lpos = pos, lm = null;
          break;
        } else {
          var add = sym - 254;
          if (sym > 264) {
            var i2 = sym - 257, b = fleb[i2];
            add = bits(dat, pos, (1 << b) - 1) + fl[i2];
            pos += b;
          }
          var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
          if (!d)
            err(3);
          pos += d & 15;
          var dt = fd[dsym];
          if (dsym > 3) {
            var b = fdeb[dsym];
            dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
          }
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + 131072);
          var end = bt + add;
          if (bt < dt) {
            var shift = dl - dt, dend = Math.min(dt, end);
            if (shift + bt < 0)
              err(3);
            for (; bt < dend; ++bt)
              buf[bt] = dict[shift + bt];
          }
          for (; bt < end; ++bt)
            buf[bt] = buf[bt - dt];
        }
      }
      st.l = lm, st.p = lpos, st.b = bt, st.f = final;
      if (lm)
        final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
  };
  var et = /* @__PURE__ */ new u8(0);
  var b2 = function(d, b) {
    return d[b] | d[b + 1] << 8;
  };
  var b4 = function(d, b) {
    return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
  };
  var b8 = function(d, b) {
    return b4(d, b) + b4(d, b + 4) * 4294967296;
  };
  function inflateSync(data, opts) {
    return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
  }
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  var dutf8 = function(d) {
    for (var r = "", i2 = 0; ; ) {
      var c = d[i2++];
      var eb = (c > 127) + (c > 223) + (c > 239);
      if (i2 + eb > d.length)
        return { s: r, r: slc(d, i2 - 1) };
      if (!eb)
        r += String.fromCharCode(c);
      else if (eb == 3) {
        c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
      } else if (eb & 1)
        r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
      else
        r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
    }
  };
  function strFromU8(dat, latin1) {
    if (latin1) {
      var r = "";
      for (var i2 = 0; i2 < dat.length; i2 += 16384)
        r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
      return r;
    } else if (td) {
      return td.decode(dat);
    } else {
      var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
      if (r.length)
        err(8);
      return s;
    }
  }
  var slzh = function(d, b) {
    return b + 30 + b2(d, b + 26) + b2(d, b + 28);
  };
  var zh = function(d, b, z) {
    var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
    var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
    return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
  };
  var z64hs = function(d, b, l, z, sc, su, off) {
    var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
    var nf = nsc + nsu + noff;
    if (z && nf) {
      for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
        if (b2(d, b) == 1) {
          return [
            nsc ? b8(d, b + 4 + 8 * nsu) : sc,
            nsu ? b8(d, b + 4) : su,
            noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
            1
          ];
        }
      }
      if (z < 2)
        err(13);
    }
    return [sc, su, off, 0];
  };
  function unzipSync(data, opts) {
    var files = {};
    var e = data.length - 22;
    for (; b4(data, e) != 101010256; --e) {
      if (!e || data.length - e > 65558)
        err(13);
    }
    ;
    var c = b2(data, e + 8);
    if (!c)
      return {};
    var o = b4(data, e + 16);
    var z = b4(data, e - 20) == 117853008;
    if (z) {
      var ze = b4(data, e - 12);
      z = b4(data, ze) == 101075792;
      if (z) {
        c = b4(data, ze + 32);
        o = b4(data, ze + 48);
      }
    }
    var fltr = opts && opts.filter;
    for (var i2 = 0; i2 < c; ++i2) {
      var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
      o = no;
      if (!fltr || fltr({
        name: fn,
        size: sc,
        originalSize: su,
        compression: c_2
      })) {
        if (!c_2)
          files[fn] = slc(data, b, b + sc);
        else if (c_2 == 8)
          files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
        else
          err(14, "unknown compression type " + c_2);
      }
    }
    return files;
  }

  // lib/html-dom.js
  function parse(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  // lib/parse.js
  var USERNAME_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;
  var RESERVED = /* @__PURE__ */ new Set([
    "about",
    "accounts",
    "ar",
    "challenge",
    "developer",
    "direct",
    "directory",
    "emails",
    "explore",
    "graphql",
    "legal",
    "lite",
    "nametag",
    "p",
    "privacy",
    "reel",
    "reels",
    "session",
    "stories",
    "tv",
    "web"
  ]);
  var SENT_KEY = /follow_requests_sent|permanent_follow_requests|pending_follow_requests|sent_follow_requests/i;
  var RECEIVED_KEY = /follow_requests_received|requests_received/i;
  var REJECT_KEY = /relationships_followers|relationships_following|close_friends|blocked_users|restricted_users|removed_suggestions|recently_unfollowed|dismissed_suggested/i;
  function unique(list2) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const name of list2) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }
  function cleanUsername(raw) {
    if (raw == null) return null;
    let text = String(raw).replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
    text = text.replace(/^@+/, "");
    text = text.split(/[/?#]/)[0];
    if (!USERNAME_RE.test(text)) return null;
    if (RESERVED.has(text.toLowerCase())) return null;
    return text;
  }
  function usernameFromUrl(href) {
    if (!href) return null;
    try {
      const url = new URL(href, "https://www.instagram.com");
      const host = url.hostname.replace(/^www\./i, "");
      if (host !== "instagram.com") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "_u" && parts[1]) return cleanUsername(parts[1]);
      if (parts.length === 1) return cleanUsername(parts[0]);
      return null;
    } catch {
      return null;
    }
  }
  function nameKind(filename) {
    const base = String(filename || "").replace(/\\/g, "/").split("/").pop().toLowerCase();
    if (/pending_follow_requests|follow_requests_sent|permanent_follow_requests|sent_follow/.test(base)) {
      return "sent";
    }
    if (/follow_requests_received|received_follow/.test(base)) return "received";
    if (/follower|following|close_friends|blocked/.test(base)) return "reject";
    return "unknown";
  }
  function emptyResult(warnings2, extra = {}) {
    return { usernames: [], warnings: warnings2, trusted: false, ...extra };
  }
  function usernameFromEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    return usernameFromUrl(entry.href) || cleanUsername(entry.value) || cleanUsername(entry.title);
  }
  function walkJson(node, mode, buckets) {
    if (Array.isArray(node)) {
      for (const item of node) walkJson(item, mode, buckets);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.string_list_data)) {
      for (const entry of node.string_list_data) {
        const username = usernameFromEntry(entry);
        if (username) buckets[mode].push(username);
      }
    } else if (mode === "sent") {
      const direct = cleanUsername(node.value) || cleanUsername(node.title) || usernameFromUrl(node.href);
      if (direct && (node.href || node.value || node.timestamp)) buckets.sent.push(direct);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "string_list_data" || value == null || typeof value !== "object") continue;
      let next = mode;
      if (RECEIVED_KEY.test(key)) next = "received";
      else if (SENT_KEY.test(key)) next = "sent";
      else if (REJECT_KEY.test(key)) next = "reject";
      walkJson(value, next, buckets);
    }
  }
  function parseJsonDocument(text, filename) {
    let data;
    try {
      data = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      return emptyResult(["JSON okunamad\u0131. Dosya bozuk olabilir."]);
    }
    const buckets = { sent: [], received: [], reject: [], unknown: [] };
    walkJson(data, "unknown", buckets);
    const kind = nameKind(filename);
    const sent = unique(buckets.sent);
    const unknown = unique(buckets.unknown);
    if (sent.length) {
      return { usernames: sent, warnings: [], trusted: true };
    }
    if (kind === "sent" && unknown.length) {
      return { usernames: unknown, warnings: [], trusted: true };
    }
    if (kind === "received" || buckets.received.length && !sent.length && !unknown.length) {
      return emptyResult([
        "Bu dosya sana gelen takip istekleri. G\xF6nderdi\u011Fin istekler i\xE7in pending_follow_requests dosyas\u0131 gerekir."
      ]);
    }
    if (kind === "reject" || buckets.reject.length && !unknown.length) {
      return emptyResult([
        "Bu dosya takip\xE7i veya takip listesi. Bekleyen istek dosyas\u0131n\u0131 y\xFCkle: pending_follow_requests.html veya .json."
      ]);
    }
    if (unknown.length) {
      return {
        usernames: unknown,
        warnings: [
          "Dosyan\u0131n bekleyen istek listesi oldu\u011Fu ba\u015Fl\u0131ktan anla\u015F\u0131lmad\u0131. Listeyi kontrol et; yanl\u0131\u015Fsa \xE7al\u0131\u015Ft\u0131rma."
        ],
        trusted: false
      };
    }
    return emptyResult([
      "Bu JSON i\xE7inde g\xF6nderilmi\u015F takip iste\u011Fi bulunamad\u0131. Instagram d\u0131\u015Fa aktarmas\u0131ndaki pending_follow_requests dosyas\u0131n\u0131 y\xFCkle."
    ]);
  }
  function readText(el) {
    if (!el) return "";
    const raw = typeof el.text === "string" ? el.text : el.textContent || "";
    return raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  }
  function elementText(el) {
    return readText(el);
  }
  function hasExportClass(el) {
    const className = el.getAttribute("class") || "";
    return className.includes("_a6-i") || className.includes("_a6_q") || className.includes("_2pin");
  }
  function parseHtmlDocument(html, filename) {
    const root = parse(html);
    const title = `${readText(root.querySelector("title"))} ${readText(root.querySelector("h1"))}`;
    const exportLike = html.includes("_a6-") || html.includes("uiBoxWhite") || html.includes("_a6_q");
    let titleKind = "unknown";
    if (/pending follow request|bekleyen takip iste|follow requests sent|gonderilen takip istegi|gönderilen takip isteği/i.test(title)) {
      titleKind = "sent";
    } else if (/follow requests received|gelen takip iste|followers|following|takipçiler|takip ettiklerin/i.test(title)) {
      titleKind = /received|gelen takip/i.test(title) ? "received" : "reject";
    }
    const found = [];
    for (const el of root.querySelectorAll("*")) {
      const tag = String(el.tagName || "").toUpperCase();
      if (tag === "A") {
        const fromHref = usernameFromUrl(el.getAttribute("href") || "");
        if (fromHref) found.push(fromHref);
      }
      if (tag === "A" || tag === "H2" || tag === "H3" || tag === "TD" || hasExportClass(el)) {
        const username = cleanUsername(elementText(el));
        if (username) found.push(username);
      }
    }
    const usernames = unique(found);
    const kind = nameKind(filename);
    if (titleKind === "received" || kind === "received") {
      return emptyResult([
        "Bu dosya sana gelen takip istekleri. G\xF6nderdi\u011Fin istekler i\xE7in pending_follow_requests dosyas\u0131 gerekir."
      ]);
    }
    if ((titleKind === "reject" || kind === "reject") && titleKind !== "sent" && kind !== "sent") {
      return emptyResult([
        "Bu dosya takip\xE7i veya takip listesi. Bekleyen istek dosyas\u0131n\u0131 y\xFCkle: pending_follow_requests.html veya .json."
      ]);
    }
    if (!usernames.length) {
      return emptyResult([
        "Dosyada profil bulunamad\u0131. Instagram'\u0131n indirdi\u011Fin bilgilerindeki pending_follow_requests.html veya .json dosyas\u0131n\u0131 y\xFCkle."
      ]);
    }
    const trusted = kind === "sent" || titleKind === "sent" || exportLike;
    const warnings2 = [];
    if (!trusted) {
      warnings2.push(
        "Bu dosya resmi d\u0131\u015Fa aktarma gibi g\xF6r\xFCnm\xFCyor. Profiller listelendi ama otomatik \xE7ekim i\xE7in i\u015Faretli de\u011Fil. Do\u011Fru ki\u015Filerse se\xE7ip \xE7al\u0131\u015Ft\u0131r."
      );
    }
    return { usernames, warnings: warnings2, trusted };
  }
  function asBytes(buffer) {
    if (buffer instanceof Uint8Array) return buffer;
    return new Uint8Array(buffer);
  }
  function decodeBuffer(buffer) {
    const bytes = asBytes(buffer);
    if (!bytes.length) return "";
    const decode = (encoding) => new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, "");
    if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 254) return decode("utf-16le");
    if (bytes.length >= 3 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) return decode("utf-8");
    const sample = Math.min(bytes.length, 240);
    let zeros = 0;
    for (let i2 = 1; i2 < sample; i2 += 2) if (bytes[i2] === 0) zeros++;
    if (zeros > sample / 8) return decode("utf-16le");
    return decode("utf-8");
  }
  function parseZip(buffer) {
    let files;
    try {
      files = unzipSync(asBytes(buffer));
    } catch {
      return emptyResult(["Zip a\xE7\u0131lamad\u0131."]);
    }
    const entries = Object.entries(files).filter(([entryName]) => {
      const name = entryName.replace(/\\/g, "/");
      if (!name || name.endsWith("/") || name.startsWith("__MACOSX/")) return false;
      return /\.(html?|json)$/i.test(name);
    });
    const preferred = entries.filter(([entryName]) => nameKind(entryName) === "sent");
    const chosen = preferred.length ? preferred : [];
    if (!chosen.length) {
      const names = entries.map(([entryName]) => entryName.replace(/\\/g, "/").split("/").pop());
      return emptyResult([
        names.length ? `Zip i\xE7inde bekleyen takip iste\u011Fi dosyas\u0131 yok. G\xF6r\xFClen dosyalar: ${names.slice(0, 14).join(", ")}` : "Zip i\xE7inde HTML veya JSON yok."
      ]);
    }
    const usernames = [];
    const warnings2 = [];
    for (const [entryName, data] of chosen) {
      const text = decodeBuffer(data);
      const parsed = parseText(entryName, text);
      usernames.push(...parsed.usernames);
      warnings2.push(...parsed.warnings);
    }
    const uniqueNames = unique(usernames);
    if (!uniqueNames.length) {
      return emptyResult(
        warnings2.length ? warnings2 : ["Zip i\xE7indeki bekleyen istek dosyas\u0131nda profil bulunamad\u0131."]
      );
    }
    return { usernames: uniqueNames, warnings: unique(warnings2), trusted: true };
  }
  function parseText(filename, text) {
    const trimmed = text.trim();
    if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return parseJsonDocument(text, filename);
    }
    return parseHtmlDocument(text, filename);
  }
  function parseBuffer(filename, buffer) {
    const lower = String(filename || "").toLowerCase();
    if (lower.endsWith(".zip")) return parseZip(buffer);
    if (!/\.(html?|json)$/i.test(lower)) {
      return emptyResult(["HTML, JSON veya bu dosyalar\u0131 i\xE7eren zip y\xFCkle."]);
    }
    return parseText(filename, decodeBuffer(buffer));
  }

  // public/site-app.js
  var fileInput = document.querySelector("#file");
  var drop = document.querySelector("#drop");
  var dropLabel = document.querySelector("#drop-label");
  var source = document.querySelector("#source");
  var warnings = document.querySelector("#warnings");
  var list = document.querySelector("#list");
  var counts = document.querySelector("#counts");
  var search = document.querySelector("#search");
  var pickCountInput = document.querySelector("#pick-count");
  var pickSideInput = document.querySelector("#pick-side");
  var pickApplyButton = document.querySelector("#pick-apply");
  var openNextButton = document.querySelector("#open-next");
  var log = document.querySelector("#log");
  var STORAGE_KEY = "geri-cekilmis-hesaplar";
  var items = [];
  var saved = loadSaved();
  function loadSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return new Set((Array.isArray(parsed) ? parsed : []).map((name) => String(name).toLowerCase()));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  function storeSaved() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved].sort()));
  }
  function remember(item) {
    saved.add(item.username.toLowerCase());
    storeSaved();
    item.status = "saved";
    item.selected = false;
  }
  function addLog(message, level = "info") {
    const item = document.createElement("li");
    item.textContent = message;
    if (level === "ok" || level === "error") item.className = level;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }
  function renderWarnings(messages) {
    warnings.replaceChildren();
    for (const message of messages || []) {
      const note = document.createElement("p");
      note.className = "warning";
      note.textContent = message;
      warnings.appendChild(note);
    }
  }
  function renderList() {
    const scroll = list.scrollTop;
    const query = search.value.trim().toLowerCase();
    const visible = items.filter((item) => item.username.toLowerCase().includes(query));
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = items.length ? "Aramayla e\u015Fle\u015Fen profil yok." : "Hen\xFCz dosya yok.";
      list.appendChild(empty);
    }
    for (const item of visible) {
      const row = document.createElement("article");
      row.className = "person";
      const indexLabel = document.createElement("span");
      indexLabel.className = "index";
      indexLabel.textContent = String(items.indexOf(item) + 1);
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = Boolean(item.selected);
      box.disabled = item.status === "saved";
      box.addEventListener("change", () => {
        if (item.status === "saved") {
          item.selected = false;
          box.checked = false;
          return;
        }
        item.selected = box.checked;
        renderMeta();
      });
      const link = document.createElement("a");
      link.href = `https://www.instagram.com/${encodeURIComponent(item.username)}/`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = item.username;
      link.addEventListener("click", () => {
        remember(item);
        renderList();
      });
      const meta = document.createElement("div");
      meta.className = `meta ${item.status === "saved" ? "withdrawn" : ""}`;
      meta.textContent = item.status === "saved" ? "Kay\u0131tl\u0131, tekrar istek yok" : "Bekliyor";
      row.append(indexLabel, box, link, meta);
      list.appendChild(row);
    }
    list.scrollTop = scroll;
    renderMeta();
  }
  function renderMeta() {
    const selected = items.filter((item) => item.selected).length;
    const kept = items.filter((item) => item.status === "saved").length;
    counts.textContent = items.length ? `${items.length} profil \xB7 ${selected} se\xE7ili \xB7 ${kept} kay\u0131tl\u0131` : "";
  }
  function applyParsed(filename, parsed) {
    items = parsed.usernames.map((username) => {
      const known = saved.has(username.toLowerCase());
      return {
        username,
        selected: parsed.trusted && !known,
        status: known ? "saved" : "pending"
      };
    });
    source.textContent = filename ? `Y\xFCklenen: ${filename}` : "";
    renderWarnings(parsed.warnings);
    dropLabel.textContent = filename || "Dosyay\u0131 buraya b\u0131rak veya se\xE7";
    renderList();
    const kept = items.filter((item) => item.status === "saved").length;
    addLog(
      items.length ? `${items.length} profil bulundu.${kept ? ` ${kept} kay\u0131tl\u0131 hesap se\xE7ilmedi.` : ""}` : parsed.warnings[0] || "Profil bulunamad\u0131.",
      items.length ? "ok" : "error"
    );
  }
  async function upload(file) {
    dropLabel.textContent = "Okunuyor...";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseBuffer(file.name, bytes);
    applyParsed(file.name, parsed);
  }
  function setAll(selected) {
    for (const item of items) item.selected = selected && item.status !== "saved";
    renderList();
  }
  function pickRange() {
    const count = Math.floor(Number(pickCountInput.value));
    const pick = pickSideInput.value === "last" ? "last" : "first";
    if (!Number.isFinite(count) || count < 1) {
      addLog("Se\xE7ilecek adet 1 veya daha b\xFCy\xFCk olmal\u0131.", "error");
      return;
    }
    const eligible = items.filter((item) => item.status !== "saved");
    const size = Math.min(eligible.length, count);
    const chosen = new Set((pick === "last" ? eligible.slice(-size) : eligible.slice(0, size)).map((item) => item.username.toLowerCase()));
    for (const item of items) item.selected = chosen.has(item.username.toLowerCase());
    renderList();
  }
  function openNext() {
    const selected = items.filter((item2) => item2.selected && item2.status !== "saved");
    if (!selected.length) {
      addLog("A\xE7\u0131lacak se\xE7ili profil yok.", "error");
      return;
    }
    const item = selected[0];
    window.open(`https://www.instagram.com/${encodeURIComponent(item.username)}/`, "_blank", "noopener");
    remember(item);
    addLog(`${item.username} kaydedildi. Buna tekrar istek at\u0131lmaz. Kalan se\xE7ili: ${selected.length - 1}.`);
    renderList();
  }
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) upload(fileInput.files[0]);
  });
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("over");
    if (event.dataTransfer.files[0]) upload(event.dataTransfer.files[0]);
  });
  document.querySelector("#select-all").addEventListener("click", () => setAll(true));
  document.querySelector("#select-none").addEventListener("click", () => setAll(false));
  pickApplyButton.addEventListener("click", pickRange);
  openNextButton.addEventListener("click", openNext);
  search.addEventListener("input", renderList);
  renderList();
})();
