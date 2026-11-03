import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

const options = [
  { value: "light", label: "Light", Icon: Sun, description: "Light theme" },
  { value: "dark", label: "Dark", Icon: Moon, description: "Dark theme" },
  {
    value: "system",
    label: "Auto",
    Icon: Monitor,
    description: "Auto · Follow device theme",
  },
] as const;

export function ThemeSwitcher({
  labelled = false,
  label = "Theme",
}: {
  labelled?: boolean;
  label?: string;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={value => {
        if (value === "light" || value === "dark" || value === "system")
          setTheme(value);
      }}
      role="radiogroup"
      aria-label={label}
      className="theme-toggle"
      data-labels={labelled}
      size="sm"
      loop
    >
      {options.map(({ value, label, Icon, description }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              className="theme-option"
              value={value}
              aria-label={`${label} theme`}
            >
              <Icon size={16} aria-hidden="true" />
              {labelled && <span>{label}</span>}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {description}
          </TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
