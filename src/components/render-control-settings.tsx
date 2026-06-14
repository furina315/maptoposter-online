import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type PoiSource } from "@/lib/types";
import { Eye } from "lucide-react";
import * as m from "@/paraglide/messages";

interface RenderControlSettingsProps {
  showCoords: boolean;
  showCity: boolean;
  showCountry: boolean;
  poiSource: PoiSource;
  onShowCoordsChange: (val: boolean) => void;
  onShowCityChange: (val: boolean) => void;
  onShowCountryChange: (val: boolean) => void;
  onPoiSourceChange: (val: PoiSource) => void;
}

export function RenderControlSettings({
  showCoords,
  showCity,
  showCountry,
  poiSource,
  onShowCoordsChange,
  onShowCityChange,
  onShowCountryChange,
  onPoiSourceChange,
}: RenderControlSettingsProps) {
  // 文字元素 toggle 列表（现有功能）
  const textToggles = [
    { checked: showCity, onChange: onShowCityChange, label: m.toggle_show_city() },
    { checked: showCountry, onChange: onShowCountryChange, label: m.toggle_show_country() },
    { checked: showCoords, onChange: onShowCoordsChange, label: m.toggle_show_coords() },
  ];

  const poiSourceOptions: { value: PoiSource; label: string }[] = [
    { value: "off", label: m.poi_source_off() },
    { value: "overpass", label: m.poi_source_overpass() },
    { value: "custom", label: m.poi_source_custom() },
  ];

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-primary" />
        <h2 className="text-lg text-foreground">{m.render_control()}</h2>
      </div>
      <div className="flex flex-wrap gap-1">
        {textToggles.map(({ checked, onChange, label }) => (
          <label
            key={label}
            className="flex items-center gap-3 cursor-pointer py-1 px-1 hover:bg-secondary/30 rounded transition-colors"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
            />
            <span className="text-sm text-foreground select-none">{label}</span>
          </label>
        ))}
        <div className="mt-3 w-full space-y-2">
          <p className="px-1 text-xs uppercase tracking-wider text-muted-foreground">
            {m.toggle_show_pois()}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {poiSourceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPoiSourceChange(option.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  poiSource === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary/40"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] italic px-1 text-muted-foreground mt-2">
          {m.render_control_poi_hint()}
        </p>
      </div>
    </Card>
  );
}
