/// <reference path="plugin-api.d.ts" />
window.__bdgPluginRegister(function activate(api) {
  api.log("osu!mania exporter activated (id=" + api.id + ")");

  var KEY_CHOICES = [4, 5, 6, 7, 8, 9, 10, 16, 18];
  var DEFAULT_KEYS = 7;

  var CSS = [
    ".osuex{font:12px/1.5 system-ui,sans-serif;display:flex;flex-direction:column;gap:8px;min-width:320px;max-width:480px;color:inherit}",
    ".osuex fieldset{border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:8px 10px;margin:0}",
    ".osuex legend{padding:0 4px;opacity:.8}",
    ".osuex .osuex-field{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0}",
    ".osuex .osuex-lbl{flex:0 0 auto;opacity:.85}",
    ".osuex input[type=text],.osuex input[type=number],.osuex select{flex:1 1 auto;min-width:0;background:rgba(128,128,128,.12);border:1px solid rgba(128,128,128,.35);color:inherit;border-radius:4px;padding:2px 5px;box-sizing:border-box}",
    ".osuex .osuex-inline{display:flex;align-items:center;gap:6px}",
    ".osuex .osuex-inline input[type=number]{max-width:64px}",
    ".osuex table{width:100%;border-collapse:collapse}",
    ".osuex th,.osuex td{text-align:left;padding:2px 4px;border-bottom:1px solid rgba(128,128,128,.18)}",
    ".osuex .osuex-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}",
    ".osuex .osuex-scroll{max-height:200px;overflow:auto}",
    ".osuex .osuex-muted{opacity:.72;font-size:11px}",
    ".osuex .osuex-muted.err{opacity:1;color:#ef4444}",
    ".osuex .osuex-status{font-size:11px;white-space:pre-wrap;word-break:break-word;min-height:14px}",
    ".osuex .osuex-status.err{color:#ef4444}",
    ".osuex button{cursor:pointer;border-radius:4px;border:1px solid rgba(128,128,128,.4);background:rgba(128,128,128,.15);color:inherit;padding:3px 8px}",
    ".osuex .osuex-rowbtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}",
  ].join("\n");

  var assignment = {};
  var trackSelects = [];
  var metaInputs = {};
  var keysSelect = null;
  var specialInput = null;
  var hiddenInput = null;
  var hpInput = null;
  var odInput = null;
  var arInput = null;
  var trackBody = null;
  var statusEl = null;
  var summaryEl = null;
  var listeners = [];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function textInput(value, placeholder) {
    var i = document.createElement("input");
    i.type = "text";
    if (value != null) i.value = value;
    if (placeholder) i.placeholder = placeholder;
    i.addEventListener("input", updateSummary);
    return i;
  }

  function numInput(value, min, max, step) {
    var i = document.createElement("input");
    i.type = "number";
    i.value = value;
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    if (step != null) i.step = step;
    return i;
  }

  function field(label, input) {
    var row = el("label", "osuex-field");
    row.appendChild(el("span", "osuex-lbl", label));
    row.appendChild(input);
    return row;
  }

  function baseName(p) {
    if (!p) return "";
    var s = String(p);
    var i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    return i >= 0 ? s.slice(i + 1) : s;
  }

  function sanitizeFile(s) {
    return String(s == null ? "" : s)
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  function errMessage(err) {
    if (!err) return "未知错误";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    return String(err);
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = "osuex-status" + (isError ? " err" : "");
    if (isError) api.log("[osu export] " + message);
  }

  function formatNumber(n) {
    var s = n.toFixed(6);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }

  function keysNow() {
    return parseInt(keysSelect.value, 10) || DEFAULT_KEYS;
  }

  function columnX(col, keys) {
    var lane = 512 / keys;
    var x = Math.floor(lane * col + lane / 2);
    if (x < 0) return 0;
    if (x > 511) return 511;
    return x;
  }

  function audioNameFromEnv() {
    var p = null;
    try {
      p = api.system.audioPath();
    } catch (e) {
      p = null;
    }
    if (p) return baseName(p);
    var snap = api.project.snapshot();
    return snap.audioName || "audio.mp3";
  }

  function nextFree(used, keys) {
    for (var c = 0; c < keys; c++) {
      if (!used[c]) return c;
    }
    return -1;
  }

  function rebuildTracks() {
    var keys = keysNow();
    var snap = api.project.snapshot();
    var tracks = [];
    for (var i = 0; i < snap.tracks.length; i++) {
      if (!hiddenInput.checked && snap.tracks[i].hidden) continue;
      tracks.push(snap.tracks[i]);
    }

    trackSelects = [];
    trackBody.textContent = "";

    var used = {};
    for (var a = 0; a < tracks.length; a++) {
      var id = tracks[a].id;
      var col = assignment[id];
      if (col === undefined || col === null) {
        col = nextFree(used, keys);
        assignment[id] = col;
      } else if (col >= keys) {
        col = -1;
        assignment[id] = -1;
      }
      if (col >= 0) used[col] = true;
    }

    for (var t = 0; t < tracks.length; t++) {
      var track = tracks[t];

      var tr = el("tr");
      var nameCell = el("td");
      var dot = el("span", "osuex-dot");
      dot.style.background = track.color || "#888";
      nameCell.appendChild(dot);
      nameCell.appendChild(document.createTextNode(track.name || track.id));
      tr.appendChild(nameCell);

      var sel = document.createElement("select");
      var skip = el("option", null, "跳过");
      skip.value = "-1";
      sel.appendChild(skip);
      for (var c = 0; c < keys; c++) {
        var opt = el("option", null, "列 " + (c + 1) + (specialInput.checked && c === 0 ? "（刮盘）" : ""));
        opt.value = String(c);
        sel.appendChild(opt);
      }
      sel.value = String(assignment[track.id]);
      (function (trackId, select) {
        select.addEventListener("change", function () {
          assignment[trackId] = parseInt(select.value, 10);
          updateSummary();
        });
      })(track.id, sel);

      var cell = el("td");
      cell.appendChild(sel);
      tr.appendChild(cell);

      trackBody.appendChild(tr);
      trackSelects.push({ id: track.id, select: sel });
    }

    updateSummary();
  }

  function collectMapping() {
    var keys = keysNow();
    var map = {};
    var dup = {};
    for (var i = 0; i < trackSelects.length; i++) {
      var rec = trackSelects[i];
      var col = parseInt(rec.select.value, 10);
      map[rec.id] = col;
      if (col >= 0 && col < keys) {
        dup[col] = (dup[col] || 0) + 1;
      }
    }
    return { map: map, dup: dup };
  }

  function collectNotes(map, keys) {
    var snap = api.project.snapshot();
    var notes = [];
    for (var i = 0; i < snap.markers.length; i++) {
      var m = snap.markers[i];
      var col = map[m.trackId];
      if (col === undefined || col < 0 || col >= keys) continue;
      notes.push({ time: Math.round(m.timeMs), col: col });
    }
    notes.sort(function (a, b) {
      if (a.time !== b.time) return a.time - b.time;
      return a.col - b.col;
    });
    return notes;
  }

  function collectTimingPoints() {
    var snap = api.project.snapshot();

    function bpmOf(beat) {
      var b = api.project.bpmAtBeat(beat);
      return isFinite(b) && b > 0 ? b : snap.baseBpm;
    }

    var raw = [{ beat: 0, bpm: bpmOf(0) }];
    var pts = snap.bpmPoints.slice().sort(function (a, b) {
      return a.beat - b.beat;
    });
    for (var i = 0; i < pts.length; i++) {
      raw.push({ beat: pts[i].beat, bpm: bpmOf(pts[i].beat) });
    }

    var out = [];
    for (var j = 0; j < raw.length; j++) {
      var bpm = raw[j].bpm;
      if (!isFinite(bpm) || bpm <= 0) continue;
      var time = Math.round(api.project.timeOfBeat(raw[j].beat));
      if (out.length) {
        var last = out[out.length - 1];
        if (Math.abs(last.bpm - bpm) < 1e-6) continue;
        if (time <= last.time) {
          last.bpm = bpm;
          continue;
        }
      }
      out.push({ time: time, bpm: bpm });
    }
    if (!out.length) {
      out.push({ time: Math.round(api.project.timeOfBeat(0)), bpm: snap.baseBpm });
    }
    return out;
  }

  function readMeta() {
    function val(key) {
      var input = metaInputs[key];
      return input ? input.value.trim() : "";
    }
    var title = val("title") || api.project.snapshot().name || "Untitled";
    var artist = val("artist");
    return {
      audio: val("audio") || audioNameFromEnv(),
      title: title,
      titleUnicode: val("titleUnicode") || title,
      artist: artist,
      artistUnicode: val("artistUnicode") || artist,
      creator: val("creator") || "BDG",
      version: val("version") || title,
      source: val("source"),
      tags: val("tags"),
      hp: hpInput.value || "8",
      od: odInput.value || "8",
      ar: arInput.value || "5",
    };
  }

  function buildOsu(meta, keys, notes, timings, specialStyle) {
    var L = [];
    function push(s) {
      L.push(s);
    }

    push("osu file format v14");
    push("");
    push("[General]");
    push("AudioFilename: " + meta.audio);
    push("AudioLeadIn: 0");
    push("PreviewTime: -1");
    push("Countdown: 0");
    push("SampleSet: Soft");
    push("StackLeniency: 0.7");
    push("Mode: 3");
    push("LetterboxInBreaks: 0");
    push("SpecialStyle: " + (specialStyle ? 1 : 0));
    push("WidescreenStoryboard: 0");
    push("");
    push("[Editor]");
    push("DistanceSpacing: 1");
    push("BeatDivisor: 4");
    push("GridSize: 4");
    push("TimelineZoom: 1");
    push("");
    push("[Metadata]");
    push("Title:" + meta.title);
    push("TitleUnicode:" + meta.titleUnicode);
    push("Artist:" + meta.artist);
    push("ArtistUnicode:" + meta.artistUnicode);
    push("Creator:" + meta.creator);
    push("Version:" + meta.version);
    push("Source:" + meta.source);
    push("Tags:" + meta.tags);
    push("BeatmapID:0");
    push("BeatmapSetID:0");
    push("");
    push("[Difficulty]");
    push("HPDrainRate:" + meta.hp);
    push("CircleSize:" + keys);
    push("OverallDifficulty:" + meta.od);
    push("ApproachRate:" + meta.ar);
    push("SliderMultiplier:1");
    push("SliderTickRate:1");
    push("");
    push("[Events]");
    push("");
    push("[TimingPoints]");
    for (var i = 0; i < timings.length; i++) {
      push(timings[i].time + "," + formatNumber(60000 / timings[i].bpm) + ",4,2,0,100,1,0");
    }
    push("");
    push("[HitObjects]");
    for (var j = 0; j < notes.length; j++) {
      push(columnX(notes[j].col, keys) + ",192," + notes[j].time + ",1,0,0:0:0:0:");
    }
    push("");
    return L.join("\n");
  }

  function updateSummary() {
    if (!summaryEl || !trackBody) return;
    var keys = keysNow();
    var mapping = collectMapping();
    var snap = api.project.snapshot();
    var count = 0;
    for (var i = 0; i < snap.markers.length; i++) {
      var col = mapping.map[snap.markers[i].trackId];
      if (col >= 0 && col < keys) count++;
    }
    var dups = [];
    for (var c in mapping.dup) {
      if (mapping.dup[c] > 1) dups.push(parseInt(c, 10) + 1);
    }
    summaryEl.textContent =
      count + " 个音符 · " + keys + "K" +
      (dups.length ? " · 警告：列 " + dups.join("/") + " 被多个轨道占用" : "");
    summaryEl.className = "osuex-muted" + (dups.length ? " err" : "");
  }

  function doExport() {
    var keys = keysNow();
    var meta = readMeta();
    var mapping = collectMapping();

    var dups = [];
    for (var c in mapping.dup) {
      if (mapping.dup[c] > 1) dups.push(parseInt(c, 10) + 1);
    }

    var notes = collectNotes(mapping.map, keys);
    if (!notes.length) {
      setStatus("没有映射到列的音符，请检查轨道映射", true);
      return;
    }

    var timings = collectTimingPoints();
    var text = buildOsu(meta, keys, notes, timings, specialInput.checked);
    var defaultName = sanitizeFile(
      (meta.artist ? meta.artist + " - " : "") + meta.title + " [" + meta.version + "]",
    ) + ".osu";

    setStatus(
      (dups.length ? "注意：列 " + dups.join("/") + " 被多个轨道占用。\n" : "") +
        "准备导出 " + notes.length + " 个音符 / " + timings.length + " 个时间点…",
      dups.length > 0,
    );

    var savedPath = "";
    api.system
      .saveFile({
        title: "导出 osu!mania 谱面",
        defaultPath: defaultName,
        filters: [{ name: "osu! beatmap", extensions: ["osu"] }],
      })
      .then(function (res) {
        if (res.canceled || !res.filePath) return;
        savedPath = res.filePath;
        return api.system.writeText(res.filePath, text);
      })
      .then(function (ok) {
        if (!savedPath) return;
        if (ok) {
          setStatus("已导出：" + baseName(savedPath) + "\n" + savedPath);
        } else {
          setStatus("写入失败：" + savedPath, true);
        }
      })
      .catch(function (err) {
        setStatus("导出失败：" + errMessage(err), true);
      });
  }

  var panel = api.ui.registerPanel({
    id: "osu-export",
    title: { zh: "osu!mania 导出", en: "osu!mania Export" },
    mount: function mount(host) {
      host.textContent = "";

      var style = document.createElement("style");
      style.textContent = CSS;
      host.appendChild(style);

      var root = el("div", "osuex");
      host.appendChild(root);

      var snap = api.project.snapshot();
      var defaultAudio = audioNameFromEnv();

      var metaFs = document.createElement("fieldset");
      metaFs.appendChild(el("legend", null, "元数据 Metadata"));
      metaInputs.title = textInput(snap.name || "");
      metaInputs.titleUnicode = textInput(snap.name || "");
      metaInputs.artist = textInput("");
      metaInputs.artistUnicode = textInput("");
      metaInputs.creator = textInput("BDG");
      metaInputs.version = textInput(snap.name || "Mania");
      metaInputs.source = textInput("BDG");
      metaInputs.tags = textInput("BDG osu");
      metaInputs.audio = textInput(defaultAudio);
      metaFs.appendChild(field("Title", metaInputs.title));
      metaFs.appendChild(field("TitleUnicode", metaInputs.titleUnicode));
      metaFs.appendChild(field("Artist", metaInputs.artist));
      metaFs.appendChild(field("ArtistUnicode", metaInputs.artistUnicode));
      metaFs.appendChild(field("Creator", metaInputs.creator));
      metaFs.appendChild(field("Version", metaInputs.version));
      metaFs.appendChild(field("Source", metaInputs.source));
      metaFs.appendChild(field("Tags", metaInputs.tags));
      metaFs.appendChild(field("AudioFilename", metaInputs.audio));
      root.appendChild(metaFs);

      var layoutFs = document.createElement("fieldset");
      layoutFs.appendChild(el("legend", null, "布局与难度 Layout"));

      keysSelect = document.createElement("select");
      for (var k = 0; k < KEY_CHOICES.length; k++) {
        var ko = el("option", null, KEY_CHOICES[k] + "K");
        ko.value = String(KEY_CHOICES[k]);
        keysSelect.appendChild(ko);
      }
      keysSelect.value = String(DEFAULT_KEYS);
      keysSelect.addEventListener("change", rebuildTracks);
      layoutFs.appendChild(field("键数 Keys", keysSelect));

      var diffRow = el("div", "osuex-field");
      diffRow.appendChild(el("span", "osuex-lbl", "HP / OD / AR"));
      var diffBox = el("div", "osuex-inline");
      hpInput = numInput(8, 0, 10, 0.1);
      odInput = numInput(8, 0, 10, 0.1);
      arInput = numInput(5, 0, 10, 0.1);
      diffBox.appendChild(hpInput);
      diffBox.appendChild(odInput);
      diffBox.appendChild(arInput);
      diffRow.appendChild(diffBox);
      layoutFs.appendChild(diffRow);

      specialInput = document.createElement("input");
      specialInput.type = "checkbox";
      specialInput.addEventListener("change", rebuildTracks);
      layoutFs.appendChild(field("8K 特殊样式（左侧刮盘）", specialInput));

      hiddenInput = document.createElement("input");
      hiddenInput.type = "checkbox";
      hiddenInput.addEventListener("change", rebuildTracks);
      layoutFs.appendChild(field("包含隐藏轨道", hiddenInput));

      root.appendChild(layoutFs);

      var trackFs = document.createElement("fieldset");
      trackFs.appendChild(el("legend", null, "轨道 → 列 Track mapping"));
      var toolRow = el("div", "osuex-rowbtns");
      var refreshBtn = el("button", null, "刷新轨道");
      refreshBtn.addEventListener("click", function () {
        assignment = {};
        rebuildTracks();
      });
      toolRow.appendChild(refreshBtn);
      toolRow.appendChild(el("span", "osuex-muted", "同列同刻会自动成为多押"));
      trackFs.appendChild(toolRow);

      var scroll = el("div", "osuex-scroll");
      var table = el("table");
      var thead = el("thead");
      var headRow = el("tr");
      headRow.appendChild(el("th", null, "轨道"));
      headRow.appendChild(el("th", null, "列"));
      thead.appendChild(headRow);
      table.appendChild(thead);
      trackBody = el("tbody");
      table.appendChild(trackBody);
      scroll.appendChild(table);
      trackFs.appendChild(scroll);
      root.appendChild(trackFs);

      var actionFs = document.createElement("fieldset");
      actionFs.appendChild(el("legend", null, "导出 Export"));
      var actionRow = el("div", "osuex-rowbtns");
      var exportBtn = el("button", null, "导出 .osu");
      exportBtn.addEventListener("click", doExport);
      actionRow.appendChild(exportBtn);
      summaryEl = el("span", "osuex-muted");
      actionRow.appendChild(summaryEl);
      actionFs.appendChild(actionRow);
      statusEl = el("div", "osuex-status");
      actionFs.appendChild(statusEl);
      root.appendChild(actionFs);

      listeners.push(api.events.on("project", updateSummary));

      rebuildTracks();
      setStatus("填写元数据并确认轨道映射后点击导出。");

      return function unmount() {
        for (var i = 0; i < listeners.length; i++) listeners[i]();
        listeners.length = 0;
        host.textContent = "";
      };
    },
  });

  api.ui.registerAction({
    label: { zh: "打开 osu!mania 导出面板", en: "Open osu!mania export panel" },
    run: function () {
      panel.open();
    },
  });

  api.ui.registerShortcut({
    id: "toggle-osu-export",
    label: { zh: "切换 osu!mania 导出面板", en: "Toggle osu!mania export panel" },
    combo: "Alt+3",
    run: function () {
      panel.toggle();
    },
  });

  api.ui.registerExporter({
    label: { zh: "osu!mania 谱面 (.osu)", en: "osu!mania beatmap (.osu)" },
    run: function () {
      panel.open();
    },
  });

  api.log("contributions registered");

  return function dispose() {
    for (var i = 0; i < listeners.length; i++) listeners[i]();
    listeners.length = 0;
    api.log("renderer entry disposed");
  };
});
