export type Language = "zh" | "en";

export interface Translations {
  // 通用
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
  };

  // 登录页面
  login: {
    title: string;
    subtitle: string;
    joinSession: string;
    nameLabel: string;
    namePlaceholder: string;
    sessionIdLabel: string;
    sessionIdPlaceholder: string;
    createButton: string;
    joinButton: string;
    joiningButton: string;
    roleLabel: string;
    roleHost: string;
    roleAttendance: string;
    roleGuest: string;
    roleHostDescription: string;
    roleAttendanceDescription: string;
    roleGuestDescription: string;
  };

  // 主界面
  main: {
    sessionTitle: string;
    welcome: string;
    connected: string;
    disconnected: string;
    users: string;
    you: string;
    share: string;
    copied: string;
    logout: string;
    role: string;
    host: string;
    attendance: string;
    guest: string;
  };

  // 模板设置
  templates: {
    title: string;
    subtitle: string;
    showSettings: string;
    hideSettings: string;
    selectTemplate: string;
    customValues: string;
    customPlaceholder: string;
    currentCards: string;
    preview: string;
    hostOnly: string;
    confirm: string;
    validation: {
      empty: string;
      minCards: string;
      invalidFormat: string;
    };
  };

  // 投票
  voting: {
    title: string;
    subtitle: string;
    statusTitle: string;
    revealButton: string;
    resetButton: string;
    hostOnly: string;
    cannotVote: string;
    votedUsers: string;
    notVotedUsers: string;
    guestUsers: string;
  };

  // 结果
  results: {
    title: string;
    distribution: string;
    teamEstimate: string;
    votes: string;
    averageDescription: string;
  };

  // 模板名称
  templateNames: {
    fibonacci: string;
    natural: string;
    tshirt: string;
    powers: string;
    custom: string;
  };

  // 模板描述
  templateDescriptions: {
    fibonacci: string;
    natural: string;
    tshirt: string;
    powers: string;
    custom: string;
  };

  // 错误信息
  errors: {
    sessionNotFound: {
      title: string;
      description: string;
      backToHostButton: string;
      closeButton: string;
    };
  };
}

