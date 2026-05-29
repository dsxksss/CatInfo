export interface TranslationDict {
  views: string;
  telemetryChart: string;
  processesList: string;
  resetTelemetry: string;
  latency: string;
  uptime: string;
  fuzzyFilter: string;
  injectStress: string;
  cooldownStress: string;
  systemBridge: string;
  processor: string;
  ramMemory: string;
  physicalSSD: string;
  networkInterface: string;
  largeChartSubtitle: string;
  intervalWindow: string;
  baseSpeed: string;
  socketsSchedulers: string;
  threadsActive: string;
  totalProcesses: string;
  inUseCompressed: string;
  availableReserve: string;
  hardwareCommitted: string;
  pagedPool: string;
  activeTime: string;
  readLatency: string;
  writeLatency: string;
  interfaceBandwidth: string;
  totalSend: string;
  totalRecv: string;
  ipv4Address: string;
  connectionType: string;
  logicalProcessorArray: string;
  hyperthreadingEngine: string;
  hyperthreadingMsg: string;
  searchPlaceholder: string;
  fuzzyTaskFilter: string;
  filterThreadsDesc: string;
  allStatus: string;
  runningStatus: string;
  stressedStatus: string;
  suspendedStatus: string;
  idleStatus: string;
  ownerFilters: string;
  priorityRank: string;
  allPriorities: string;
  launchNewBinary: string;
  resetMemory: string;
  processDiagnosticsDesk: string;
  noProcessSelected: string;
  processDetails: string;
  binaryPath: string;
  parentProcess: string;
  threads: string;
  user: string;
  priority: string;
  description: string;
  procStatusText: string;
  sigterm: string;
  sigkill: string;
  systemRing0: string;
  userRing3: string;
  protectedKernel: string;
  interactiveSpace: string;
  noSysProcesses: string;
  noUserProcesses: string;
  propertiesMetadata: string;
  cpuAffinity: string;
  committedMem: string;
  executionDirectory: string;
  threadCount: string;
  domainOwner: string;
  taskScheduler: string;
  ringContext: string;
  executionManifest: string;
  forceTerminate: string;
  killProcessTree: string;
  selectProcessPrompt: string;
}

