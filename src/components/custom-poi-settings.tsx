import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPinned, Pin } from "lucide-react";
import * as m from "@/paraglide/messages";

interface CustomPOISettingsProps {
  customPoiCount: number;
  poiSourceLabel: string;
  onManageClick: () => void;
}

export function CustomPOISettings({
  customPoiCount,
  poiSourceLabel,
  onManageClick,
}: CustomPOISettingsProps) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Pin className="h-4 w-4 text-primary" />
        <h2 className="text-lg text-foreground">{m.custom_poi_nav_label()}</h2>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{m.custom_poi_section_description()}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <MapPinned className="h-4 w-4 text-primary" />
              <span>{m.custom_poi_added_count({ count: String(customPoiCount) })}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {m.custom_poi_current_source({ source: poiSourceLabel })}
            </p>
          </div>
          <Button type="button" onClick={onManageClick}>
            {m.custom_poi_manage_button()}
          </Button>
        </div>
      </div>
    </Card>
  );
}
