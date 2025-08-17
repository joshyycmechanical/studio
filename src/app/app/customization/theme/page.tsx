
'use client';

import * as React from 'react';
import { ChromePicker, ColorResult, HSLColor } from 'react-color';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette, Undo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper to convert HSL object to CSS string
const hslToString = (hsl: HSLColor): string => `${Math.round(hsl.h)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%`;

export default function ThemeCustomizationPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = React.useState(false);

  // Default theme colors as HSL objects
  const defaultTheme = {
    background: { h: 220, s: 0.20, l: 0.98, a: 1 },
    primary: { h: 210, s: 0.90, l: 0.50, a: 1 },
    accent: { h: 210, s: 0.80, l: 0.90, a: 1 },
  };

  // State to hold the current theme colors
  const [colors, setColors] = React.useState(defaultTheme);

  // Function to apply colors to the document's CSS variables
  const applyTheme = React.useCallback((themeColors: typeof defaultTheme) => {
    document.documentElement.style.setProperty('--background', hslToString(themeColors.background));
    document.documentElement.style.setProperty('--primary', hslToString(themeColors.primary));
    document.documentElement.style.setProperty('--accent', hslToString(themeColors.accent));
  }, []);

  // On mount, load theme from localStorage or use defaults
  React.useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('custom-theme');
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        setColors(parsedTheme);
        applyTheme(parsedTheme);
      } catch (e) {
        console.error("Failed to parse saved theme", e);
        setColors(defaultTheme);
        applyTheme(defaultTheme);
      }
    } else {
       applyTheme(defaultTheme);
    }
  }, [applyTheme]);

  const handleColorChange = (colorName: keyof typeof colors, color: ColorResult) => {
    const newColors = { ...colors, [colorName]: color.hsl };
    setColors(newColors);
    applyTheme(newColors); // Apply theme live
  };

  const handleSaveTheme = () => {
    localStorage.setItem('custom-theme', JSON.stringify(colors));
    toast({
      title: 'Theme Saved',
      description: 'Your custom theme has been saved to this browser.',
    });
  };

  const handleResetTheme = () => {
    localStorage.removeItem('custom-theme');
    setColors(defaultTheme);
    applyTheme(defaultTheme);
    toast({
      title: 'Theme Reset',
      description: 'The theme has been reset to its default colors.',
    });
  };

  if (!isMounted) {
      return null; // Don't render until client-side hydration is complete
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="h-6 w-6" /> Theme Customizer</CardTitle>
        <CardDescription>
          Customize the look and feel of your application. Changes are saved locally to your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Label className="w-24 shrink-0">Primary Color</Label>
          <div className="flex items-center gap-4">
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" className="w-48 justify-start text-left font-normal">
                   <div className="w-4 h-4 rounded-full mr-2 border" style={{ backgroundColor: `hsl(${colors.primary.h}, ${colors.primary.s * 100}%, ${colors.primary.l * 100}%)` }}></div>
                   Primary
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0 border-0">
                 <ChromePicker color={colors.primary} onChange={(color) => handleColorChange('primary', color)} disableAlpha />
               </PopoverContent>
             </Popover>
              <div className="h-10 w-24 rounded-md" style={{ backgroundColor: `hsl(${colors.primary.h}, ${colors.primary.s * 100}%, ${colors.primary.l * 100}%)` }}></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Label className="w-24 shrink-0">Accent Color</Label>
           <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-48 justify-start text-left font-normal">
                    <div className="w-4 h-4 rounded-full mr-2 border" style={{ backgroundColor: `hsl(${colors.accent.h}, ${colors.accent.s * 100}%, ${colors.accent.l * 100}%)` }}></div>
                    Accent
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0">
                  <ChromePicker color={colors.accent} onChange={(color) => handleColorChange('accent', color)} disableAlpha />
                </PopoverContent>
              </Popover>
               <div className="h-10 w-24 rounded-md bg-accent"></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Label className="w-24 shrink-0">Background</Label>
           <div className="flex items-center gap-4">
             <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-48 justify-start text-left font-normal">
                    <div className="w-4 h-4 rounded-full mr-2 border" style={{ backgroundColor: `hsl(${colors.background.h}, ${colors.background.s * 100}%, ${colors.background.l * 100}%)` }}></div>
                    Background
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0">
                  <ChromePicker color={colors.background} onChange={(color) => handleColorChange('background', color)} disableAlpha />
                </PopoverContent>
              </Popover>
               <div className="h-10 w-24 rounded-md bg-background border"></div>
            </div>
        </div>
      </CardContent>
       <CardFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleResetTheme}>
                <Undo className="mr-2 h-4 w-4" /> Reset to Default
            </Button>
            <Button onClick={handleSaveTheme}>Save Theme</Button>
       </CardFooter>
    </Card>
  );
}
