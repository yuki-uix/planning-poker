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
    nameLabel: string;
    namePlaceholder: string;
    sessionIdLabel: string;
    sessionIdPlaceholder: string;
    joinButton: string;
    joiningButton: string;
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
  };

  // 投票
  voting: {
    title: string;
    subtitle: string;
    statusTitle: string;
    revealButton: string;
    resetButton: string;
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
      nameLabel: "你的姓名",
      namePlaceholder: "输入你的姓名",
      sessionIdLabel: "会话ID",
      sessionIdPlaceholder: "输入会话ID (例如: team-sprint-1)",
      joinButton: "加入会话",
      joiningButton: "加入中...",
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
    },
    voting: {
      title: "选择你的估点",
      subtitle: "为当前故事选择一个估点值。☕️ 表示你需要休息或更多讨论。",
      statusTitle: "投票状态",
      revealButton: "显示投票",
      resetButton: "重置投票",
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
      nameLabel: "Your Name",
      namePlaceholder: "Enter your name",
      sessionIdLabel: "Session ID",
      sessionIdPlaceholder: "Enter session ID (e.g., team-sprint-1)",
      joinButton: "Join Session",
      joiningButton: "Joining...",
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
    },
    voting: {
      title: "Select Your Estimate",
      subtitle:
        "Choose a point value for the current story. ☕️ means you need a break or more discussion.",
      statusTitle: "Voting Status",
      revealButton: "Reveal Votes",
      resetButton: "Reset Votes",
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
  let value: any = translations[lang];

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return path; // 如果找不到翻译，返回原路径
    }
  }

  return typeof value === "string" ? value : path;
}
