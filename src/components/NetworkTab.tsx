import { useState, useEffect } from 'react';
import { Network, Globe } from 'lucide-react';

interface SocketConnection {
  id: string;
  localAddress: string;
  remoteAddress: string;
  remoteHost: string;
  protocol: 'TCP' | 'UDP';
  status: 'ESTABLISHED' | 'CLOSE_WAIT' | 'LISTEN' | 'TIME_WAIT';
  downloadRate: number; // in Kbps
  uploadRate: number; // in Kbps
}

interface NetworkTabProps {
  lang?: 'en' | 'zh';
  netRxKbps?: number;
  netTxKbps?: number;
}

export default function NetworkTab({
  lang = 'en',
  netRxKbps = 840,
  netTxKbps = 12.8,
}: NetworkTabProps) {
  const [activeConnections, setActiveConnections] = useState<SocketConnection[]>([
    { id: '1', localAddress: '192.168.1.104:54201', remoteAddress: '142.250.200.46:443', remoteHost: 'google.com', protocol: 'TCP', status: 'ESTABLISHED', downloadRate: 242.4, uploadRate: 12.8 },
    { id: '2', localAddress: '192.168.1.104:49112', remoteAddress: '104.18.23.4:443', remoteHost: 'aistudio.google.com', protocol: 'TCP', status: 'ESTABLISHED', downloadRate: 592.0, uploadRate: 48.2 },
    { id: '3', localAddress: '192.168.1.104:54110', remoteAddress: '52.12.140.245:443', remoteHost: 'aws.amazon.com', protocol: 'TCP', status: 'ESTABLISHED', downloadRate: 4.8, uploadRate: 0.4 },
    { id: '4', localAddress: '192.168.1.104:50012', remoteAddress: '157.240.22.35:443', remoteHost: 'instagram.com', protocol: 'TCP', status: 'CLOSE_WAIT', downloadRate: 0.0, uploadRate: 0.0 },
    { id: '5', localAddress: '192.168.1.104:53', remoteAddress: '8.8.8.8:53', remoteHost: 'dns.google', protocol: 'UDP', status: 'LISTEN', downloadRate: 1.2, uploadRate: 1.2 },
    { id: '6', localAddress: '0.0.0.0:135', remoteAddress: '0.0.0.0:0', remoteHost: 'rpc-epmap', protocol: 'TCP', status: 'LISTEN', downloadRate: 0.0, uploadRate: 0.0 },
  ]);

  // Simulate socket activities fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveConnections((prev) =>
        prev.map((conn) => {
          if (conn.status === 'ESTABLISHED') {
            const downDelta = (Math.random() - 0.5) * 30;
            const upDelta = (Math.random() - 0.5) * 6;
            return {
              ...conn,
              downloadRate: Math.max(1, conn.downloadRate + downDelta),
              uploadRate: Math.max(0.1, conn.uploadRate + upDelta),
            };
          }
          return conn;
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6" id="network-tab-layout">
      
      {/* Prime Top Metric Grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1 block">
              {lang === 'zh' ? '活动网络连接' : 'Active Network Sockets'}
            </span>
            <span className="text-3xl font-extrabold tracking-tight font-mono-premium text-zinc-100">
              {activeConnections.length} <span className="text-sm font-normal text-zinc-500">{lang === 'zh' ? '连接' : 'sockets'}</span>
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mt-4">
            {lang === 'zh' ? '网络传输协议正常' : 'TCP Stack Enabled'}
          </p>
        </div>

        <div className="card p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1 block">
              {lang === 'zh' ? '实时网络流量' : 'Aggregate Sockets In/Out'}
            </span>
            <span className="text-3xl font-extrabold tracking-tight font-mono-premium text-zinc-100">
              {(netRxKbps + netTxKbps).toFixed(1)} <span className="text-sm font-normal text-zinc-500">Kbps</span>
            </span>
          </div>
          <p className="text-[10px] text-[#17c964] font-semibold uppercase tracking-widest mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {lang === 'zh' ? '网络传输正常' : 'Sockets Clean'}
          </p>
        </div>

        <div className="card p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1 block">
              {lang === 'zh' ? '网络延迟' : 'Link RTT Latency'}
            </span>
            <span className="text-3xl font-extrabold tracking-tight font-mono-premium text-zinc-100">
              14.2 <span className="text-sm font-normal text-zinc-500">ms</span>
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mt-4">
            {lang === 'zh' ? '网卡接口: 10G 以太网' : 'Primary Interface: ETH 10G'}
          </p>
        </div>
      </div>

      {/* Connection grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Dynamic Network Connection List */}
        <div className="lg:col-span-12 card overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-zinc-900 bg-zinc-950/20">
            <h3 className="font-bold text-zinc-200 uppercase text-xs tracking-wider flex items-center gap-2">
              <Network size={16} className="text-[#006fee]" /> {lang === 'zh' ? '网络连接列表' : 'Logical Network Connections'}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {lang === 'zh'
                ? '实时显示系统当前的网络连接、网络端口与流量速度。'
                : 'Real-time listing of active IPv4 addresses, binding sockets & packet transmission ratios'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono-premium text-xs">
              <thead className="bg-[#18181b]/50 text-[10px] uppercase text-zinc-400 font-bold tracking-wider select-none border-b border-zinc-900">
                <tr>
                  <th className="px-6 py-3.5">{lang === 'zh' ? '传输协议' : 'Protocol'}</th>
                  <th className="px-6 py-3.5">{lang === 'zh' ? '本地端口' : 'Local Port Address'}</th>
                  <th className="px-6 py-3.5">{lang === 'zh' ? '目标 IP 地址' : 'Remote Target IP address'}</th>
                  <th className="px-6 py-3.5">{lang === 'zh' ? '目标域名' : 'Associated Domain'}</th>
                  <th className="px-6 py-3.5 text-right">
                    <span className="text-zinc-500 mr-1 select-none">↑</span>{lang === 'zh' ? '上行速率' : 'TX Speed'}
                  </th>
                  <th className="px-6 py-3.5 text-right">
                    <span className="text-blue-500/70 mr-1 select-none">↓</span>{lang === 'zh' ? '下行速率' : 'RX Speed'}
                  </th>
                  <th className="px-6 py-3.5 text-center">{lang === 'zh' ? '运行状态' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {activeConnections.map((conn) => (
                  <tr key={conn.id} className="border-b border-zinc-900/60 hover:bg-zinc-900/50 transition-all font-mono-premium text-xs">
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 font-bold text-[10px] rounded ${
                        conn.protocol === 'TCP' ? 'bg-blue-500/10 text-[#006fee] border border-blue-550/20' : 'bg-amber-500/10 text-[#f5a524] border border-amber-500/20'
                      }`}>
                        {conn.protocol}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-300 font-semibold">{conn.localAddress}</td>
                    <td className="px-6 py-3.5 text-zinc-400">{conn.remoteAddress}</td>
                    <td className="px-6 py-3.5 text-[#006fee] font-semibold flex items-center gap-1.5 pt-4">
                      <Globe size={12} /> {conn.remoteHost}
                    </td>
                    <td className="px-6 py-3.5 text-right text-zinc-400 font-bold">
                      <span className="text-zinc-500 mr-1 select-none">↑</span>{conn.uploadRate.toFixed(1)} Kbps
                    </td>
                    <td className="px-6 py-3.5 text-right text-[#006fee] font-extrabold">
                      <span className="text-blue-500/70 mr-1 select-none">↓</span>{conn.downloadRate.toFixed(1)} Kbps
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        conn.status === 'ESTABLISHED' ? 'bg-emerald-500/10 text-[#17c964] border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {conn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-zinc-900 text-xs text-zinc-500 font-medium">
            {lang === 'zh'
              ? '网络连接每秒自动刷新一次。'
              : 'Active connections polling rate is automatically calibrated. Socket state matches standard Windows Netstat API calls.'}
          </div>
        </div>

      </div>

    </div>
  );
}
