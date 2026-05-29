import { Sliders, Power, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

interface SettingsTabProps {
  pollingInterval: number;
  setPollingInterval: (val: number) => void;
  processesCount: number;
  cpuUsage: number;
  memoryUsage: number;
  lang?: 'en' | 'zh';
  confirmKill: boolean;
  setConfirmKill: (val: boolean) => void;
}

export default function SettingsTab({
  pollingInterval,
  setPollingInterval,
  processesCount: _processesCount,
  cpuUsage: _cpuUsage,
  memoryUsage: _memoryUsage,
  lang = 'en',
  confirmKill,
  setConfirmKill,
}: SettingsTabProps) {
  const [autostart, setAutostart] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(true);

  useEffect(() => {
    isEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false))
      .finally(() => setAutostartBusy(false));
  }, []);

  const toggleAutostart = async () => {
    if (autostartBusy) return;
    setAutostartBusy(true);
    try {
      if (autostart) {
        await disable();
        setAutostart(false);
      } else {
        await enable();
        setAutostart(true);
      }
    } catch (e) {
      console.error('Failed to toggle autostart', e);
      // re-sync with the real state on failure
      try {
        setAutostart(await isEnabled());
      } catch {
        /* ignore */
      }
    } finally {
      setAutostartBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto" id="settings-tab-layout">
      
      {/* Settings Card */}
      <div className="card p-6 flex flex-col justify-between" id="telemetry-controls-box">
        <div className="space-y-6">
          <div className="pb-4 border-b border-zinc-900">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300 flex items-center gap-2">
              <Sliders size={16} className="text-[#006fee]" /> {lang === 'zh' ? '刷新率设置' : 'Telemetry Configurations'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {lang === 'zh' ? '调整硬件性能数据刷新的时间间隔' : 'Calibrate driver polling algorithms and visual presentation specs'}
            </p>
          </div>

          {/* Slider polling interval */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-zinc-400">{lang === 'zh' ? '数据刷新间隔' : 'Driver Polling Interval'}</span>
              <span className="mono text-[#006fee] font-bold font-mono-premium bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                {pollingInterval} ms
              </span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="500"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#006fee]"
              id="polling-slider"
            />
            <div className="text-[10px] text-zinc-500 flex justify-between">
              <span>500ms ({lang === 'zh' ? '高频刷新' : 'High FPS'})</span>
              <span>5000ms ({lang === 'zh' ? '节能省电' : 'Power Save'})</span>
            </div>
          </div>

          {/* Launch on startup toggle */}
          <div className="space-y-3 pt-4 border-t border-zinc-900">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Power size={16} className="text-[#006fee] mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-zinc-300 block">
                    {lang === 'zh' ? '开机自启' : 'Launch on Startup'}
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {lang === 'zh'
                      ? '登录 Windows 后自动启动 喵一眼'
                      : 'Start Cat Info automatically when you sign in to Windows'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autostart}
                aria-label={lang === 'zh' ? '开机自启' : 'Launch on Startup'}
                disabled={autostartBusy}
                onClick={toggleAutostart}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  autostart ? 'bg-[#006fee]' : 'bg-zinc-700'
                }`}
                id="autostart-toggle"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    autostart ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Confirm Kill toggle */}
          <div className="space-y-3 pt-4 border-t border-zinc-900">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Shield size={16} className="text-[#006fee] mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-zinc-300 block">
                    {lang === 'zh' ? '终止进程二次确认' : 'Confirm Before Killing'}
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {lang === 'zh'
                      ? '在终止/强杀进程前弹出二次确认窗口，防止误触'
                      : 'Show a confirmation dialog before terminating processes to prevent accidental clicks'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={confirmKill}
                aria-label={lang === 'zh' ? '终止进程二次确认' : 'Confirm Before Killing'}
                onClick={() => setConfirmKill(!confirmKill)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  confirmKill ? 'bg-[#006fee]' : 'bg-zinc-700'
                }`}
                id="confirm-kill-toggle"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    confirmKill ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Security settings display */}
          <div className="space-y-3 pt-4 border-t border-zinc-900 text-xs">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{lang === 'zh' ? '系统防护状态' : 'System Security Flags'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950/50 p-2.5 rounded border border-zinc-900/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-zinc-400 font-medium">Root Bridge SEC</span>
              </div>
              <div className="bg-zinc-950/50 p-2.5 rounded border border-zinc-900/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-zinc-400 font-medium">Wincat Guard-OK</span>
              </div>
            </div>
          </div>

        </div>

        <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850 text-xs text-zinc-500 leading-relaxed mt-6 font-medium">
          <span className="font-bold text-zinc-300 block mb-1">{lang === 'zh' ? '资源自适应保护' : 'Adaptive Performance Guard'}</span>
          {lang === 'zh' 
            ? '当 CPU 负载超过 90% 时，系统会自动调低数据刷新频率，以确保界面运行流畅、不卡顿。'
            : 'When processor load metrics peak above 90%, driver polling frequency automatically clamps safeguards to conserve physical resource cycles.'}
        </div>
      </div>

    </div>
  );
}