export const translations: Record<'en' | 'zh', TranslationDict> = {
  en: {
    views: 'VIEWS',
    telemetryChart: 'Telemetry Chart',
    processesList: 'Processes List',
    resetTelemetry: 'Reset Telemetry',
    latency: 'Latency',
    uptime: 'Uptime',
    fuzzyFilter: 'Fuzzy filter...',
    injectStress: 'Inject Stress',
    cooldownStress: 'Cooldown Stress',
    systemBridge: 'SYSTEM BRIDGE',
    processor: 'CPU',
    ramMemory: 'Memory',
    physicalSSD: 'Disk',
    networkInterface: 'Network',
    largeChartSubtitle: 'Click and hover anywhere on the chart for exact timeline values',
    intervalWindow: 'Interval: 1s • Window: 60s',
    baseSpeed: 'Base Speed',
    socketsSchedulers: 'Sockets / Schedulers',
    threadsActive: 'Threads Active',
    totalProcesses: 'Total Processes',
    inUseCompressed: 'In Use (Compressed)',
    availableReserve: 'Available Reserve',
    hardwareCommitted: 'Hardware Committed',
    pagedPool: 'Paged Pool',
    activeTime: 'Active Time',
    readLatency: 'Read Latency',
    writeLatency: 'Write Latency',
    interfaceBandwidth: 'Interface Bandwidth',
    totalSend: 'Total Send (TX)',
    totalRecv: 'Total Recv (RX)',
    ipv4Address: 'IPv4 Address',
    connectionType: 'Connection Type',
    logicalProcessorArray: 'Logical Processor Array',
    hyperthreadingEngine: 'Hyperthreading Engine',
    hyperthreadingMsg: 'Logical array polling is synchronized every 1s. Thread affinity scheduling is managed dynamically by the secure kernel scheduler.',
    searchPlaceholder: 'Search processes...',
    fuzzyTaskFilter: 'Fuzzy Task Filter',
    filterThreadsDesc: 'Filter active threads by binary name or user space...',
    allStatus: 'All Status',
    runningStatus: 'RUNNING status',
    stressedStatus: 'STRESSED status',
    suspendedStatus: 'SUSPENDED status',
    idleStatus: 'IDLE status',
    ownerFilters: 'Owner Filters',
    priorityRank: 'Priority Rank',
    allPriorities: 'All Priorities',
    launchNewBinary: 'Launch New Binary',
    resetMemory: 'Reset Memory',
    processDiagnosticsDesk: 'Process Diagnostics Desk',
    noProcessSelected: 'No detailed process selected. Choose a row above to query deep thread telemetry.',
    processDetails: 'Process Details',
    binaryPath: 'Binary executable path',
    parentProcess: 'Parent process details',
    threads: 'threads',
    user: 'user',
    priority: 'priority',
    description: 'Description',
    procStatusText: 'Status',
    sigterm: 'SIGTERM (Regular)',
    sigkill: 'SIGKILL (Force Tree)',
    systemRing0: 'System Ring 0',
    userRing3: 'User Ring 3',
    protectedKernel: 'Protected Kernel',
    interactiveSpace: 'Interactive Space',
    noSysProcesses: 'No active system binaries found in memory tree.',
    noUserProcesses: 'No running applications in the user context tree.',
    propertiesMetadata: 'Properties Metadata',
    cpuAffinity: 'CPU Affinity',
    committedMem: 'Committed Mem',
    executionDirectory: 'Execution Directory',
    threadCount: 'Thread Count',
    domainOwner: 'Domain Owner',
    taskScheduler: 'Task Scheduler',
    ringContext: 'Ring Context',
    executionManifest: 'Execution Manifest',
    forceTerminate: 'Force Terminate Task',
    killProcessTree: 'Kill Dynamic Process Tree',
    selectProcessPrompt: 'Select any item tree node line inside the explorer to expand registry keys and stack frames.',
  },
  zh: {
    views: '视图',
    telemetryChart: '性能监控',
    processesList: '进程列表',
    resetTelemetry: '刷新监控数据',
    latency: '网络延迟',
    uptime: '运行时间',
    fuzzyFilter: '搜索进程...',
    injectStress: '开始测试',
    cooldownStress: '停止测试',
    systemBridge: '系统监控',
    processor: 'CPU',
    ramMemory: '内存',
    physicalSSD: '磁盘',
    networkInterface: '网络',
    largeChartSubtitle: '点击或将鼠标悬停在图表上查看数值',
    intervalWindow: '每秒自动更新一次',
    baseSpeed: '基础速度',
    socketsSchedulers: '插槽 / 核心',
    threadsActive: '线程数',
    totalProcesses: '总进程数',
    inUseCompressed: '已用内存',
    availableReserve: '可用内存',
    hardwareCommitted: '虚拟内存',
    pagedPool: '分页缓冲池',
    activeTime: '硬盘活动时间',
    readLatency: '读取速度',
    writeLatency: '写入速度',
    interfaceBandwidth: '网络带宽',
    totalSend: '总发送',
    totalRecv: '总接收',
    ipv4Address: 'IP 地址',
    connectionType: '连接类型',
    logicalProcessorArray: 'CPU 核心使用情况',
    hyperthreadingEngine: '多核多线程',
    hyperthreadingMsg: '数据每秒更新一次，自动优化处理器调度。',
    searchPlaceholder: '搜索进程名称...',
    fuzzyTaskFilter: '搜索进程',
    filterThreadsDesc: '输入进程名或用户名搜索...',
    allStatus: '所有状态',
    runningStatus: '运行中',
    stressedStatus: '占用过高',
    suspendedStatus: '已挂起',
    idleStatus: '空闲',
    ownerFilters: '按用户筛选',
    priorityRank: '按优先级筛选',
    allPriorities: '所有优先级',
    launchNewBinary: '运行新任务',
    resetMemory: '重置进程',
    processDiagnosticsDesk: '进程详细信息',
    noProcessSelected: '未选中任何进程。请在列表里点击任意进程查看详情。',
    processDetails: '进程详情',
    binaryPath: '程序路径',
    parentProcess: '父进程',
    threads: '活动线程',
    user: '用户名',
    priority: '优先级',
    description: '描述',
    procStatusText: '状态',
    sigterm: '结束进程',
    sigkill: '结束进程及子进程',
    systemRing0: '系统程序 (Ring 0)',
    userRing3: '用户程序 (Ring 3)',
    protectedKernel: '系统服务',
    interactiveSpace: '用户应用',
    noSysProcesses: '未找到系统进程。',
    noUserProcesses: '未找到用户应用。',
    propertiesMetadata: '详细属性',
    cpuAffinity: 'CPU 占用',
    committedMem: '使用内存',
    executionDirectory: '程序路径',
    threadCount: '线程数量',
    domainOwner: '运行用户',
    taskScheduler: '任务优先级',
    ringContext: '安全级别',
    executionManifest: '程序描述',
    forceTerminate: '结束任务',
    killProcessTree: '结束任务及子进程',
    selectProcessPrompt: '在列表里点击任意进程，即可在此处查看该进程的详细运行状态与属性。',
  },
};
