"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "work-ledger-backup-reminder-date";

/**
 * 模块级标志：同一会话内只提醒一次（两个页面共享，避免首页/日历页各自弹一次）。
 */
let remindedThisSession = false;

function getTodayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isReminderDay(): boolean {
  // Date.getDay(): 0=周日, 1=周一, 5=周五
  const day = new Date().getDay();
  return day === 1 || day === 5;
}

/**
 * 周一 / 周五当天第一次打开应用时，弹出一次"记得备份"气泡。
 * 通过 localStorage 记录"已提醒日期"，跨会话避免同一天重复提醒。
 */
export function useBackupReminder(): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (remindedThisSession || !isReminderDay()) return;

    const today = getTodayKey();
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage 不可用时静默跳过
    }
    if (lastShown === today) return;

    remindedThisSession = true;
    try {
      localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // 忽略写入失败，气泡仍可正常显示
    }
    setVisible(true);
  }, []);

  const dismiss = () => setVisible(false);

  return { visible, dismiss };
}
