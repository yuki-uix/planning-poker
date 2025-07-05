'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useTheme } from 'next-themes'
import { useLanguage } from '@/hooks/use-language'

const themeColors = [
  { name: { zh: '青色', en: 'Cyan' }, value: 'cyan', color: '#48a1ad' },
  { name: { zh: '绿色', en: 'Green' }, value: 'green', color: '#6b9e78' },
  { name: { zh: '紫色', en: 'Purple' }, value: 'purple', color: '#634f7d' },
  { name: { zh: '橙色', en: 'Orange' }, value: 'orange', color: '#cc8508' },
  { name: { zh: '粉色', en: 'Pink' }, value: 'pink', color: '#e16a7b' },
  { name: { zh: '深蓝', en: 'Navy' }, value: 'navy', color: '#163c4d' },
]

interface ThemeColorPickerProps {
  compact?: boolean;
}

export function ThemeColorPicker({ compact = false }: ThemeColorPickerProps) {
  useTheme()
  const { language } = useLanguage()
  const [colorTheme, setColorTheme] = React.useState('cyan')

  React.useEffect(() => {
    // 从localStorage获取保存的主题色，如果没有则设置为青色
    const savedColorTheme = localStorage.getItem('color-theme')
    if (savedColorTheme) {
      setColorTheme(savedColorTheme)
      document.documentElement.setAttribute('data-color-theme', savedColorTheme)
    } else {
      // 设置默认主题色为青色
      localStorage.setItem('color-theme', 'cyan')
      document.documentElement.setAttribute('data-color-theme', 'cyan')
    }
  }, [])



  const handleColorChange = (colorValue: string) => {
    setColorTheme(colorValue)
    localStorage.setItem('color-theme', colorValue)
    document.documentElement.setAttribute('data-color-theme', colorValue)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium whitespace-nowrap text-title">
          {language === 'zh' ? '主题色:' : 'Theme:'}
        </Label>
        <div className="flex gap-1">
          {themeColors.map((colorOption) => ( 
            <Button
              key={colorOption.value}
              variant={colorTheme === colorOption.value ? "default" : "outline"}
              size="sm"
              className="w-8 h-8 p-0 relative"
              onClick={() => handleColorChange(colorOption.value)}
              style={{
                backgroundColor: colorTheme === colorOption.value ? colorOption.color : 'transparent',
                borderColor: colorOption.color,
              }}
              title={colorOption.name[language as keyof typeof colorOption.name]}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colorOption.color }}
              />
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <Label className="text-sm font-medium mb-3 block text-title">
          {language === 'zh' ? '主题色' : 'Theme Color'}
        </Label>
        <div className="flex gap-2">
          {themeColors.map((colorOption) => (
            <Button
              key={colorOption.value}
              variant={colorTheme === colorOption.value ? "default" : "outline"}
              size="sm"
              className="flex-1 h-10 relative"
              onClick={() => handleColorChange(colorOption.value)}
              style={{
                backgroundColor: colorTheme === colorOption.value ? colorOption.color : 'transparent',
                borderColor: colorOption.color,
                color: colorTheme === colorOption.value ? 'white' : colorOption.color,
              }}
            >
              <div 
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: colorOption.color }}
              />
              {colorOption.name[language as keyof typeof colorOption.name]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 