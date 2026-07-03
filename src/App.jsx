import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "time-energy-companion-v2";

const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultProfile = {
  name: "Jamie",
  wakeTime: "07:00",
  sleepTime: "23:00",
  napTime: "12:30",
  napMinutes: 30,
  waterInterval: 60,
  budgets: [
    { id: "reading", label: "读书", minutes: 60, color: "green", start: "09:30" },
    { id: "writing", label: "写作", minutes: 90, color: "blue", start: "10:45" },
    { id: "social", label: "社交", minutes: 30, color: "amber", start: "15:30" },
  ],
  habits: [
    { id: "morning-meditation", label: "早晨正念冥想", time: "07:05", detail: "10 分钟", minutes: 10 },
    { id: "walk-voice", label: "散步与语音记录", time: "07:20", detail: "计划 / 心情 / 灵感", minutes: 40 },
    { id: "breakfast", label: "早餐与恢复", time: "08:10", detail: "散步回来后", minutes: 30 },
    { id: "water", label: "每小时喝水", time: "每小时", detail: "轻提醒", minutes: 5 },
    { id: "nap", label: "午休", time: "12:30", detail: "30 分钟", minutes: 30 },
    { id: "evening-meditation", label: "晚间正念冥想", time: "22:30", detail: "10 分钟", minutes: 10 },
  ],
};

const defaultDay = {
  energy: 3,
  focus: 3,
  mood: "平静",
  mustDos: [
    { id: "task-1", title: "完成读书笔记", minutes: 60, done: false },
    { id: "task-2", title: "写作：读书日记", minutes: 90, done: false },
    { id: "task-3", title: "联系重要的人", minutes: 30, done: false },
  ],
  habitDone: {},
  notes: [
    { id: "note-1", type: "灵感", text: "关于时间统计的长期主义思考", time: "07:28" },
    { id: "note-2", type: "计划", text: "今天先写一段读书日记，再整理行动清单", time: "07:33" },
  ],
  inbox: [],
  attachments: [],
  logs: [
    { id: "log-1", category: "reading", label: "读书", minutes: 35, energy: 4, mood: "平静", quality: "有效投入", note: "读书笔记", time: "09:10" },
    { id: "log-2", category: "writing", label: "写作", minutes: 45, energy: 3, mood: "平静", quality: "有效投入", note: "读书日记写作", time: "10:30" },
  ],
};

const MOODS = ["平静", "开心", "焦虑", "低落", "兴奋"];
const QUALITY_OPTIONS = ["有效投入", "普通完成", "被打断", "恢复休息", "消耗较大"];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialState() {
  return {
    profile: defaultProfile,
    days: {
      [todayKey()]: defaultDay,
    },
  };
}

function loadState() {
  try {
    const next = localStorage.getItem(STORAGE_KEY);
    if (next) return JSON.parse(next);

    const old = localStorage.getItem("time-energy-companion-v1");
    if (old) {
      const parsed = JSON.parse(old);
      return {
        profile: { ...defaultProfile, ...(parsed.profile || {}) },
        days: parsed.days || { [todayKey()]: defaultDay },
      };
    }
  } catch {
    return null;
  }
  return null;
}

function timeNow() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function weekdayLabel() {
  return new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}

function minutesFromLogs(logs, category) {
  return logs.filter((log) => log.category === category).reduce((sum, log) => sum + Number(log.minutes || 0), 0);
}

