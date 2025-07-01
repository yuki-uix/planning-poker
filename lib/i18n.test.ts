import { detectLanguage, getTranslation, getNestedTranslation } from "./i18n";

// 简单的测试函数
export function testI18n() {
  console.log("=== 多语言功能测试 ===");

  // 测试翻译获取
  const zhTranslations = getTranslation("zh");
  const enTranslations = getTranslation("en");

  console.log("中文标题:", zhTranslations.login.title);
  console.log("英文标题:", enTranslations.login.title);

  // 测试嵌套翻译
  console.log("嵌套翻译测试:", getNestedTranslation("zh", "login.title"));
  console.log("嵌套翻译测试:", getNestedTranslation("en", "login.title"));

  // 测试语言检测（在浏览器环境中）
  if (typeof window !== "undefined") {
    console.log("检测到的语言:", detectLanguage());
  }

  console.log("=== 测试完成 ===");
}