const translations: Record<Language, Translations> = {
  zh: {
    common: {
      loading: "加载中...",
      error: "错误",
      success: "成功",
      cancel: "取消",
      confirm: "确认",
      save: "保存",
      delete: "删除",
      edit: "编辑",
      close: "关闭",
    },
    login: {
      title: "估点工具",
      subtitle: "加入或创建规划扑克会话",
      joinSession: "加入会话",
      nameLabel: "你的姓名",
      namePlaceholder: "输入你的姓名",
      sessionIdLabel: "会话ID",
      sessionIdPlaceholder: "输入会话ID (例如: team-sprint-1)",
      createButton: "创建会话",
      joinButton: "加入会话",
      joiningButton: "加入中...",
      roleLabel: "选择角色",
      roleHost: "主持人 (Host)",
      roleAttendance: "参与者 (Attendance)",
      roleGuest: "旁观者 (Guest)",
      roleHostDescription: "创建会话，管理模板设置，控制投票流程",
      roleAttendanceDescription: "参与投票，为故事估点",
      roleGuestDescription: "旁观投票过程，查看结果",
    },
    main: {
      sessionTitle: "会话",
      welcome: "欢迎",
      connected: "已连接",
      disconnected: "已断开",
      users: "用户",
      you: "你",
      share: "分享",
      copied: "已复制",
      logout: "退出",
      role: "角色",
      host: "主持人",
      attendance: "参与者",
      guest: "旁观者",
    },
    templates: {
      title: "估点模板设置",
      subtitle: "选择或自定义估点卡片模板",
      showSettings: "显示设置",
      hideSettings: "隐藏设置",
      selectTemplate: "选择模板",
      customValues: "自定义估点值",
      customPlaceholder: "输入估点值，用逗号分隔 (例如: ☕️,1,2,3,5,8,13)",
      currentCards: "当前卡片",
      preview: "当前模板预览",
      hostOnly: "仅主持人可修改",
      confirm: "确认更新",
      validation: {
        empty: "估点值不能为空",
        minCards: "至少需要2张卡片",
        invalidFormat: "格式错误：只允许数字、☕️ 或 ? 符号",
      },
    },
    voting: {
      title: "选择你的估点",
      subtitle: "为当前故事选择一个估点值。☕️ 表示你需要休息或更多讨论。",
      statusTitle: "投票状态",
      revealButton: "显示投票",
      resetButton: "重置投票",
      hostOnly: "仅主持人可操作",
      cannotVote: "旁观者不能投票",
      votedUsers: "已投票",
      notVotedUsers: "未投票",
      guestUsers: "访客",
    },
    results: {
      title: "估点结果",
      distribution: "投票分布",
      teamEstimate: "团队估点",
      votes: "票",
      averageDescription: "个有效投票的平均值 (不包括 ☕️)",
    },
    templateNames: {
      fibonacci: "菲波那契数列",
      natural: "自然数",
      tshirt: "T恤尺码",
      powers: "2的幂次",
      custom: "自定义",
    },
    templateDescriptions: {
      fibonacci: "经典的敏捷估点序列",
      natural: "简单的1-10自然数序列",
      tshirt: "XS到XXL的尺码估点",
      powers: "2的幂次序列",
      custom: "输入自定义估点值",
    },
    errors: {
      sessionNotFound: {
        title: "会话不存在",
        description: "无法找到指定的会话。请确认分享链接是否正确，或联系主持人确认会话状态。",
        backToHostButton: "回到主持人页面",
        closeButton: "关闭",
      },
    },
  },
  en: {
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      cancel: "Cancel",
      confirm: "Confirm",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
    },
    login: {
      title: "Point Estimation Tool",
      subtitle: "Join or create a planning poker session",
      joinSession: "Join Session",
      nameLabel: "Your Name",
      namePlaceholder: "Enter your name",
      sessionIdLabel: "Session ID",
      sessionIdPlaceholder: "Enter session ID (e.g., team-sprint-1)",
      createButton: "Create Session",
      joinButton: "Join Session",
      joiningButton: "Joining...",
      roleLabel: "Select Role",
      roleHost: "Host",
      roleAttendance: "Attendance",
      roleGuest: "Guest",
      roleHostDescription:
        "Create session, manage templates, control voting flow",
      roleAttendanceDescription: "Participate in voting, estimate stories",
      roleGuestDescription: "Observe voting process, view results",
    },
    main: {
      sessionTitle: "Session",
      welcome: "Welcome",
      connected: "Connected",
      disconnected: "Disconnected",
      users: "users",
      you: "You",
      share: "Share",
      copied: "Copied",
      logout: "Logout",
      role: "Role",
      host: "Host",
      attendance: "Attendance",
      guest: "Guest",
    },
    templates: {
      title: "Estimation Template Settings",
      subtitle: "Select or customize estimation card templates",
      showSettings: "Show Settings",
      hideSettings: "Hide Settings",
      selectTemplate: "Select Template",
      customValues: "Custom Estimation Values",
      customPlaceholder:
        "Enter estimation values separated by commas (e.g., ☕️,1,2,3,5,8,13)",
      currentCards: "Current Cards",
      preview: "Current Template Preview",
      hostOnly: "Host only",
      confirm: "Update",
      validation: {
        empty: "Estimation values cannot be empty",
        minCards: "At least 2 cards are required",
        invalidFormat: "Invalid format: only numbers, ☕️ or ? symbols are allowed",
      },
    },
    voting: {
      title: "Select Your Estimate",
      subtitle:
        "Choose a point value for the current story. ☕️ means you need a break or more discussion.",
      statusTitle: "Voting Status",
      revealButton: "Reveal Votes",
      resetButton: "Reset Votes",
      hostOnly: "Host only",
      cannotVote: "Guests cannot vote",
      votedUsers: "Voted",
      notVotedUsers: "Not Voted",
      guestUsers: "Guests",
    },
    results: {
      title: "Estimation Results",
      distribution: "Vote Distribution",
      teamEstimate: "Team Estimate",
      votes: "votes",
      averageDescription: "valid votes average (excluding ☕️)",
    },
    templateNames: {
      fibonacci: "Fibonacci Sequence",
      natural: "Natural Numbers",
      tshirt: "T-Shirt Sizes",
      powers: "Powers of 2",
      custom: "Custom",
    },
    templateDescriptions: {
      fibonacci: "Classic agile estimation sequence",
      natural: "Simple 1-10 natural number sequence",
      tshirt: "XS to XXL size estimation",
      powers: "Powers of 2 sequence",
      custom: "Enter custom estimation values",
    },
    errors: {
      sessionNotFound: {
        title: "Session Not Found",
        description: "Unable to find the specified session. Please verify the share link is correct, or contact the host to confirm the session status.",
        backToHostButton: "Back to Host Page",
        closeButton: "Close",
      },
    },
  },
};

// 检测浏览器语言
export function detectLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("zh")) {
    return "zh";
  }
  return "en";
}

// 获取翻译
export function getTranslation(lang: Language): Translations {
  return translations[lang];
}

// 获取嵌套翻译
export function getNestedTranslation(lang: Language, path: string): string {
  const keys = path.split(".");
  let value: unknown = translations[lang];

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return path; // 如果找不到翻译，返回原路径
    }
  }

  return typeof value === "string" ? value : path;
}
