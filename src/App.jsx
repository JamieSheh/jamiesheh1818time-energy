import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "time-energy-companion-v1";

const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultProfile = {
  name: "Jamie",
  wakeTime: "07:00",
  sleepTime: "23:00",
  napTime: "12:30",
  napMinutes: 30,
  waterInterval: 60,
  budgets: [
    { id: "reading", label: "读书", minutes: 60, color: "green" },
    { id: "writing", label: "写作", minutes: 90, color: "blue" },
    { id: "social", label: "社交", minutes: 30, color: "amber" },
  ],
  habits: [
    { id: "morning-meditation", label: "早晨正念冥想", time: "07:05", detail: "10 分钟" },
    { id: "walk-voice", label: "散步与语音记录", time: "07:20", detail: "计划 / 心情 / 灵感" },
    { id: "breakfast", label: "早餐与恢复", time: "08:10", detail: "散步回来后" },
    { id: "water", label: "每小时喝水", time: "每小时", detail: "轻提醒" },
    { id: "nap", label: "午休", time: "12:30", detail: "30 分钟" },
    { id: "evening-meditation", label: "晚间正念冥想", time: "22:30", detail: "10 分钟" },
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
  attachments: [],
  logs: [
    { id: "log-1", category: "reading", label: "读书", minutes: 35, energy: 4, quality: "有效投入", time: "09:10" },
    { id: "log-2", category: "writing", label: "写作", minutes: 45, energy: 3, quality: "有效投入", time: "10:30" },
  ],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function createInitialState() {
  return {
    profile: defaultProfile,
    days: {
      [todayKey()]: defaultDay,
    },
  };
}

function minutesFromLogs(logs, category) {
  return logs.filter((log) => log.category === category).reduce((sum, log) => sum + Number(log.minutes || 0), 0);
}

function timeNow() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function weekdayLabel() {
  return new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function noteText(note, profile) {
  return [
    `【${note.type}】${profile.name} 的记录`,
    `时间：${note.time}`,
    "",
    note.text,
  ].join("\n");
}

function cardText(note, profile) {
  return [
    "灵感卡片",
    `来自：${profile.name}`,
    `类型：${note.type}`,
    `时间：${note.time}`,
    "",
    note.text,
    "",
    "记录于「时间能量伙伴」",
  ].join("\n");
}

export function App() {
  const [state, setState] = useState(() => loadState() || createInitialState());
  const [activeTab, setActiveTab] = useState("today");
  const [voiceType, setVoiceType] = useState("灵感");
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [taskDraft, setTaskDraft] = useState("");
  const [logDraft, setLogDraft] = useState({ category: "reading", minutes: 25, label: "读书", quality: "有效投入" });
  const recognitionRef = useRef(null);
  const fileRef = useRef(null);
  const attachmentFileRef = useRef(null);

  const dateKey = todayKey();
  const day = state.days[dateKey] || defaultDay;
  const profile = state.profile;
  const supportsVoice = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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

  const budgetStats = useMemo(() => {
    return profile.budgets.map((budget) => {
      const used = minutesFromLogs(day.logs, budget.id);
      return { ...budget, used, percent: Math.min(100, Math.round((used / budget.minutes) * 100)) };
    });
  }, [day.logs, profile.budgets]);

  const timeline = useMemo(() => {
    return [
      { time: profile.wakeTime, label: "起床", tone: "coral" },
      { time: "07:05", label: "早晨正念冥想 10 分钟", tone: "green" },
      { time: "07:20", label: "散步语音：计划 / 心情 / 灵感", tone: "coral" },
      { time: "08:10", label: "早餐与恢复", tone: "green" },
      { time: "09:30", label: "读书时间块", tone: "green" },
      { time: "10:45", label: "写作时间块", tone: "blue" },
      { time: profile.napTime, label: `午休 ${profile.napMinutes} 分钟`, tone: "green" },
      { time: "15:30", label: "社交 / 连接", tone: "amber" },
      { time: "22:30", label: "晚间正念冥想 10 分钟", tone: "green" },
      { time: profile.sleepTime, label: "目标入睡", tone: "blue" },
    ];
  }, [profile]);

  function startVoice() {
    if (!supportsVoice) {
      setTranscript("当前浏览器不支持语音识别。可以先手动输入，或用 Chrome / Edge 打开。");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setTranscript(text);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setTranscript("");
    setIsListening(true);
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function saveVoiceNote() {
    const text = transcript.trim();
    if (!text) return;
    updateDay((current) => ({
      ...current,
      notes: [{ id: uid("note"), type: voiceType, text, time: timeNow() }, ...current.notes],
    }));
    setTranscript("");
  }

  function addTask() {
    const title = taskDraft.trim();
    if (!title) return;
    updateDay((current) => ({
      ...current,
      mustDos: [...current.mustDos, { id: uid("task"), title, minutes: 30, done: false }],
    }));
    setTaskDraft("");
  }

  function addLog() {
    const budget = profile.budgets.find((item) => item.id === logDraft.category);
    updateDay((current) => ({
      ...current,
      logs: [
        { id: uid("log"), category: logDraft.category, label: budget?.label || logDraft.label, minutes: Number(logDraft.minutes), quality: logDraft.quality, energy: current.energy, time: timeNow() },
        ...current.logs,
      ],
    }));
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "time-energy-companion",
      version: 1,
      ...state,
    };
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

  function exportNote(note, mode = "note") {
    const text = mode === "card" ? cardText(note, profile) : noteText(note, profile);
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), safeFileName(`${note.type}-${note.time}`, "txt"));
  }

  function exportSelectedNotes() {
    const selected = day.notes.filter((note) => selectedNoteIds.includes(note.id));
    if (!selected.length) {
      window.alert("请先在灵感池里选择要导出的卡片。");
      return;
    }
    const text = selected.map((note) => cardText(note, profile)).join("\n\n---\n\n");
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `selected-inspiration-cards-${dateKey}.txt`);
  }

  async function copyNote(note, mode = "card") {
    const text = mode === "card" ? cardText(note, profile) : noteText(note, profile);
    try {
      await navigator.clipboard.writeText(text);
      window.alert("已复制到剪贴板。");
    } catch {
      window.alert("复制失败。可以改用导出文本文件。");
    }
  }

  async function shareNote(note) {
    const text = cardText(note, profile);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${note.type}卡片`, text });
      } catch {
        // User cancelled the share sheet.
      }
      return;
    }
    copyNote(note, "card");
  }

  function toggleNoteSelected(id) {
    setSelectedNoteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert("当前版本建议单个附件小于 5MB。大文件更适合放在 iCloud Drive，再把链接记到灵感里。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateDay((current) => ({
        ...current,
        attachments: [
          {
            id: uid("file"),
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            time: timeNow(),
            dataUrl: String(reader.result),
          },
          ...(current.attachments || []),
        ],
      }));
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function exportAttachment(attachment) {
    fetch(attachment.dataUrl)
      .then((response) => response.blob())
      .then((blob) => downloadBlob(blob, attachment.name));
  }

  function deleteAttachment(id) {
    updateDay((current) => ({
      ...current,
      attachments: (current.attachments || []).filter((item) => item.id !== id),
    }));
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
              isListening={isListening}
              startVoice={startVoice}
              stopVoice={stopVoice}
              saveVoiceNote={saveVoiceNote}
              supportsVoice={supportsVoice}
            />
            <div className="two-column">
              <TaskPanel day={day} updateDay={updateDay} taskDraft={taskDraft} setTaskDraft={setTaskDraft} addTask={addTask} />
              <EnergyPanel day={day} updateDay={updateDay} />
            </div>
            <HabitPanel profile={profile} day={day} updateDay={updateDay} />
            <BudgetPanel budgetStats={budgetStats} logDraft={logDraft} setLogDraft={setLogDraft} addLog={addLog} />
            <InspirationPanel
              notes={day.notes}
              selectedNoteIds={selectedNoteIds}
              toggleNoteSelected={toggleNoteSelected}
              exportNote={exportNote}
              copyNote={copyNote}
              shareNote={shareNote}
            />
          </>
        )}
        {activeTab === "calendar" && <CalendarPanel timeline={timeline} profile={profile} day={day} />}
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
  const { voiceType, setVoiceType, transcript, setTranscript, isListening, startVoice, stopVoice, saveVoiceNote, supportsVoice } = props;
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
        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder={supportsVoice ? "点击开始后，说出你今天想到的事..." : "当前浏览器不支持语音识别，可以手动输入。"} />
        <div className="button-row">
          <button className="primary" onClick={isListening ? stopVoice : startVoice}>{isListening ? "停止记录" : "开始语音记录"}</button>
          <button className="secondary" onClick={saveVoiceNote}>保存</button>
        </div>
      </div>
    </section>
  );
}

function TaskPanel({ day, updateDay, taskDraft, setTaskDraft, addTask }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>今日三件事</h2>
        <span>{day.mustDos.filter((task) => task.done).length}/{day.mustDos.length}</span>
      </div>
      <div className="task-list">
        {day.mustDos.map((task, index) => (
          <label className="task-row" key={task.id}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => updateDay((current) => ({
                ...current,
                mustDos: current.mustDos.map((item) => item.id === task.id ? { ...item, done: !item.done } : item),
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
        {["平静", "开心", "焦虑", "低落", "兴奋"].map((mood) => (
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

function BudgetPanel({ budgetStats, logDraft, setLogDraft, addLog }) {
  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>今日时间预算</h2>
        <span>柳比歇夫记录</span>
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
        <input type="number" min="1" value={logDraft.minutes} onChange={(event) => setLogDraft((draft) => ({ ...draft, minutes: event.target.value }))} />
        <button onClick={addLog}>记一段</button>
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
              <button onClick={() => copyNote(note)}>复制</button>
              <button onClick={() => exportNote(note, "card")}>导出</button>
              <button onClick={() => shareNote(note)}>分享</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarPanel({ timeline, profile }) {
  return (
    <section className="panel full calendar-panel">
      <div className="panel-title">
        <h2>今天日历</h2>
        <span>{profile.wakeTime} - {profile.sleepTime}</span>
      </div>
      <div className="timeline">
        {timeline.map((item) => (
          <div className={`timeline-row ${item.tone}`} key={`${item.time}-${item.label}`}>
            <time>{item.time}</time>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsPanel({ day, budgetStats }) {
  const total = day.logs.reduce((sum, log) => sum + Number(log.minutes || 0), 0);
  return (
    <section className="panel full">
      <div className="panel-title">
        <h2>今日复盘</h2>
        <span>{total} 分钟有效记录</span>
      </div>
      <div className="stats-grid">
        <div><strong>{day.energy}/5</strong><span>平均能量</span></div>
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
    importData,
    fileRef,
    attachmentFileRef,
    saveAttachment,
    exportAttachment,
    deleteAttachment,
  } = props;
  const updateProfile = (patch) => setState((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  const updateBudget = (id, minutes) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        budgets: current.profile.budgets.map((budget) => budget.id === id ? { ...budget, minutes: Number(minutes) } : budget),
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
        <span>给自己或伴侣定制</span>
      </div>
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
          <input type="number" min="0" value={budget.minutes} onChange={(event) => updateBudget(budget.id, event.target.value)} />
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
    attachmentFileRef,
    saveAttachment,
    exportAttachment,
    deleteAttachment,
  } = props;
  const totalNotes = Object.values(state.days).reduce((sum, item) => sum + (item.notes?.length || 0), 0);
  const totalLogs = Object.values(state.days).reduce((sum, item) => sum + (item.logs?.length || 0), 0);
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
        <div><strong>{totalFiles}</strong><span>附件</span></div>
      </div>
      <p className="backup-note">完整备份会包含你的设置、时间记录、灵感文字和小附件。建议每周导出一次，保存到 iCloud Drive 或电脑。</p>
      <div className="button-row export-row">
        <button className="primary" onClick={exportData}>完整备份</button>
        <button className="secondary" onClick={exportSelectedNotes}>导出已选灵感</button>
        <span className="selection-hint">已选 {selectedNoteIds.length} 张</span>
      </div>
      <div className="attachment-head">
        <h3>附件库</h3>
        <button className="secondary" onClick={() => attachmentFileRef.current?.click()}>添加文件</button>
        <input ref={attachmentFileRef} type="file" onChange={saveAttachment} hidden />
      </div>
      <div className="attachment-list">
        {attachments.length === 0 && <p className="empty-hint">今天还没有附件。小文件会进入完整备份，大文件建议放 iCloud Drive 后把链接写进灵感。</p>}
        {attachments.map((file) => (
          <article className="attachment-row" key={file.id}>
            <div>
              <strong>{file.name}</strong>
              <span>{Math.ceil(file.size / 1024)} KB · {file.time}</span>
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