function clampNumber(value, min, max, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function inferCapture(text, type, day, profile) {
  const content = String(text || "");
  const hourMatch = content.match(/(\d+(?:\.\d+)?)\s*(小时|个小时|h)/i);
  const minuteMatch = content.match(/(\d+)\s*(分钟|分|min|m)/i);
  const minutes = hourMatch ? Math.round(Number(hourMatch[1]) * 60) : minuteMatch ? Number(minuteMatch[1]) : 25;
  const energyMatch = content.match(/(?:能量|精力)\D*([1-5])/);
  const mood = MOODS.find((item) => content.includes(item)) || day.mood || "平静";

  const budget = profile.budgets.find((item) => content.includes(item.label))
    || (/读书|阅读|看书/.test(content) ? profile.budgets.find((item) => item.id === "reading") : null)
    || (/写作|写稿|笔记/.test(content) ? profile.budgets.find((item) => item.id === "writing") : null)
    || (/社交|聊天|沟通|见面/.test(content) ? profile.budgets.find((item) => item.id === "social") : null)
    || profile.budgets[0];

  const suggestedType = type === "时间记录" || minuteMatch || hourMatch
    ? "log"
    : /计划|目标|待办|要做|今天|明天/.test(content)
      ? "task"
      : "note";

  return {
    suggestedType,
    category: budget?.id || "reading",
    label: budget?.label || "记录",
    minutes,
    energy: energyMatch ? Number(energyMatch[1]) : day.energy || 3,
    mood,
    quality: content.includes("累") || content.includes("消耗") ? "消耗较大" : "有效投入",
  };
}

function safeFileName(text, ext) {
  const base = String(text || "time-energy")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 36) || "time-energy";
  return `${base}.${ext}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function parseMinutes(detail, fallback = 30) {
  const match = String(detail || "").match(/(\d+)\s*分钟/);
  return match ? Number(match[1]) : fallback;
}

function addMinutes(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute + Number(minutes || 30), 0, 0);
  return date.toTimeString().slice(0, 5);
}

function formatIcsDate(dateKey, time) {
  return `${dateKey.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function escapeIcs(text) {
  return String(text || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function noteText(note, profile) {
  return [`【${note.type}】${profile.name} 的记录`, `时间：${note.time}`, "", note.text].join("\n");
}

function feishuCardText(note, profile, day) {
  return [
    `# ${note.type}｜${profile.name} 的时间能量记录`,
    "",
    `- 时间：${note.time}`,
    `- 心情：${day.mood}`,
    `- 能量：${day.energy}/5`,
    `- 专注：${day.focus}/5`,
    "",
    "## 内容",
    note.text,
    "",
    "## 文件索引",
    "如有大文件，请放在百度云盘，并在这里补充链接、提取码和说明。",
  ].join("\n");
}

function buildCalendarEvents(profile) {
  const timedHabits = profile.habits
    .filter((habit) => /^\d{2}:\d{2}$/.test(habit.time))
    .map((habit) => ({
      title: habit.label,
      start: habit.time,
      end: addMinutes(habit.time, habit.minutes || parseMinutes(habit.detail, 20)),
      description: habit.detail,
    }));

  const budgetEvents = profile.budgets.map((budget) => ({
    title: `${budget.label}时间块`,
    start: budget.start || "09:30",
    end: addMinutes(budget.start || "09:30", budget.minutes),
    description: `今日预算 ${budget.minutes} 分钟`,
  }));

  return [...timedHabits, ...budgetEvents].sort((a, b) => a.start.localeCompare(b.start));
}

function makeIcs(profile, dateKey) {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const events = buildCalendarEvents(profile).map((event) => [
    "BEGIN:VEVENT",
    `UID:${uid("event")}@time-energy-companion`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${formatIcsDate(dateKey, event.start)}`,
    `DTEND:${formatIcsDate(dateKey, event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description || "时间能量伙伴")}`,
    "END:VEVENT",
  ].join("\r\n"));

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Time Energy Companion//ZH-CN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function App() {
  const [state, setState] = useState(() => loadState() || createInitialState());
  const [activeTab, setActiveTab] = useState("today");
  const [voiceType, setVoiceType] = useState("灵感");
  const [transcript, setTranscript] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [taskDraft, setTaskDraft] = useState("");
  const [logDraft, setLogDraft] = useState({ category: "reading", minutes: 25, quality: "有效投入", energy: 3, mood: "平静", note: "" });
  const [recordingState, setRecordingState] = useState("idle");
  const [recordingUrl, setRecordingUrl] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordedBlobRef = useRef(null);
  const fileRef = useRef(null);
  const attachmentFileRef = useRef(null);

  const dateKey = todayKey();
  const profile = state.profile;
  const day = state.days[dateKey] || defaultDay;
  const supportsRecording = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  const updateDay = (updater) => {
    setState((current) => {
      const currentDay = current.days[dateKey] || defaultDay;
      return {
        ...current,
        days: {
          ...current.days,
          [dateKey]: updater(currentDay),
        },
      };
    });
  };

  const budgetStats = useMemo(() => profile.budgets.map((budget) => {
    const used = minutesFromLogs(day.logs || [], budget.id);
    return { ...budget, used, percent: Math.min(100, Math.round((used / Math.max(1, budget.minutes)) * 100)) };
  }), [day.logs, profile.budgets]);

  const timeline = useMemo(() => buildCalendarEvents(profile).map((event) => ({
    time: event.start,
    label: event.title,
    detail: event.description,
    tone: event.title.includes("写作") ? "blue" : event.title.includes("社交") ? "amber" : "green",
  })), [profile]);

  function saveVoiceNote() {
    const text = transcript.trim();
    if (!text) return;
    const suggestion = inferCapture(text, voiceType, day, profile);
    updateDay((current) => ({
      ...current,
      notes: voiceType === "时间记录" ? (current.notes || []) : [{ id: uid("note"), type: voiceType, text, time: timeNow() }, ...(current.notes || [])],
      inbox: [{
        id: uid("inbox"),
        type: voiceType,
        text,
        time: timeNow(),
        source: "文字/语音转写",
        suggestion,
      }, ...(current.inbox || [])],
    }));
    setTranscript("");
  }

  function openShortcuts() {
    window.location.href = "shortcuts://";
  }

  async function startRecording() {
    if (!supportsRecording) {
      window.alert("当前浏览器不支持网页录音。可以先用系统录音 App，再把文件或链接放进附件库。");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      recordedBlobRef.current = blob;
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(URL.createObjectURL(blob));
      setRecordingState("ready");
    };
    recorder.start();
    setRecordingState("recording");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function saveRecording() {
    if (!recordedBlobRef.current) return;
    const blob = recordedBlobRef.current;
    const dataUrl = await readBlobAsDataUrl(blob);
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    updateDay((current) => ({
      ...current,
      attachments: [{
        id: uid("audio"),
        kind: "audio",
        name: `语音记录-${dateKey}-${timeNow().replace(":", "")}.${ext}`,
        type: blob.type || "audio/webm",
        size: blob.size,
        time: timeNow(),
        dataUrl,
      }, ...(current.attachments || [])],
    }));
    recordedBlobRef.current = null;
    setRecordingUrl("");
    setRecordingState("idle");
  }

  function addTask() {
    const title = taskDraft.trim();
    if (!title) return;
    updateDay((current) => ({
      ...current,
      mustDos: [...(current.mustDos || []), { id: uid("task"), title, minutes: 30, done: false }],
    }));
    setTaskDraft("");
  }

  function addLog() {
    const budget = profile.budgets.find((item) => item.id === logDraft.category);
    const minutes = clampNumber(logDraft.minutes, 1, 1440, 25);
    updateDay((current) => ({
      ...current,
      logs: [{
        id: uid("log"),
        category: logDraft.category,
        label: budget?.label || "记录",
        minutes,
        quality: logDraft.quality,
        energy: clampNumber(logDraft.energy, 1, 5, current.energy || 3),
        mood: logDraft.mood || current.mood || "平静",
        note: logDraft.note || "",
        time: logDraft.time || timeNow(),
      }, ...(current.logs || [])],
    }));
    setLogDraft((draft) => ({ ...draft, minutes: 25, note: "", time: timeNow() }));
  }

  function updateLog(id, patch) {
    updateDay((current) => ({
      ...current,
      logs: (current.logs || []).map((log) => log.id === id ? { ...log, ...patch } : log),
    }));
  }

  function deleteLog(id) {
    updateDay((current) => ({ ...current, logs: (current.logs || []).filter((log) => log.id !== id) }));
  }

  function deleteInboxItem(id) {
    updateDay((current) => ({ ...current, inbox: (current.inbox || []).filter((item) => item.id !== id) }));
  }

  function inboxToLog(item) {
    const suggestion = item.suggestion || inferCapture(item.text, item.type, day, profile);
    updateDay((current) => ({
      ...current,
      logs: [{
        id: uid("log"),
        category: suggestion.category,
        label: suggestion.label,
        minutes: suggestion.minutes,
        energy: suggestion.energy,
        mood: suggestion.mood,
        quality: suggestion.quality,
        note: item.text,
        time: item.time || timeNow(),
        source: item.source,
      }, ...(current.logs || [])],
      inbox: (current.inbox || []).filter((entry) => entry.id !== item.id),
    }));
  }

  function inboxToTask(item) {
    const suggestion = item.suggestion || inferCapture(item.text, item.type, day, profile);
    updateDay((current) => ({
      ...current,
      mustDos: [{ id: uid("task"), title: item.text, minutes: suggestion.minutes, done: false }, ...(current.mustDos || [])],
      inbox: (current.inbox || []).filter((entry) => entry.id !== item.id),
    }));
  }

  function inboxToNote(item) {
    updateDay((current) => ({
      ...current,
      notes: [{ id: uid("note"), type: item.type || "灵感", text: item.text, time: item.time || timeNow() }, ...(current.notes || [])],
      inbox: (current.inbox || []).filter((entry) => entry.id !== item.id),
    }));
  }

  function exportData() {
    const payload = { exportedAt: new Date().toISOString(), app: "time-energy-companion", version: 2, ...state };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `time-energy-backup-${dateKey}.json`);
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.profile && parsed.days) {
          const { exportedAt, app, version, ...restored } = parsed;
          setState(restored);
        }
      } catch {
        window.alert("导入失败：文件格式不正确。");
      }
    };
    reader.readAsText(file);
  }

  function exportCalendar() {
    const ics = makeIcs(profile, dateKey);
    downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), `time-energy-calendar-${dateKey}.ics`);
  }

  function exportNote(note, mode = "feishu") {
    const text = mode === "feishu" ? feishuCardText(note, profile, day) : noteText(note, profile);
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), safeFileName(`${note.type}-${note.time}`, "txt"));
  }

  function exportSelectedNotes() {
    const selected = (day.notes || []).filter((note) => selectedNoteIds.includes(note.id));
    if (!selected.length) {
      window.alert("请先在灵感池里选择要导出的卡片。");
      return;
    }
    const text = selected.map((note) => feishuCardText(note, profile, day)).join("\n\n---\n\n");
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `selected-inspiration-cards-${dateKey}.txt`);
  }

  function exportAttachmentIndex() {
    const attachments = Object.entries(state.days).flatMap(([key, item]) => (item.attachments || []).map((file) => ({
      date: key,
      name: file.name,
      type: file.type,
      size: file.size,
      time: file.time,
      kind: file.kind || "file",
    })));
    const lines = attachments.map((file) => `${file.date} ${file.time}｜${file.kind}｜${file.name}｜${Math.ceil(file.size / 1024)} KB`);
    downloadBlob(new Blob([lines.join("\n") || "暂无附件索引"], { type: "text/plain;charset=utf-8" }), `attachment-index-${dateKey}.txt`);
  }

  async function copyNote(note) {
    const text = feishuCardText(note, profile, day);
    try {
      await navigator.clipboard.writeText(text);
      window.alert("已复制为飞书格式。");
    } catch {
      window.alert("复制失败。可以改用导出文本文件。");
    }
  }

  async function shareNote(note) {
    const text = feishuCardText(note, profile, day);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${note.type}｜飞书记录`, text });
      } catch {
        // User cancelled the share sheet.
      }
      return;
    }
    copyNote(note);
  }

  function toggleNoteSelected(id) {
    setSelectedNoteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert("当前版本建议单个附件小于 5MB。大文件请放百度云盘，再把链接和提取码写进灵感卡。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateDay((current) => ({
        ...current,
        attachments: [{
          id: uid("file"),
          kind: "file",
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          time: timeNow(),
          dataUrl: String(reader.result),
        }, ...(current.attachments || [])],
      }));
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function exportAttachment(attachment) {
    fetch(attachment.dataUrl).then((response) => response.blob()).then((blob) => downloadBlob(blob, attachment.name));
  }

  function deleteAttachment(id) {
    updateDay((current) => ({ ...current, attachments: (current.attachments || []).filter((item) => item.id !== id) }));
  }

  return (
    <main className="app-shell">
      <section className="screen">
        <Header profile={profile} />
        {activeTab === "today" && (
          <>
            <RhythmCard profile={profile} />
            <VoicePanel
              voiceType={voiceType}
              setVoiceType={setVoiceType}
              transcript={transcript}
              setTranscript={setTranscript}
              saveVoiceNote={saveVoiceNote}
              recordingState={recordingState}
              recordingUrl={recordingUrl}
              startRecording={startRecording}
              stopRecording={stopRecording}
              saveRecording={saveRecording}
              supportsRecording={supportsRecording}
              openShortcuts={openShortcuts}
            />
            <InboxPanel
              inbox={day.inbox || []}
              inboxToLog={inboxToLog}
              inboxToTask={inboxToTask}
              inboxToNote={inboxToNote}
              deleteInboxItem={deleteInboxItem}
            />
            <div className="two-column">
              <TaskPanel day={day} updateDay={updateDay} taskDraft={taskDraft} setTaskDraft={setTaskDraft} addTask={addTask} />
              <EnergyPanel day={day} updateDay={updateDay} />
            </div>
            <HabitPanel profile={profile} day={day} updateDay={updateDay} />
            <BudgetPanel
              budgetStats={budgetStats}
              logs={day.logs || []}
              logDraft={logDraft}
              setLogDraft={setLogDraft}
              addLog={addLog}
              updateLog={updateLog}
              deleteLog={deleteLog}
            />
            <InspirationPanel
              notes={day.notes || []}
              selectedNoteIds={selectedNoteIds}
              toggleNoteSelected={toggleNoteSelected}
              exportNote={exportNote}
              copyNote={copyNote}
              shareNote={shareNote}
            />
          </>
        )}
        {activeTab === "calendar" && <CalendarPanel timeline={timeline} profile={profile} exportCalendar={exportCalendar} />}
        {activeTab === "stats" && <StatsPanel day={day} budgetStats={budgetStats} />}
        {activeTab === "settings" && (
          <SettingsPanel
            profile={profile}
            state={state}
            day={day}
            selectedNoteIds={selectedNoteIds}
            setState={setState}
            exportData={exportData}
            exportSelectedNotes={exportSelectedNotes}
            exportAttachmentIndex={exportAttachmentIndex}
            importData={importData}
            fileRef={fileRef}
            attachmentFileRef={attachmentFileRef}
            saveAttachment={saveAttachment}
            exportAttachment={exportAttachment}
            deleteAttachment={deleteAttachment}
          />
        )}
      </section>
      <nav className="bottom-nav" aria-label="主导航">
        {[
          ["today", "今天"],
          ["calendar", "日历"],
          ["stats", "统计"],
          ["settings", "我的"],
        ].map(([id, label]) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function Header({ profile }) {
  return (
    <header className="topbar">
      <div>
        <p className="muted">{weekdayLabel()}</p>
        <h1>早安，{profile.name}</h1>
      </div>
      <div className="date-badge">日历</div>
    </header>
  );
}

function RhythmCard({ profile }) {
  return (
    <section className="rhythm-card" aria-label="今日节律">
      <div>
        <strong>{profile.wakeTime}</strong>
        <span>起床</span>
      </div>
      <div>
        <strong>{profile.sleepTime}</strong>
        <span>目标入睡</span>
      </div>
    </section>
  );
}

function VoicePanel(props) {
  const {
    voiceType,
    setVoiceType,
    transcript,
    setTranscript,
    saveVoiceNote,
    recordingState,
    recordingUrl,
    startRecording,
    stopRecording,
    saveRecording,
    supportsRecording,
    openShortcuts,
  } = props;

  return (
    <section className="voice-panel">
      <div className="voice-orb" aria-hidden="true">录</div>
      <div className="voice-content">
        <p className="eyebrow">散步语音记录</p>
        <h2>记录灵感、今日计划和心情</h2>
        <div className="segmented">
          {["计划", "心情", "灵感", "时间记录"].map((type) => (
            <button key={type} className={voiceType === type ? "selected" : ""} onClick={() => setVoiceType(type)}>{type}</button>
          ))}
        </div>
        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="先写下文字灵感；如果需要音频，用下方录音。" />
        <div className="button-row">
          <button className="primary" onClick={saveVoiceNote}>保存文字</button>
          <button className="secondary" onClick={openShortcuts}>打开快捷指令</button>
          <button className="secondary" onClick={recordingState === "recording" ? stopRecording : startRecording}>
            {recordingState === "recording" ? "停止录音" : "开始录音"}
          </button>
          {recordingState === "ready" && <button className="secondary" onClick={saveRecording}>保存音频</button>}
        </div>
        <div className="shortcut-card">
          <strong>Action Button 推荐设置</strong>
          <span>在 iPhone 快捷指令里新建“记录灵感”：先录制音频并保存到语音备忘录，再打开这个网页。回到这里后，把语音转写或摘要粘贴进上方文本框，它会进入待整理并给出分类建议。</span>
        </div>
        {!supportsRecording && <p className="voice-hint">当前浏览器不支持网页录音，可用系统录音后把文件放入附件库。</p>}
        {recordingState === "recording" && <p className="voice-hint">正在使用网页内录音。若要直接进语音备忘录，请用上方快捷指令入口。</p>}
        {recordingUrl && <audio className="audio-preview" controls src={recordingUrl} />}
      </div>
    </section>
  );
}

function InboxPanel({ inbox, inboxToLog, inboxToTask, inboxToNote, deleteInboxItem }) {
  if (!inbox.length) return null;

  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>待整理语音/文字</h2>
        <span>{inbox.length} 条待确认</span>
      </div>
      <div className="inbox-list">
        {inbox.map((item) => {
          const suggestion = item.suggestion || {};
          return (
            <article className="inbox-card" key={item.id}>
              <div>
                <strong>{item.type} · {item.time}</strong>
                <p>{item.text}</p>
                <span>建议：{suggestion.label || "记录"} · {suggestion.minutes || 25} 分钟 · 能量 {suggestion.energy || 3}/5 · {suggestion.mood || "平静"}</span>
              </div>
              <div className="inbox-actions">
                <button onClick={() => inboxToLog(item)}>转时间记录</button>
                <button onClick={() => inboxToTask(item)}>转计划</button>
                <button onClick={() => inboxToNote(item)}>转灵感</button>
                <button onClick={() => deleteInboxItem(item.id)}>删除</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TaskPanel({ day, updateDay, taskDraft, setTaskDraft, addTask }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>今日三件事</h2>
        <span>{(day.mustDos || []).filter((task) => task.done).length}/{(day.mustDos || []).length}</span>
      </div>
      <div className="task-list">
        {(day.mustDos || []).map((task, index) => (
          <label className="task-row" key={task.id}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => updateDay((current) => ({
                ...current,
                mustDos: (current.mustDos || []).map((item) => item.id === task.id ? { ...item, done: !item.done } : item),
              }))}
            />
            <span className="task-index">{index + 1}</span>
            <span>
              <strong>{task.title}</strong>
              <small>{task.minutes} 分钟</small>
            </span>
          </label>
        ))}
      </div>
      <div className="inline-form">
        <input value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} placeholder="添加一件事" />
        <button onClick={addTask}>添加</button>
      </div>
    </section>
  );
}

function EnergyPanel({ day, updateDay }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>能量 · 心情</h2>
        <span>记录</span>
      </div>
      <Slider label="能量" value={day.energy} onChange={(value) => updateDay((current) => ({ ...current, energy: value }))} />
      <Slider label="专注" value={day.focus} onChange={(value) => updateDay((current) => ({ ...current, focus: value }))} />
      <div className="mood-row">
        {MOODS.map((mood) => (
          <button key={mood} className={day.mood === mood ? "selected" : ""} onClick={() => updateDay((current) => ({ ...current, mood }))}>{mood}</button>
        ))}
      </div>
    </section>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <label className="slider-row">
      <span>{label}</span>
      <strong>{value}/5</strong>
      <input type="range" min="1" max="5" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function HabitPanel({ profile, day, updateDay }) {
  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>固定习惯</h2>
        <span>可在“我的”里修改</span>
      </div>
      <div className="habit-strip">
        {profile.habits.map((habit) => (
          <button
            key={habit.id}
            className={day.habitDone[habit.id] ? "habit done" : "habit"}
            onClick={() => updateDay((current) => ({
              ...current,
              habitDone: { ...current.habitDone, [habit.id]: !current.habitDone[habit.id] },
            }))}
          >
            <strong>{habit.label}</strong>
            <span>{habit.time} · {habit.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BudgetPanel({ budgetStats, logs, logDraft, setLogDraft, addLog, updateLog, deleteLog }) {
  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>真实时间账本</h2>
        <span>可补记 / 可修改 / 可删除</span>
      </div>
      <div className="budget-list">
        {budgetStats.map((budget) => (
          <div className="budget-row" key={budget.id}>
            <div>
              <strong>{budget.label}</strong>
              <span>{budget.used} / {budget.minutes} 分钟</span>
            </div>
            <div className="progress"><i className={budget.color} style={{ width: `${budget.percent}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="log-form">
        <select value={logDraft.category} onChange={(event) => setLogDraft((draft) => ({ ...draft, category: event.target.value }))}>
          {budgetStats.map((budget) => <option key={budget.id} value={budget.id}>{budget.label}</option>)}
        </select>
        <input type="time" value={logDraft.time || timeNow()} onChange={(event) => setLogDraft((draft) => ({ ...draft, time: event.target.value }))} />
        <input type="number" min="1" value={logDraft.minutes} onChange={(event) => setLogDraft((draft) => ({ ...draft, minutes: event.target.value }))} aria-label="分钟" />
        <select value={logDraft.energy || 3} onChange={(event) => setLogDraft((draft) => ({ ...draft, energy: Number(event.target.value) }))} aria-label="能量">
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>能量 {value}</option>)}
        </select>
        <select value={logDraft.mood || "平静"} onChange={(event) => setLogDraft((draft) => ({ ...draft, mood: event.target.value }))} aria-label="心情">
          {MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
        </select>
        <select value={logDraft.quality} onChange={(event) => setLogDraft((draft) => ({ ...draft, quality: event.target.value }))} aria-label="质量">
          {QUALITY_OPTIONS.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
        </select>
        <input value={logDraft.note || ""} onChange={(event) => setLogDraft((draft) => ({ ...draft, note: event.target.value }))} placeholder="做了什么" />
        <button onClick={addLog}>补记</button>
      </div>
      <div className="log-list">
        {logs.length === 0 && <p className="empty-hint">今天还没有时间记录。先补记一段，比如“读书 35 分钟，能量 4”。</p>}
        {logs.map((log) => (
          <article className="log-card" key={log.id}>
            <select value={log.category} onChange={(event) => {
              const budget = budgetStats.find((item) => item.id === event.target.value);
              updateLog(log.id, { category: event.target.value, label: budget?.label || log.label });
            }}>
              {budgetStats.map((budget) => <option key={budget.id} value={budget.id}>{budget.label}</option>)}
            </select>
            <input type="time" value={log.time || "09:00"} onChange={(event) => updateLog(log.id, { time: event.target.value })} />
            <input type="number" min="1" value={log.minutes || 1} onChange={(event) => updateLog(log.id, { minutes: clampNumber(event.target.value, 1, 1440, 1) })} aria-label="已用分钟" />
            <select value={log.energy || 3} onChange={(event) => updateLog(log.id, { energy: Number(event.target.value) })} aria-label="能量状态">
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>能量 {value}</option>)}
            </select>
            <select value={log.mood || "平静"} onChange={(event) => updateLog(log.id, { mood: event.target.value })} aria-label="心情">
              {MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
            </select>
            <select value={log.quality || "有效投入"} onChange={(event) => updateLog(log.id, { quality: event.target.value })} aria-label="投入质量">
              {QUALITY_OPTIONS.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
            </select>
            <input value={log.note || ""} onChange={(event) => updateLog(log.id, { note: event.target.value })} placeholder="备注" />
            <button onClick={() => deleteLog(log.id)}>删除</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function InspirationPanel({ notes, selectedNoteIds, toggleNoteSelected, exportNote, copyNote, shareNote }) {
  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>灵感池</h2>
        <span>{selectedNoteIds.length ? `已选 ${selectedNoteIds.length}` : `${notes.length} 条`}</span>
      </div>
      <div className="note-grid">
        {notes.map((note) => (
          <article key={note.id} className={selectedNoteIds.includes(note.id) ? "note-card selected" : "note-card"}>
            <label className="note-select">
              <input type="checkbox" checked={selectedNoteIds.includes(note.id)} onChange={() => toggleNoteSelected(note.id)} />
              <b>{note.type}</b>
            </label>
            <p>{note.text}</p>
            <span>{note.time}</span>
            <div className="note-actions">
              <button onClick={() => copyNote(note)}>复制飞书格式</button>
              <button onClick={() => exportNote(note, "feishu")}>导出</button>
              <button onClick={() => shareNote(note)}>分享到飞书</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarPanel({ timeline, profile, exportCalendar }) {
  return (
    <section className="panel full calendar-panel">
      <div className="panel-title">
        <h2>今天日历</h2>
        <span>{profile.wakeTime} - {profile.sleepTime}</span>
      </div>
      <button className="calendar-export" onClick={exportCalendar}>导出到苹果日历 (.ics)</button>
      <p className="calendar-hint">iPhone 下载后可导入日历。当前版本不会自动写入系统日历。</p>
      <div className="timeline">
        {timeline.map((item) => (
          <div className={`timeline-row ${item.tone}`} key={`${item.time}-${item.label}`}>
            <time>{item.time}</time>
            <span>{item.label}<small>{item.detail}</small></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsPanel({ day, budgetStats }) {
  const total = (day.logs || []).reduce((sum, log) => sum + Number(log.minutes || 0), 0);
  const energyLogs = (day.logs || []).filter((log) => Number(log.energy));
  const averageEnergy = energyLogs.length
    ? (energyLogs.reduce((sum, log) => sum + Number(log.energy), 0) / energyLogs.length).toFixed(1)
    : day.energy;
  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>今日复盘</h2>
        <span>{total} 分钟有效记录</span>
      </div>
      <div className="stats-grid">
        <div><strong>{averageEnergy}/5</strong><span>记录平均能量</span></div>
        <div><strong>{day.focus}/5</strong><span>专注水平</span></div>
        <div><strong>{day.mood}</strong><span>主要心情</span></div>
      </div>
      <div className="review-box">
        <h3>今晚可以问自己</h3>
        <p>今天哪些时间真正流向了重要的事？哪些事情消耗了能量？明天要保护哪一个高能量时段？</p>
      </div>
      <div className="budget-list">
        {budgetStats.map((budget) => <div className="budget-row compact" key={budget.id}><strong>{budget.label}</strong><span>{budget.used} 分钟</span></div>)}
      </div>
    </section>
  );
}

function SettingsPanel(props) {
  const {
    profile,
    state,
    day,
    selectedNoteIds,
    setState,
    exportData,
    exportSelectedNotes,
    exportAttachmentIndex,
    importData,
    fileRef,
    attachmentFileRef,
    saveAttachment,
    exportAttachment,
    deleteAttachment,
  } = props;
  const updateProfile = (patch) => setState((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  const updateBudget = (id, patch) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        budgets: current.profile.budgets.map((budget) => budget.id === id ? { ...budget, ...patch } : budget),
      },
    }));
  };
  const updateHabit = (id, patch) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        habits: current.profile.habits.map((habit) => habit.id === id ? { ...habit, ...patch } : habit),
      },
    }));
  };

  return (
    <section className="panel full settings-panel">
      <div className="panel-title">
        <h2>我的节律</h2>
        <span>首次设置后自动保存</span>
      </div>
      <p className="settings-note">这些设置保存在当前设备。换手机、清理浏览器数据或更换浏览器前，请先在备份中心导出完整备份。</p>
      <div className="settings-grid">
        <label>名字<input value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} /></label>
        <label>起床时间<input type="time" value={profile.wakeTime} onChange={(event) => updateProfile({ wakeTime: event.target.value })} /></label>
        <label>目标入睡<input type="time" value={profile.sleepTime} onChange={(event) => updateProfile({ sleepTime: event.target.value })} /></label>
        <label>午休时间<input type="time" value={profile.napTime} onChange={(event) => updateProfile({ napTime: event.target.value })} /></label>
      </div>
      <h3>时间预算</h3>
      {profile.budgets.map((budget) => (
        <label className="budget-setting" key={budget.id}>
          <span>{budget.label}</span>
          <input type="number" min="0" value={budget.minutes} onChange={(event) => updateBudget(budget.id, { minutes: Number(event.target.value) })} />
          <small>分钟</small>
        </label>
      ))}
      <h3>固定习惯</h3>
      <div className="habit-edit-list">
        {profile.habits.map((habit) => (
          <div className="habit-editor" key={habit.id}>
            <input value={habit.label} onChange={(event) => updateHabit(habit.id, { label: event.target.value })} aria-label="习惯名称" />
            <input value={habit.time} onChange={(event) => updateHabit(habit.id, { time: event.target.value })} aria-label="习惯时间" />
            <input value={habit.detail} onChange={(event) => updateHabit(habit.id, { detail: event.target.value })} aria-label="习惯说明" />
          </div>
        ))}
      </div>
      <div className="button-row export-row">
        <button className="primary" onClick={exportData}>导出数据</button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>导入数据</button>
        <input ref={fileRef} type="file" accept="application/json" onChange={importData} hidden />
      </div>
      <BackupCenter
        state={state}
        day={day}
        selectedNoteIds={selectedNoteIds}
        exportData={exportData}
        exportSelectedNotes={exportSelectedNotes}
        exportAttachmentIndex={exportAttachmentIndex}
        attachmentFileRef={attachmentFileRef}
        saveAttachment={saveAttachment}
        exportAttachment={exportAttachment}
        deleteAttachment={deleteAttachment}
      />
    </section>
  );
}

function BackupCenter(props) {
  const {
    state,
    day,
    selectedNoteIds,
    exportData,
    exportSelectedNotes,
    exportAttachmentIndex,
    attachmentFileRef,
    saveAttachment,
    exportAttachment,
    deleteAttachment,
  } = props;
  const totalNotes = Object.values(state.days).reduce((sum, item) => sum + (item.notes?.length || 0), 0);
  const totalLogs = Object.values(state.days).reduce((sum, item) => sum + (item.logs?.length || 0), 0);
  const totalInbox = Object.values(state.days).reduce((sum, item) => sum + (item.inbox?.length || 0), 0);
  const totalFiles = Object.values(state.days).reduce((sum, item) => sum + (item.attachments?.length || 0), 0);
  const attachments = day.attachments || [];

  return (
    <section className="backup-center">
      <div className="panel-title">
        <h2>备份中心</h2>
        <span>防丢失</span>
      </div>
      <div className="backup-stats">
        <div><strong>{totalNotes}</strong><span>文字记录</span></div>
        <div><strong>{totalLogs}</strong><span>时间记录</span></div>
        <div><strong>{totalInbox}</strong><span>待整理</span></div>
        <div><strong>{totalFiles}</strong><span>附件</span></div>
      </div>
      <p className="backup-note">完整备份会包含设置、时间记录、待整理语音文字、灵感文字、录音和小附件。大文件请放百度云盘，灵感卡里保存链接和提取码。</p>
      <div className="button-row export-row">
        <button className="primary" onClick={exportData}>完整备份</button>
        <button className="secondary" onClick={exportSelectedNotes}>导出已选灵感</button>
        <button className="secondary" onClick={exportAttachmentIndex}>导出附件索引</button>
        <span className="selection-hint">已选 {selectedNoteIds.length} 张</span>
      </div>
      <div className="attachment-head">
        <h3>附件库</h3>
        <button className="secondary" onClick={() => attachmentFileRef.current?.click()}>添加文件</button>
        <input ref={attachmentFileRef} type="file" onChange={saveAttachment} hidden />
      </div>
      <div className="attachment-list">
        {attachments.length === 0 && <p className="empty-hint">今天还没有附件。小文件会进入完整备份，大文件建议放百度云盘后把链接写进灵感。</p>}
        {attachments.map((file) => (
          <article className="attachment-row" key={file.id}>
            <div>
              <strong>{file.kind === "audio" ? "录音：" : ""}{file.name}</strong>
              <span>{Math.ceil(file.size / 1024)} KB · {file.time}</span>
              {file.kind === "audio" && <audio controls src={file.dataUrl} />}
            </div>
            <div>
              <button onClick={() => exportAttachment(file)}>保存</button>
              <button onClick={() => deleteAttachment(file.id)}>删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
