# Design QA

final result: passed

## Checks

- Mobile viewport tested at 390 x 844.
- Homepage loads with title `时间能量伙伴`.
- No horizontal overflow on mobile.
- Bottom navigation is visible.
- Morning and evening mindfulness meditation habits are present.
- Settings page opens from `我的`.
- Profile rhythm fields and habit editor inputs are visible.
- Backup center added for full JSON export/import, selected inspiration export, and small attachment handling.
- Inspiration cards support select, copy, text export, and share actions.
- Calendar page exports a standard `.ics` file for Apple Calendar import.
- Voice panel supports in-app audio recording, preview, and saving recordings as attachments.
- Settings page explains that personal rhythm settings are stored on the current device after first setup.
- Feishu-friendly card text is available through copy/share/export actions.
- Production build completes successfully with Vite.

## Notes

- Voice input depends on browser Web Speech API support. Manual text input remains available when speech recognition is unsupported.
